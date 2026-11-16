import { describe, expect, it } from 'vitest'
import { drawHoverHighlight, drawHoverOverlay } from './hoverHighlight'
import { SNAP_NEAREST_COLOR, SNAP_NEAREST_RADIUS } from './colors'
import { makeFakeCtx } from './testFakeCtx'
import { createEmptyMap } from '../model/createEmptyMap'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 128, height: 128, cellSize: 32, offsetX: 0, offsetY: 0 }
const model = createEmptyMap(10, 10)

describe('drawHoverHighlight', () => {
  it('highlights the 0.5 quadrant for texture tools', () => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverHighlight(
      ctx,
      { type: 'region-rect', tileType: 'floor' },
      { x: 1, y: 1 },
      { x: 1.25, y: 1.75 },
      viewport,
    )

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect?.args).toEqual([33, 49, 14, 14])
  })

  it('highlights the whole cell for non-texture tools', () => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverHighlight(ctx, { type: 'wall' }, { x: 1, y: 2 }, { x: 1.25, y: 2.75 }, viewport)

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    // Full cell (1,2): screen (32..64, 64..96), inset by 1 → 30×30.
    expect(strokeRect?.args).toEqual([33, 65, 30, 30])
  })

  it.each(['cursor', 'pan', 'door', 'stairs'] as const)('draws nothing for the %s tool', (type) => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverHighlight(
      ctx,
      type === 'door' ? { type: 'door', imageId: null } : { type },
      { x: 1, y: 2 },
      { x: 1.25, y: 2.75 },
      viewport,
    )

    expect(calls).toEqual([])
  })
})

describe('drawHoverOverlay', () => {
  it('marks the snapped half-cell point for texture tools, not cell corners', () => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverOverlay(
      ctx,
      model,
      { type: 'region-rect', tileType: 'floor' },
      { x: 1, y: 1 },
      { x: 1.2, y: 1.8 },
      viewport,
    )

    const arcs = calls.filter((c) => c.op === 'arc')
    expect(arcs).toHaveLength(1)
    expect(arcs[0].fillStyle).toBe(SNAP_NEAREST_COLOR)
    // 1.2 → 1, 1.8 → 2 (snapToHalfGrid).
    expect(arcs[0].args).toEqual([1 * 32, 2 * 32, SNAP_NEAREST_RADIUS, 0, Math.PI * 2])
  })

  it('shows candidate points for walls', () => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverOverlay(ctx, model, { type: 'wall' }, { x: 1, y: 1 }, { x: 1.2, y: 1.8 }, viewport)

    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(4)
  })

  it('shows only snap candidates for the door tool (no cell/quadrant highlight)', () => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverOverlay(
      ctx,
      model,
      { type: 'door', imageId: null },
      { x: 1, y: 1 },
      { x: 1.2, y: 1.8 },
      viewport,
    )

    expect(calls.filter((c) => c.op === 'strokeRect')).toHaveLength(0)
    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(4)
  })

  it('shows only snap candidates for the stairs tool (no cell highlight)', () => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverOverlay(ctx, model, { type: 'stairs' }, { x: 1, y: 1 }, { x: 1.2, y: 1.8 }, viewport)

    expect(calls.filter((c) => c.op === 'strokeRect')).toHaveLength(0)
    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(4)
  })

  it.each(['cursor', 'pan'] as const)('draws nothing for the %s tool', (type) => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverOverlay(ctx, model, { type }, { x: 1, y: 2 }, { x: 1.25, y: 2.75 }, viewport)

    expect(calls).toEqual([])
  })
})
