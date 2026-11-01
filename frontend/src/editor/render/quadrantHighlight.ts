import { SNAP_STEP } from '../model/snap'
import { HIGHLIGHT_COLOR } from './colors'
import type { Point } from '@/shared/point'
import type { Viewport } from './viewport'

/**
 * Подсветка квадранта 0.5×0.5 клетки под курсором (текстурные инструменты):
 * квадрант определяется положением мировой точки внутри клетки.
 */
export function drawQuadrantHighlight(
  ctx: CanvasRenderingContext2D,
  world: Point,
  viewport: Viewport,
): void {
  const qx = Math.floor(world.x / SNAP_STEP) * SNAP_STEP
  const qy = Math.floor(world.y / SNAP_STEP) * SNAP_STEP
  const size = SNAP_STEP * viewport.cellSize
  const x = qx * viewport.cellSize - viewport.offsetX
  const y = qy * viewport.cellSize - viewport.offsetY

  ctx.lineWidth = 2
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2)
}
