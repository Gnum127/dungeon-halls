import { describe, expect, it, vi } from 'vitest'
import { EXPORT_CELL_SIZE, renderToCanvas } from './pngExport'
import { createEmptyMap } from '../model/createEmptyMap'
import { createTerrainRegion } from '../model/regions'
import { makeFakeCtx } from '../render/testFakeCtx'
import type { Point } from '@/shared/point'

const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

describe('renderToCanvas', () => {
  it('rejects a map larger than the canvas limits before allocating', () => {
    const big = createEmptyMap(1000, 1)
    expect(() => renderToCanvas(big)).toThrow(/exceeds canvas limits/)
  })

  it('rejects an invalid page window', () => {
    const model = createEmptyMap(4, 4)
    expect(() =>
      renderToCanvas(model, EXPORT_CELL_SIZE, undefined, {
        page: { col: -1, row: 0, cols: 1, rows: 1 },
      }),
    ).toThrow(/col/)
  })

  it('rejects a pageSize smaller than the page window', () => {
    const model = createEmptyMap(4, 4)
    expect(() =>
      renderToCanvas(model, EXPORT_CELL_SIZE, undefined, {
        page: { col: 0, row: 0, cols: 2, rows: 2 },
        pageSize: { cols: 1, rows: 1 },
      }),
    ).toThrow(/must not be smaller/)
  })

  it('forwards the texture atlas to the offscreen render', () => {
    const { ctx, calls } = makeFakeCtx()
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    getContext.mockImplementation(() => ctx)
    try {
      const image = {} as HTMLImageElement
      const model = {
        ...createEmptyMap(4, 4),
        regions: [createTerrainRegion('floor', square(0, 0, 4, 4), 0, 'r')],
      }
      renderToCanvas(model, 64, {
        tileTextures: { floor: { image, size: 64 } },
        objectTextures: {},
        elementImages: {},
      })

      expect(calls.some((c) => c.op === 'drawImage' && c.args[0] === image)).toBe(true)
    } finally {
      getContext.mockRestore()
    }
  })
})
