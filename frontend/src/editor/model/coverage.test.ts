import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { createEmptyMap } from './createEmptyMap'
import { createCoverageTester, coverageGridPoints, allGridPoints, gridPoints } from './coverage'
import { createTerrainRegion } from './regions'
import type { Point } from '@/shared/point'

const square = (x: number, y: number, size: number): Point[] => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

describe('createCoverageTester', () => {
  it('is false on an empty map', () => {
    expect(createCoverageTester(createEmptyMap(10, 10))({ x: 1, y: 1 })).toBe(false)
  })

  it('detects a point inside a solid region', () => {
    const model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(0, 0, 4), 0, 'r'),
    })
    const covered = createCoverageTester(model)
    expect(covered({ x: 2, y: 2 })).toBe(true)
    expect(covered({ x: 6, y: 6 })).toBe(false)
  })

  it('lets a higher empty region remove coverage (top wins)', () => {
    let model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(0, 0, 4), 0, 'r'),
    })
    model = applyCommand(model, {
      kind: 'addRegion',
      region: createTerrainRegion('empty', square(1, 1, 2), 1, 'hole'),
    })
    const covered = createCoverageTester(model)
    expect(covered({ x: 2, y: 2 })).toBe(false)
    expect(covered({ x: 0.5, y: 0.5 })).toBe(true)
  })

  it('sorts regions by zOrder regardless of their array order', () => {
    let model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(0, 0, 4), 0, 'r'),
    })
    model = applyCommand(model, {
      kind: 'addRegion',
      region: createTerrainRegion('empty', square(1, 1, 2), 1, 'hole'),
    })
    // A loaded file may keep its regions out of zOrder; the tester must sort.
    const shuffled = { ...model, regions: [...model.regions].reverse() }
    expect(createCoverageTester(shuffled)({ x: 2, y: 2 })).toBe(false)
  })

  it('restores coverage when a later region is painted over an erased area', () => {
    let model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(0, 0, 4), 0, 'r'),
    })
    model = applyCommand(model, {
      kind: 'addRegion',
      region: createTerrainRegion('empty', square(1, 1, 2), 1, 'hole'),
    })
    model = applyCommand(model, {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(1.5, 1.5, 1), 2, 'patch'),
    })
    const covered = createCoverageTester(model)
    expect(covered({ x: 2, y: 2 })).toBe(true)
    expect(covered({ x: 1.25, y: 1.25 })).toBe(false)
  })

  it('treats only an empty region as no coverage', () => {
    const model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('empty', square(0, 0, 4), 0, 'hole'),
    })
    expect(createCoverageTester(model)({ x: 2, y: 2 })).toBe(false)
  })

  it('treats a point on the region border as covered', () => {
    const model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(1, 1, 3), 0, 'r'),
    })
    expect(createCoverageTester(model)({ x: 1, y: 2 })).toBe(true)
  })

  it('treats stairs overlays as coverage', () => {
    const model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addStairs',
      polygon: square(5, 5, 2),
    })
    const covered = createCoverageTester(model)
    expect(covered({ x: 6, y: 6 })).toBe(true)
    expect(covered({ x: 1, y: 1 })).toBe(false)
  })
})

describe('coverageGridPoints', () => {
  const full = { firstCol: 0, lastCol: 9, firstRow: 0, lastRow: 9 }

  it('enumerates the unique corners of covered cells', () => {
    const model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(0, 0, 2), 0, 'r'),
    })
    const points = coverageGridPoints(model, full)
    // 2×2 covered cells share lattice corners → 3×3 = 9 points (not 16).
    expect(points).toHaveLength(9)
    expect(points).toContainEqual({ x: 0, y: 0 })
    expect(points).toContainEqual({ x: 2, y: 2 })
    expect(points).not.toContainEqual({ x: 3, y: 0 })
  })

  it('limits points to the requested cell range', () => {
    const model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(0, 0, 3), 0, 'r'),
    })
    const points = coverageGridPoints(model, {
      firstCol: 0,
      lastCol: 0,
      firstRow: 0,
      lastRow: 0,
    })
    expect(points).toHaveLength(4)
    expect(points).toContainEqual({ x: 1, y: 1 })
  })

  it('returns nothing when no cell is covered', () => {
    expect(coverageGridPoints(createEmptyMap(10, 10), full)).toEqual([])
  })
})

describe('allGridPoints', () => {
  it('enumerates every lattice corner of the range (cells + 1 each side)', () => {
    const points = allGridPoints({ firstCol: 0, lastCol: 1, firstRow: 0, lastRow: 1 })
    // 2×2 cells → 3×3 = 9 corners, unique and deterministic.
    expect(points).toHaveLength(9)
    expect(points).toContainEqual({ x: 0, y: 0 })
    expect(points).toContainEqual({ x: 2, y: 2 })
  })

  it('offsets corners with the requested range', () => {
    const points = allGridPoints({ firstCol: 2, lastCol: 2, firstRow: 3, lastRow: 3 })
    expect(points).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ])
  })
})

describe('gridPoints', () => {
  const full = { firstCol: 0, lastCol: 9, firstRow: 0, lastRow: 9 }

  it('splits covered corners from the free field', () => {
    const model = applyCommand(createEmptyMap(10, 10), {
      kind: 'addRegion',
      region: createTerrainRegion('floor', square(0, 0, 2), 0, 'r'),
    })
    const { covered, empty } = gridPoints(model, full)
    expect(covered).toHaveLength(9)
    // 11×11 = 121 corners; the 9 covered ones are removed from the free set.
    expect(empty).toHaveLength(121 - 9)
    const coveredKeys = new Set(covered.map((p) => `${p.x},${p.y}`))
    expect(empty.every((p) => !coveredKeys.has(`${p.x},${p.y}`))).toBe(true)
  })

  it('marks the whole field free when nothing is covered', () => {
    const range = { firstCol: 0, lastCol: 2, firstRow: 0, lastRow: 2 }
    const { covered, empty } = gridPoints(createEmptyMap(3, 3), range)
    expect(covered).toEqual([])
    expect(empty).toHaveLength(16)
    expect(empty).toEqual(allGridPoints(range))
  })
})
