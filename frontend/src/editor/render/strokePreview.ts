import { TILE_COLORS } from './colors'
import { TILE_TYPES } from '../model/types'
import type { TileValue } from '../model/types'
import type { Cell } from '../tools/brush'
import type { Viewport } from './viewport'

const PREVIEW_ALPHA = 0.6

/**
 * Превью незавершённого штриха кисти поверх базового рендера.
 * Вызывается после renderMap в тех же CSS-координатах (см. контракт renderMap).
 */
export function drawStrokePreview(
  ctx: CanvasRenderingContext2D,
  cells: readonly Cell[],
  viewport: Viewport,
  tile: TileValue,
): void {
  const typeName = TILE_TYPES[tile]
  if (!typeName || cells.length === 0) return

  const previousAlpha = ctx.globalAlpha
  ctx.globalAlpha = PREVIEW_ALPHA
  try {
    ctx.fillStyle = TILE_COLORS[typeName]
    for (const cell of cells) {
      ctx.fillRect(
        cell.x * viewport.cellSize - viewport.offsetX,
        cell.y * viewport.cellSize - viewport.offsetY,
        viewport.cellSize,
        viewport.cellSize,
      )
    }
  } finally {
    ctx.globalAlpha = previousAlpha
  }
}
