import type { TileGrid } from '@/shared/tiles'
import type { Door, WallEdge } from './walls'
import type { MapLight } from './lights'

export { EMPTY_TILE, MAX_MAP_DIMENSION, TILE_TYPES } from '@/shared/tiles'
export { GRID_TYPES, isGridType } from '@/shared/tiles'
export type { GridType, TileGrid, TileTypeName, TileValue } from '@/shared/tiles'

export const MAP_VERSION = 4

export type ObjectRotation = 0 | 90 | 180 | 270

export interface ObjectScale {
  readonly w: number
  readonly h: number
}

/** Объект карты; footprint определяется scale (по умолчанию 1×1). */
export interface MapObject {
  readonly id: number
  readonly kindId: string
  readonly x: number
  readonly y: number
  readonly rotation?: ObjectRotation
  readonly scale?: ObjectScale
}

export interface MapModel {
  readonly version: typeof MAP_VERSION
  /** Тип сетки; влияет на геометрию клеток и рендер. */
  readonly gridType: 'square' | 'hex-flat' | 'hex-pointy'
  readonly width: number
  readonly height: number
  readonly tiles: TileGrid
  readonly objects: readonly MapObject[]
  /** Стены-рёбра и двери на них — только для square (MVP этапа 5). */
  readonly walls: readonly WallEdge[]
  readonly doors: readonly Door[]
  /** Источники света для VTT-экспорта; физика считается платформой. */
  readonly lights: readonly MapLight[]
}
