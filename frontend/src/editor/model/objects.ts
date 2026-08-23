import type { MapObject } from './types'

export const OBJECT_KINDS = ['door', 'stairs', 'table', 'chair', 'chest', 'torch'] as const

export type ObjectKindId = (typeof OBJECT_KINDS)[number]

/** Цвета отрисовки объектов; палитра UI берёт те же значения. */
export const OBJECT_COLORS: Record<ObjectKindId, string> = {
  door: '#b0762f',
  stairs: '#7a7f8c',
  table: '#8a5a2b',
  chair: '#6b4423',
  chest: '#9c6b30',
  torch: '#e08a2d',
}

export function isKnownKind(kindId: string): kindId is ObjectKindId {
  return (OBJECT_KINDS as readonly string[]).includes(kindId)
}

/** Клетка занята, если на ней стоит любой объект. */
export function isCellOccupied(objects: readonly MapObject[], x: number, y: number): boolean {
  return objects.some((object) => object.x === x && object.y === y)
}

export function nextObjectId(objects: readonly MapObject[]): number {
  return objects.reduce((max, object) => Math.max(max, object.id), 0) + 1
}

export function findObjectById(objects: readonly MapObject[], id: number): MapObject | undefined {
  return objects.find((object) => object.id === id)
}
