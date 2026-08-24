import { MAX_MAP_DIMENSION } from '@/shared/tiles'
import type { TileGrid } from '@/shared/tiles'
import { FLOOR, WALL } from './tiles'
import type { Rng } from './rng'
import type { CaveParams, GenerationResult } from './types'

/** Рамка стен + хотя бы одна клетка пола внутри. */
const MIN_CAVE_DIMENSION = 3
const MAX_SMOOTHING_ITERATIONS = 20
/** Стена, если среди 8 соседей стен не меньше этой доли порога. */
export const WALL_NEIGHBOR_THRESHOLD = 5

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
      next[y * width + x] = walls >= WALL_NEIGHBOR_THRESHOLD ? WALL : FLOOR
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
  for (const [name, value] of [
    ['width', width],
    ['height', height],
  ] as const) {
    if (!Number.isInteger(value) || value < MIN_CAVE_DIMENSION || value > MAX_MAP_DIMENSION) {
      throw new RangeError(
        `${name} must be an integer in [${MIN_CAVE_DIMENSION}, ${MAX_MAP_DIMENSION}], got ${value}`,
      )
    }
  }
  if (!(params.fillProbability >= 0 && params.fillProbability <= 1)) {
    throw new RangeError(
      `fillProbability must be a number in [0, 1], got ${params.fillProbability}`,
    )
  }
  if (
    !Number.isInteger(params.smoothingIterations) ||
    params.smoothingIterations < 0 ||
    params.smoothingIterations > MAX_SMOOTHING_ITERATIONS
  ) {
    throw new RangeError(
      `smoothingIterations must be an integer in [0, ${MAX_SMOOTHING_ITERATIONS}], got ${params.smoothingIterations}`,
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
