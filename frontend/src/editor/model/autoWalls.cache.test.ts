import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('polygon-clipping', async (importOriginal) => {
  const actual = await importOriginal<typeof import('polygon-clipping')>()
  return { ...actual, union: vi.fn(actual.union), difference: vi.fn(actual.difference) }
})

import { union } from 'polygon-clipping'
import { computePreviewWalls } from './autoWalls'
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

describe('computePreviewWalls cache', () => {
  beforeEach(() => {
    vi.mocked(union).mockClear()
  })

  it('unions the base coverage once and reuses it across repeated previews', () => {
    const base = [squareRegion(0, 0, 2, 'a')]
    const preview = squareRegion(2, 0, 2, 'p')

    computePreviewWalls(base, preview)
    const afterFirst = vi.mocked(union).mock.calls.length
    computePreviewWalls(base, preview)
    const afterSecond = vi.mocked(union).mock.calls.length

    // First call: base union + preview union. Second: preview union only (base cached).
    expect(afterFirst).toBe(2)
    expect(afterSecond - afterFirst).toBe(1)
  })
})
