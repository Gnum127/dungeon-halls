import type { WallEdge } from '../model/walls'
import { EDGE_HIGHLIGHT_COLOR } from './colors'
import type { Viewport } from './viewport'

/**
 * Подсветка ребра под курсором в режиме инструмента дверей.
 * Вызывается после renderMap; линия проводится по экранной геометрии ребра.
 */
export function drawEdgeHighlight(
  ctx: CanvasRenderingContext2D,
  edge: WallEdge,
  viewport: Viewport,
): void {
  const s = viewport.cellSize
  const x = edge.x * s - viewport.offsetX
  const y = edge.y * s - viewport.offsetY
  ctx.lineWidth = 3
  ctx.strokeStyle = EDGE_HIGHLIGHT_COLOR
  ctx.beginPath()
  if (edge.side === 'N') {
    ctx.moveTo(x, y)
    ctx.lineTo(x + s, y)
  } else if (edge.side === 'S') {
    ctx.moveTo(x, y + s)
    ctx.lineTo(x + s, y + s)
  } else if (edge.side === 'W') {
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + s)
  } else {
    ctx.moveTo(x + s, y)
    ctx.lineTo(x + s, y + s)
  }
  ctx.stroke()
}
