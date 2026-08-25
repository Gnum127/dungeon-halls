import type { Command, WallUpdate } from '../model/commands'
import { edgeKey, isEdgeInBounds, normalizeEdge } from '../model/walls'
import type { WallEdge } from '../model/walls'
import type { Viewport } from '../render/viewport'

/**
 * Ближайшее ребро сетки к точке экрана (квадратная сетка). Возвращает null,
 * если точка дальше полклетки за границами карты. Работает при любом зуме
 * и смещении: переход через viewport-оффсеты, как у screenToCell.
 */
export function nearestEdgeAt(
  viewport: Viewport,
  pointX: number,
  pointY: number,
  cols: number,
  rows: number,
): WallEdge | null {
  const { cellSize, offsetX, offsetY } = viewport
  // Конвенция проекта: мир = экран + оффсет (как в screenToCell).
  const wx = pointX + offsetX
  const wy = pointY + offsetY
  const half = cellSize / 2
  const maxX = cols * cellSize
  const maxY = rows * cellSize
  if (wx < -half || wy < -half || wx > maxX + half || wy > maxY + half) {
    return null
  }

  // Ближайшая вертикальная и горизонтальная линии сетки (индексы 0..cols / 0..rows).
  const lineX = Math.min(Math.max(Math.round(wx / cellSize), 0), cols)
  const distX = Math.abs(wx - lineX * cellSize)
  const lineY = Math.min(Math.max(Math.round(wy / cellSize), 0), rows)
  const distY = Math.abs(wy - lineY * cellSize)

  // Клетка, внутри которой лежит точка (для индекса поперечной стороны).
  const col = Math.min(Math.max(Math.floor(wx / cellSize), 0), cols - 1)
  const row = Math.min(Math.max(Math.floor(wy / cellSize), 0), rows - 1)

  if (distX <= distY) {
    // Вертикальная линия: W клетки справа, а на правой границе — E последней клетки.
    if (lineX === cols) return { x: cols - 1, y: row, side: 'E' }
    return { x: lineX, y: row, side: 'W' }
  }
  if (lineY === rows) return { x: col, y: rows - 1, side: 'S' }
  return { x: col, y: lineY, side: 'N' }
}

interface MapDimensions {
  readonly width: number
  readonly height: number
}

/**
 * Собирает штрих стен в одну команду setWalls. Рёбра нормализуются,
 * повторы схлопываются, рёбра вне карты отбрасываются.
 * Возвращает null, если ни одного валидного ребра не набралось.
 */
export function commitWallStroke(
  model: MapDimensions,
  edges: readonly WallEdge[],
  present: boolean,
): Command | null {
  const seen = new Set<string>()
  const updates: WallUpdate[] = []
  for (const edge of edges) {
    if (!isEdgeInBounds(edge, model.width, model.height)) continue
    const canonical = normalizeEdge(edge, model.width, model.height)
    const key = edgeKey(canonical)
    if (seen.has(key)) continue
    seen.add(key)
    updates.push({ edge: canonical, present })
  }
  if (updates.length === 0) return null
  return { kind: 'setWalls', updates }
}
