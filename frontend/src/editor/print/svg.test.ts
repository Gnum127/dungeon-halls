import { describe, expect, it } from 'vitest'
import { buildSvg } from './svg'
import { createTerrainRegion } from '../model/regions'
import { createWallSegment } from '../model/wallSegments'
import { MAP_VERSION } from '../model/types'
import {
  DOOR_FILL_COLOR,
  LIGHT_MARKER_COLOR,
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

  it('renders a door as a filled rectangle', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      { id: 'w1' },
    )
    const door = { id: 'd1', wallSegmentId: 'w1', position: 0.5, open: false, imageId: null }
    const svg = buildSvg(model({ walls: [wall], doors: [door] }))

    expect(svg).toContain(`fill="${DOOR_FILL_COLOR}"`)
  })

  it('draws stair steps clipped to a stairs region', () => {
    const svg = buildSvg(
      model({ regions: [createTerrainRegion('stairs', square(0, 0, 2, 2), 0, 'r')] }),
    )
    expect(svg).toContain(`stroke="${STAIRS_STEP_COLOR}"`)
    expect(svg).toContain('clip-path="url(#stairs-0)"')
    expect(svg).toContain('<clipPath id="stairs-0">')
  })

  it('omits lights unless includeLight is set', () => {
    const withLight = model({ lights: [{ id: 1, x: 1, y: 1, radius: 2, color: '#ffdd88' }] })
    expect(buildSvg(withLight)).not.toContain(LIGHT_MARKER_COLOR)
    expect(buildSvg(withLight, { includeLight: true })).toContain(LIGHT_MARKER_COLOR)
  })
})
