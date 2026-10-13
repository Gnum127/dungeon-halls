import { isKnownKind, OBJECT_COLORS } from '../model/objects'
import { FALLBACK_OBJECT_COLOR } from './colors'
import { cellCenterAt } from './geometry'
import type { EditorTool } from '../tools/editorTool'
import type { Viewport } from './viewport'

const GHOST_ALPHA = 0.4

/** Полупрозрачный ghost-превью объекта под курсором (квадратная сетка). */
export function drawGhostPreview(
  ctx: CanvasRenderingContext2D,
  cell: { x: number; y: number },
  viewport: Viewport,
  tool: Extract<EditorTool, { type: 'object' }>,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  const center = cellCenterAt(cell.x, cell.y, cellSize)
  const cx = center.x - offsetX
  const cy = center.y - offsetY

  const prevAlpha = ctx.globalAlpha
  ctx.globalAlpha = GHOST_ALPHA

  ctx.save()
  ctx.translate(cx, cy)
  if (tool.rotation !== 0) {
    ctx.rotate((tool.rotation * Math.PI) / 180)
  }

  const fill = isKnownKind(tool.kindId) ? OBJECT_COLORS[tool.kindId] : FALLBACK_OBJECT_COLOR
  const w = cellSize * tool.scale.w
  const h = cellSize * tool.scale.h
  ctx.fillStyle = fill
  ctx.fillRect(-w / 2, -h / 2, w, h)

  ctx.restore()
  ctx.globalAlpha = prevAlpha
}
