import { TILE_TYPES } from '../model/types'
import type { MapModel } from '../model/types'
import { CANVAS_BACKGROUND_COLOR, GRID_LINE_COLOR, TILE_COLORS } from './colors'
import type { Viewport } from './viewport'

/**
 * Единственная точка рендера карты: чистая функция от модели и вьюпорта.
 * Спрайтовый режим позже заменит только выбор заливки, не структуру.
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  viewport: Viewport,
): void {
  const { width, height, cellSize, offsetX, offsetY } = viewport

  ctx.fillStyle = CANVAS_BACKGROUND_COLOR
  ctx.fillRect(0, 0, width, height)

  const firstCol = Math.max(0, Math.floor(offsetX / cellSize))
  const firstRow = Math.max(0, Math.floor(offsetY / cellSize))
  const lastCol = Math.min(model.width - 1, Math.floor((offsetX + width) / cellSize))
  const lastRow = Math.min(model.height - 1, Math.floor((offsetY + height) / cellSize))

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let col = firstCol; col <= lastCol; col += 1) {
      const tileIndex = model.tiles[row * model.width + col]
      ctx.fillStyle = TILE_COLORS[TILE_TYPES[tileIndex]]
      ctx.fillRect(col * cellSize - offsetX, row * cellSize - offsetY, cellSize, cellSize)
    }
  }

  ctx.strokeStyle = GRID_LINE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let col = firstCol; col <= lastCol + 1; col += 1) {
    const x = Math.floor(col * cellSize - offsetX) + 0.5
    ctx.moveTo(x, Math.max(0, -offsetY))
    ctx.lineTo(x, Math.min(height, model.height * cellSize - offsetY))
  }
  for (let row = firstRow; row <= lastRow + 1; row += 1) {
    const y = Math.floor(row * cellSize - offsetY) + 0.5
    ctx.moveTo(Math.max(0, -offsetX), y)
    ctx.lineTo(Math.min(width, model.width * cellSize - offsetX), y)
  }
  ctx.stroke()
}
