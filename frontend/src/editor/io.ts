import { isKnownKind } from './model/objects'
import { MAP_VERSION, MAX_MAP_DIMENSION, TILE_TYPES } from './model/types'
import type { MapModel, MapObject, TileValue } from './model/types'

/** Ошибка разбора файла карты: сообщение понятно пользователю без стека. */
export class MapLoadError extends Error {}

interface RawMapFile {
  version?: unknown
  gridType?: unknown
  width?: unknown
  height?: unknown
  tiles?: unknown
  objects?: unknown
}

function validateGridType(value: unknown): 'square' | 'hex-flat' | 'hex-pointy' {
  if (value !== 'square' && value !== 'hex-flat' && value !== 'hex-pointy') {
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
  return JSON.stringify(
    {
      version: model.version,
      gridType: model.gridType,
      width: model.width,
      height: model.height,
      tiles: Array.from(model.tiles),
      objects: model.objects.map((object) => ({ ...object })),
    },
    null,
    2,
  )
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
  if (raw.version !== 1 && raw.version !== 2) {
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

  return {
    version: MAP_VERSION,
    gridType,
    width,
    height,
    tiles: Uint8Array.from(raw.tiles as TileValue[]),
    objects,
  }
}
