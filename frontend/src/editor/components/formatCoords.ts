import { offsetToAxial } from '@/shared/hex'
import type { GridType } from '@/shared/tiles'

export interface OffsetCell {
  readonly x: number
  readonly y: number
}

/** Строка координат статусбара: offset x/y для квадрата, axial q/r для гексов. */
export function formatCoords(cell: OffsetCell, gridType: GridType): string {
  if (gridType === 'square') {
    return `x: ${cell.x} · y: ${cell.y}`
  }
  const orientation = gridType === 'hex-pointy' ? 'pointy' : 'flat'
  const { q, r } = offsetToAxial(cell.x, cell.y, orientation)
  return `q: ${q} · r: ${r}`
}
