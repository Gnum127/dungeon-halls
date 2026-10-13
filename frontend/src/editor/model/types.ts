import type { TerrainRegion } from './regions'
import type { WallSegment } from './wallSegments'
import type { Door } from './doors'
import type { MapLight } from './lights'

export { TILE_TYPES, MAX_MAP_DIMENSION } from '@/shared/tiles'
export type { TileTypeName } from '@/shared/tiles'
export type { TerrainRegion } from './regions'
export type { WallExtends, WallSegment } from './wallSegments'
export type { Door } from './doors'
export type { MapLight } from './lights'

/** Версия векторной модели карты. Пишем/читаем только её (миграций нет). */
export const MAP_VERSION = 5

export type ObjectRotation = 0 | 90 | 180 | 270

export interface ObjectScale {
  readonly w: number
  readonly h: number
}

/**
 * Объект карты; footprint определяется scale (по умолчанию 1×1).
 * Rotation — косметическое свойство, влияет только на рендер, НЕ на footprint.
 */
export interface MapObject {
  readonly id: number
  readonly kindId: string
  readonly x: number
  readonly y: number
  readonly rotation?: ObjectRotation
  readonly scale?: ObjectScale
}

/** Сетка карты: размеры в клетках и размер клетки в пикселях. */
export interface MapGrid {
  readonly width: number
  readonly height: number
  readonly cellSize: number
}

/**
 * Векторная модель карты (v5). Покрытие — регионы-полигоны, границы —
 * стеновые сегменты с телом, двери — на сегментах. Объекты и свет остаются
 * клеточными и опираются на grid.
 */
export interface MapModel {
  readonly version: typeof MAP_VERSION
  readonly grid: MapGrid
  readonly regions: readonly TerrainRegion[]
  readonly walls: readonly WallSegment[]
  readonly doors: readonly Door[]
  readonly objects: readonly MapObject[]
  readonly lights: readonly MapLight[]
}
