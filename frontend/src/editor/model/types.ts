import type { TileGrid } from '@/shared/tiles'

export { EMPTY_TILE, MAX_MAP_DIMENSION, TILE_TYPES } from '@/shared/tiles'
export { GRID_TYPES, isGridType } from '@/shared/tiles'
export type { GridType, TileGrid, TileTypeName, TileValue } from '@/shared/tiles'

export const MAP_VERSION = 2

/** Объект карты занимает одну клетку; каталог видов появляется в пункте 1.8. */
export interface MapObject {
  readonly id: number
  readonly kindId: string
  readonly x: number
  readonly y: number
}

export interface MapModel {
  readonly version: typeof MAP_VERSION
  /** Тип сетки; влияет на геометрию клеток и рендер. */
  readonly gridType: 'square' | 'hex-flat' | 'hex-pointy'
  readonly width: number
  readonly height: number
  readonly tiles: TileGrid
  readonly objects: readonly MapObject[]
}
