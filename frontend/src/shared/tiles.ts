export const MAX_MAP_DIMENSION = 300

/** Тип сетки карты; определяет геометрию клеток и hit-test. */
export type GridType = 'square' | 'hex-flat' | 'hex-pointy'

export const GRID_TYPES: readonly GridType[] = ['square', 'hex-flat', 'hex-pointy']

/**
 * Пустая клетка. Значение тайла — индекс в TILE_TYPES, поэтому порядок
 * элементов палитры менять нельзя: он неявно хранится в сохранённых картах.
 */
export const EMPTY_TILE = 0

export const TILE_TYPES = ['empty', 'floor', 'grass', 'water', 'stone', 'sand', 'wall'] as const

export type TileTypeName = (typeof TILE_TYPES)[number]

export type TileValue = number

export type TileGrid = Uint8Array
