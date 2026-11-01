import { TILE_COLORS } from './colors'
import { wallPath } from './geometry'
import type { Point } from '@/shared/point'
import type { WallSegment } from '../model/wallSegments'
import type { TileTypeName } from '../model/types'
import type { Viewport } from './viewport'

const PREVIEW_ALPHA = 0.6
const PREVIEW_WALL_COLOR = '#e0b050'

export interface RegionPreview {
  readonly polygon: readonly Point[]
  readonly walls: readonly WallSegment[]
  readonly tileType: TileTypeName
}

/** Живое превью региона: полупрозрачная заливка полигона + периметровые стены. */
export function drawRegionPreview(
  ctx: CanvasRenderingContext2D,
  preview: RegionPreview,
  viewport: Viewport,
): void {
  if (preview.polygon.length < 3) return
  const { cellSize, offsetX, offsetY } = viewport

  const prevAlpha = ctx.globalAlpha
  ctx.globalAlpha = PREVIEW_ALPHA

  ctx.beginPath()
  preview.polygon.forEach((point, index) => {
    const x = point.x * cellSize - offsetX
    const y = point.y * cellSize - offsetY
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fillStyle = TILE_COLORS[preview.tileType]
  ctx.fill()

  ctx.globalAlpha = prevAlpha

  if (preview.walls.length > 0) {
    ctx.strokeStyle = PREVIEW_WALL_COLOR
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const wall of preview.walls) {
      if (wall.points.length < 2) continue
      const { points, closed } = wallPath(wall)
      ctx.beginPath()
      ctx.moveTo(points[0].x * cellSize - offsetX, points[0].y * cellSize - offsetY)
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x * cellSize - offsetX, points[i].y * cellSize - offsetY)
      }
      if (closed) ctx.closePath()
      ctx.stroke()
    }
  }
}
