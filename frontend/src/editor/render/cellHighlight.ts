import { HIGHLIGHT_COLOR } from './colors'
import type { Cell } from './geometry'
import type { Viewport } from './viewport'

/** Рамка вокруг клетки под курсором (квадратная сетка). */
export function drawCellHighlight(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  viewport: Viewport,
): void {
  ctx.lineWidth = 2
  ctx.strokeStyle = HIGHLIGHT_COLOR
  const x = cell.x * viewport.cellSize - viewport.offsetX
  const y = cell.y * viewport.cellSize - viewport.offsetY
  ctx.strokeRect(x + 1, y + 1, viewport.cellSize - 2, viewport.cellSize - 2)
}
