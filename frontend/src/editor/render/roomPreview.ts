import type { WallEdge } from '../model/walls'
import type { Cell } from '../tools/brush'
import { WALL_LINE_WIDTH } from './colors'
import { wallSegment } from './renderMap'
import type { Viewport } from './viewport'

const FLOOR_ALPHA = 0.35
const LINE_ALPHA = 0.85
const FLOOR_COLOR = '#8a7f66'
const PREVIEW_LINE_COLOR = '#e0b050'
const VERTEX_COLOR = '#f5d070'

/** План живого превью комнаты: заливка, периметровые стены, вершины. */
export interface RoomPreviewPlan {
  /** Клетки пола превью (обычно из RoomGeometry.tiles). */
  readonly tiles: readonly Cell[]
  /** Рёбра стен превью (обычно из RoomGeometry.walls). */
  readonly walls: readonly WallEdge[]
  /** Вершины полигона — ломаная и точки поверх заливки. */
  readonly verts: readonly Cell[]
}

/**
 * Полупрозрачный превью-слой комнаты поверх базового рендера: заливка пола,
 * периметровые стены и ломаная вершин (для полигона). Вызывается после
 * renderMap в тех же CSS-координатах.
 */
export function drawRoomPreview(
  ctx: CanvasRenderingContext2D,
  plan: RoomPreviewPlan,
  viewport: Viewport,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  const previousAlpha = ctx.globalAlpha

  if (plan.tiles.length > 0) {
    ctx.globalAlpha = FLOOR_ALPHA
    ctx.fillStyle = FLOOR_COLOR
    for (const cell of plan.tiles) {
      ctx.fillRect(
        cell.x * cellSize - offsetX,
        cell.y * cellSize - offsetY,
        cellSize,
        cellSize,
      )
    }
  }

  if (plan.walls.length > 0) {
    ctx.globalAlpha = LINE_ALPHA
    ctx.lineWidth = WALL_LINE_WIDTH
    ctx.strokeStyle = PREVIEW_LINE_COLOR
    ctx.beginPath()
    for (const wall of plan.walls) {
      const [x1, y1, x2, y2] = wallSegment(wall, cellSize)
      ctx.moveTo(x1 - offsetX, y1 - offsetY)
      ctx.lineTo(x2 - offsetX, y2 - offsetY)
    }
    ctx.stroke()
  }

  if (plan.verts.length > 0) {
    ctx.globalAlpha = LINE_ALPHA
    ctx.lineWidth = 2
    ctx.strokeStyle = PREVIEW_LINE_COLOR
    ctx.beginPath()
    plan.verts.forEach((vertex, index) => {
      const x = (vertex.x + 0.5) * cellSize - offsetX
      const y = (vertex.y + 0.5) * cellSize - offsetY
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    if (plan.verts.length >= 3) ctx.closePath()
    ctx.stroke()

    ctx.fillStyle = VERTEX_COLOR
    const radius = Math.max(1.5, cellSize * 0.1)
    for (const vertex of plan.verts) {
      ctx.beginPath()
      ctx.arc(
        (vertex.x + 0.5) * cellSize - offsetX,
        (vertex.y + 0.5) * cellSize - offsetY,
        radius,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  ctx.globalAlpha = previousAlpha
}