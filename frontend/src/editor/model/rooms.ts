import type { TileUpdate, WallUpdate } from './commands'
import type { WallEdge } from './walls'
import { EMPTY_TILE } from './types'
import type { TileValue } from './types'
import type { Cell } from '../tools/brush'

export interface RoomGeometry {
  readonly tiles: readonly TileUpdate[]
  readonly walls: readonly WallUpdate[]
}

const WALL_SIDE_ORDER: ReadonlyArray<WallEdge['side']> = ['N', 'W', 'E', 'S']

function compareWalls(a: WallEdge, b: WallEdge): number {
  if (a.x !== b.x) return a.x - b.x
  if (a.y !== b.y) return a.y - b.y
  return WALL_SIDE_ORDER.indexOf(a.side) - WALL_SIDE_ORDER.indexOf(b.side)
}

/**
 * Прямоугольная комната: заливка выбранным тайлом по диапазону и стены по
 * периметру. Диапазон обрезается границами карты — стены на самой границе
 * опускаются (у карты уже есть край). При `EMPTY_TILE` комната работает как
 * ластик области: чистит тайлы без построения стен. Возвращает пустую
 * геометрию, если после обрезки не осталось ни одной клетки.
 */
export function rectRoom(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  height: number,
  tile: TileValue,
): RoomGeometry {
  const x1 = Math.max(0, Math.min(ax, bx))
  const y1 = Math.max(0, Math.min(ay, by))
  const x2 = Math.min(width - 1, Math.max(ax, bx))
  const y2 = Math.min(height - 1, Math.max(ay, by))
  if (x2 < x1 || y2 < y1) return { tiles: [], walls: [] }

  const tiles: TileUpdate[] = []
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      tiles.push({ x, y, tile })
    }
  }
  // Ластик-комната только чистит область, стены не строит.
  if (tile === EMPTY_TILE) return { tiles, walls: [] }

  const walls: WallEdge[] = []
  // Верх и низ комнаты — горизонтальные рёбра её крайних рядов.
  if (y1 > 0) {
    for (let x = x1; x <= x2; x += 1) walls.push({ x, y: y1, side: 'N' })
  }
  if (y2 + 1 < height) {
    for (let x = x1; x <= x2; x += 1) walls.push({ x, y: y2, side: 'S' })
  }
  // Лево и право — вертикальные рёбра крайних колонок.
  if (x1 > 0) {
    for (let y = y1; y <= y2; y += 1) walls.push({ x: x1, y, side: 'W' })
  }
  if (x2 + 1 < width) {
    for (let y = y1; y <= y2; y += 1) walls.push({ x: x2, y, side: 'E' })
  }

  return { tiles, walls: walls.map((edge) => ({ edge, present: true })) }
}

/**
 * Полигональная комната: внутренние клетки по правилу even-odd (центр клетки
 * внутри полигона, вершины — в координатах клеток, полигональная точка —
 * центр клетки-вершины), стены — рёбра на границе «внутренняя/внешняя клетка».
 * Центр клетки, лежащий на контуре, считается внутренним: кликнутые
 * вершины и обводка прямоугольников всегда попадают в комнату.
 * Правило границы корректно работает на вогнутых полигонах; стены на границе
 * карты опускаются. Меньше трёх (после снятия дублей) вершин — пустая геометрия.
 * При `EMPTY_TILE` полигон чистит внутренние тайлы и НЕ строит стен (ластик).
 */
export function polygonRoom(
  vertices: readonly Cell[],
  width: number,
  height: number,
  tile: TileValue,
): RoomGeometry {
  const points = vertices.map((v) => ({
    x: Math.max(0, Math.min(width - 1, v.x)) + 0.5,
    y: Math.max(0, Math.min(height - 1, v.y)) + 0.5,
  }))
  // Снимок соседних дублей вершин: клики по одной клетке не дублируют угол.
  const unique = points.filter(
    (p, index) => index === 0 || p.x !== points[index - 1].x || p.y !== points[index - 1].y,
  )
  if (unique.length < 3) return { tiles: [], walls: [] }

  const inside = new Set<number>()
  const tiles: TileUpdate[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pointInPolygon(unique, x + 0.5, y + 0.5)) {
        inside.add(y * width + x)
        tiles.push({ x, y, tile })
      }
    }
  }
  if (inside.size === 0) return { tiles, walls: [] }
  // Ластик-комната только чистит область, стены не строит.
  if (tile === EMPTY_TILE) return { tiles, walls: [] }

  const walls: WallEdge[] = []
  for (const key of inside) {
    const x = key % width
    const y = Math.floor(key / width)
    if (y > 0 && !inside.has(key - width)) walls.push({ x, y, side: 'N' })
    if (y + 1 < height && !inside.has(key + width)) walls.push({ x, y, side: 'S' })
    if (x > 0 && !inside.has(key - 1)) walls.push({ x, y, side: 'W' })
    if (x + 1 < width && !inside.has(key + 1)) walls.push({ x, y, side: 'E' })
  }
  walls.sort(compareWalls)

  return { tiles, walls: walls.map((edge) => ({ edge, present: true })) }
}

/** Точка на контуре полигона (в пределах отрезка) или внутри по even-odd. */
function pointInPolygon(
  polygon: ReadonlyArray<{ x: number; y: number }>,
  px: number,
  py: number,
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    // Все координаты кратны 0.5 — коллинеарные вычисления точны.
    const onSegment =
      (px - xi) * (yj - yi) - (py - yi) * (xj - xi) === 0 &&
      px >= Math.min(xi, xj) &&
      px <= Math.max(xi, xj) &&
      py >= Math.min(yi, yj) &&
      py <= Math.max(yi, yj)
    if (onSegment) return true
    const crosses =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}