import { describe, expect, it } from 'vitest'
import { TILE_TYPES } from '@/shared/tiles'
import { createRng } from './rng'
import type { CaveParams } from './types'
import { generateCaves } from './caves'

const FLOOR = TILE_TYPES.indexOf('floor')
const WALL = TILE_TYPES.indexOf('wall')

function makeParams(overrides: Partial<CaveParams> = {}): CaveParams {
  return {
    type: 'caves',
    seed: 42,
    width: 40,
    height: 30,
    fillProbability: 0.45,
    smoothingIterations: 4,
    ...overrides,
  }
}

describe('generateCaves', () => {
  it('is deterministic for the same seed', () => {
    expect(generateCaves(makeParams(), createRng(5))).toEqual(
      generateCaves(makeParams(), createRng(5)),
    )
  })

  it('different seeds give different caves', () => {
    const a = generateCaves(makeParams({ seed: 1 }), createRng(1))
    const b = generateCaves(makeParams({ seed: 2 }), createRng(2))

    expect([...a.tiles]).not.toEqual([...b.tiles])
  })

  it('keeps the perimeter as walls for any input', () => {
    // Экстремальная плотность: даже сплошной пол обрастает рамкой.
    const { tiles } = generateCaves(
      makeParams({ fillProbability: 0, smoothingIterations: 0 }),
      createRng(3),
    )

    for (let x = 0; x < 40; x += 1) {
      expect(tiles[x]).toBe(WALL)
      expect(tiles[(30 - 1) * 40 + x]).toBe(WALL)
    }
    for (let y = 0; y < 30; y += 1) {
      expect(tiles[y * 40]).toBe(WALL)
      expect(tiles[y * 40 + 40 - 1]).toBe(WALL)
    }
  })

  it('uses only floor and wall tiles', () => {
    const { tiles } = generateCaves(makeParams(), createRng(9))
    for (const tile of tiles) {
      expect([FLOOR, WALL]).toContain(tile)
    }
  })

  it('higher density yields more walls (directional check)', () => {
    const countWalls = (seed: number, fillProbability: number) => {
      const { tiles } = generateCaves(
        makeParams({ seed, width: 60, height: 60, fillProbability, smoothingIterations: 3 }),
        createRng(seed),
      )
      let walls = 0
      for (const tile of tiles) if (tile === WALL) walls += 1
      return walls
    }

    const sparse = countWalls(77, 0.3)
    const dense = countWalls(77, 0.7)
    expect(dense).toBeGreaterThan(sparse)
  })

  it('rejects invalid fillProbability and smoothingIterations', () => {
    expect(() => generateCaves(makeParams({ fillProbability: -0.1 }), createRng(1))).toThrow(
      RangeError,
    )
    expect(() => generateCaves(makeParams({ fillProbability: 1.1 }), createRng(1))).toThrow(
      RangeError,
    )
    expect(() => generateCaves(makeParams({ smoothingIterations: -1 }), createRng(1))).toThrow(
      RangeError,
    )
    expect(() => generateCaves(makeParams({ smoothingIterations: 21 }), createRng(1))).toThrow(
      RangeError,
    )
    expect(() => generateCaves(makeParams({ smoothingIterations: 2.5 }), createRng(1))).toThrow(
      RangeError,
    )
  })

  it('zero iterations keeps the raw noise except the border', () => {
    const params = makeParams({ seed: 8, fillProbability: 0.5, smoothingIterations: 0 })
    const { tiles } = generateCaves(params, createRng(8))

    // Независимо воспроизводим тот же поток шума: он тратился на все клетки
    // (рамка перезаписана после), ассертим только внутренность.
    const rng = createRng(8)
    for (let y = 0; y < params.height; y += 1) {
      for (let x = 0; x < params.width; x += 1) {
        const expected = rng.next() < 0.5 ? WALL : FLOOR
        const inside = x > 0 && y > 0 && x < params.width - 1 && y < params.height - 1
        if (inside) expect(tiles[y * params.width + x]).toBe(expected)
      }
    }
  })
})
