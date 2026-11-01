import { describe, expect, it } from 'vitest'
import {
  drawSnapCandidates,
  hoverSnapCandidates,
  toolPaintsTexture,
  toolUsesHoverSnap,
} from './snapPreview'
import {
  SNAP_CANDIDATE_COLOR,
  SNAP_CANDIDATE_RADIUS,
  SNAP_NEAREST_COLOR,
  SNAP_NEAREST_RADIUS,
} from './colors'
import { makeFakeCtx } from './testFakeCtx'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { createTerrainRegion } from '../model/regions'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 128, height: 128, cellSize: 32, offsetX: 0, offsetY: 0 }

const square = (x: number, y: number, size: number): Point[] => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

function coveredModel(): MapModel {
  return applyCommand(createEmptyMap(10, 10), {
    kind: 'addRegion',
    region: createTerrainRegion('floor', square(0, 0, 4), 0, 'r'),
  })
}

describe('toolUsesHoverSnap', () => {
  it('is true for half-grid placement tools', () => {
    expect(toolUsesHoverSnap({ type: 'region-rect', tileType: 'floor' })).toBe(true)
    expect(toolUsesHoverSnap({ type: 'region-polygon', tileType: 'floor', vertices: 6 })).toBe(true)
    expect(toolUsesHoverSnap({ type: 'wall' })).toBe(true)
    expect(toolUsesHoverSnap({ type: 'door', imageId: null })).toBe(true)
  })

  it('is false for cell/center tools', () => {
    expect(toolUsesHoverSnap({ type: 'select' })).toBe(false)
    expect(toolUsesHoverSnap({ type: 'light' })).toBe(false)
    expect(
      toolUsesHoverSnap({
        type: 'object',
        kindId: 'torch',
        rotation: 0,
        scale: { w: 1, h: 1 },
      }),
    ).toBe(false)
  })
})

describe('toolPaintsTexture', () => {
  it('is true only for coverage-painting tools', () => {
    expect(toolPaintsTexture({ type: 'region-rect', tileType: 'floor' })).toBe(true)
    expect(toolPaintsTexture({ type: 'region-polygon', tileType: 'floor', vertices: 6 })).toBe(true)
    expect(toolPaintsTexture({ type: 'wall' })).toBe(false)
    expect(toolPaintsTexture({ type: 'door', imageId: null })).toBe(false)
    expect(toolPaintsTexture({ type: 'select' })).toBe(false)
    expect(toolPaintsTexture({ type: 'light' })).toBe(false)
    expect(
      toolPaintsTexture({
        type: 'object',
        kindId: 'torch',
        rotation: 0,
        scale: { w: 1, h: 1 },
      }),
    ).toBe(false)
  })
})

describe('hoverSnapCandidates', () => {
  it('gives 9 points over a covered cell and 4 over an uncovered one', () => {
    const model = coveredModel()
    expect(hoverSnapCandidates(model, { x: 1, y: 1 })).toHaveLength(9)
    expect(hoverSnapCandidates(model, { x: 8, y: 8 })).toHaveLength(4)
  })
})

describe('drawSnapCandidates', () => {
  it('marks the candidate nearest the cursor as the highlight', () => {
    const { ctx, calls } = makeFakeCtx()
    drawSnapCandidates(ctx, coveredModel(), { x: 0, y: 0 }, { x: 0.1, y: 0.1 }, viewport)

    const arcs = calls.filter((c) => c.op === 'arc')
    expect(arcs).toHaveLength(9)
    const highlighted = arcs.filter((c) => c.fillStyle === SNAP_NEAREST_COLOR)
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].args).toEqual([0, 0, SNAP_NEAREST_RADIUS, 0, Math.PI * 2])
    expect(arcs.filter((c) => c.fillStyle === SNAP_CANDIDATE_COLOR)).toHaveLength(8)
  })

  it('offers only the four corners when the cell is uncovered', () => {
    const { ctx, calls } = makeFakeCtx()
    drawSnapCandidates(ctx, coveredModel(), { x: 8, y: 8 }, { x: 8.9, y: 8.9 }, viewport)

    const arcs = calls.filter((c) => c.op === 'arc')
    expect(arcs).toHaveLength(4)
    const highlighted = arcs.filter((c) => c.fillStyle === SNAP_NEAREST_COLOR)
    expect(highlighted[0].args).toEqual([9 * 32, 9 * 32, SNAP_NEAREST_RADIUS, 0, Math.PI * 2])
  })

  it('maps world coordinates through the viewport and keeps radii constant', () => {
    const { ctx, calls } = makeFakeCtx()
    const zoomed: Viewport = { width: 128, height: 128, cellSize: 64, offsetX: 32, offsetY: 16 }
    drawSnapCandidates(ctx, coveredModel(), { x: 1, y: 1 }, { x: 1, y: 1 }, zoomed)

    const arcs = calls.filter((c) => c.op === 'arc')
    const highlighted = arcs.find((c) => c.fillStyle === SNAP_NEAREST_COLOR)
    expect(highlighted?.args).toEqual([
      1 * 64 - 32,
      1 * 64 - 16,
      SNAP_NEAREST_RADIUS,
      0,
      Math.PI * 2,
    ])
    expect(
      arcs.every((c) => c.args[2] === SNAP_NEAREST_RADIUS || c.args[2] === SNAP_CANDIDATE_RADIUS),
    ).toBe(true)
  })
})
