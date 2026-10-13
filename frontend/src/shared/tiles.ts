export const TILE_TYPES = [
  'empty',
  'floor',
  'grass',
  'water',
  'stone',
  'sand',
  'wall',
  'stairs',
] as const

export type TileTypeName = (typeof TILE_TYPES)[number]

export type TileGrid = Uint8Array

export const MAX_MAP_DIMENSION = 300
