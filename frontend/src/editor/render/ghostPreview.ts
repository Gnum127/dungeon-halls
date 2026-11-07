import { isKnownKind, OBJECT_COLORS } from '../model/objects'
import { FALLBACK_OBJECT_COLOR } from './colors'
import type { EditorTool } from '../tools/editorTool'
import type { Viewport } from './viewport'

const GHOST_ALPHA = 0.4

/**
 * Полупрозрачный ghost-превью объекта под курсором: `anchor` — мировая
 * float-точка (клетки) левого-верхнего угла, как у координат объекта в рендере.
 */
export function drawGhostPreview(
  ctx: CanvasRenderingContext2D,
  anchor: { x: number; y: number },
  viewport: Viewport,
  tool: Extract<EditorTool, { type: 'object' }>,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  const w = cellSize * tool.scale.w
  const h = cellSize * tool.scale.h
  const cx = anchor.x * cellSize + w / 2 - offsetX
  const cy = anchor.y * cellSize + h / 2 - offsetY

  const prevAlpha = ctx.globalAlpha
  ctx.globalAlpha = GHOST_ALPHA

  ctx.save()
  ctx.translate(cx, cy)
  if (tool.rotation !== 0) {
    ctx.rotate((tool.rotation * Math.PI) / 180)
  }

  const fill = isKnownKind(tool.kindId) ? OBJECT_COLORS[tool.kindId] : FALLBACK_OBJECT_COLOR
  ctx.fillStyle = fill
  ctx.fillRect(-w / 2, -h / 2, w, h)

  ctx.restore()
  ctx.globalAlpha = prevAlpha
}
