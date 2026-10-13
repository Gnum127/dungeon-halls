import { renderToCanvas } from '../tools/pngExport'
import type { MapModel } from '../model/types'
import { paginateMap } from './pages'

/** Title в метаданных PDF; поле name в модель карты не добавляем. */
export const PDF_TITLE = 'dungeon-halls-map'

export type PaperSize = 'a4' | 'a3' | 'letter'
export type PrintOrientation = 'portrait' | 'landscape'

/** Целевое разрешение растра страниц: 64px/клетку при печати — мыло. */
export const PRINT_DPI = 180

/** Размеры листов в пунктах (pt, 1pt = 1/72 дюйма): [ширина, высота]. */
const PAPER_PT: Record<PaperSize, [number, number]> = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  letter: [612, 792],
}

export interface PrintLayout {
  /** Страница в клетках карты (лист округляется ВНИЗ до целых клеток). */
  readonly pageCols: number
  readonly pageRows: number
  /** Пикселей на клетку в растре страницы (= PRINT_DPI × cellInches). */
  readonly rasterCellPx: number
  readonly pageWidthPt: number
  readonly pageHeightPt: number
}

export interface BuildPdfOptions {
  readonly paper?: PaperSize
  readonly orientation?: PrintOrientation
  /** Клетка в дюймах: 1" — стандарт D&D (5 футов), 0.5" — компакт. */
  readonly cellInches?: number
  readonly includeLight?: boolean
}

/**
 * Геометрия печати без DOM: размер страницы в клетках и растре.
 * Чистая функция — known-answer тесты фиксируют соответствие pt/дюймам.
 */
export function computePrintLayout(
  paper: PaperSize,
  orientation: PrintOrientation,
  cellInches: number,
): PrintLayout {
  const [shortSide, longSide] = PAPER_PT[paper]
  const pageWidthPt = orientation === 'portrait' ? shortSide : longSide
  const pageHeightPt = orientation === 'portrait' ? longSide : shortSide
  const cellPt = cellInches * 72
  return {
    pageCols: Math.max(1, Math.floor(pageWidthPt / cellPt)),
    pageRows: Math.max(1, Math.floor(pageHeightPt / cellPt)),
    rasterCellPx: Math.round(PRINT_DPI * cellInches),
    pageWidthPt,
    pageHeightPt,
  }
}

/** Рендер страницы в data URL: инъекция для тестов оркестрации. */
export type PageRenderer = (
  model: MapModel,
  page: { col: number; row: number; cols: number; rows: number },
  pageSize: { cols: number; rows: number },
  rasterCellPx: number,
  includeLight: boolean,
) => string

function defaultPageRenderer(
  model: MapModel,
  page: Parameters<PageRenderer>[1],
  pageSize: Parameters<PageRenderer>[2],
  rasterCellPx: number,
  includeLight: boolean,
): string {
  return renderToCanvas(model, rasterCellPx, undefined, {
    page,
    pageSize,
    includeLight,
  }).toDataURL('image/png')
}

/**
 * Сборка мультистраничного PDF из готовых PNG-страниц (jsPDF, pt-геометрия).
 * jsPDF грузится динамически: ~600KB библиотеки печати не должны попадать
 * в стартовый бандл приложения.
 */
export async function assemblePdf(
  pages: readonly string[],
  layout: Pick<PrintLayout, 'pageWidthPt' | 'pageHeightPt'>,
  title: string,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: layout.pageWidthPt <= layout.pageHeightPt ? 'portrait' : 'landscape',
    unit: 'pt',
    format: [layout.pageWidthPt, layout.pageHeightPt],
  })
  pdf.setProperties({ title })
  for (const [index, dataUrl] of pages.entries()) {
    if (index > 0) {
      pdf.addPage([layout.pageWidthPt, layout.pageHeightPt])
    }
    pdf.addImage(dataUrl, 'PNG', 0, 0, layout.pageWidthPt, layout.pageHeightPt)
  }
  return pdf.output('blob')
}

/**
 * Экспорт карты в многостраничный PDF для печати: карта режется на страницы
 * по computePrintLayout, каждая страница рендерится растром через
 * renderToCanvas, склеивается jsPDF'ом.
 */
export async function exportMapToPdf(
  model: MapModel,
  options: BuildPdfOptions = {},
  renderPage: PageRenderer = defaultPageRenderer,
): Promise<Blob> {
  const paper = options.paper ?? 'a4'
  const orientation = options.orientation ?? 'portrait'
  const cellInches = options.cellInches ?? 1

  const layout = computePrintLayout(paper, orientation, cellInches)
  const pages = paginateMap(model.grid.width, model.grid.height, layout.pageCols, layout.pageRows)
  const rendered = pages.map((page) =>
    renderPage(
      model,
      page,
      { cols: layout.pageCols, rows: layout.pageRows },
      layout.rasterCellPx,
      options.includeLight ?? false,
    ),
  )
  return assemblePdf(rendered, layout, PDF_TITLE)
}
