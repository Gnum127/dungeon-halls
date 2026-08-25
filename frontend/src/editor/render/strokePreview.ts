import { TILE_COLORS } from './colors'
import { TILE_TYPES } from '../model/types'
import type { TileValue } from '../model/types'
import { cellCorners } from '@/shared/hex'
import type { GridType } from '@/shared/tiles'
import type { Cell } from '../tools/brush'
import { cellCenterAt, hexOrientationOf, traceCellPolygon } from './gridGeometry'
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
  gridType: GridType,
): void {
  const typeName = TILE_TYPES[tile]
  if (!typeName || cells.length === 0) return

  const orientation = hexOrientationOf(gridType)
  const previousAlpha = ctx.globalAlpha
  ctx.globalAlpha = PREVIEW_ALPHA
  try {
    ctx.fillStyle = TILE_COLORS[typeName]
    for (const cell of cells) {
      if (!orientation) {
        ctx.fillRect(
          cell.x * viewport.cellSize - viewport.offsetX,
          cell.y * viewport.cellSize - viewport.offsetY,
          viewport.cellSize,
          viewport.cellSize,
        )
        continue
      }
      const center = cellCenterAt(cell.x, cell.y, gridType, viewport.cellSize)
      ctx.beginPath()
      traceCellPolygon(
        ctx,
        center.x - viewport.offsetX,
        center.y - viewport.offsetY,
        cellCorners(orientation, viewport.cellSize),
      )
      ctx.fill()
    }
  } finally {
    ctx.globalAlpha = previousAlpha
  }
}
