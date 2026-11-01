import { createCoverageTester } from '../model/coverage'
import { characteristicPoints, nearestSnapPoint } from '../model/snap'
import {
  SNAP_CANDIDATE_COLOR,
  SNAP_CANDIDATE_RADIUS,
  SNAP_NEAREST_COLOR,
  SNAP_NEAREST_RADIUS,
} from './colors'
import type { MapModel } from '../model/types'
import type { EditorTool } from '../tools/editorTool'
import type { Point } from '@/shared/point'
import type { Viewport } from './viewport'

/** Инструменты, чья привязка идёт к полуклеточной сетке (стены/двери/текстуры). */
export function toolUsesHoverSnap(tool: EditorTool): boolean {
  switch (tool.type) {
    case 'region-rect':
    case 'region-polygon':
    case 'wall':
    case 'door':
      return true
    default:
      return false
  }
}

/** Характеристические точки клетки под курсором (9 при покрытии, 4 без). */
export function hoverSnapCandidates(model: MapModel, cell: Point): Point[] {
  const covered = createCoverageTester(model)({ x: cell.x + 0.5, y: cell.y + 0.5 })
  return characteristicPoints(cell, covered)
}

/**
 * Точки-кандидаты привязки в клетке под курсором; ближайшая к курсору
 * подсвечивается контрастно. Радиусы постоянные (экранные пиксели).
 */
export function drawSnapCandidates(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  cell: Point,
  target: Point,
  viewport: Viewport,
): void {
  const candidates = hoverSnapCandidates(model, cell)
  const nearest = nearestSnapPoint(candidates, target)
  const { cellSize, offsetX, offsetY } = viewport
  for (const point of candidates) {
    const isNearest = point === nearest
    ctx.fillStyle = isNearest ? SNAP_NEAREST_COLOR : SNAP_CANDIDATE_COLOR
    ctx.beginPath()
    ctx.arc(
      point.x * cellSize - offsetX,
      point.y * cellSize - offsetY,
      isNearest ? SNAP_NEAREST_RADIUS : SNAP_CANDIDATE_RADIUS,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
}
