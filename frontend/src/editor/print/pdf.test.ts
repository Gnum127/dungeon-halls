import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import { PDF_TITLE, PRINT_DPI, assemblePdf, computePrintLayout, exportMapToPdf } from './pdf'

// Валидный PNG 1×1: jsPDF парсит его как изображение страницы.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function toLatin1(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return text
}

describe('computePrintLayout', () => {
  it('maps A4 portrait with 1-inch cells to known pt geometry', () => {
    expect(computePrintLayout('a4', 'portrait', 1)).toEqual({
      // floor(595.28 / 72) × floor(841.89 / 72)
      pageCols: 8,
      pageRows: 11,
      rasterCellPx: PRINT_DPI,
      pageWidthPt: 595.28,
      pageHeightPt: 841.89,
    })
  })

  it('swaps sides in landscape and halves the cell at 0.5 inches', () => {
    const landscape = computePrintLayout('letter', 'landscape', 1)
    expect(landscape.pageWidthPt).toBe(792)
    expect(landscape.pageHeightPt).toBe(612)

    const half = computePrintLayout('a4', 'portrait', 0.5)
    expect(half.pageCols).toBe(16)
    expect(half.pageRows).toBe(23)
    expect(half.rasterCellPx).toBe(PRINT_DPI / 2)
  })

  it('keeps at least one cell per side even if a cell exceeds the sheet', () => {
    const huge = computePrintLayout('a4', 'portrait', 10)
    expect(huge.pageCols).toBe(1)
    expect(huge.pageRows).toBe(1)
  })
})

describe('assemblePdf', () => {
  it('builds one PDF page per image with pt geometry and title metadata', async () => {
    const blob = assemblePdf(
      [TINY_PNG, TINY_PNG],
      { pageWidthPt: 595.28, pageHeightPt: 841.89 },
      PDF_TITLE,
    )
    const text = await toLatin1(blob)

    expect(text.startsWith('%PDF')).toBe(true)
    // Ровно две страницы.
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(2)
    // Размер страницы в пунктах: MediaBox [0 0 width height] = A4-портрет.
    const mediaBox = /MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(text)
    expect(mediaBox).not.toBeNull()
    expect(Number(mediaBox?.[1])).toBeCloseTo(595.28, 2)
    expect(Number(mediaBox?.[2])).toBeCloseTo(841.89, 2)
    // Title из константы попал в метаданные.
    expect(text).toContain(`/Title (${PDF_TITLE})`)
  })

  it('keeps landscape geometry as given (no side swapping inside jsPDF)', async () => {
    const blob = assemblePdf([TINY_PNG], { pageWidthPt: 792, pageHeightPt: 612 }, PDF_TITLE)
    const text = await toLatin1(blob)
    const mediaBox = /MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(text)
    expect(Number(mediaBox?.[1])).toBeCloseTo(792, 2)
    expect(Number(mediaBox?.[2])).toBeCloseTo(612, 2)
  })

  it('produces a non-empty blob slightly larger than its images', () => {
    const pngBytes = Math.floor((TINY_PNG.length - 'data:image/png;base64,'.length) * 0.75)
    const blob = assemblePdf(
      [TINY_PNG, TINY_PNG],
      { pageWidthPt: 612, pageHeightPt: 792 },
      PDF_TITLE,
    )
    // Smoke: архив не пуст и тяжелее суммы картинок (заголовки + метаданные).
    expect(blob.size).toBeGreaterThan(pngBytes * 2)
    expect(blob.size).toBeLessThan(pngBytes * 2 * 100)
  })
})

describe('exportMapToPdf', () => {
  function makeRender() {
    return vi.fn<
      (
        model: unknown,
        page: unknown,
        pageSize: unknown,
        rasterCellPx: number,
        includeLight: boolean,
      ) => string
    >(() => TINY_PNG)
  }

  it('renders each paginated page through the injected renderer', async () => {
    const render = makeRender()
    // Карта 20×15, A4 1": страницы 8×11 клеток → 3×2 = 6 страниц.
    const blob = await exportMapToPdf(createEmptyMap(20, 15), {}, render)

    expect(render).toHaveBeenCalledTimes(6)
    expect(render.mock.calls[0]?.[1]).toEqual({ col: 0, row: 0, cols: 8, rows: 11 })
    expect(render.mock.calls[1]?.[1]).toEqual({ col: 8, row: 0, cols: 8, rows: 11 })
    expect(render.mock.calls[3]?.[1]).toEqual({ col: 0, row: 11, cols: 8, rows: 4 })
    // Полный размер страницы на всех вызовах, растр 180px/клетку.
    for (const call of render.mock.calls) {
      expect(call[2]).toEqual({ cols: 8, rows: 11 })
      expect(call[3]).toBe(180)
      expect(call[4]).toBe(false)
    }
    expect((await toLatin1(await blob)).match(/\/Type \/Page\b/g)).toHaveLength(6)
  })

  it('passes options through: light flag, paper and cell scale', async () => {
    const render = makeRender()
    await exportMapToPdf(
      createEmptyMap(2, 2),
      { paper: 'a3', orientation: 'landscape', cellInches: 0.5, includeLight: true },
      render,
    )

    expect(render).toHaveBeenCalledTimes(1)
    const [model, , pageSize, rasterCellPx, includeLight] = render.mock.calls[0] as [
      unknown,
      unknown,
      unknown,
      number,
      boolean,
    ]
    expect(model).toBeDefined()
    // A3 в ландшафте: 1190.55×841.89pt / 36pt (0.5") → 33×23 клетки.
    expect(pageSize).toEqual({ cols: 33, rows: 23 })
    expect(rasterCellPx).toBe(PRINT_DPI / 2)
    expect(includeLight).toBe(true)
  })

  it('rejects non-square grids', async () => {
    await expect(exportMapToPdf(createEmptyMap(2, 2, 'hex-flat'))).rejects.toThrow(
      /square grids only/,
    )
    await expect(exportMapToPdf(createEmptyMap(2, 2, 'hex-pointy'))).rejects.toThrow(
      /square grids only/,
    )
  })
})
