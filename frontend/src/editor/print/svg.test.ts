import { describe, expect, it } from 'vitest'
import { buildSvg, SVG_UNITS_PER_CELL } from './svg'
import { OBJECT_COLORS } from '../model/objects'
import { coverageGridPoints } from '../model/coverage'
import { createTerrainRegion } from '../model/regions'
import { createWallSegment } from '../model/wallSegments'
import { MAP_VERSION } from '../model/types'
import {
  DOOR_FILL_COLOR,
  EMPTY_GRID_POINT_COLOR,
  GRID_POINT_COLOR,
  LIGHT_MARKER_COLOR,
  STAIRS_OUTLINE_COLOR,
  STAIRS_STEP_COLOR,
  TILE_COLORS,
  WALL_BODY_COLOR,
} from '../render/colors'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'

const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

function model(overrides: Partial<MapModel> = {}): MapModel {
  return {
    version: MAP_VERSION,
    grid: { width: 4, height: 4, cellSize: 64 },
    regions: [],
    walls: [],
    doors: [],
    stairs: [],
    objects: [],
    lights: [],
    ...overrides,
  }
}

describe('buildSvg', () => {
  it('emits region polygons coloured by tile type', () => {
    const svg = buildSvg(
      model({ regions: [createTerrainRegion('floor', square(0, 0, 2, 2), 0, 'r')] }),
    )

    expect(svg).toContain('<svg')
    expect(svg).toContain(`fill="${TILE_COLORS.floor}"`)
    expect(svg).toContain('points="0,0 128,0 128,128 0,128"')
  })

  it('anchors object ellipses at the float top-left plus half the footprint', () => {
    const svg = buildSvg(
      model({
        objects: [{ id: 1, kindId: 'torch', x: 1.5, y: 2, scale: { w: 2, h: 1 } }],
      }),
    )
    const s = SVG_UNITS_PER_CELL
    // cx = 1.5*64 + (2*64)/2 = 160; cy = 2*64 + (1*64)/2 = 160.
    expect(svg).toContain(`<ellipse cx="${1.5 * s + s}" cy="${2 * s + s / 2}"`)
    expect(svg).toContain(`fill="${OBJECT_COLORS.torch}"`)
  })

  it('rotates a float-anchored object around its float center', () => {
    const svg = buildSvg(
      model({
        objects: [
          { id: 1, kindId: 'torch', x: 1.5, y: 2, scale: { w: 2, h: 1 }, rotation: 90 },
        ],
      }),
    )
    const s = SVG_UNITS_PER_CELL
    expect(svg).toContain(`transform="rotate(90 ${1.5 * s + s} ${2 * s + s / 2})"`)
  })

  it('draws wall bodies grouped by thickness with per-group stroke width', () => {
    const thin = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      { id: 'w1', thickness: 0.5 },
    )
    const thick = createWallSegment(
      [
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ],
      { id: 'w2', thickness: 1 },
    )
    const svg = buildSvg(model({ walls: [thin, thick] }))

    expect(svg).toContain(`stroke="${WALL_BODY_COLOR}"`)
    expect(svg).toContain('stroke-width="32"')
    expect(svg).toContain('stroke-width="64"')
  })

  it('closes a closed wall contour with Z and rounds joins', () => {
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
    const svg = buildSvg(model({ walls: [wall] }))
    expect(svg).toContain('M0 0L128 0L128 128L0 128Z')
    expect(svg).toContain('stroke-linejoin="round"')
  })

  it('groups same-thickness closed contours into one path (a Z per subpath)', () => {
    const a = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 0 },
      ],
      { id: 'a', thickness: 0.5 },
    )
    const b = createWallSegment(
      [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2, y: 0 },
      ],
      { id: 'b', thickness: 0.5 },
    )
    const svg = buildSvg(model({ walls: [a, b] }))
    const bodyPaths = svg.split('\n').filter((line) => line.includes(`stroke="${WALL_BODY_COLOR}"`))
    expect(bodyPaths).toHaveLength(1)
    expect((bodyPaths[0].match(/Z/g) ?? []).length).toBe(2)
  })

  it('does not close an open wall polyline in SVG', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ],
      { id: 'w1' },
    )
    const svg = buildSvg(model({ walls: [wall] }))
    expect(svg).toContain('M0 0L128 0L128 128')
    expect(svg).not.toContain('Z')
  })

  it('breaks the wall path around a door opening', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      { id: 'w1' },
    )
    const door = { id: 'd1', a: { x: 1.5, y: 0 }, b: { x: 2.5, y: 0 }, openAngle: 0, imageId: null }
    const svg = buildSvg(model({ walls: [wall], doors: [door] }))
    const body = svg.split('\n').find((line) => line.includes(`stroke="${WALL_BODY_COLOR}"`))
    expect(body).toBeDefined()
    expect((body?.match(/M/g) ?? []).length).toBe(2)
    // 64 units/cell: opening 1.5..2.5 ± 1/6 → 85.333 and 170.667.
    expect(svg).toContain('M0 0L85.333 0')
    expect(svg).toContain('M170.667 0L256 0')
  })

  it('draws the grid: bright points only where covered, dim points on the free field', () => {
    const empty = buildSvg(model())
    expect(empty).not.toContain(GRID_POINT_COLOR)
    // Empty 4×4 map → 5×5 = 25 free corners.
    const emptyDots = empty.match(
      new RegExp(`<circle[^>]*fill="${EMPTY_GRID_POINT_COLOR}"`, 'g'),
    )
    expect(emptyDots).toHaveLength(25)

    const withRegion = buildSvg(
      model({ regions: [createTerrainRegion('floor', square(0, 0, 2, 2), 0, 'r')] }),
    )
    // A 2×2 covered block shares lattice corners → 3×3 = 9 unique bright points.
    const dots = withRegion.match(new RegExp(`<circle[^>]*fill="${GRID_POINT_COLOR}"`, 'g'))
    expect(dots).toHaveLength(9)
    const freeDots = withRegion.match(
      new RegExp(`<circle[^>]*fill="${EMPTY_GRID_POINT_COLOR}"`, 'g'),
    )
    expect(freeDots).toHaveLength(25 - 9)

    // Free-field points are drawn smaller than the bright coverage points.
    const brightRadius = Number(
      (
        withRegion.match(
          new RegExp(`<circle[^>]*r="([^"]+)"[^>]*fill="${GRID_POINT_COLOR}"`),
        ) ?? []
      )[1],
    )
    const freeRadii = [
      ...withRegion.matchAll(
        new RegExp(`<circle[^>]*r="([^"]+)"[^>]*fill="${EMPTY_GRID_POINT_COLOR}"`, 'g'),
      ),
    ].map((match) => Number(match[1]))
    expect(freeRadii).toHaveLength(25 - 9)
    expect(freeRadii.every((radius) => radius < brightRadius)).toBe(true)
  })

  it('emits exactly the grid points the canvas uses (print parity)', () => {
    const m = model({ regions: [createTerrainRegion('floor', square(0, 0, 3, 2), 0, 'r')] })
    const expected = coverageGridPoints(m, {
      firstCol: 0,
      lastCol: m.grid.width - 1,
      firstRow: 0,
      lastRow: m.grid.height - 1,
    })
    const matches = [
      ...buildSvg(m).matchAll(
        new RegExp(`<circle cx="([^"]+)" cy="([^"]+)"[^>]*fill="${GRID_POINT_COLOR}"`, 'g'),
      ),
    ]
    const coords = matches.map((match) => ({
      x: Number(match[1]) / SVG_UNITS_PER_CELL,
      y: Number(match[2]) / SVG_UNITS_PER_CELL,
    }))
    expect(coords).toEqual(expected)
  })

  it('renders a door as a filled rectangle along its opening', () => {
    const door = { id: 'd1', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, openAngle: 0, imageId: null }
    const svg = buildSvg(model({ doors: [door] }))

    expect(svg).toContain(`fill="${DOOR_FILL_COLOR}"`)
  })

  it('rotates the leaf around the hinge by the open angle', () => {
    const door = { id: 'd1', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, openAngle: 90, imageId: null }
    const svg = buildSvg(model({ doors: [door] }))

    // Hinge at the origin, leaf along +x rotated 90°; 1 cell = 64 units wide.
    expect(svg).toContain('transform="translate(0 0) rotate(90)"')
    expect(svg).toMatch(/width="64"/)
  })

  it('anchors the SVG leaf rotation at the hinge', () => {
    const door = { id: 'd1', a: { x: 2, y: 3 }, b: { x: 3, y: 3 }, openAngle: 90, imageId: null }
    // 64 units/cell → hinge at (128, 192).
    expect(buildSvg(model({ doors: [door] }))).toContain(
      'transform="translate(128 192) rotate(90)"',
    )
  })

  it('draws a stairs entity contour and steps clipped to it', () => {
    const stairs = [
      {
        id: 's1',
        polygon: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 1 },
          { x: 0, y: 1 },
        ],
      },
    ]
    const svg = buildSvg(model({ stairs }))
    expect(svg).toContain(`stroke="${STAIRS_STEP_COLOR}"`)
    expect(svg).toContain(`stroke="${STAIRS_OUTLINE_COLOR}"`)
    expect(svg).toContain('clip-path="url(#stairs-0)"')
    expect(svg).toContain('<clipPath id="stairs-0">')
    // The step path is not empty (at least one M…L… subpath).
    expect(svg).toMatch(/d="M[^"]*L[^"]*"[^>]*clip-path="url\(#stairs-0\)"/)
  })

  it('omits lights unless includeLight is set', () => {
    const withLight = model({ lights: [{ id: 1, x: 1, y: 1, radius: 2, color: '#ffdd88' }] })
    expect(buildSvg(withLight)).not.toContain(LIGHT_MARKER_COLOR)
    expect(buildSvg(withLight, { includeLight: true })).toContain(LIGHT_MARKER_COLOR)
  })
})
