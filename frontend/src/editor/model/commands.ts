import {
  findObjectById,
  footprintInBounds,
  isFootprintFree,
  isKnownKind,
  nextObjectId,
  objectFootprint,
} from './objects'
import { findLightById, isValidLightColor, isValidLightRadius, nextLightId } from './lights'
import {
  doorAtEdge,
  edgeKey,
  findDoorById,
  hasWall,
  isEdgeInBounds,
  nextDoorId,
  normalizeEdge,
} from './walls'
import type { Door, WallEdge } from './walls'
import { MAX_MAP_DIMENSION, TILE_TYPES } from './types'
import type { GridType, MapModel, ObjectRotation, ObjectScale, TileGrid, TileValue } from './types'
export interface TileUpdate {
  readonly x: number
  readonly y: number
  readonly tile: TileValue
}

export interface WallUpdate {
  readonly edge: WallEdge
  readonly present: boolean
}

export type Command =
  | { readonly kind: 'setTile'; readonly x: number; readonly y: number; readonly tile: TileValue }
  | { readonly kind: 'setTiles'; readonly updates: readonly TileUpdate[] }
  | {
      readonly kind: 'addObject'
      readonly x: number
      readonly y: number
      readonly kindId: string
      readonly rotation?: ObjectRotation
      readonly scale?: ObjectScale
    }
  | { readonly kind: 'moveObject'; readonly id: number; readonly x: number; readonly y: number }
  | { readonly kind: 'removeObject'; readonly id: number }
  | {
      readonly kind: 'replaceMap'
      readonly width: number
      readonly height: number
      readonly tiles: TileGrid | readonly TileValue[]
      readonly gridType?: GridType
    }
  | { readonly kind: 'setGridType'; readonly gridType: GridType }
  | { readonly kind: 'setWalls'; readonly updates: readonly WallUpdate[] }
  | { readonly kind: 'toggleWall'; readonly edge: WallEdge }
  | { readonly kind: 'addDoor'; readonly edge: WallEdge }
  | { readonly kind: 'removeDoor'; readonly id: number }
  | { readonly kind: 'setDoorOpen'; readonly id: number; readonly open: boolean }
  | {
      readonly kind: 'addLight'
      readonly x: number
      readonly y: number
      readonly radius: number
      readonly color: string
    }
  | { readonly kind: 'removeLight'; readonly id: number }

function assertValidUpdate(update: TileUpdate, model: MapModel): void {
  const { x, y, tile } = update
  if (!Number.isInteger(x) || x < 0 || x >= model.width) {
    throw new RangeError(`Tile x must be an integer in [0, ${model.width}), got ${x}`)
  }
  if (!Number.isInteger(y) || y < 0 || y >= model.height) {
    throw new RangeError(`Tile y must be an integer in [0, ${model.height}), got ${y}`)
  }
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_TYPES.length) {
    throw new RangeError(`Tile value must be an integer in [0, ${TILE_TYPES.length}), got ${tile}`)
  }
}

function assertInside(model: MapModel, x: number, y: number): void {
  if (!Number.isInteger(x) || x < 0 || x >= model.width) {
    throw new RangeError(`Cell x must be an integer in [0, ${model.width}), got ${x}`)
  }
  if (!Number.isInteger(y) || y < 0 || y >= model.height) {
    throw new RangeError(`Cell y must be an integer in [0, ${model.height}), got ${y}`)
  }
}

function applyTiles(model: MapModel, updates: readonly TileUpdate[]): MapModel {
  for (const update of updates) {
    assertValidUpdate(update, model)
  }

  // Copy-on-write: запись идентичного значения не считается изменением,
  // чтобы no-op штрихи кисти не создавали записи в истории.
  if (!updates.some(({ x, y, tile }) => model.tiles[y * model.width + x] !== tile)) {
    return model
  }

  const tiles = new Uint8Array(model.tiles)
  for (const { x, y, tile } of updates) {
    tiles[y * model.width + x] = tile
  }

  return { ...model, tiles }
}

function addObject(
  model: MapModel,
  x: number,
  y: number,
  kindId: string,
  rotation?: ObjectRotation,
  scale?: ObjectScale,
): MapModel {
  assertInside(model, x, y)
  if (!isKnownKind(kindId)) {
    throw new RangeError(`Unknown object kind: ${kindId}`)
  }
  const object: import('./types').MapObject = {
    id: nextObjectId(model.objects),
    kindId,
    x,
    y,
    ...(rotation !== undefined && { rotation }),
    ...(scale !== undefined && { scale }),
  }
  if (!footprintInBounds(object, model.width, model.height)) {
    throw new RangeError(`Object footprint [${x}..${x + (scale?.w ?? 1)}) × [${y}..${y + (scale?.h ?? 1)}) is out of bounds ${model.width}×${model.height}`)
  }
  const { w, h } = objectFootprint(object)
  if (!isFootprintFree(model.objects, x, y, w, h)) {
    throw new RangeError(`Object footprint at (${x}, ${y}) overlaps with another object`)
  }
  return { ...model, objects: [...model.objects, object] }
}

function moveObject(model: MapModel, id: number, x: number, y: number): MapModel {
  assertInside(model, x, y)
  const object = findObjectById(model.objects, id)
  if (!object) {
    throw new RangeError(`Object ${id} not found`)
  }
  if (object.x === x && object.y === y) {
    return model
  }
  const moved = { ...object, x, y }
  if (!footprintInBounds(moved, model.width, model.height)) {
    throw new RangeError(`Object footprint at (${x}, ${y}) is out of bounds`)
  }
  const { w, h } = objectFootprint(moved)
  const otherObjects = model.objects.filter((o) => o.id !== id)
  if (!isFootprintFree(otherObjects, x, y, w, h)) {
    throw new RangeError(`Object footprint at (${x}, ${y}) overlaps with another object`)
  }
  return {
    ...model,
    objects: model.objects.map((candidate) => (candidate.id === id ? moved : candidate)),
  }
}

function removeObject(model: MapModel, id: number): MapModel {
  const object = findObjectById(model.objects, id)
  if (!object) {
    throw new RangeError(`Object ${id} not found`)
  }
  return { ...model, objects: model.objects.filter((candidate) => candidate.id !== id) }
}

function tilesEqual(a: TileGrid, b: TileGrid): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Полная замена документа (результат генерации): одна запись истории —
 * undo возвращает прежнюю карту вместе с объектами. Объекты при замене
 * очищаются атомарно: их координаты не переживают смену размеров/сеток.
 */
function replaceMap(
  model: MapModel,
  width: number,
  height: number,
  tiles: TileGrid | readonly TileValue[],
  gridType: GridType,
): MapModel {
  if (!Number.isInteger(width) || width < 1 || width > MAX_MAP_DIMENSION) {
    throw new RangeError(`width must be an integer in [1, ${MAX_MAP_DIMENSION}], got ${width}`)
  }
  if (!Number.isInteger(height) || height < 1 || height > MAX_MAP_DIMENSION) {
    throw new RangeError(`height must be an integer in [1, ${MAX_MAP_DIMENSION}], got ${height}`)
  }
  // Принимаем и обычный массив, и Uint8Array от генератора.
  if (tiles == null || typeof tiles.length !== 'number' || tiles.length !== width * height) {
    throw new RangeError(`tiles must contain exactly ${width * height} values`)
  }
  for (const tile of tiles) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_TYPES.length) {
      throw new RangeError(
        `Tile value must be an integer in [0, ${TILE_TYPES.length}), got ${tile}`,
      )
    }
  }

  const nextTiles = Uint8Array.from(tiles)
  const identical =
    model.width === width &&
    model.height === height &&
    model.gridType === gridType &&
    model.objects.length === 0 &&
    model.walls.length === 0 &&
    model.doors.length === 0 &&
    model.lights.length === 0 &&
    tilesEqual(model.tiles, nextTiles)

  // No-op только при полностью идентичном документе: если сетка совпала,
  // но есть сущности — замена нужна, чтобы атомарно их убрать.
  if (identical) return model

  return {
    ...model,
    gridType,
    width,
    height,
    tiles: nextTiles,
    objects: [],
    walls: [],
    doors: [],
    lights: [],
  }
}

/** Смена типа сетки как метаданных: тайлы и объекты сохраняются. */
function setGridType(model: MapModel, gridType: GridType): MapModel {
  // Рёбра квадратной сетки не имеют смысла на гексах: пока есть
  // стены/двери/свет, смена сетки запрещена (UI дизейблит выбор).
  if (model.walls.length > 0 || model.doors.length > 0 || model.lights.length > 0) {
    return model
  }
  if (model.gridType === gridType) return model
  return { ...model, gridType }
}

function addLight(model: MapModel, x: number, y: number, radius: number, color: string): MapModel {
  assertInside(model, x, y)
  if (!isValidLightRadius(radius)) {
    throw new RangeError(`Light radius must be an integer in [1, 30], got ${String(radius)}`)
  }
  if (!isValidLightColor(color)) {
    throw new RangeError(`Light color must be a hex string like #ffdd88, got ${String(color)}`)
  }
  const light = { id: nextLightId(model.lights), x, y, radius, color }
  return { ...model, lights: [...model.lights, light] }
}

function removeLight(model: MapModel, id: number): MapModel {
  const light = findLightById(model.lights, id)
  if (!light) {
    throw new RangeError(`Light ${id} not found`)
  }
  return { ...model, lights: model.lights.filter((candidate) => candidate.id !== id) }
}

function assertValidEdge(edge: WallEdge, width: number, height: number): void {
  if (!isEdgeInBounds(edge, width, height)) {
    throw new RangeError(
      `Wall edge cell (${String(edge.x)}, ${String(edge.y)}) is out of bounds ${width}x${height}`,
    )
  }
}

/**
 * Пакетное изменение стен: одна запись истории на штрих кисти/ластика.
 * Входные рёбра принимаются в любой форме и нормализуются при коммите.
 * Снятие стены каскадно удаляет дверь на её ребре той же командой.
 */
function setWalls(model: MapModel, updates: readonly WallUpdate[]): MapModel {
  for (const { edge } of updates) {
    assertValidEdge(edge, model.width, model.height)
  }

  const wallsByKey = new Map(model.walls.map((wall) => [edgeKey(wall), wall]))
  const removedKeys = new Set<string>()
  let changed = false
  for (const { edge, present } of updates) {
    const canonical = normalizeEdge(edge, model.width, model.height)
    const key = edgeKey(canonical)
    const exists = wallsByKey.has(key)
    if (present && !exists) {
      wallsByKey.set(key, canonical)
      changed = true
    } else if (!present && exists) {
      wallsByKey.delete(key)
      removedKeys.add(key)
      changed = true
    }
  }
  if (!changed) return model

  // Каскад: двери снятых стен уходят той же командой (одна запись истории).
  const keptDoors = model.doors.filter((door) => !removedKeys.has(edgeKey(door.edge)))
  return {
    ...model,
    walls: [...wallsByKey.values()],
    doors: keptDoors,
  }
}

function addDoor(model: MapModel, edge: WallEdge): MapModel {
  assertValidEdge(edge, model.width, model.height)
  const canonical = normalizeEdge(edge, model.width, model.height)
  if (!hasWall(model.walls, canonical)) {
    throw new RangeError('A door can only be placed on an existing wall')
  }
  if (doorAtEdge(model.doors, canonical)) {
    throw new RangeError('This wall already has a door')
  }
  const door: Door = { id: nextDoorId(model.doors), edge: canonical, open: false }
  return { ...model, doors: [...model.doors, door] }
}

function removeDoor(model: MapModel, id: number): MapModel {
  const door = findDoorById(model.doors, id)
  if (!door) {
    throw new RangeError(`Door ${id} not found`)
  }
  return { ...model, doors: model.doors.filter((candidate) => candidate.id !== id) }
}

function setDoorOpen(model: MapModel, id: number, open: boolean): MapModel {
  const door = findDoorById(model.doors, id)
  if (!door) {
    throw new RangeError(`Door ${id} not found`)
  }
  if (door.open === open) return model
  return {
    ...model,
    doors: model.doors.map((candidate) =>
      candidate.id === id ? { ...candidate, open } : candidate,
    ),
  }
}

export function applyCommand(model: MapModel, command: Command): MapModel {
  switch (command.kind) {
    case 'setTile':
      return applyTiles(model, [{ x: command.x, y: command.y, tile: command.tile }])
    case 'setTiles':
      return applyTiles(model, command.updates)
    case 'addObject':
      return addObject(model, command.x, command.y, command.kindId, command.rotation, command.scale)
    case 'moveObject':
      return moveObject(model, command.id, command.x, command.y)
    case 'removeObject':
      return removeObject(model, command.id)
    case 'replaceMap':
      return replaceMap(
        model,
        command.width,
        command.height,
        command.tiles,
        command.gridType ?? 'square',
      )
    case 'setGridType':
      return setGridType(model, command.gridType)
    case 'setWalls':
      return setWalls(model, command.updates)
    case 'toggleWall': {
      const edge = normalizeEdge(command.edge, model.width, model.height)
      return setWalls(model, [{ edge, present: !hasWall(model.walls, edge) }])
    }
    case 'addDoor':
      return addDoor(model, command.edge)
    case 'removeDoor':
      return removeDoor(model, command.id)
    case 'setDoorOpen':
      return setDoorOpen(model, command.id, command.open)
    case 'addLight':
      return addLight(model, command.x, command.y, command.radius, command.color)
    case 'removeLight':
      return removeLight(model, command.id)
  }
}
