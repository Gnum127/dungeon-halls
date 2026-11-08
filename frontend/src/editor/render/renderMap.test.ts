import { describe, expect, it } from 'vitest'
import { MAX_TEXTURE_TILES_PER_REGION, renderMap } from './renderMap'
import { wallPath } from './geometry'
import { makeFakeCtx } from './testFakeCtx'
import { createTerrainRegion } from '../model/regions'
import { createWallSegment } from '../model/wallSegments'
import { OBJECT_COLORS } from '../model/objects'
import { MAP_VERSION } from '../model/types'
import {
  CANVAS_BACKGROUND_COLOR,
  DOOR_FILL_COLOR,
  EMPTY_GRID_POINT_COLOR,
  EMPTY_GRID_POINT_RADIUS_SCALE,
  GRID_POINT_COLOR,
  GRID_POINT_RADIUS,
  LIGHT_GLOW_COLOR,
  LIGHT_MARKER_COLOR,
  STAIRS_OUTLINE_COLOR,
  STAIRS_STEP_COLOR,
  TILE_COLORS,
  WALL_BODY_COLOR,
  WALL_LINE_COLOR,
} from './colors'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import { pickIndexFromCoords } from '@/shared/random'
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
    stairs: [],
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

  it('draws a stairs entity outline and step lines without filling it', () => {
    const stairs = [
      {
        id: 's1',
        polygon: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 1 },
          { x: 0, y: 1 },
        ],
      },
    ]
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ stairs }), viewport)

    expect(calls.some((c) => c.op === 'stroke' && c.fillStyle === STAIRS_OUTLINE_COLOR)).toBe(true)
    expect(calls.some((c) => c.op === 'stroke' && c.fillStyle === STAIRS_STEP_COLOR)).toBe(true)
    expect(calls.some((c) => c.op === 'clip')).toBe(true)
    // Stairs are an overlay: the point grid (covered + free) is the only fill
    // they contribute, no region fill for the stairs polygon itself.
    const fills = calls.filter((c) => c.op === 'fill')
    expect(fills.length).toBeGreaterThan(0)
    expect(
      fills.every(
        (c) => c.fillStyle === GRID_POINT_COLOR || c.fillStyle === EMPTY_GRID_POINT_COLOR,
      ),
    ).toBe(true)
  })

  it('draws stairs before objects (layer order)', () => {
    const stairs = [
      {
        id: 's1',
        polygon: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 1 },
          { x: 0, y: 1 },
        ],
      },
    ]
    const { ctx, calls } = makeFakeCtx()
    renderMap(
      ctx,
      baseModel({ stairs, objects: [{ id: 1, kindId: 'torch', x: 1, y: 1 }] }),
      viewport,
    )

    const stepIndex = calls.findIndex((c) => c.op === 'stroke' && c.fillStyle === STAIRS_STEP_COLOR)
    const objectFill = calls.findIndex(
      (c) => c.op === 'fill' && c.fillStyle === OBJECT_COLORS.torch,
    )
    const gridIndex = calls.findIndex((c) => c.op === 'fill' && c.fillStyle === GRID_POINT_COLOR)
    const emptyGridIndex = calls.findIndex(
      (c) => c.op === 'fill' && c.fillStyle === EMPTY_GRID_POINT_COLOR,
    )
    expect(stepIndex).toBeGreaterThanOrEqual(0)
    expect(gridIndex).toBeGreaterThan(stepIndex)
    expect(objectFill).toBeGreaterThan(stepIndex)
    expect(objectFill).toBeGreaterThan(gridIndex)
    expect(emptyGridIndex).toBeGreaterThanOrEqual(0)
    // Объекты рисуются ПОВЕРХ точечной сетки (в т.ч. свободного поля).
    expect(objectFill).toBeGreaterThan(emptyGridIndex)
  })

  it('draws the point grid: bright on covered cells, dim on free field', () => {
    const empty = makeFakeCtx()
    renderMap(empty.ctx, baseModel(), viewport)
    // No coverage → no bright points, but the free field is fully dotted.
    expect(empty.calls.some((c) => c.op === 'fill' && c.fillStyle === GRID_POINT_COLOR)).toBe(false)
    // 8×8 cells → 9×9 = 81 free lattice corners.
    expect(
      empty.calls.filter((c) => c.op === 'fill' && c.fillStyle === EMPTY_GRID_POINT_COLOR),
    ).toHaveLength(81)

    const region = createTerrainRegion('floor', square(0, 0, 2, 2), 0, 'r')
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), viewport)
    const dots = calls.filter((c) => c.op === 'fill' && c.fillStyle === GRID_POINT_COLOR)
    // A 2×2 covered block shares lattice corners → 3×3 = 9 unique bright points.
    expect(dots).toHaveLength(9)
    // The remaining corners stay dim.
    const emptyDots = calls.filter(
      (c) => c.op === 'fill' && c.fillStyle === EMPTY_GRID_POINT_COLOR,
    )
    expect(emptyDots).toHaveLength(81 - 9)
    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(81)

    // Bright points are full size, free-field points are smaller (spec 20.1).
    const brightArcs = calls.filter((c) => c.op === 'arc' && c.fillStyle === GRID_POINT_COLOR)
    expect(brightArcs.every((c) => c.args[2] === GRID_POINT_RADIUS)).toBe(true)
    const emptyArcs = calls.filter(
      (c) => c.op === 'arc' && c.fillStyle === EMPTY_GRID_POINT_COLOR,
    )
    expect(emptyArcs.every((c) => c.args[2] === GRID_POINT_RADIUS * EMPTY_GRID_POINT_RADIUS_SCALE)).toBe(
      true,
    )
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

  it('cuts the wall into two runs around a door opening', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      { id: 'w1' },
    )
    const door = { id: 'd1', a: { x: 1.5, y: 0 }, b: { x: 2.5, y: 0 }, openAngle: 0, imageId: null }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall], doors: [door] }), viewport)

    // Two sub-paths → two body strokes (the wall is broken by the opening).
    expect(calls.filter((c) => c.op === 'stroke' && c.fillStyle === WALL_BODY_COLOR)).toHaveLength(
      2,
    )

    const starts = calls.filter((c) => c.op === 'moveTo').map((c) => c.args[0] as number)
    // Opening 1.5..2.5 plus 1/6 clearance → ends at 1.3333 and 2.6667 cells (*32px).
    expect(starts[0]).toBeCloseTo(0)
    expect(starts[1]).toBeCloseTo((2.5 + 1 / 6) * 32)
    const ends = calls.filter((c) => c.op === 'lineTo').map((c) => c.args[0] as number)
    expect(ends[0]).toBeCloseTo((1.5 - 1 / 6) * 32)
    expect(ends[1]).toBeCloseTo(4 * 32)
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
    const { ctx, raw, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall] }), viewport)

    // Only the wall closes its path (no regions in the model).
    expect(calls.filter((c) => c.op === 'closePath')).toHaveLength(1)
    expect(calls.filter((c) => c.op === 'stroke' && c.fillStyle === WALL_BODY_COLOR)).toHaveLength(
      1,
    )
    expect(calls.filter((c) => c.op === 'stroke' && c.fillStyle === WALL_LINE_COLOR)).toHaveLength(
      1,
    )
    expect(raw.lineJoin).toBe('round')
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
    const { ctx, raw, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ walls: [wall] }), viewport)

    expect(calls.some((c) => c.op === 'closePath')).toBe(false)
    expect(raw.lineCap).toBe('round')
  })

  it('draws a closed door as a filled rectangle along its opening', () => {
    const door = { id: 'd1', a: { x: 1, y: 0 }, b: { x: 2, y: 0 }, openAngle: 0, imageId: null }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ doors: [door] }), viewport)

    const doorRects = calls.filter((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)
    expect(doorRects).toHaveLength(1)
  })

  it('falls back to a filled door when its texture is missing from the pool', () => {
    const door = {
      id: 'd1',
      a: { x: 1, y: 0 },
      b: { x: 2, y: 0 },
      openAngle: 0,
      imageId: 'door-iron',
    }
    const textures = { tileTextures: {}, objectTextures: {}, elementImages: {} }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ doors: [door] }), viewport, textures)

    expect(calls.some((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)).toBe(true)
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
  })

  it('falls back to a filled door when the whole atlas is absent', () => {
    const door = {
      id: 'd1',
      a: { x: 1, y: 0 },
      b: { x: 2, y: 0 },
      openAngle: 0,
      imageId: 'door-iron',
    }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ doors: [door] }), viewport)

    expect(calls.some((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)).toBe(true)
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
  })

  it('draws a textured closed door from the element image pool', () => {
    const door = {
      id: 'd1',
      a: { x: 1, y: 0 },
      b: { x: 2, y: 0 },
      openAngle: 0,
      imageId: 'door-iron',
    }
    const image = {} as HTMLImageElement
    const textures = { tileTextures: {}, objectTextures: {}, elementImages: { 'door-iron': image } }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ doors: [door] }), viewport, textures)

    expect(calls.some((c) => c.op === 'drawImage' && c.args[0] === image)).toBe(true)
    expect(calls.some((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)).toBe(false)
  })

  it('draws an open door as a leaf strip (no texture rotation)', () => {
    // A textured door, but open → the leaf is a plain fill, not the texture.
    const door = {
      id: 'd1',
      a: { x: 1, y: 1 },
      b: { x: 2, y: 1 },
      openAngle: 90,
      imageId: 'door-iron',
    }
    const image = {} as HTMLImageElement
    const textures = { tileTextures: {}, objectTextures: {}, elementImages: { 'door-iron': image } }
    const { ctx, raw, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ doors: [door] }), viewport, textures)

    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
    expect(
      calls.filter((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR),
    ).toHaveLength(1)
    // 90° rotation about the hinge maps the leaf onto the vertical axis.
    expect(raw.lastRotate).toBeCloseTo(Math.PI / 2)
  })

  it('rotates the leaf by an arbitrary open angle', () => {
    const door = {
      id: 'd1',
      a: { x: 1, y: 1 },
      b: { x: 2, y: 1 },
      openAngle: 45,
      imageId: null,
    }
    const { ctx, raw, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ doors: [door] }), viewport)

    expect(
      calls.filter((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR),
    ).toHaveLength(1)
    expect(raw.lastRotate).toBeCloseTo(Math.PI / 4)
  })

  it('anchors the door translation at the hinge point', () => {
    const door = { id: 'd1', a: { x: 2, y: 3 }, b: { x: 3, y: 3 }, openAngle: 0, imageId: null }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ doors: [door] }), viewport)

    const translate = calls.find((c) => c.op === 'translate')
    expect(translate?.args).toEqual([2 * 32, 3 * 32])
  })

  it('falls back to a colour ellipse for objects without a sprite', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ objects: [{ id: 1, kindId: 'torch', x: 1, y: 1 }] }), viewport)

    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === OBJECT_COLORS.torch)).toBe(true)
  })

  it('anchors object rendering at the float top-left plus half the footprint', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(
      ctx,
      baseModel({
        objects: [{ id: 1, kindId: 'torch', x: 1.5, y: 2, scale: { w: 2, h: 1 } }],
      }),
      viewport,
    )

    // cx = 1.5*32 + (2*32)/2 = 80; cy = 2*32 + (1*32)/2 = 80.
    const translate = calls.find((c) => c.op === 'translate')
    expect(translate?.args).toEqual([1.5 * 32 + 32, 2 * 32 + 16])
  })

  it('draws objects below the walls (layer order)', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      { id: 'w1' },
    )
    const { ctx, calls } = makeFakeCtx()
    renderMap(
      ctx,
      baseModel({ objects: [{ id: 1, kindId: 'torch', x: 1, y: 1 }], walls: [wall] }),
      viewport,
    )

    const objectFill = calls.findIndex((c) => c.op === 'fill' && c.fillStyle === OBJECT_COLORS.torch)
    const wallStroke = calls.findIndex((c) => c.op === 'stroke' && c.fillStyle === WALL_BODY_COLOR)
    expect(objectFill).toBeGreaterThanOrEqual(0)
    expect(wallStroke).toBeGreaterThan(objectFill)
  })

  it('draws light glow and marker by default', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(
      ctx,
      baseModel({ lights: [{ id: 1, x: 1, y: 1, radius: 2, color: '#ffdd88' }] }),
      viewport,
    )

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
    // Grid points still draw arcs; the light glow/marker must not.
    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === LIGHT_MARKER_COLOR)).toBe(false)
    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === LIGHT_GLOW_COLOR)).toBe(false)
  })

  it('draws an object with its texture stretched to the footprint', () => {
    const image = {} as HTMLImageElement
    const textures = { tileTextures: {}, objectTextures: { table: image }, elementImages: {} }
    const { ctx, calls } = makeFakeCtx()
    renderMap(
      ctx,
      baseModel({ objects: [{ id: 1, kindId: 'table', x: 1, y: 1, scale: { w: 2, h: 1 } }] }),
      viewport,
      textures,
    )

    // w=64, h=32 → drawImage(-32, -16, 64, 32) around the translated centre.
    const drawn = calls.find((c) => c.op === 'drawImage' && c.args[0] === image)
    expect(drawn?.args).toEqual([image, -32, -16, 64, 32])
    // No colour swatch when a texture is present.
    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === OBJECT_COLORS.table)).toBe(false)
  })

  it('rotates an object texture around its centre', () => {
    const image = {} as HTMLImageElement
    const textures = { tileTextures: {}, objectTextures: { table: image }, elementImages: {} }
    const { ctx, calls, raw } = makeFakeCtx()
    renderMap(
      ctx,
      baseModel({ objects: [{ id: 1, kindId: 'table', x: 1, y: 1, rotation: 90 }] }),
      viewport,
      textures,
    )

    expect(raw.lastRotate).toBeCloseTo(Math.PI / 2)
    expect(calls.some((c) => c.op === 'drawImage' && c.args[0] === image)).toBe(true)
  })

  it('prefers the user image override over the object texture', () => {
    const texture = {} as HTMLImageElement
    const override = {} as HTMLImageElement
    const textures = {
      tileTextures: {},
      objectTextures: { table: texture },
      elementImages: { 'table-round': override },
      imageOverrides: { table: 'table-round' },
    }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ objects: [{ id: 1, kindId: 'table', x: 1, y: 1 }] }), viewport, textures)

    const drawn = calls.filter((c) => c.op === 'drawImage').map((c) => c.args[0])
    expect(drawn).toContain(override)
    expect(drawn).not.toContain(texture)
  })

  it('falls through to the object texture when the override image is absent', () => {
    const texture = {} as HTMLImageElement
    const textures = {
      tileTextures: {},
      objectTextures: { table: texture },
      elementImages: {},
      imageOverrides: { table: 'table-round' },
    }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ objects: [{ id: 1, kindId: 'table', x: 1, y: 1 }] }), viewport, textures)

    expect(calls.some((c) => c.op === 'drawImage' && c.args[0] === texture)).toBe(true)
  })

  it('treats an explicit null override as the kind default (uses the manifest texture)', () => {
    const texture = {} as HTMLImageElement
    const defaultImage = {} as HTMLImageElement
    const textures = {
      tileTextures: {},
      objectTextures: { table: texture },
      elementImages: { 'table-wooden': defaultImage },
      imageOverrides: { table: null },
    }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ objects: [{ id: 1, kindId: 'table', x: 1, y: 1 }] }), viewport, textures)

    const drawn = calls.filter((c) => c.op === 'drawImage').map((c) => c.args[0])
    expect(drawn).toContain(texture)
    expect(drawn).not.toContain(defaultImage)
  })

  it('falls back to the kind default element image when no texture is loaded', () => {
    const fallback = {} as HTMLImageElement
    const textures = {
      tileTextures: {},
      objectTextures: {},
      elementImages: { 'table-wooden': fallback },
    }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ objects: [{ id: 1, kindId: 'table', x: 1, y: 1 }] }), viewport, textures)

    expect(calls.some((c) => c.op === 'drawImage' && c.args[0] === fallback)).toBe(true)
  })

  it('prefers the kind object texture over its default element image', () => {
    const texture = {} as HTMLImageElement
    const elementImage = {} as HTMLImageElement
    const textures = {
      tileTextures: {},
      objectTextures: { table: texture },
      elementImages: { 'table-wooden': elementImage },
    }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ objects: [{ id: 1, kindId: 'table', x: 1, y: 1 }] }), viewport, textures)

    const drawn = calls.filter((c) => c.op === 'drawImage').map((c) => c.args[0])
    expect(drawn).toContain(texture)
    expect(drawn).not.toContain(elementImage)
  })

  it('draws landscape textures before the grid and object textures after it', () => {
    const regionImage = {} as HTMLImageElement
    const objectImage = {} as HTMLImageElement
    const textures = {
      tileTextures: { floor: { image: regionImage, size: 64 } },
      objectTextures: { table: objectImage },
      elementImages: {},
    }
    const region = createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')
    const { ctx, calls } = makeFakeCtx()
    renderMap(
      ctx,
      baseModel({ regions: [region], objects: [{ id: 1, kindId: 'table', x: 1, y: 1 }] }),
      viewport,
      textures,
    )

    const regionIndex = calls.findIndex((c) => c.op === 'drawImage' && c.args[0] === regionImage)
    const gridIndex = calls.findIndex((c) => c.op === 'arc')
    const objectIndex = calls.findIndex((c) => c.op === 'drawImage' && c.args[0] === objectImage)
    expect(regionIndex).toBeGreaterThanOrEqual(0)
    expect(gridIndex).toBeGreaterThan(regionIndex)
    expect(objectIndex).toBeGreaterThan(gridIndex)
  })

  it('tiles a region with its texture, scaled by the viewport cell size', () => {
    const image = {} as HTMLImageElement
    const textures = {
      tileTextures: { floor: { image, size: 64 } },
      objectTextures: {},
      elementImages: {},
    }
    // size 64 = 1 клетка (ref 64); cellSize 32 → плитка 32px; 4×4 клетки → 4×4 плиток.
    const region = createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), viewport, textures)

    expect(calls.some((c) => c.op === 'clip')).toBe(true)
    const drawn = calls.filter((c) => c.op === 'drawImage')
    expect(drawn).toHaveLength(16)
    expect(drawn[0].args).toEqual([image, 0, 0, 32, 32])
    expect(drawn[15].args).toEqual([image, 96, 96, 32, 32])
  })

  it('scales the texture tile with the zoom (cell size)', () => {
    const image = {} as HTMLImageElement
    const textures = {
      tileTextures: { floor: { image, size: 128 } },
      objectTextures: {},
      elementImages: {},
    }
    const region = createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')
    const { ctx, calls } = makeFakeCtx(512, 512)
    renderMap(ctx, baseModel({ regions: [region] }), { ...viewport, cellSize: 64 }, textures)

    // size 128 = 2 клетки; cellSize 64 → плитка 128px; 4×4 клетки → 2×2 плиток.
    const drawn = calls.filter((c) => c.op === 'drawImage')
    expect(drawn).toHaveLength(4)
    expect(drawn[0].args).toEqual([image, 0, 0, 128, 128])
  })

  it('anchors the texture phase to the world, independent of scroll', () => {
    const image = {} as HTMLImageElement
    const textures = {
      tileTextures: { floor: { image, size: 64 } },
      objectTextures: {},
      elementImages: {},
    }
    // Регион не выровнен по мировому нулю; вьюпорт прокручен.
    const region = createTerrainRegion('floor', square(0.5, 0.5, 2.5, 1.5), 0, 'r')
    const scrolled: Viewport = { ...viewport, offsetX: 10, offsetY: 20 }
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), scrolled, textures)

    const drawn = calls.filter((c) => c.op === 'drawImage')
    // worldSize 1 клетка; cols 0..2, rows 0..1 → 6 плиток, фаза от мирового нуля.
    expect(drawn).toHaveLength(6)
    expect(drawn[0].args).toEqual([image, -10, -20, 32, 32])
    expect(drawn[5].args).toEqual([image, 54, 12, 32, 32])
  })

  it('falls back to colour when the texture tile count exceeds the cap', () => {
    const image = {} as HTMLImageElement
    const textures = {
      tileTextures: { floor: { image, size: 64 } },
      objectTextures: {},
      elementImages: {},
    }
    const side = Math.ceil(Math.sqrt(MAX_TEXTURE_TILES_PER_REGION)) + 1
    const region = createTerrainRegion('floor', square(0, 0, side, side), 0, 'r')
    const { ctx, calls } = makeFakeCtx(64, 64)
    renderMap(ctx, baseModel({ regions: [region] }), viewport, textures)

    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === TILE_COLORS.floor)).toBe(true)
  })

  it('still tiles a region whose tile count is just under the cap', () => {
    const image = {} as HTMLImageElement
    const textures = {
      tileTextures: { floor: { image, size: 64 } },
      objectTextures: {},
      elementImages: {},
    }
    const side = Math.floor(Math.sqrt(MAX_TEXTURE_TILES_PER_REGION)) - 2
    const region = createTerrainRegion('floor', square(0, 0, side, side), 0, 'r')
    const { ctx, calls } = makeFakeCtx(64, 64)
    renderMap(ctx, baseModel({ regions: [region] }), viewport, textures)

    expect(calls.filter((c) => c.op === 'drawImage')).toHaveLength(side * side)
  })

  it('tiles a region deterministically across renders', () => {
    const image = {} as HTMLImageElement
    const textures = {
      tileTextures: { floor: { image, size: 64 } },
      objectTextures: {},
      elementImages: {},
    }
    const region = createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')
    const first = makeFakeCtx()
    const second = makeFakeCtx()
    renderMap(first.ctx, baseModel({ regions: [region] }), viewport, textures)
    renderMap(second.ctx, baseModel({ regions: [region] }), viewport, textures)

    const drawnArgs = (calls: { op: string; args: unknown[] }[]) =>
      calls.filter((c) => c.op === 'drawImage').map((c) => c.args)
    expect(drawnArgs(second.calls)).toEqual(drawnArgs(first.calls))
  })

  it('renders a region with colour only when no texture is loaded', () => {
    const region = createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, baseModel({ regions: [region] }), viewport)

    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === TILE_COLORS.floor)).toBe(true)
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
  })

  it('tiles a region with deterministic variants from the texture pool', () => {
    const base = {} as HTMLImageElement
    const variantA = {} as HTMLImageElement
    const variantB = {} as HTMLImageElement
    const textures = {
      tileTextures: { floor: { image: base, size: 64, pool: [variantA, variantB] } },
      objectTextures: {},
      elementImages: {},
    }
    const region = createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')
    const first = makeFakeCtx()
    const second = makeFakeCtx()
    renderMap(first.ctx, baseModel({ regions: [region] }), viewport, textures)
    renderMap(second.ctx, baseModel({ regions: [region] }), viewport, textures)

    const imagesOf = (calls: { op: string; args: unknown[] }[]) =>
      calls.filter((c) => c.op === 'drawImage').map((c) => c.args[0])
    const firstImages = imagesOf(first.calls)
    expect(firstImages).toHaveLength(16)
    expect(firstImages).not.toContain(base)
    expect(new Set(firstImages).size).toBeGreaterThan(1)
    // Вариант — функция координаты плитки (col, row), а не порядка обхода:
    // сверяем всю row-major последовательность (ловит и транспонирование, и
    // смену обхода цикла).
    const pool = [variantA, variantB]
    const expected: HTMLImageElement[] = []
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        expected.push(pool[pickIndexFromCoords(col, row, pool.length)])
      }
    }
    expect(firstImages).toEqual(expected)
    expect(imagesOf(second.calls)).toEqual(firstImages)
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
