import type { Viewport } from './viewport'

/** Целочисленная клетка сетки (offset-координаты). */
export interface Cell {
  readonly x: number
  readonly y: number
}

/** Центр клетки в мировых пикселях (квадратная сетка). */
export function cellCenterAt(col: number, row: number, cellSize: number): { x: number; y: number } {
  return { x: (col + 0.5) * cellSize, y: (row + 0.5) * cellSize }
}

export interface CellRange {
  readonly firstCol: number
  readonly lastCol: number
  readonly firstRow: number
  readonly lastRow: number
}

/** Диапазон видимых клеток (квадратная сетка), обрезанный по карте. */
export function visibleCellRange(viewport: Viewport, cols: number, rows: number): CellRange {
  const { width, height, cellSize, offsetX, offsetY } = viewport
  return {
    firstCol: Math.max(0, Math.floor(offsetX / cellSize)),
    firstRow: Math.max(0, Math.floor(offsetY / cellSize)),
    lastCol: Math.min(cols - 1, Math.floor((offsetX + width) / cellSize)),
    lastRow: Math.min(rows - 1, Math.floor((offsetY + height) / cellSize)),
  }
}

export interface MapPixelBounds {
  readonly width: number
  readonly height: number
  readonly originX: number
  readonly originY: number
}

/** Габариты карты в пикселях (квадратная сетка: origin всегда 0). */
export function mapPixelBounds(cols: number, rows: number, cellSize: number): MapPixelBounds {
  return { width: cols * cellSize, height: rows * cellSize, originX: 0, originY: 0 }
}
