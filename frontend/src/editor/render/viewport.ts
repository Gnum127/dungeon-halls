/** Геометрия просмотра: размер canvas в CSS-пикселях и мировая позиция. */
export interface Viewport {
  readonly width: number
  readonly height: number
  readonly cellSize: number
  readonly offsetX: number
  readonly offsetY: number
}

export const BASE_CELL_SIZE = 32
export const MIN_CELL_SIZE = 8
export const MAX_CELL_SIZE = 128

export function clampCellSize(size: number): number {
  if (!Number.isFinite(size)) return BASE_CELL_SIZE
  return Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, size))
}

/**
 * Экранная точка → координаты клетки. Может вернуть клетку вне карты —
 * вызывающий сам решает, что с ней делать (курсор, кисть и т.д.).
 */
export function screenToCell(
  viewport: Viewport,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  return {
    x: Math.floor((screenX + viewport.offsetX) / viewport.cellSize),
    y: Math.floor((screenY + viewport.offsetY) / viewport.cellSize),
  }
}

/** Зум с якорем в экранной точке: точка мира под курсором остаётся на месте. */
export function zoomAt(
  viewport: Viewport,
  screenX: number,
  screenY: number,
  nextCellSizeRaw: number,
): Viewport {
  const nextCellSize = clampCellSize(nextCellSizeRaw)
  const scale = nextCellSize / viewport.cellSize
  return {
    ...viewport,
    cellSize: nextCellSize,
    offsetX: (viewport.offsetX + screenX) * scale - screenX,
    offsetY: (viewport.offsetY + screenY) * scale - screenY,
  }
}
