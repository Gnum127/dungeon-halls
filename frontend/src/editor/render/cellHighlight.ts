import type { Cell } from '../tools/brush'
import { cellCorners } from '@/shared/hex'
import type { GridType } from '@/shared/tiles'
import { HIGHLIGHT_COLOR } from './colors'
import { cellCenterAt, hexOrientationOf, traceCellPolygon } from './gridGeometry'
import type { Viewport } from './viewport'

/**
 * Рамка вокруг клетки под курсором. Вызывается после renderMap.
 * Для гексов полигон чуть вжимается внутрь — как strokeRect у квадрата.
 */
export function drawCellHighlight(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  viewport: Viewport,
  gridType: GridType,
): void {
  const orientation = hexOrientationOf(gridType)
  ctx.lineWidth = 2
  ctx.strokeStyle = HIGHLIGHT_COLOR
  if (!orientation) {
    // Квадратная клетка задаётся левым-верхним углом, не центром.
    const x = cell.x * viewport.cellSize - viewport.offsetX
    const y = cell.y * viewport.cellSize - viewport.offsetY
    ctx.strokeRect(x + 1, y + 1, viewport.cellSize - 2, viewport.cellSize - 2)
    return
  }
  const center = cellCenterAt(cell.x, cell.y, gridType, viewport.cellSize)
  const x = center.x - viewport.offsetX
  const y = center.y - viewport.offsetY

  const shrink = (viewport.cellSize - 3) / viewport.cellSize
  const corners = cellCorners(orientation, viewport.cellSize * shrink)
  ctx.beginPath()
  traceCellPolygon(ctx, x, y, corners)
  ctx.stroke()
}
