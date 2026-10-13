import { describe, expect, it } from 'vitest'
import { EXPORT_CELL_SIZE, renderToCanvas } from './pngExport'
import { createEmptyMap } from '../model/createEmptyMap'

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
})
