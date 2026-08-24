export const TILE_TYPES = ['empty', 'floor', 'grass', 'water', 'stone', 'sand', 'wall'] as const

export type TileTypeName = (typeof TILE_TYPES)[number]

export type TileValue = number

export type TileGrid = Uint8Array

export const EMPTY_TILE = 0

export const MAX_MAP_DIMENSION = 300

export type GridType = 'square' | 'hex-flat' | 'hex-pointy'

export const GRID_TYPES: readonly GridType[] = ['square', 'hex-flat', 'hex-pointy']

export function isGridType(value: unknown): value is GridType {
  return typeof value === 'string' && (GRID_TYPES as readonly string[]).includes(value)
}
