import { renderMap } from '../render/renderMap'
import { mapPixelBounds } from '../render/gridGeometry'
import type { SpriteRenderContext } from '../render/sprites/loader'
import type { MapModel } from '../model/types'
import type { PageRect } from '../print/pages'

/** 1 клетка = 64px: печатный масштаб, независимый от экранного зума. */
export const EXPORT_CELL_SIZE = 64

const MAX_EXPORT_SIDE = 16384
const MAX_EXPORT_AREA = 134_217_728

/** Страховка от невалидного окна страницы: отрицательный сдвиг молча
 * обрезал бы карту. Источник страниц — paginateMap, но API публичный. */
function validatePage(page: PageRect): void {
  requireNonNegative(page.col, 'col')
  requireNonNegative(page.row, 'row')
  requirePositive(page.cols, 'cols')
  requirePositive(page.rows, 'rows')
}

function requireNonNegative(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Invalid ${name}: ${value}`)
  }
}

function requirePositive(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`Invalid ${name}: ${value}`)
  }
}

export interface PageSize {
  readonly cols: number
  readonly rows: number
}

export interface RenderToCanvasOptions {
  /**
   * Страница печати: окно клеток карты, попадающее на лист (square).
   * Контент прижат к левому верхнему углу холста.
   */
  readonly page?: PageRect
  /**
   * Полный размер страницы в клетках: холст всегда размера страницы,
   * неполная последняя колонка/ряд дают ПОЛЯ, а не уменьшенный холст
   * (иначе страницы растянутся до разного масштаба при печати).
   * По умолчанию — размер самой страницы (page.cols × page.rows).
   */
  readonly pageSize?: PageSize
  /** Свет в печать по чекбоксу; по умолчанию рисуется как на экране. */
  readonly includeLight?: boolean
}

/**
 * Рендерит карту в offscreen canvas и отдаёт PNG через тот же renderMap,
 * что и на экране. Сетка сохраняется для печати. Атлас опционален:
 * недоступен/неполон — экспорт цветами, без ожидания и ошибок.
 */
export function exportMapToPng(
  model: MapModel,
  cellSize = EXPORT_CELL_SIZE,
  sprites?: SpriteRenderContext,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = renderToCanvas(model, cellSize, sprites)
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG encoding failed'))
    }, 'image/png')
  })
}

/**
 * Рендер карты в offscreen canvas: общая точка для PNG-, UVTT- и PDF-экспорта.
 * Без options рендерится вся карта целиком; с options.page — одна страница
 * печати (клетки страницы, лимиты canvas считаются ОТ РАЗМЕРА СТРАНИЦЫ,
 * поэтому огромная карта не мешает маленькой странице).
 * Бросает RangeError при превышении лимитов canvas.
 */
export function renderToCanvas(
  model: MapModel,
  cellSize = EXPORT_CELL_SIZE,
  sprites?: SpriteRenderContext,
  options?: RenderToCanvasOptions,
): HTMLCanvasElement {
  const page = options?.page
  let width: number
  let height: number
  let offsetX = 0
  let offsetY = 0
  if (page) {
    if (model.gridType !== 'square') {
      // Разбивка по страницам определена только для прямоугольных клеток.
      throw new RangeError('Paged rendering supports square grids only')
    }
    validatePage(page)
    const pageSize = options?.pageSize
    if (pageSize) {
      requirePositive(pageSize.cols, 'pageSize.cols')
      requirePositive(pageSize.rows, 'pageSize.rows')
      if (pageSize.cols < page.cols || pageSize.rows < page.rows) {
        // Страница меньше окна клеток молча обрезала бы контент при печати.
        throw new RangeError('pageSize must not be smaller than the page window')
      }
    }
    width = Math.ceil((pageSize?.cols ?? page.cols) * cellSize)
    height = Math.ceil((pageSize?.rows ?? page.rows) * cellSize)
    offsetX = page.col * cellSize
    offsetY = page.row * cellSize
  } else {
    // Габариты от геометрии сетки: у гексов холст шире/выше w·cellSize,
    // иначе крайние клетки молча обрезаются. canvas.width/height — целые
    // (дробная часть отбрасывается браузером), поэтому округляем вверх.
    const bounds = mapPixelBounds(model.width, model.height, model.gridType, cellSize)
    width = Math.ceil(bounds.width)
    height = Math.ceil(bounds.height)
  }
  // Большие canvas браузеры молча не растеризуют — отказываем заранее с причиной.
  if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE || width * height > MAX_EXPORT_AREA) {
    throw new RangeError(`Export size ${width}x${height} exceeds canvas limits`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D context is unavailable')
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  renderMap(ctx, model, { width, height, cellSize, offsetX, offsetY }, sprites, {
    includeLight: options?.includeLight,
  })
  return canvas
}

/** PNG-байты offscreen canvas; общий хелпер PNG- и UVTT-экспорта. */
export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG encoding failed'))
        return
      }
      blob.arrayBuffer().then(
        (buffer) => resolve(new Uint8Array(buffer)),
        () => reject(new Error('PNG encoding failed')),
      )
    }, 'image/png')
  })
}
