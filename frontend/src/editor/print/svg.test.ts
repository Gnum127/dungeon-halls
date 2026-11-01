import { describe, expect, it } from 'vitest'
import { buildSvg } from './svg'
import { createTerrainRegion } from '../model/regions'
import { createWallSegment } from '../model/wallSegments'
import { MAP_VERSION } from '../model/types'
import {
  DOOR_FILL_COLOR,
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
    const svg = buildSvg(model({ regions: [createTerrainRegion('floor', square(0, 0, 2, 2), 0, 'r')] }))

    expect(svg).toContain('<svg')
    expect(svg).toContain(`fill="${TILE_COLORS.floor}"`)
    expect(svg).toContain('points="0,0 128,0 128,128 0,128"')
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

  it('renders a door as a filled rectangle along its opening', () => {
    const door = { id: 'd1', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, openAngle: 0, imageId: null }
    const svg = buildSvg(model({ doors: [door] }))

    expect(svg).toContain(`fill="${DOOR_FILL_COLOR}"`)
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
  })

  it('omits lights unless includeLight is set', () => {
    const withLight = model({ lights: [{ id: 1, x: 1, y: 1, radius: 2, color: '#ffdd88' }] })
    expect(buildSvg(withLight)).not.toContain(LIGHT_MARKER_COLOR)
    expect(buildSvg(withLight, { includeLight: true })).toContain(LIGHT_MARKER_COLOR)
  })
})
