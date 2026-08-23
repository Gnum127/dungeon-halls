import { EMPTY_TILE, MAP_VERSION, MAX_MAP_DIMENSION } from './types'
import type { MapModel } from './types'

function assertDimension(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_MAP_DIMENSION) {
    throw new RangeError(
      `Map dimension must be an integer in [1, ${MAX_MAP_DIMENSION}], got ${value}`,
    )
  }
}

export function createEmptyMap(width: number, height: number): MapModel {
  assertDimension(width)
  assertDimension(height)

  return {
    version: MAP_VERSION,
    width,
    height,
    tiles: new Uint8Array(width * height).fill(EMPTY_TILE),
  }
}
