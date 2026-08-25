import { afterEach, describe, expect, it, vi } from 'vitest'
import { unzipSync } from 'fflate'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import { makeFakeCtx } from '../render/testFakeCtx'
import {
  UVTT_MAP_NAME,
  UVTT_PIXELS_PER_GRID,
  buildLineOfSight,
  buildMapJson,
  edgeSegment,
  exportMapToUvtt,
} from './uvtt'
import { fromUtf8 } from './zip'

const PPG = 64

describe('edgeSegment', () => {
  it('returns endpoints for all sides including perimeter', () => {
    expect(edgeSegment({ x: 1, y: 1, side: 'N' })).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(edgeSegment({ x: 3, y: 1, side: 'E' })).toEqual([
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ])
    expect(edgeSegment({ x: 1, y: 3, side: 'S' })).toEqual([
      { x: 1, y: 4 },
      { x: 2, y: 4 },
    ])
  })
})

describe('buildLineOfSight', () => {
  it('returns no polygons for an empty wall set', () => {
    expect(buildLineOfSight([], PPG)).toEqual([])
  })

  it('closes a rectangle of walls into one polygon in pixels', () => {
    const walls = [
      { x: 0, y: 0, side: 'N' as const }, // (0,0)-(1,0)
      { x: 1, y: 0, side: 'N' as const }, // (1,0)-(2,0)
      { x: 1, y: 0, side: 'E' as const }, // (2,0)-(2,1)
      { x: 1, y: 1, side: 'E' as const }, // (2,1)-(2,2)
      { x: 1, y: 1, side: 'S' as const }, // (1,2)-(2,2)
      { x: 0, y: 1, side: 'S' as const }, // (0,2)-(1,2)
      { x: 0, y: 1, side: 'W' as const }, // (0,1)-(0,2)
      { x: 0, y: 0, side: 'W' as const }, // (0,0)-(0,1)
    ]
    expect(buildLineOfSight(walls, PPG)).toEqual([
      [
        { x: 0, y: 0 },
        { x: PPG, y: 0 },
        { x: PPG * 2, y: 0 },
        { x: PPG * 2, y: PPG },
        { x: PPG * 2, y: PPG * 2 },
        { x: PPG, y: PPG * 2 },
        { x: 0, y: PPG * 2 },
        { x: 0, y: PPG },
      ],
    ])
  })

  it('ignores hanging ends and disconnected chains', () => {
    const walls = [
      // Замкнутый квадрат 1×1.
      { x: 0, y: 0, side: 'N' as const },
      { x: 0, y: 0, side: 'E' as const },
      { x: 0, y: 0, side: 'S' as const },
      { x: 0, y: 0, side: 'W' as const },
      // Висячее ребро в стороне.
      { x: 5, y: 5, side: 'N' as const },
      { x: 5, y: 5, side: 'E' as const },
    ]
    const polygons = buildLineOfSight(walls, PPG)
    expect(polygons).toHaveLength(1)
    expect(polygons[0]).toHaveLength(4)
  })

  it('splits two disjoint loops into two polygons', () => {
    const square = (dx: number, dy: number) =>
      [
        { x: dx, y: dy, side: 'N' as const },
        { x: dx, y: dy, side: 'E' as const },
        { x: dx, y: dy, side: 'S' as const },
        { x: dx, y: dy, side: 'W' as const },
      ] satisfies Array<{ x: number; y: number; side: 'N' | 'E' | 'S' | 'W' }>
    const polygons = buildLineOfSight([...square(0, 0), ...square(4, 4)], PPG)
    expect(polygons).toHaveLength(2)
  })

  it('splits two rooms at a T-junction: the partition stays in line_of_sight', () => {
    // Две смежные комнаты с общей перегородкой: перегородка — стена,
    // обзор сквозь неё не проходит, поэтому VTT получает контуры ОБЕИХ
    // комнат (дверь в перегородке вырезается порталом, см. buildMapJson).
    const walls = [
      { x: 0, y: 0, side: 'N' as const }, // верх
      { x: 1, y: 0, side: 'N' as const },
      { x: 1, y: 0, side: 'E' as const }, // правая стена
      { x: 1, y: 0, side: 'S' as const }, // низ
      { x: 0, y: 0, side: 'S' as const },
      { x: 0, y: 0, side: 'W' as const }, // левая стена
      { x: 1, y: 0, side: 'W' as const }, // перегородка (1,0)-(1,1)
    ]
    const polygons = buildLineOfSight(walls, PPG)
    expect(polygons).toHaveLength(2)
    for (const polygon of polygons) {
      expect(polygon).toHaveLength(4)
    }
  })

  it('decomposes a 2×1 map with partition into two room outlines in any edge order', () => {
    const walls = [
      { x: 0, y: 0, side: 'N' as const },
      { x: 1, y: 0, side: 'N' as const },
      { x: 1, y: 0, side: 'E' as const },
      { x: 1, y: 0, side: 'S' as const },
      { x: 0, y: 0, side: 'S' as const },
      { x: 0, y: 0, side: 'W' as const },
      // Перегородка — внутреннее ребро; обе комнаты остаются контурами.
      { x: 1, y: 0, side: 'W' as const },
    ]
    // Порядок «перегородка первой»: обход стартует в узле ветвления.
    const partitionFirst = [walls[6], ...walls.slice(0, 6)] as typeof walls
    for (const order of [walls, partitionFirst]) {
      const polygons = buildLineOfSight(order, PPG)
      expect(polygons).toHaveLength(2)
      for (const polygon of polygons) {
        expect(polygon).toHaveLength(4)
      }
    }
  })

  it('ignores a hanging edge attached to a closed loop (spike is dropped)', () => {
    const walls = [
      // Замкнутый квадрат.
      { x: 0, y: 0, side: 'N' as const },
      { x: 0, y: 0, side: 'E' as const },
      { x: 0, y: 0, side: 'S' as const },
      { x: 0, y: 0, side: 'W' as const },
      // Висячая цепочка из вершины квадрата: шип даёт грань нулевой
      // площади и не попадает в line_of_sight.
      { x: 1, y: 0, side: 'N' as const },
      { x: 2, y: 0, side: 'E' as const },
    ]
    const polygons = buildLineOfSight(walls, PPG)
    expect(polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: PPG, y: 0 },
        { x: PPG, y: PPG },
        { x: 0, y: PPG },
      ],
    ])
  })

  it('keeps corner-sharing squares as two separate room outlines', () => {
    const square = (dx: number, dy: number) =>
      [
        { x: dx, y: dy, side: 'N' as const },
        { x: dx, y: dy, side: 'E' as const },
        { x: dx, y: dy, side: 'S' as const },
        { x: dx, y: dy, side: 'W' as const },
      ] satisfies Array<{ x: number; y: number; side: 'N' | 'E' | 'S' | 'W' }>
    // Квадраты (0,0)-(1,1) и (1,1)-(2,2) делят узел (1,1): две комнаты.
    const polygons = buildLineOfSight([...square(0, 0), ...square(1, 1)], PPG)
    expect(polygons).toHaveLength(2)
    for (const polygon of polygons) {
      expect(polygon).toHaveLength(4)
    }
  })
})

describe('buildMapJson', () => {
  function sampleModel(): MapModel {
    let model = applyCommand(createEmptyMap(4, 4), {
      kind: 'setWalls',
      updates: [
        { edge: { x: 0, y: 0, side: 'N' }, present: true },
        { edge: { x: 1, y: 0, side: 'W' }, present: true },
        { edge: { x: 0, y: 0, side: 'S' }, present: true },
        { edge: { x: 0, y: 0, side: 'W' }, present: true },
      ],
    })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 0, y: 0, side: 'N' } })
    model = applyCommand(model, {
      kind: 'addLight',
      x: 1,
      y: 1,
      radius: 6,
      color: '#ffd682',
    })
    return model
  }

  it('excludes the legacy cell object "door" from portals', () => {
    let model = applyCommand(createEmptyMap(4, 4), {
      kind: 'addObject',
      x: 2,
      y: 2,
      kindId: 'door',
    })
    model = applyCommand(model, {
      kind: 'setWalls',
      updates: [{ edge: { x: 0, y: 0, side: 'N' }, present: true }],
    })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 0, y: 0, side: 'N' } })
    const json = buildMapJson(model)
    const portals = json.portals as Array<{ bounds: unknown }>
    expect(portals).toHaveLength(1)
    expect(portals[0].bounds).toEqual([
      { x: 0, y: 0 },
      { x: PPG, y: 0 },
    ])
  })

  it('maps an open east-edge door to an unclosed portal with rotation 0', () => {
    let model = applyCommand(createEmptyMap(3, 3), {
      kind: 'setWalls',
      updates: [{ edge: { x: 1, y: 1, side: 'E' }, present: true }],
    })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 1, y: 1, side: 'E' } })
    model = applyCommand(model, { kind: 'setDoorOpen', id: 1, open: true })

    const json = buildMapJson(model)
    const portals = json.portals as Array<{
      position: { x: number; y: number }
      bounds: Array<{ x: number; y: number }>
      rotation: number
      closed: boolean
    }>
    expect(portals).toEqual([
      {
        position: { x: PPG * 2, y: PPG * 1.5 },
        bounds: [
          { x: PPG * 2, y: PPG },
          { x: PPG * 2, y: PPG * 2 },
        ],
        rotation: 0,
        closed: false,
        enabled: true,
      },
    ])
  })

  it('produces a deterministic known-answer map.json', () => {
    const json = buildMapJson(sampleModel())
    expect(json).toEqual({
      format: '0.3',
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 4, y: 4 },
        pixels_per_grid: PPG,
      },
      line_of_sight: [
        [
          { x: 0, y: 0 },
          { x: PPG, y: 0 },
          { x: PPG, y: PPG },
          { x: 0, y: PPG },
        ],
      ],
      portals: [
        {
          position: { x: PPG / 2, y: 0 },
          bounds: [
            { x: 0, y: 0 },
            { x: PPG, y: 0 },
          ],
          rotation: 90,
          closed: true,
          enabled: true,
        },
      ],
      lights: [
        {
          position: { x: PPG * 1.5, y: PPG * 1.5 },
          range: 6,
          intensity: 1,
          color: '#ffd682',
          shadows: true,
        },
      ],
      environment: {
        ambient_light: '#ffffff',
        ambient_intensity: 0.4,
      },
    })
  })
})

describe('exportMapToUvtt', () => {
  function stubCanvasRenderingContext() {
    const { ctx } = makeFakeCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: (blob: Blob | null) => void,
    ) {
      callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }))
    })
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects non-square grids', async () => {
    await expect(exportMapToUvtt(createEmptyMap(4, 4, 'hex-pointy'))).rejects.toThrow(
      /square grids only/,
    )
    await expect(exportMapToUvtt(createEmptyMap(4, 4, 'hex-flat'))).rejects.toThrow(
      /square grids only/,
    )
  })

  it('builds a zip with map.json and the rendered png', async () => {
    stubCanvasRenderingContext()
    const model = applyCommand(createEmptyMap(2, 2), {
      kind: 'setWalls',
      updates: [
        { edge: { x: 0, y: 0, side: 'N' }, present: true },
        { edge: { x: 1, y: 0, side: 'W' }, present: true },
        { edge: { x: 0, y: 0, side: 'S' }, present: true },
        { edge: { x: 0, y: 0, side: 'W' }, present: true },
      ],
    })

    const blob = await exportMapToUvtt(model)
    expect(blob.type).toBe('application/octet-stream')

    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual([`${UVTT_MAP_NAME}.png`, 'map.json'])

    // PNG-запись — те же байты, что отдал canvas.toBlob.
    expect(Array.from(files[`${UVTT_MAP_NAME}.png`])).toEqual([0x89, 0x50, 0x4e, 0x47])

    // map.json внутри архива — сериализованный buildMapJson.
    const parsed = JSON.parse(fromUtf8(files['map.json']))
    expect(parsed.format).toBe('0.3')
    expect(parsed.resolution).toEqual({
      map_origin: { x: 0, y: 0 },
      map_size: { x: 2, y: 2 },
      pixels_per_grid: UVTT_PIXELS_PER_GRID,
    })
    expect(parsed.line_of_sight).toHaveLength(1)
  })
})
