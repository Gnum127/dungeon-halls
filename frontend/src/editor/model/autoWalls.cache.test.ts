import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('polygon-clipping', async (importOriginal) => {
  const actual = await importOriginal<typeof import('polygon-clipping')>()
  return { ...actual, union: vi.fn(actual.union) }
})

import { union } from 'polygon-clipping'
import { computeWallsWithRegion } from './autoWalls'
import { createTerrainRegion } from './regions'
import type { TerrainRegion } from './regions'

const squareRegion = (x: number, y: number, size: number, id: string): TerrainRegion =>
  createTerrainRegion(
    'floor',
    [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ],
    0,
    id,
  )

describe('computeWallsWithRegion cache', () => {
  beforeEach(() => {
    vi.mocked(union).mockClear()
  })

  it('unions the base coverage once and reuses it across repeated previews', () => {
    // Two base regions so building the base coverage itself needs one union call.
    const base = [squareRegion(0, 0, 2, 'a'), squareRegion(2, 0, 2, 'b')]
    const preview = squareRegion(4, 0, 2, 'p')

    computeWallsWithRegion(base, preview)
    const afterFirst = vi.mocked(union).mock.calls.length
    computeWallsWithRegion(base, preview)
    const afterSecond = vi.mocked(union).mock.calls.length

    // First call: base coverage union + preview union. Second: preview union only (base cached).
    expect(afterFirst).toBe(2)
    expect(afterSecond - afterFirst).toBe(1)
  })
})
