import { describe, expect, it } from 'vitest'
import { paginateMap } from './pages'

describe('paginateMap', () => {
  it('puts a map smaller than the page on a single top-left page', () => {
    expect(paginateMap(2, 2, 5, 4)).toEqual([{ col: 0, row: 0, cols: 2, rows: 2 }])
  })

  it('splits an exact multiple into full pages in row-major order', () => {
    const pages = paginateMap(4, 4, 2, 2)
    expect(pages).toEqual([
      { col: 0, row: 0, cols: 2, rows: 2 },
      { col: 2, row: 0, cols: 2, rows: 2 },
      { col: 0, row: 2, cols: 2, rows: 2 },
      { col: 2, row: 2, cols: 2, rows: 2 },
    ])
  })

  it('clips the last column and row to the remaining cells', () => {
    const pages = paginateMap(5, 3, 2, 2)
    // Колонки клеток: 2+2+1, ряды: 2+1 → 6 страниц.
    expect(pages).toHaveLength(6)
    const lastCol = pages.filter((page) => page.col === 4)
    for (const page of lastCol) {
      expect(page.cols).toBe(1)
    }
    const lastRow = pages.filter((page) => page.row === 2)
    for (const page of lastRow) {
      expect(page.rows).toBe(1)
    }
    expect(lastCol).toHaveLength(2)
    expect(lastRow).toHaveLength(3)
  })

  it.each([0, -1, 1.5])('rejects non-positive or fractional arguments (%d)', (bad) => {
    expect(() => paginateMap(bad, 4, 2, 2)).toThrow(RangeError)
    expect(() => paginateMap(4, bad, 2, 2)).toThrow(RangeError)
    expect(() => paginateMap(4, 4, bad, 2)).toThrow(RangeError)
    expect(() => paginateMap(4, 4, 2, bad)).toThrow(RangeError)
  })
})
