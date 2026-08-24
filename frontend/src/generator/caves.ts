import { TILE_TYPES } from '@/shared/tiles'
import type { TileGrid } from '@/shared/tiles'
import type { Rng } from './rng'
import type { CaveParams, GenerationResult } from './types'

function tileIndex(name: string): number {
  const index = TILE_TYPES.indexOf(name as (typeof TILE_TYPES)[number])
  if (index < 0) throw new Error(`Unknown tile: ${name}`)
  return index
}

const FLOOR = tileIndex('floor')
const WALL = tileIndex('wall')

/**
 * Классическое правило пещер: клетка становится стеной, если среди 8 соседей
 * ≥5 стен; иначе полом. Границы карты считаются стенами — это вместе с
 * рамкой-заливкой гарантирует замкнутый периметр.
 */
function stepSmooth(current: Uint8Array, width: number, height: number): Uint8Array {
  const next = new Uint8Array(current.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let walls = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          const outside = nx < 0 || ny < 0 || nx >= width || ny >= height
          if (outside || current[ny * width + nx] === WALL) walls += 1
        }
      }
      next[y * width + x] = walls >= 5 ? WALL : FLOOR
    }
  }
  return next
}

/**
 * Пещеры через cellular automata: шум с плотностью fillProbability →
 * smoothingIterations итераций сглаживания → рамка стен по периметру.
 */
export function generateCaves(params: CaveParams, rng: Rng): GenerationResult {
  const { width, height } = params
  if (!(params.fillProbability >= 0 && params.fillProbability <= 1)) {
    throw new RangeError(
      `fillProbability must be a number in [0, 1], got ${params.fillProbability}`,
    )
  }
  if (
    !Number.isInteger(params.smoothingIterations) ||
    params.smoothingIterations < 0 ||
    params.smoothingIterations > 20
  ) {
    throw new RangeError(
      `smoothingIterations must be an integer in [0, 20], got ${params.smoothingIterations}`,
    )
  }

  let tiles: TileGrid = new Uint8Array(width * height)
  for (let i = 0; i < tiles.length; i += 1) {
    tiles[i] = rng.next() < params.fillProbability ? WALL : FLOOR
  }

  for (let iteration = 0; iteration < params.smoothingIterations; iteration += 1) {
    tiles = stepSmooth(tiles, width, height)
  }

  // Рамка стен по периметру после всех итераций.
  for (let x = 0; x < width; x += 1) {
    tiles[x] = WALL
    tiles[(height - 1) * width + x] = WALL
  }
  for (let y = 0; y < height; y += 1) {
    tiles[y * width] = WALL
    tiles[y * width + width - 1] = WALL
  }

  return { width, height, tiles }
}
