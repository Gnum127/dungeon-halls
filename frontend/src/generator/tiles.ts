import { TILE_TYPES } from '@/shared/tiles'

function tileIndex(name: string): number {
  const index = TILE_TYPES.indexOf(name as (typeof TILE_TYPES)[number])
  if (index < 0) throw new Error(`Unknown tile: ${name}`)
  return index
}

export const FLOOR = tileIndex('floor')
export const WALL = tileIndex('wall')
