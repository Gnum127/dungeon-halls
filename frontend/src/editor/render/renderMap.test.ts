import { describe, expect, it } from 'vitest'
import { renderMap } from './renderMap'
import { wallPath } from './geometry'
import { makeFakeCtx } from './testFakeCtx'
import { createTerrainRegion } from '../model/regions'
import { createWallSegment } from '../model/wallSegments'
import { OBJECT_COLORS } from '../model/objects'
import { MAP_VERSION } from '../model/types'
import {
  CANVAS_BACKGROUND_COLOR,
  DOOR_FILL_COLOR,
  GRID_LINE_COLOR,
  LIGHT_MARKER_COLOR,
  STAIRS_STEP_COLOR,
  TILE_COLORS,
  WALL_BODY_COLOR,
  WALL_LINE_COLOR,
} from './colors'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 256, height: 256, cellSize: 32, offsetX: 0, offsetY: 0 }

const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

function baseModel(overrides: Partial<MapModel> = {}): MapModel {
  return {
    version: MAP_VERSION,
    grid: { width: 8, height: 8, cellSize: 32 },
    regions: [],
    walls: [],
    doors: [],
    objects: [],
    lights: [],
    ...overrides,
  }
}

describe('renderMap', () => {
  it('paints the background first', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel(), viewport)

    expect(calls[0]).toMatchObject({ op: 'fillRect' })
    expect(calls[0].fillStyle).toBe(CANVAS_BACKGROUND_COLOR)
    expect(calls[0].args).toEqual([0, 0, 256, 256])
  })

  it('fills regions sorted by zOrder (lower layer first)', () => {
    const top = createTerrainRegion('grass', square(0, 0, 2, 2), 5, 'top')
    const bottom = createTerrainRegion('floor', square(0, 0, 3, 3), 0, 'bottom')

    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [top, bottom] }), viewport)

    const fills = calls.filter((c) => c.op === 'fill').map((c) => c.fillStyle)
    const floorIndex = fills.indexOf(TILE_COLORS.floor)
    const grassIndex = fills.indexOf(TILE_COLORS.grass)
    expect(floorIndex).toBeGreaterThanOrEqual(0)
    expect(grassIndex).toBeGreaterThan(floorIndex)
  })

  it('draws step lines for a stairs region', () => {
    const region = createTerrainRegion('stairs', square(0, 0, 2, 2), 0, 'r')
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), viewport)

    expect(calls.some((c) => c.op === 'stroke' && c.fillStyle === STAIRS_STEP_COLOR)).toBe(true)
  })

  it('draws steps after tiling a stairs region (layer order)', () => {
    const sprite = {} as HTMLImageElement
    const sprites = { tiles: { stairs: sprite }, objects: {}, elementImages: {}, tilePools: {} }
    const region = createTerrainRegion('stairs', square(0, 0, 2, 2), 0, 'r')
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), viewport, sprites)

    const drawIndex = calls.findIndex((c) => c.op === 'drawImage')
    const stepIndex = calls.findIndex((c) => c.op === 'stroke' && c.fillStyle === STAIRS_STEP_COLOR)
    expect(drawIndex).toBeGreaterThanOrEqual(0)
    expect(stepIndex).toBeGreaterThan(drawIndex)
  })

  it('draws grid lines with the grid colour', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel(), viewport)

    expect(calls.some((c) => c.op === 'stroke' && c.fillStyle === GRID_LINE_COLOR)).toBe(true)
  })

  it('draws walls with a body and an outline', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      { thickness: 0.5, id: 'w1' },
    )
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall] }), viewport)

    expect(calls.some((c) => c.op === 'stroke' && c.fillStyle === WALL_BODY_COLOR)).toBe(true)
    expect(calls.some((c) => c.op === 'stroke' && c.fillStyle === WALL_LINE_COLOR)).toBe(true)
  })

  it('draws a closed contour as one closed path', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
        { x: 0, y: 0 },
      ],
      { id: 'w1' },
    )
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall] }), viewport)

    // Only the wall closes its path (no regions in the model).
    expect(calls.filter((c) => c.op === 'closePath')).toHaveLength(1)
    expect(calls.filter((c) => c.op === 'stroke' && c.fillStyle === WALL_BODY_COLOR)).toHaveLength(1)
    expect(calls.filter((c) => c.op === 'stroke' && c.fillStyle === WALL_LINE_COLOR)).toHaveLength(1)
  })

  it('leaves an open wall polyline unclosed', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
      ],
      { id: 'w1' },
    )
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall] }), viewport)

    expect(calls.some((c) => c.op === 'closePath')).toBe(false)
  })

  it('draws a closed door as a filled rectangle', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      { id: 'w1' },
    )
    const door = { id: 'd1', wallSegmentId: 'w1', position: 0.5, open: false, imageId: null }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall], doors: [door] }), viewport)

    const doorRects = calls.filter((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)
    expect(doorRects).toHaveLength(1)
  })

  it('falls back to a filled door when its texture is missing from the pool', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      { id: 'w1' },
    )
    const door = { id: 'd1', wallSegmentId: 'w1', position: 0.5, open: false, imageId: 'door-iron' }
    const sprites = { tiles: {}, objects: {}, elementImages: {}, tilePools: {} }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall], doors: [door] }), viewport, sprites)

    expect(calls.some((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)).toBe(true)
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
  })

  it('draws a textured door from the element image pool', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      { id: 'w1' },
    )
    const door = { id: 'd1', wallSegmentId: 'w1', position: 0.5, open: false, imageId: 'door-iron' }
    const image = {} as HTMLImageElement
    const sprites = { tiles: {}, objects: {}, elementImages: { 'door-iron': image }, tilePools: {} }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall], doors: [door] }), viewport, sprites)

    expect(calls.some((c) => c.op === 'drawImage' && c.args[0] === image)).toBe(true)
    expect(calls.some((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)).toBe(false)
  })

  it('draws an open door as two segments', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      { id: 'w1' },
    )
    const door = { id: 'd1', wallSegmentId: 'w1', position: 0.5, open: true, imageId: null }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall], doors: [door] }), viewport)

    const doorRects = calls.filter((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)
    expect(doorRects).toHaveLength(2)
  })

  it('falls back to a colour ellipse for objects without a sprite', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ objects: [{ id: 1, kindId: 'torch', x: 1, y: 1 }] }), viewport)

    expect(
      calls.some((c) => c.op === 'fill' && c.fillStyle === OBJECT_COLORS.torch),
    ).toBe(true)
  })

  it('draws light glow and marker by default', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ lights: [{ id: 1, x: 1, y: 1, radius: 2, color: '#ffdd88' }] }), viewport)

    expect(calls.some((c) => c.op === 'arc')).toBe(true)
    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === LIGHT_MARKER_COLOR)).toBe(true)
  })

  it('skips lights when includeLight is false', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(
      ctx,
      baseModel({ lights: [{ id: 1, x: 1, y: 1, radius: 2, color: '#ffdd88' }] }),
      viewport,
      undefined,
      { includeLight: false },
    )
    expect(calls.some((c) => c.op === 'arc')).toBe(false)
  })

  it('tiles a region with its sprite and restores image smoothing', () => {
    const sprite = {} as HTMLImageElement
    const sprites = { tiles: { floor: sprite }, objects: {}, elementImages: {}, tilePools: {} }
    const region = createTerrainRegion('floor', square(0, 0, 2, 2), 0, 'r')
    const { ctx, raw, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), viewport, sprites)

    expect(calls.some((c) => c.op === 'clip')).toBe(true)
    expect(calls.some((c) => c.op === 'drawImage')).toBe(true)
    expect(raw.imageSmoothingEnabled).toBe(true)
  })

  it('tiles a region with pseudo-random variants from the tile pool', () => {
    const single = {} as HTMLImageElement
    const variantA = {} as HTMLImageElement
    const variantB = {} as HTMLImageElement
    const sprites = {
      tiles: { floor: single },
      objects: {},
      elementImages: {},
      tilePools: { floor: [variantA, variantB] },
    }
    const region = createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), viewport, sprites)

    const drawn = calls.filter((c) => c.op === 'drawImage').map((c) => c.args[0])
    expect(drawn).toHaveLength(16)
    expect(drawn).not.toContain(single)
    expect(new Set(drawn).size).toBe(2)
  })

  it('tiles deterministically: the same region renders the same variants', () => {
    const variantA = {} as HTMLImageElement
    const variantB = {} as HTMLImageElement
    const sprites = {
      tiles: {},
      objects: {},
      elementImages: {},
      tilePools: { floor: [variantA, variantB] },
    }
    const region = createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')
    const first = makeFakeCtx()
    const second = makeFakeCtx()
    renderMap(first.ctx, baseModel({ regions: [region] }), viewport, sprites)
    renderMap(second.ctx, baseModel({ regions: [region] }), viewport, sprites)

    const drawnArgs = (calls: { op: string; args: unknown[] }[]) =>
      calls.filter((c) => c.op === 'drawImage').map((c) => c.args)
    expect(drawnArgs(second.calls)).toEqual(drawnArgs(first.calls))
  })

  it('falls back to the single sprite when the pool is empty', () => {
    const single = {} as HTMLImageElement
    const sprites = {
      tiles: { floor: single },
      objects: {},
      elementImages: {},
      tilePools: { floor: [] },
    }
    const region = createTerrainRegion('floor', square(0, 0, 2, 2), 0, 'r')
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), viewport, sprites)

    const drawn = calls.filter((c) => c.op === 'drawImage').map((c) => c.args[0])
    expect(drawn).toHaveLength(4)
    expect(drawn.every((image) => image === single)).toBe(true)
  })
})

describe('wallPath', () => {
  it('drops the duplicated closing point and flags a closed contour', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 0 },
      ],
      { id: 'w1' },
    )
    expect(wallPath(wall)).toEqual({
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ],
      closed: true,
    })
  })

  it('keeps an open polyline as-is', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      { id: 'w1' },
    )
    expect(wallPath(wall)).toEqual({
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      closed: false,
    })
  })

  it('does not treat a degenerate 2-point loop as closed', () => {
    const wall = createWallSegment(
      [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ],
      { id: 'w1' },
    )
    expect(wallPath(wall).closed).toBe(false)
  })
})
