import { findObjectById, footprintInBounds, isKnownKind, nextObjectId } from './objects'
import { findLightById, isValidLightColor, isValidLightRadius, nextLightId } from './lights'
import { assertValidRegion, nextZOrder } from './regions'
import { isAutoWallSegmentId } from './autoWalls'
import { assertValidWallSegment } from './wallSegments'
import { assertValidDoor, createDoor, findDoorById } from './doors'
import { assertValidStairsPolygon, createStairsPolygon } from './stairs'
import { isMapDimension } from '@/config/map.config'
import { MAP_VERSION } from './types'
import type { MapGrid, MapModel } from './types'
import type { TerrainRegion } from './regions'
import type { WallSegment } from './wallSegments'
import type { Door } from './doors'
import type { StairsPolygon } from './stairs'
import type { MapLight } from './lights'
import type { MapObject, ObjectRotation, ObjectScale } from './types'
import type { Point } from '@/shared/point'

/** Пакетное изменение стен: present=true — добавить/обновить, false — снять. */
export interface WallUpdate {
  readonly segment: WallSegment
  readonly present: boolean
}

/**
 * Полная замена документа (результат генерации/загрузки): атомарно заменяет
 * сетку, регионы, стены, двери, лестницы, объекты и свет; одна запись истории.
 */
export interface MapSnapshot {
  readonly grid: MapGrid
  readonly regions: readonly TerrainRegion[]
  readonly walls: readonly WallSegment[]
  readonly doors: readonly Door[]
  readonly stairs: readonly StairsPolygon[]
  readonly objects: readonly MapObject[]
  readonly lights: readonly MapLight[]
}

export type Command =
  | { readonly kind: 'addRegion'; readonly region: TerrainRegion }
  | { readonly kind: 'removeRegion'; readonly id: string }
  | {
      readonly kind: 'addRegionWithWalls'
      readonly region: TerrainRegion
      readonly walls: readonly WallSegment[]
    }
  | { readonly kind: 'setWalls'; readonly updates: readonly WallUpdate[] }
  | {
      readonly kind: 'addDoor'
      readonly a: Point
      readonly b: Point
      readonly imageId?: string | null
    }
  | { readonly kind: 'removeDoor'; readonly id: string }
  | { readonly kind: 'addStairs'; readonly polygon: readonly Point[] }
  | { readonly kind: 'removeStairs'; readonly id: string }
  | {
      readonly kind: 'addObject'
      readonly x: number
      readonly y: number
      readonly kindId: string
      readonly rotation?: ObjectRotation
      readonly scale?: ObjectScale
      readonly imageId?: string | null
    }
  | { readonly kind: 'moveObject'; readonly id: number; readonly x: number; readonly y: number }
  | { readonly kind: 'removeObject'; readonly id: number }
  | {
      readonly kind: 'setObjectImage'
      readonly id: number
      /** Строка — ассет, `null` — «без текстуры», `undefined` — «по умолчанию». */
      readonly imageId: string | null | undefined
    }
  | {
      readonly kind: 'setObjectScale'
      readonly id: number
      readonly scale: ObjectScale
    }
  | {
      readonly kind: 'setObjectRotation'
      readonly id: number
      readonly rotation: ObjectRotation
    }
  | {
      readonly kind: 'setObjectBounds'
      readonly id: number
      readonly x: number
      readonly y: number
      readonly scale: ObjectScale
    }
  | { readonly kind: 'setDoorImage'; readonly id: string; readonly imageId: string | null }
  | {
      readonly kind: 'addLight'
      readonly x: number
      readonly y: number
      readonly radius: number
      readonly color: string
    }
  | { readonly kind: 'removeLight'; readonly id: number }
  | { readonly kind: 'replaceMap'; readonly snapshot: MapSnapshot }

// --- Клонирование (модель не должна делить ссылки со входными данными) ---

function cloneRegion(region: TerrainRegion): TerrainRegion {
  return {
    id: region.id,
    tileType: region.tileType,
    polygon: region.polygon.map((point) => ({ x: point.x, y: point.y })),
    zOrder: region.zOrder,
  }
}

function cloneWall(wall: WallSegment): WallSegment {
  return {
    id: wall.id,
    points: wall.points.map((point) => ({ x: point.x, y: point.y })),
    extends: wall.extends,
    thickness: wall.thickness,
  }
}

function cloneDoor(door: Door): Door {
  return {
    id: door.id,
    a: { x: door.a.x, y: door.a.y },
    b: { x: door.b.x, y: door.b.y },
    imageId: door.imageId,
  }
}

function cloneStairs(stairs: StairsPolygon): StairsPolygon {
  return { id: stairs.id, polygon: stairs.polygon.map((p) => ({ x: p.x, y: p.y })) }
}

function cloneObject(object: MapObject): MapObject {
  return { ...object, ...(object.scale !== undefined && { scale: { ...object.scale } }) }
}

function cloneLight(light: MapLight): MapLight {
  return { ...light }
}

// --- Валидация ---

function assertCellInside(model: MapModel, x: number, y: number): void {
  if (!Number.isInteger(x) || x < 0 || x >= model.grid.width) {
    throw new RangeError(`Cell x must be an integer in [0, ${model.grid.width}), got ${x}`)
  }
  if (!Number.isInteger(y) || y < 0 || y >= model.grid.height) {
    throw new RangeError(`Cell y must be an integer in [0, ${model.grid.height}), got ${y}`)
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  if (a && b && typeof a === 'object') {
    const left = a as Record<string, unknown>
    const right = b as Record<string, unknown>
    const leftKeys = Object.keys(left)
    if (leftKeys.length !== Object.keys(right).length) return false
    return leftKeys.every((key) => deepEqual(left[key], right[key]))
  }
  return false
}

function assertUniqueIds(items: readonly { readonly id: string }[], label: string): void {
  const seen = new Set<string>()
  for (const item of items) {
    if (typeof item.id !== 'string' || item.id.length === 0) {
      throw new RangeError(`${label} id must be a non-empty string`)
    }
    if (seen.has(item.id)) {
      throw new RangeError(`Duplicate ${label} id: ${item.id}`)
    }
    seen.add(item.id)
  }
}

function assertValidObject(object: MapObject): void {
  if (!Number.isInteger(object.id) || object.id < 1) {
    throw new RangeError(`Object id must be a positive integer, got ${String(object.id)}`)
  }
  if (!isKnownKind(object.kindId)) {
    throw new RangeError(`Unknown object kind: ${object.kindId}`)
  }
  if (object.rotation !== undefined && ![0, 90, 180, 270].includes(object.rotation)) {
    throw new RangeError(`Invalid object rotation: ${String(object.rotation)}`)
  }
  if (object.scale !== undefined) {
    const { w, h } = object.scale
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
      throw new RangeError('Object scale must be integers >= 1')
    }
  }
  if (
    object.imageId !== undefined &&
    object.imageId !== null &&
    (typeof object.imageId !== 'string' || object.imageId.length === 0)
  ) {
    throw new RangeError('Object imageId must be null or a non-empty string')
  }
  if (!footprintInBounds(object)) {
    throw new RangeError(`Object ${object.id} origin is outside the map`)
  }
}

function assertValidLight(light: MapLight, grid: MapGrid): void {
  if (!Number.isInteger(light.id) || light.id < 1) {
    throw new RangeError(`Light id must be a positive integer, got ${String(light.id)}`)
  }
  if (
    !Number.isInteger(light.x) ||
    !Number.isInteger(light.y) ||
    light.x < 0 ||
    light.y < 0 ||
    light.x >= grid.width ||
    light.y >= grid.height
  ) {
    throw new RangeError(`Light (${light.x}, ${light.y}) is out of grid bounds`)
  }
  if (!isValidLightRadius(light.radius)) {
    throw new RangeError(`Light radius must be an integer in [1, 30], got ${String(light.radius)}`)
  }
  if (!isValidLightColor(light.color)) {
    throw new RangeError(`Light color must be hex, got ${String(light.color)}`)
  }
}

/** Полная проверка снапшота: grid + все коллекции + их инварианты. */
function validateSnapshot(snapshot: MapSnapshot): void {
  const { grid } = snapshot
  if (!isMapDimension(grid.width) || !isMapDimension(grid.height)) {
    throw new RangeError(`Snapshot grid size must be in [1, max], got ${grid.width}×${grid.height}`)
  }
  if (typeof grid.cellSize !== 'number' || !Number.isFinite(grid.cellSize) || grid.cellSize <= 0) {
    throw new RangeError(
      `Snapshot cell size must be a positive number, got ${String(grid.cellSize)}`,
    )
  }

  assertUniqueIds(snapshot.regions, 'region')
  assertUniqueIds(snapshot.walls, 'wall')
  assertUniqueIds(snapshot.doors, 'door')
  assertUniqueIds(snapshot.stairs, 'stairs')
  assertUniqueIdsObjects(snapshot.objects)
  assertUniqueIdsLights(snapshot.lights)

  for (const region of snapshot.regions) {
    assertValidRegion(region)
  }
  for (const wall of snapshot.walls) {
    assertValidWallSegment(wall)
  }
  for (const door of snapshot.doors) {
    assertValidDoor(door)
  }
  for (const stairs of snapshot.stairs) {
    assertValidStairsPolygon(stairs)
  }

  for (const object of snapshot.objects) {
    assertValidObject(object)
  }
  for (const light of snapshot.lights) {
    assertValidLight(light, grid)
  }
}

function assertUniqueIdsObjects(objects: readonly MapObject[]): void {
  const seen = new Set<number>()
  for (const object of objects) {
    if (seen.has(object.id)) throw new RangeError(`Duplicate object id: ${object.id}`)
    seen.add(object.id)
  }
}

function assertUniqueIdsLights(lights: readonly MapLight[]): void {
  const seen = new Set<number>()
  for (const light of lights) {
    if (seen.has(light.id)) throw new RangeError(`Duplicate light id: ${light.id}`)
    seen.add(light.id)
  }
}

// --- Команды ---

/** Добавляет регион поверх всех: zOrder пересчитывается (последний — сверху). */
function addRegion(model: MapModel, region: TerrainRegion): MapModel {
  assertValidRegion(region)
  if (model.regions.some((candidate) => candidate.id === region.id)) {
    throw new RangeError(`Region with id ${region.id} already exists`)
  }
  const placed: TerrainRegion = { ...cloneRegion(region), zOrder: nextZOrder(model.regions) }
  return { ...model, regions: [...model.regions, placed] }
}

function removeRegion(model: MapModel, id: string): MapModel {
  const next = model.regions.filter((region) => region.id !== id)
  if (next.length === model.regions.length) return model
  return { ...model, regions: next }
}

/**
 * Пересобирает слой авто-стен: ручные стены сохраняются, авто-стены заменяются.
 * Двери теперь самостоятельные сущности (не привязаны к стене), поэтому
 * пересборка стен их НЕ трогает.
 */
function replaceWallLayer(model: MapModel, walls: readonly WallSegment[]): MapModel {
  const manual = model.walls.filter((wall) => !isAutoWallSegmentId(wall.id))
  const merged = [...manual, ...walls.map(cloneWall)]
  return { ...model, walls: merged }
}

/**
 * Атомарно добавляет регион и пересчитывает слой авто-стен одной записью
 * истории (undo возвращает и регион, и прежние стены).
 */
function addRegionWithWalls(
  model: MapModel,
  region: TerrainRegion,
  walls: readonly WallSegment[],
): MapModel {
  return replaceWallLayer(addRegion(model, region), walls)
}

/**
 * Set-семантика по id: present=true — добавить или обновить сегмент (в т.ч.
 * геометрию/толщину), false — снять. Двери независимы от стен — не каскадят.
 */
function setWalls(model: MapModel, updates: readonly WallUpdate[]): MapModel {
  const wallsById = new Map(model.walls.map((wall) => [wall.id, wall]))
  let changed = false
  for (const { segment, present } of updates) {
    if (present) {
      assertValidWallSegment(segment)
      const existing = wallsById.get(segment.id)
      if (!existing || !deepEqual(existing, segment)) {
        wallsById.set(segment.id, cloneWall(segment))
        changed = true
      }
    } else if (wallsById.has(segment.id)) {
      wallsById.delete(segment.id)
      changed = true
    }
  }
  if (!changed) return model

  return { ...model, walls: [...wallsById.values()] }
}

function addDoor(model: MapModel, a: Point, b: Point, imageId: string | null): MapModel {
  const door = createDoor(a, b, { imageId })
  return { ...model, doors: [...model.doors, door] }
}

function removeDoor(model: MapModel, id: string): MapModel {
  if (!findDoorById(model.doors, id)) {
    throw new RangeError(`Door ${id} not found`)
  }
  return { ...model, doors: model.doors.filter((door) => door.id !== id) }
}

function addStairs(model: MapModel, polygon: readonly Point[]): MapModel {
  const stairs = createStairsPolygon(polygon)
  return { ...model, stairs: [...model.stairs, stairs] }
}

function removeStairs(model: MapModel, id: string): MapModel {
  const next = model.stairs.filter((stairs) => stairs.id !== id)
  if (next.length === model.stairs.length) return model
  return { ...model, stairs: next }
}

function addObject(
  model: MapModel,
  x: number,
  y: number,
  kindId: string,
  rotation?: ObjectRotation,
  scale?: ObjectScale,
  imageId?: string | null,
): MapModel {
  if (!isKnownKind(kindId)) {
    throw new RangeError(`Unknown object kind: ${kindId}`)
  }
  const object: MapObject = {
    id: nextObjectId(model.objects),
    kindId,
    x,
    y,
    ...(rotation !== undefined && { rotation }),
    ...(scale !== undefined && { scale }),
    ...(imageId !== undefined && { imageId }),
  }
  if (!footprintInBounds(object)) {
    throw new RangeError(`Object origin (${x}, ${y}) is out of bounds`)
  }
  // Коллизии убраны (этап 28): объекты можно ставить вплотную/внахлёст.
  return { ...model, objects: [...model.objects, cloneObject(object)] }
}

function moveObject(model: MapModel, id: number, x: number, y: number): MapModel {
  const object = findObjectById(model.objects, id)
  if (!object) {
    throw new RangeError(`Object ${id} not found`)
  }
  if (object.x === x && object.y === y) {
    return model
  }
  const moved = { ...object, x, y }
  if (!footprintInBounds(moved)) {
    throw new RangeError(`Object origin (${x}, ${y}) is out of bounds`)
  }
  return {
    ...model,
    objects: model.objects.map((candidate) => (candidate.id === id ? moved : candidate)),
  }
}

function removeObject(model: MapModel, id: number): MapModel {
  if (!findObjectById(model.objects, id)) {
    throw new RangeError(`Object ${id} not found`)
  }
  return { ...model, objects: model.objects.filter((candidate) => candidate.id !== id) }
}

/** Обновляет объект по id, если есть изменения (иначе no-op — история не пишется). */
function updateObject(
  model: MapModel,
  id: number,
  patch: Partial<Pick<MapObject, 'imageId' | 'scale' | 'rotation' | 'x' | 'y'>>,
): MapModel {
  const object = findObjectById(model.objects, id)
  if (!object) {
    throw new RangeError(`Object ${id} not found`)
  }
  const next: MapObject = { ...object, ...patch }
  if (next.scale !== undefined) {
    const { w, h } = next.scale
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
      throw new RangeError('Object scale must be integers >= 1')
    }
  }
  if (next.rotation !== undefined && ![0, 90, 180, 270].includes(next.rotation)) {
    throw new RangeError(`Invalid object rotation: ${String(next.rotation)}`)
  }
  if (
    next.imageId !== undefined &&
    next.imageId !== null &&
    (typeof next.imageId !== 'string' || next.imageId.length === 0)
  ) {
    throw new RangeError('Object imageId must be null or a non-empty string')
  }
  if (!footprintInBounds(next)) {
    throw new RangeError(`Object origin (${next.x}, ${next.y}) is out of bounds`)
  }
  if (deepEqual(object, next)) return model
  return {
    ...model,
    objects: model.objects.map((candidate) => (candidate.id === id ? next : candidate)),
  }
}

/**
 * Меняет изображение экземпляра: строка — конкретный ассет, `null` — явно
 * «без текстуры» (свотч), `undefined` — «по умолчанию» (свойство снимается,
 * рендер идёт по `objectTextures` → `defaultImage`). no-op без записи истории.
 */
function setObjectImage(model: MapModel, id: number, imageId: string | null | undefined): MapModel {
  const object = findObjectById(model.objects, id)
  if (!object) {
    throw new RangeError(`Object ${id} not found`)
  }
  if (
    imageId !== undefined &&
    imageId !== null &&
    (typeof imageId !== 'string' || imageId.length === 0)
  ) {
    throw new RangeError('Object imageId must be undefined, null or a non-empty string')
  }
  if (object.imageId === imageId) return model
  const { imageId: _previous, ...rest } = object
  const next: MapObject = imageId === undefined ? rest : { ...rest, imageId }
  return {
    ...model,
    objects: model.objects.map((candidate) => (candidate.id === id ? next : candidate)),
  }
}

function setDoorImage(model: MapModel, id: string, imageId: string | null): MapModel {
  const door = findDoorById(model.doors, id)
  if (!door) {
    throw new RangeError(`Door ${id} not found`)
  }
  if (imageId !== null && (typeof imageId !== 'string' || imageId.length === 0)) {
    throw new RangeError('Door imageId must be null or a non-empty string')
  }
  if (door.imageId === imageId) return model
  return {
    ...model,
    doors: model.doors.map((candidate) =>
      candidate.id === id ? { ...candidate, imageId } : candidate,
    ),
  }
}

function addLight(model: MapModel, x: number, y: number, radius: number, color: string): MapModel {
  assertCellInside(model, x, y)
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
  if (!findLightById(model.lights, id)) {
    throw new RangeError(`Light ${id} not found`)
  }
  return { ...model, lights: model.lights.filter((light) => light.id !== id) }
}

function replaceMap(model: MapModel, snapshot: MapSnapshot): MapModel {
  validateSnapshot(snapshot)

  const identical =
    model.grid.width === snapshot.grid.width &&
    model.grid.height === snapshot.grid.height &&
    model.grid.cellSize === snapshot.grid.cellSize &&
    deepEqual(model.regions, snapshot.regions) &&
    deepEqual(model.walls, snapshot.walls) &&
    deepEqual(model.doors, snapshot.doors) &&
    deepEqual(model.stairs, snapshot.stairs) &&
    deepEqual(model.objects, snapshot.objects) &&
    deepEqual(model.lights, snapshot.lights)
  if (identical) return model

  return {
    version: MAP_VERSION,
    grid: { ...snapshot.grid },
    regions: snapshot.regions.map(cloneRegion),
    walls: snapshot.walls.map(cloneWall),
    doors: snapshot.doors.map(cloneDoor),
    stairs: snapshot.stairs.map(cloneStairs),
    objects: snapshot.objects.map(cloneObject),
    lights: snapshot.lights.map(cloneLight),
  }
}

export function applyCommand(model: MapModel, command: Command): MapModel {
  switch (command.kind) {
    case 'addRegion':
      return addRegion(model, command.region)
    case 'removeRegion':
      return removeRegion(model, command.id)
    case 'addRegionWithWalls':
      return addRegionWithWalls(model, command.region, command.walls)
    case 'setWalls':
      return setWalls(model, command.updates)
    case 'addDoor':
      return addDoor(model, command.a, command.b, command.imageId ?? null)
    case 'removeDoor':
      return removeDoor(model, command.id)
    case 'addStairs':
      return addStairs(model, command.polygon)
    case 'removeStairs':
      return removeStairs(model, command.id)
    case 'addObject':
      return addObject(
        model,
        command.x,
        command.y,
        command.kindId,
        command.rotation,
        command.scale,
        command.imageId,
      )
    case 'moveObject':
      return moveObject(model, command.id, command.x, command.y)
    case 'removeObject':
      return removeObject(model, command.id)
    case 'setObjectImage':
      return setObjectImage(model, command.id, command.imageId)
    case 'setObjectScale':
      return updateObject(model, command.id, { scale: command.scale })
    case 'setObjectRotation':
      return updateObject(model, command.id, { rotation: command.rotation })
    case 'setObjectBounds':
      return updateObject(model, command.id, {
        x: command.x,
        y: command.y,
        scale: command.scale,
      })
    case 'setDoorImage':
      return setDoorImage(model, command.id, command.imageId)
    case 'addLight':
      return addLight(model, command.x, command.y, command.radius, command.color)
    case 'removeLight':
      return removeLight(model, command.id)
    case 'replaceMap':
      return replaceMap(model, command.snapshot)
  }
}
