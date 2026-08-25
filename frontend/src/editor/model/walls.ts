export type WallSide = 'N' | 'E' | 'S' | 'W'

export const WALL_SIDES: readonly WallSide[] = ['N', 'E', 'S', 'W']

/** Стена = ребро клетки; общие рёбра соседей канонизируются (см. normalizeEdge). */
export interface WallEdge {
  readonly x: number
  readonly y: number
  readonly side: WallSide
}

export function isWallSide(value: unknown): value is WallSide {
  return typeof value === 'string' && (WALL_SIDES as readonly string[]).includes(value)
}

/**
 * Каноническая форма ребра: E ≡ W правого соседа, S ≡ N нижнего.
 * Периметр (E последней колонки, S последнего ряда) хранится как есть —
 * канонизация только в сторону существующей клетки.
 */
export function normalizeEdge(
  edge: WallEdge,
  width: number,
  height: number,
): WallEdge {
  if (edge.side === 'E' && edge.x + 1 < width) {
    return { x: edge.x + 1, y: edge.y, side: 'W' }
  }
  if (edge.side === 'S' && edge.y + 1 < height) {
    return { x: edge.x, y: edge.y + 1, side: 'N' }
  }
  return { ...edge }
}

export function edgeKey(edge: WallEdge): string {
  return `${edge.x},${edge.y},${edge.side}`
}

/** Ребро ссылается на существующую клетку карты. */
export function isEdgeInBounds(edge: WallEdge, width: number, height: number): boolean {
  return (
    Number.isInteger(edge.x) &&
    Number.isInteger(edge.y) &&
    edge.x >= 0 &&
    edge.x < width &&
    edge.y >= 0 &&
    edge.y < height
  )
}

/** Ребро уже в канонической форме? (инвариант хранения walls). */
export function isCanonical(edge: WallEdge, width: number, height: number): boolean {
  const key = edgeKey(normalizeEdge(edge, width, height))
  return key === edgeKey(edge)
}

export function hasWall(walls: readonly WallEdge[], edge: WallEdge): boolean {
  const key = edgeKey(edge)
  return walls.some((candidate) => edgeKey(candidate) === key)
}

/** Дверь принадлежит ребру; позиция и ориентация производны от него. */
export interface Door {
  readonly id: number
  readonly edge: WallEdge
  readonly open: boolean
}

export function doorAtEdge(doors: readonly Door[], edge: WallEdge): Door | undefined {
  const key = edgeKey(edge)
  return doors.find((door) => edgeKey(door.edge) === key)
}

export function findDoorById(doors: readonly Door[], id: number): Door | undefined {
  return doors.find((door) => door.id === id)
}

export function nextDoorId(doors: readonly Door[]): number {
  return doors.reduce((max, door) => Math.max(max, door.id), 0) + 1
}
