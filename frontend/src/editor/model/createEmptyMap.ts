import {
  DEFAULT_CELL_SIZE,
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  isMapDimension,
  MAX_MAP_SIZE,
} from '@/config/map.config'
import { MAP_VERSION } from './types'
import type { MapModel } from './types'

/**
 * Пустая векторная карта. Размеры по умолчанию — из config/map.config.ts,
 * чтобы габариты карты можно было менять в одном месте.
 */
export function createEmptyMap(
  width: number = DEFAULT_MAP_WIDTH,
  height: number = DEFAULT_MAP_HEIGHT,
  cellSize: number = DEFAULT_CELL_SIZE,
): MapModel {
  if (!isMapDimension(width)) {
    throw new RangeError(`Map width must be an integer in [1, ${MAX_MAP_SIZE}], got ${width}`)
  }
  if (!isMapDimension(height)) {
    throw new RangeError(`Map height must be an integer in [1, ${MAX_MAP_SIZE}], got ${height}`)
  }
  if (typeof cellSize !== 'number' || !Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError(`Cell size must be a positive number, got ${String(cellSize)}`)
  }

  return {
    version: MAP_VERSION,
    grid: { width, height, cellSize },
    regions: [],
    walls: [],
    doors: [],
    objects: [],
    lights: [],
  }
}
