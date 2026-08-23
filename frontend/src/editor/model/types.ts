export const MAP_VERSION = 1

export const MAX_MAP_DIMENSION = 300

/**
 * Пустая клетка. Значение тайла — индекс в TILE_TYPES, поэтому порядок
 * элементов палитры менять нельзя: он неявно хранится в сохранённых картах.
 */
export const EMPTY_TILE = 0

export const TILE_TYPES = ['empty', 'floor', 'grass', 'water', 'stone', 'sand', 'wall'] as const

export type TileTypeName = (typeof TILE_TYPES)[number]

export type TileValue = number

export type TileGrid = Uint8Array

/** Объект карты занимает одну клетку; каталог видов появляется в пункте 1.8. */
export interface MapObject {
  readonly id: number
  readonly kindId: string
  readonly x: number
  readonly y: number
}

export interface MapModel {
  readonly version: typeof MAP_VERSION
  readonly width: number
  readonly height: number
  readonly tiles: TileGrid
  readonly objects: readonly MapObject[]
}
