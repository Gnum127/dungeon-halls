import { isKnownKind, OBJECT_COLORS } from '../model/objects'
import { FALLBACK_OBJECT_COLOR } from './colors'
import { cellCenterAt } from './gridGeometry'
import type { EditorTool } from '../tools/editorTool'
import type { GridType } from '@/shared/tiles'
import type { Viewport } from './viewport'

const GHOST_ALPHA = 0.4

/**
 * Рисует полупрозрачный ghost-превью объекта под курсором.
 * Показывается только когда инструмент = 'object' и клетка видна.
 */
export function drawGhostPreview(
  ctx: CanvasRenderingContext2D,
  cell: { x: number; y: number },
  viewport: Viewport,
  tool: Extract<EditorTool, { type: 'object' }>,
  gridType: GridType,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  const center = cellCenterAt(cell.x, cell.y, gridType, cellSize)
  const cx = center.x - offsetX
  const cy = center.y - offsetY

  const scaleX = tool.scale.w
  const scaleY = tool.scale.h
  const rotation = tool.rotation

  const prevAlpha = ctx.globalAlpha
  ctx.globalAlpha = GHOST_ALPHA

  ctx.save()
  ctx.translate(cx, cy)
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180)
  }

  const baseSize = gridType === 'square' ? cellSize : cellSize * 2
  const fill = isKnownKind(tool.kindId)
    ? OBJECT_COLORS[tool.kindId]
    : FALLBACK_OBJECT_COLOR

  // Draw scaled rectangle to represent footprint.
  const w = baseSize * scaleX
  const h = baseSize * scaleY
  ctx.fillStyle = fill
  ctx.fillRect(-w / 2, -h / 2, w, h)

  ctx.restore()
  ctx.globalAlpha = prevAlpha
}
