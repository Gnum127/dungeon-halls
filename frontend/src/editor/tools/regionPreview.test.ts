import { describe, expect, it } from 'vitest'
import { drawRegionWithWalls } from './regionPreview'
import { rectPolygon, regularPolygonPoints } from './regions'
import { makeFakeCtx } from '../render/testFakeCtx'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { createTerrainRegion } from '../model/regions'
import type { Viewport } from '../render/viewport'

const viewport: Viewport = { width: 320, height: 320, cellSize: 32, offsetX: 0, offsetY: 0 }

describe('drawRegionWithWalls', () => {
  it('previews a hexagon (regression: rect-only gate hid polygon preview)', () => {
    const { ctx, calls } = makeFakeCtx()
    const model = createEmptyMap(12, 12)
    const hexagon = regularPolygonPoints({ x: 5, y: 5 }, { x: 7, y: 5 }, 6)

    drawRegionWithWalls(ctx, model, viewport, 'floor', hexagon, false)

    expect(calls.some((c) => c.op === 'fill')).toBe(true)
    expect(calls.some((c) => c.op === 'closePath')).toBe(true)
  })

  it('still previews a rectangle', () => {
    const { ctx, calls } = makeFakeCtx()
    const model = createEmptyMap(12, 12)
    const rect = rectPolygon(1, 1, 3, 3, 12, 12)

    drawRegionWithWalls(ctx, model, viewport, 'floor', rect, false)

    expect(calls.some((c) => c.op === 'fill')).toBe(true)
  })

  it('draws auto-wall segments for the previewed contour', () => {
    const { ctx, calls } = makeFakeCtx()
    const model = createEmptyMap(12, 12)
    const rect = rectPolygon(1, 1, 3, 3, 12, 12)

    drawRegionWithWalls(ctx, model, viewport, 'floor', rect, true)

    // One closed preview contour → a single wall segment, one stroke.
    const strokes = calls.filter((c) => c.op === 'stroke')
    expect(strokes).toHaveLength(1)
  })

  it('skips degenerate polygons (fewer than 3 points)', () => {
    const { ctx, calls } = makeFakeCtx()
    const model = createEmptyMap(12, 12)

    drawRegionWithWalls(
      ctx,
      model,
      viewport,
      'floor',
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      true,
    )

    expect(calls).toEqual([])
  })

  it('merges the contour with an existing base region', () => {
    const base = applyCommand(createEmptyMap(12, 12), {
      kind: 'addRegion',
      region: createTerrainRegion(
        'floor',
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
        0,
        'base',
      ),
    })
    const { ctx, calls } = makeFakeCtx()
    // Preview overlaps the base → union is an 8-edge polygon.
    drawRegionWithWalls(ctx, base, viewport, 'floor', rectPolygon(1, 1, 3, 3, 12, 12), true)

    // Preview merges with the base → a single contour, one stroke.
    // (A regression that skips the union would leave two separate contours.)
    const strokes = calls.filter((c) => c.op === 'stroke')
    expect(strokes).toHaveLength(1)
  })

  it('draws no wall strokes when auto walls are disabled', () => {
    const { ctx, calls } = makeFakeCtx()
    const model = createEmptyMap(12, 12)
    drawRegionWithWalls(ctx, model, viewport, 'floor', rectPolygon(1, 1, 3, 3, 12, 12), false)

    expect(calls.some((c) => c.op === 'stroke')).toBe(false)
  })
})
