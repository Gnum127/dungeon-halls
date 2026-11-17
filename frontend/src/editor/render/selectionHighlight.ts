import { HIGHLIGHT_COLOR, HIGHLIGHT_FILL_COLOR } from './colors'
import { resizeHandlePoints } from '../model/selection'
import type { MapModel } from '../model/types'
import type { Viewport } from './viewport'

/** Толщина рамки выделения в экранных пикселях. */
const FRAME_WIDTH = 2

/**
 * Рамка выделенного объекта по footprint'у + четыре угловых хендла ресайза
 * (этап 28). Рисуется поверх самих объектов, в экранных координатах.
 */
export function drawObjectSelection(
  ctx: CanvasRenderingContext2D,
  object: MapModel['objects'][number],
  viewport: Viewport,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  const w = (object.scale?.w ?? 1) * cellSize
  const h = (object.scale?.h ?? 1) * cellSize
  const x = object.x * cellSize - offsetX
  const y = object.y * cellSize - offsetY

  ctx.save()
  // Полупрозрачная заливка — выделенная область яснее на любом покрытии.
  ctx.fillStyle = HIGHLIGHT_FILL_COLOR
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.lineWidth = FRAME_WIDTH
  ctx.strokeRect(x, y, w, h)

  const handle = Math.max(5, cellSize * 0.16)
  ctx.fillStyle = HIGHLIGHT_COLOR
  for (const point of Object.values(resizeHandlePoints(object))) {
    const hx = point.x * cellSize - offsetX
    const hy = point.y * cellSize - offsetY
    ctx.fillRect(hx - handle / 2, hy - handle / 2, handle, handle)
  }
  ctx.restore()
}

/** Подсветка выделенной двери: рамка-полоса по отрезку `a`–`b`. */
export function drawDoorSelection(
  ctx: CanvasRenderingContext2D,
  door: MapModel['doors'][number],
  viewport: Viewport,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  ctx.save()
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.lineWidth = FRAME_WIDTH
  ctx.beginPath()
  ctx.moveTo(door.a.x * cellSize - offsetX, door.a.y * cellSize - offsetY)
  ctx.lineTo(door.b.x * cellSize - offsetX, door.b.y * cellSize - offsetY)
  ctx.stroke()
  ctx.restore()
}
