import { isGridType } from '@/shared/tiles'
import { isKnownKind } from './model/objects'
import { isValidLightColor, isValidLightRadius } from './model/lights'
import type { MapLight } from './model/lights'
import { MAP_VERSION, MAX_MAP_DIMENSION, TILE_TYPES } from './model/types'
import type { MapModel, MapObject, TileValue } from './model/types'
import { edgeKey, hasWall, isCanonical, isWallSide } from './model/walls'
import type { Door, WallEdge } from './model/walls'

/** Ошибка разбора файла карты: сообщение понятно пользователю без стека. */
export class MapLoadError extends Error {}

interface RawMapFile {
  version?: unknown
  gridType?: unknown
  width?: unknown
  height?: unknown
  tiles?: unknown
  objects?: unknown
  walls?: unknown
  doors?: unknown
  lights?: unknown
}

function validateGridType(value: unknown): 'square' | 'hex-flat' | 'hex-pointy' {
  if (!isGridType(value)) {
    throw new MapLoadError(`Unknown gridType: ${String(value)}`)
  }
  return value
}

function assertIntInRange(
  value: unknown,
  name: string,
  min: number,
  maxExclusive: number,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value >= maxExclusive
  ) {
    throw new MapLoadError(
      `${name} must be an integer in [${min}, ${maxExclusive}), got ${String(value)}`,
    )
  }
}

/**
 * Сериализует модель в JSON-файл проекта. Uint8Array конвертируется явно:
 * напрямую он в JSON не сериализуется.
 */
export function serializeMap(model: MapModel): string {
  return JSON.stringify({
    version: model.version,
    gridType: model.gridType,
    width: model.width,
    height: model.height,
    tiles: Array.from(model.tiles),
    objects: model.objects.map((object) => ({ ...object })),
    walls: model.walls.map((wall) => ({ ...wall })),
    doors: model.doors.map((door) => ({
      id: door.id,
      edge: { ...door.edge },
      open: door.open,
    })),
    lights: model.lights.map((light) => ({ ...light })),
  })
}

/**
 * Разбирает файл карты: строгая валидация схемы + миграции по полю version.
 * Битый или чужой файл никогда не даёт частично заполненную модель.
 */
export function deserializeMap(json: string): MapModel {
  let raw: RawMapFile
  try {
    raw = JSON.parse(json) as RawMapFile
  } catch {
    throw new MapLoadError('File is not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new MapLoadError('Map file must contain a JSON object')
  }
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== 3) {
    throw new MapLoadError(
      `Unsupported map version: ${String(raw.version)}, supported: 1–${MAP_VERSION}`,
    )
  }

  // Миграция v1 → v2: добавляется gridType, старые карты — квадратные.
  const gridType = raw.version === 1 ? 'square' : validateGridType(raw.gridType)

  assertIntInRange(raw.width, 'width', 1, MAX_MAP_DIMENSION + 1)
  assertIntInRange(raw.height, 'height', 1, MAX_MAP_DIMENSION + 1)
  const width = raw.width
  const height = raw.height

  if (!Array.isArray(raw.tiles) || raw.tiles.length !== width * height) {
    throw new MapLoadError(`tiles must be an array of exactly ${width * height} values`)
  }
  for (const tile of raw.tiles) {
    assertIntInRange(tile, 'tile value', 0, TILE_TYPES.length)
  }

  if (!Array.isArray(raw.objects)) {
    throw new MapLoadError('objects must be an array')
  }
  const objects: MapObject[] = []
  const seenIds = new Set<number>()
  const seenCells = new Set<string>()
  for (const candidate of raw.objects) {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new MapLoadError('Every object must be a JSON object')
    }
    const { id, kindId, x, y } = candidate as Record<string, unknown>
    assertIntInRange(id, 'object id', 1, Number.MAX_SAFE_INTEGER)
    if (seenIds.has(id)) throw new MapLoadError(`Duplicate object id: ${id}`)
    seenIds.add(id)
    if (typeof kindId !== 'string' || !isKnownKind(kindId)) {
      throw new MapLoadError(`Unknown object kind: ${String(kindId)}`)
    }
    assertIntInRange(x, 'object x', 0, width)
    assertIntInRange(y, 'object y', 0, height)
    const cellKey = `${x},${y}`
    if (seenCells.has(cellKey)) throw new MapLoadError(`Duplicate cell for objects: ${cellKey}`)
    seenCells.add(cellKey)
    objects.push({ id, kindId, x, y })
  }

  // walls/doors/lights появились в v3; старые версии мигрируют пустыми коллекциями.
  let walls: WallEdge[] = []
  let doors: Door[] = []
  let lights: MapLight[] = []
  if (raw.version === 3) {
    // Стены-рёбра определены только для квадратной сетки (MVP этапа 5);
    // команды такую модель создать не позволяют — файл тоже отклоняем.
    const hasWalls = Array.isArray(raw.walls) && raw.walls.length > 0
    const hasDoors = Array.isArray(raw.doors) && raw.doors.length > 0
    if (gridType !== 'square' && (hasWalls || hasDoors)) {
      throw new MapLoadError('Walls and doors are only supported on square grids')
    }
    if (!Array.isArray(raw.walls)) {
      throw new MapLoadError('walls must be an array')
    }
    const seenEdges = new Set<string>()
    for (const candidate of raw.walls) {
      if (typeof candidate !== 'object' || candidate === null) {
        throw new MapLoadError('Every wall must be a JSON object')
      }
      const { x, y, side } = candidate as Record<string, unknown>
      assertIntInRange(x, 'wall x', 0, width)
      assertIntInRange(y, 'wall y', 0, height)
      if (!isWallSide(side)) {
        throw new MapLoadError(`Unknown wall side: ${String(side)}`)
      }
      const edge: WallEdge = { x, y, side }
      if (!isCanonical(edge, width, height)) {
        throw new MapLoadError(
          `Non-canonical wall edge: ${x},${y},${side} (E/S must point at the last cell)`,
        )
      }
      const key = edgeKey(edge)
      if (seenEdges.has(key)) throw new MapLoadError(`Duplicate wall edge: ${key}`)
      seenEdges.add(key)
      walls.push(edge)
    }

    if (!Array.isArray(raw.doors)) {
      throw new MapLoadError('doors must be an array')
    }
    const seenDoorIds = new Set<number>()
    const seenDoorEdges = new Set<string>()
    for (const candidate of raw.doors) {
      if (typeof candidate !== 'object' || candidate === null) {
        throw new MapLoadError('Every door must be a JSON object')
      }
      const { id, edge, open } = candidate as Record<string, unknown>
      assertIntInRange(id, 'door id', 1, Number.MAX_SAFE_INTEGER)
      if (seenDoorIds.has(id)) throw new MapLoadError(`Duplicate door id: ${id}`)
      seenDoorIds.add(id)
      if (typeof open !== 'boolean') {
        throw new MapLoadError('Door open must be a boolean')
      }
      if (typeof edge !== 'object' || edge === null || Array.isArray(edge)) {
        throw new MapLoadError('Door edge must be a JSON object')
      }
      const { x, y, side } = edge as Record<string, unknown>
      assertIntInRange(x, 'door edge x', 0, width)
      assertIntInRange(y, 'door edge y', 0, height)
      if (!isWallSide(side)) {
        throw new MapLoadError(`Unknown door edge side: ${String(side)}`)
      }
      const doorEdge: WallEdge = { x, y, side }
      if (!isCanonical(doorEdge, width, height)) {
        throw new MapLoadError(`Non-canonical door edge: ${x},${y},${String(side)}`)
      }
      if (!hasWall(walls, doorEdge)) {
        throw new MapLoadError('Every door must be placed on an existing wall')
      }
      const doorKey = edgeKey(doorEdge)
      // Инвариант «одна дверь на ребро» — тот же, что гарантируют команды.
      if (seenDoorEdges.has(doorKey)) {
        throw new MapLoadError(`Duplicate door edge: ${doorKey}`)
      }
      seenDoorEdges.add(doorKey)
      doors.push({ id, edge: doorEdge, open })
    }

    // lights: необязательная секция v3 (ранние v3-файлы писались без неё).
    if (raw.lights !== undefined) {
      if (!Array.isArray(raw.lights)) {
        throw new MapLoadError('lights must be an array')
      }
      const seenLightIds = new Set<number>()
      for (const candidate of raw.lights) {
        if (typeof candidate !== 'object' || candidate === null) {
          throw new MapLoadError('Every light must be a JSON object')
        }
        const { id, x, y, radius, color } = candidate as Record<string, unknown>
        assertIntInRange(id, 'light id', 1, Number.MAX_SAFE_INTEGER)
        if (seenLightIds.has(id)) throw new MapLoadError(`Duplicate light id: ${id}`)
        seenLightIds.add(id)
        assertIntInRange(x, 'light x', 0, width)
        assertIntInRange(y, 'light y', 0, height)
        if (!isValidLightRadius(radius)) {
          throw new MapLoadError(
            `Light radius must be an integer in [1, 30], got ${String(radius)}`,
          )
        }
        if (!isValidLightColor(color)) {
          throw new MapLoadError(`Light color must be hex, got ${String(color)}`)
        }
        lights.push({ id, x, y, radius, color })
      }
    }
  }

  return {
    version: MAP_VERSION,
    gridType,
    width,
    height,
    tiles: Uint8Array.from(raw.tiles as TileValue[]),
    objects,
    walls,
    doors,
    lights,
  }
}
