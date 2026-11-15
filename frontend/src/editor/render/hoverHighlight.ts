import { drawCellHighlight } from './cellHighlight'
import { drawQuadrantHighlight } from './quadrantHighlight'
import {
  drawHalfGridSnapPoint,
  drawSnapCandidates,
  toolPaintsTexture,
  toolUsesHoverSnap,
} from './snapPreview'
import { snapToHalfGrid } from '../model/snap'
import type { EditorTool } from '../tools/editorTool'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from './viewport'

/**
 * Подсветка под курсором: текстурные инструменты подсвечивают квадрант
 * 0.5×0.5, остальные — целую клетку. Курсор, панорамирование и дверь карту не
 * подсвечивают вообще (у двери — только точки снапа). Единая точка выбора для
 * CanvasView.
 */
export function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  tool: EditorTool,
  cell: Point,
  world: Point,
  viewport: Viewport,
): void {
  if (tool.type === 'cursor' || tool.type === 'pan' || tool.type === 'door') return
  if (toolPaintsTexture(tool)) {
    drawQuadrantHighlight(ctx, world, viewport)
  } else {
    drawCellHighlight(ctx, cell, viewport)
  }
}

/**
 * Всё, что рисуется под курсором: подсветка + маркер фактической привязки.
 * Текстурные инструменты кликают по ближайшей полуклеточной точке — подсвечиваем
 * именно её, а не углы клетки. Единая точка выбора для CanvasView.
 */
export function drawHoverOverlay(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  tool: EditorTool,
  cell: Point,
  world: Point,
  viewport: Viewport,
): void {
  drawHoverHighlight(ctx, tool, cell, world, viewport)
  if (toolPaintsTexture(tool)) {
    drawHalfGridSnapPoint(ctx, snapToHalfGrid(world), viewport)
  } else if (toolUsesHoverSnap(tool)) {
    drawSnapCandidates(ctx, model, cell, world, viewport)
  }
}
