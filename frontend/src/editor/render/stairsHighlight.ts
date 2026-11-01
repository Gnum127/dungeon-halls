import { HIGHLIGHT_COLOR } from './colors'
import type { Point } from '@/shared/point'
import type { Viewport } from './viewport'

/**
 * Подсветка выделенной лестницы: замкнутый контур цветом выделения. Вынесено
 * из CanvasView ради тестируемости (единая точка отрисовки контура выделения).
 */
export function drawStairsSelection(
  ctx: CanvasRenderingContext2D,
  polygon: readonly Point[],
  viewport: Viewport,
): void {
  if (polygon.length < 3) return
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.lineWidth = 2
  ctx.beginPath()
  polygon.forEach((point, index) => {
    const x = point.x * viewport.cellSize - viewport.offsetX
    const y = point.y * viewport.cellSize - viewport.offsetY
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.stroke()
}
