import { describe, expect, it } from 'vitest'
import { TILE_TYPES } from '@/shared/tiles'
import { createRng } from './rng'
import type { DungeonParams } from './types'
import { generateDungeon, layoutRooms } from './dungeon'

const FLOOR = TILE_TYPES.indexOf('floor')
const WALL = TILE_TYPES.indexOf('wall')

function makeParams(overrides: Partial<DungeonParams> = {}): DungeonParams {
  return {
    type: 'dungeon',
    seed: 42,
    width: 40,
    height: 30,
    roomAttempts: 100,
    ...overrides,
  }
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Связность: flood-fill от первой половой клетки должен достичь всех полов. */
function floorComponentCoversAll(tiles: Uint8Array, width: number, height: number): boolean {
  const start = tiles.findIndex((tile) => tile === FLOOR)
  if (start === -1) return true

  const seen = new Set<number>([start])
  const queue = [start]
  while (queue.length > 0) {
    const index = queue.pop()!
    const x = index % width
    const y = Math.floor(index / width)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const neighbour = ny * width + nx
      if (tiles[neighbour] === FLOOR && !seen.has(neighbour)) {
        seen.add(neighbour)
        queue.push(neighbour)
      }
    }
  }

  let floors = 0
  for (const tile of tiles) if (tile === FLOOR) floors += 1
  return seen.size === floors
}

describe('layoutRooms', () => {
  it('is deterministic for the same seed', () => {
    expect(layoutRooms(makeParams(), createRng(7))).toEqual(layoutRooms(makeParams(), createRng(7)))
  })

  it('keeps every room inside the wall border', () => {
    const params = makeParams({ width: 30, height: 20 })
    const rooms = layoutRooms(params, createRng(7))

    expect(rooms.length).toBeGreaterThan(0)
    for (const room of rooms) {
      expect(room.x).toBeGreaterThanOrEqual(1)
      expect(room.y).toBeGreaterThanOrEqual(1)
      expect(room.x + room.w).toBeLessThanOrEqual(params.width - 1)
      expect(room.y + room.h).toBeLessThanOrEqual(params.height - 1)
    }
  })

  it('never overlaps rooms, even by the one-cell gap', () => {
    const rooms = layoutRooms(makeParams({ roomAttempts: 500 }), createRng(3))

    for (let i = 0; i < rooms.length; i += 1) {
      for (let j = i + 1; j < rooms.length; j += 1) {
        const a: Rect = rooms[i]!
        const b: Rect = rooms[j]!
        const separated =
          a.x + a.w + 1 <= b.x ||
          b.x + b.w + 1 <= a.x ||
          a.y + a.h + 1 <= b.y ||
          b.y + b.h + 1 <= a.y
        expect(separated).toBe(true)
      }
    }
  })

  it('throws on invalid roomAttempts', () => {
    expect(() => layoutRooms(makeParams({ roomAttempts: 0 }), createRng(1))).toThrow(RangeError)
    expect(() => layoutRooms(makeParams({ roomAttempts: 2.5 }), createRng(1))).toThrow(RangeError)
    expect(() => layoutRooms(makeParams({ roomAttempts: 10001 }), createRng(1))).toThrow(RangeError)
  })
})

describe('generateDungeon', () => {
  it('is deterministic for the same seed', () => {
    expect(generateDungeon(makeParams(), createRng(5))).toEqual(
      generateDungeon(makeParams(), createRng(5)),
    )
  })

  it('uses only floor and wall tiles', () => {
    const { tiles } = generateDungeon(makeParams(), createRng(5))
    for (const tile of tiles) {
      expect([FLOOR, WALL]).toContain(tile)
    }
  })

  it('keeps the perimeter as walls', () => {
    const params = makeParams()
    const { tiles } = generateDungeon(params, createRng(9))

    for (let x = 0; x < params.width; x += 1) {
      expect(tiles[x]).toBe(WALL)
      expect(tiles[(params.height - 1) * params.width + x]).toBe(WALL)
    }
    for (let y = 0; y < params.height; y += 1) {
      expect(tiles[y * params.width]).toBe(WALL)
      expect(tiles[y * params.width + params.width - 1]).toBe(WALL)
    }
  })

  it('produces a fully connected floor', () => {
    const { width, height, tiles } = generateDungeon(
      makeParams({ roomAttempts: 200 }),
      createRng(13),
    )

    expect(floorComponentCoversAll(tiles, width, height)).toBe(true)
  })

  it('stays connected across several seeds', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const { width, height, tiles } = generateDungeon(makeParams(), createRng(seed))
      expect(floorComponentCoversAll(tiles, width, height)).toBe(true)
    }
  })

  it('rejects invalid dimensions and attempts', () => {
    expect(() => generateDungeon(makeParams({ width: 4 }), createRng(1))).toThrow(RangeError)
    expect(() => generateDungeon(makeParams({ height: 301 }), createRng(1))).toThrow(RangeError)
    expect(() => generateDungeon(makeParams({ width: 10.5 }), createRng(1))).toThrow(RangeError)
  })
})
