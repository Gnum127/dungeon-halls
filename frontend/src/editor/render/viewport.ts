import { axialToOffset, pixelToCell } from '@/shared/hex'
import type { GridType } from '@/shared/tiles'

/** Пан и зум без привязки к размеру canvas. */
export interface PanZoomState {
  readonly cellSize: number
  readonly offsetX: number
  readonly offsetY: number
}

/** Геометрия просмотра: размер canvas в CSS-пикселях и мировая позиция. */
export interface Viewport extends PanZoomState {
  readonly width: number
  readonly height: number
}

export const BASE_CELL_SIZE = 32
export const MIN_CELL_SIZE = 8
export const MAX_CELL_SIZE = 128

export function clampCellSize(size: number): number {
  if (!Number.isFinite(size)) return BASE_CELL_SIZE
  return Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, size))
}

/**
 * Экранная точка → координаты клетки (offset col/row). Может вернуть клетку
 * вне карты — вызывающий сам решает, что с ней делать (курсор, кисть и т.д.).
 */
export function screenToCell(
  viewport: PanZoomState,
  screenX: number,
  screenY: number,
  gridType: GridType,
): { x: number; y: number } {
  if (gridType === 'square') {
    return {
      x: Math.floor((screenX + viewport.offsetX) / viewport.cellSize),
      y: Math.floor((screenY + viewport.offsetY) / viewport.cellSize),
    }
  }
  const orientation = gridType === 'hex-pointy' ? 'pointy' : 'flat'
  // Зеркало origin-нормировки cellCenterAt: из нормализованных мировых
  // координат обратно в «сырые» формул Red Blob.
  const worldX =
    screenX +
    viewport.offsetX -
    (orientation === 'pointy' ? Math.sqrt(3) / 2 : 1) * viewport.cellSize
  const worldY =
    screenY +
    viewport.offsetY -
    (orientation === 'pointy' ? 1 : Math.sqrt(3) / 2) * viewport.cellSize
  const axial = pixelToCell(worldX, worldY, orientation, viewport.cellSize)
  const offset = axialToOffset(axial.q, axial.r, orientation)
  return { x: offset.col, y: offset.row }
}

/** Зум с якорем в экранной точке: точка мира под курсором остаётся на месте. */
export function zoomAt<T extends PanZoomState>(
  viewport: T,
  screenX: number,
  screenY: number,
  nextCellSizeRaw: number,
): T {
  const nextCellSize = clampCellSize(nextCellSizeRaw)
  const scale = nextCellSize / viewport.cellSize
  return {
    ...viewport,
    cellSize: nextCellSize,
    offsetX: (viewport.offsetX + screenX) * scale - screenX,
    offsetY: (viewport.offsetY + screenY) * scale - screenY,
  }
}
