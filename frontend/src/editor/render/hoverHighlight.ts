import { drawCellHighlight } from './cellHighlight'
import { drawQuadrantHighlight } from './quadrantHighlight'
import { toolPaintsTexture } from './snapPreview'
import type { EditorTool } from '../tools/editorTool'
import type { Point } from '@/shared/point'
import type { Viewport } from './viewport'

/**
 * Подсветка под курсором: текстурные инструменты подсвечивают квадрант
 * 0.5×0.5, остальные — целую клетку. Единая точка выбора для CanvasView.
 */
export function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  tool: EditorTool,
  cell: Point,
  world: Point,
  viewport: Viewport,
): void {
  if (toolPaintsTexture(tool)) {
    drawQuadrantHighlight(ctx, world, viewport)
  } else {
    drawCellHighlight(ctx, cell, viewport)
  }
}
