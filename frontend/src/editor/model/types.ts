export const MAP_VERSION = 1

export const MAX_MAP_DIMENSION = 300

export const EMPTY_TILE = 0

export const TILE_TYPES = [
  'empty',
  'floor',
  'grass',
  'water',
  'stone',
  'sand',
  'wall',
] as const

export type TileTypeName = (typeof TILE_TYPES)[number]

export type TileValue = number

export type TileGrid = Uint8Array

export interface MapModel {
  readonly version: number
  readonly width: number
  readonly height: number
  readonly tiles: TileGrid
}
