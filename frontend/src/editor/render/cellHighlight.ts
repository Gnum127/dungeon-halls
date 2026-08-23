import type { Cell } from '../tools/brush'
import { HIGHLIGHT_COLOR } from './colors'
import type { Viewport } from './viewport'

/** Рамка вокруг клетки под курсором. Вызывается после renderMap. */
export function drawCellHighlight(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  viewport: Viewport,
): void {
  const x = cell.x * viewport.cellSize - viewport.offsetX
  const y = cell.y * viewport.cellSize - viewport.offsetY
  ctx.lineWidth = 2
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.strokeRect(x + 1, y + 1, viewport.cellSize - 2, viewport.cellSize - 2)
}
