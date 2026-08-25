import type { GridType } from '@/shared/tiles'
import { cellCenter, offsetToAxial } from '@/shared/hex'
import type { HexOrientation } from '@/shared/hex'
import type { Viewport } from './viewport'

/** Мост GridType → ориентация hex-математики; null для квадратной сетки. */
export function hexOrientationOf(gridType: GridType): HexOrientation | null {
  if (gridType === 'hex-flat') return 'flat'
  if (gridType === 'hex-pointy') return 'pointy'
  return null
}

export interface MapPixelBounds {
  readonly width: number
  readonly height: number
  /**
   * Минимальные координаты геометрии (вершины крайних гексов уходят в минус,
   * у квадрата 0): прибавляется к смещению рендера/экспорта, чтобы контент
   * целиком попадал в холст [0..width]×[0..height].
   */
  readonly originX: number
  readonly originY: number
}

/**
 * Габариты карты в пикселях по типу сетки. Для гексов габариты шире/выше
 * w·cellSize на полгекса — экспорт и лимиты канвы обязаны считать от них,
 * иначе крайние клетки молча обрезаются.
 */
export function mapPixelBounds(
  cols: number,
  rows: number,
  gridType: GridType,
  cellSize: number,
): MapPixelBounds {
  const orientation = hexOrientationOf(gridType)
  if (!orientation) {
    return { width: cols * cellSize, height: rows * cellSize, originX: 0, originY: 0 }
  }
  if (orientation === 'pointy') {
    return {
      width: Math.sqrt(3) * cellSize * (cols + 0.5),
      height: cellSize * (1.5 * rows + 0.5),
      originX: -(Math.sqrt(3) / 2) * cellSize,
      originY: -cellSize,
    }
  }
  return {
    width: cellSize * (1.5 * cols + 0.5),
    height: Math.sqrt(3) * cellSize * (rows + 0.5),
    originX: -cellSize,
    originY: -(Math.sqrt(3) / 2) * cellSize,
  }
}

/**
 * Центр клетки в мировых координатах карты: контент целиком в [0..bounds]
 * из mapPixelBounds. Сдвиги — те же −origin, но константами: renderMap зовёт
 * функцию дважды на каждую видимую клетку, аллокации bounds недопустимы.
 * Синхронизация с mapPixelBounds зафиксирована brute-force тестом.
 */
export function cellCenterAt(
  col: number,
  row: number,
  gridType: GridType,
  cellSize: number,
): { x: number; y: number } {
  const orientation = hexOrientationOf(gridType)
  if (!orientation) return { x: (col + 0.5) * cellSize, y: (row + 0.5) * cellSize }
  const axial = offsetToAxial(col, row, orientation)
  const center = cellCenter(axial.q, axial.r, orientation, cellSize)
  return orientation === 'pointy'
    ? { x: center.x + (Math.sqrt(3) / 2) * cellSize, y: center.y + cellSize }
    : { x: center.x + cellSize, y: center.y + (Math.sqrt(3) / 2) * cellSize }
}

export interface CellRange {
  readonly firstCol: number
  readonly lastCol: number
  readonly firstRow: number
  readonly lastRow: number
}

/**
 * Диапазон клеток, попадающих во вьюпорт, с запасом в две клетки на сторону:
 * покрывает сдвиг origin и чётность ряда/колонки гексов без точной аналитики.
 */
export function visibleCellRange(
  viewport: Viewport,
  cols: number,
  rows: number,
  gridType: GridType,
): CellRange {
  const { width, height, cellSize, offsetX, offsetY } = viewport
  if (gridType === 'square') {
    return {
      firstCol: Math.max(0, Math.floor(offsetX / cellSize)),
      firstRow: Math.max(0, Math.floor(offsetY / cellSize)),
      lastCol: Math.min(cols - 1, Math.floor((offsetX + width) / cellSize)),
      lastRow: Math.min(rows - 1, Math.floor((offsetY + height) / cellSize)),
    }
  }

  const pointy = gridType === 'hex-pointy'
  const colStep = pointy ? Math.sqrt(3) * cellSize : 1.5 * cellSize
  const rowStep = pointy ? 1.5 * cellSize : Math.sqrt(3) * cellSize
  // Диапазон за пределами карты обязан оставаться пустым, иначе clamp
  // нарисует угловую клетку для вьюпорта в стороне от карты.
  const span = (lo: number, hi: number, max: number): { first: number; last: number } => {
    if (lo > max || hi < 0) return { first: 0, last: -1 }
    return { first: Math.max(0, lo), last: Math.min(max, hi) }
  }
  const colSpan = span(
    Math.floor((offsetX - 2 * colStep) / colStep),
    Math.floor((offsetX + width + 2 * colStep) / colStep),
    cols - 1,
  )
  const rowSpan = span(
    Math.floor((offsetY - 2 * cellSize) / rowStep),
    Math.floor((offsetY + height + 2 * cellSize) / rowStep),
    rows - 1,
  )
  return {
    firstCol: colSpan.first,
    lastCol: colSpan.last,
    firstRow: rowSpan.first,
    lastRow: rowSpan.last,
  }
}

/** Добавляет в текущий путь замкнутый контур клетки с центром (cx, cy). */
export function traceCellPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  corners: Array<[number, number]>,
): void {
  ctx.moveTo(cx + corners[0][0], cy + corners[0][1])
  for (let i = 1; i < corners.length; i += 1) {
    ctx.lineTo(cx + corners[i][0], cy + corners[i][1])
  }
  ctx.closePath()
}
