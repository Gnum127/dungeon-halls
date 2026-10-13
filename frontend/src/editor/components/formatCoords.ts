export interface OffsetCell {
  readonly x: number
  readonly y: number
}

/** Строка координат статусбара (квадратная сетка: offset x/y). */
export function formatCoords(cell: OffsetCell): string {
  return `x: ${cell.x} · y: ${cell.y}`
}
