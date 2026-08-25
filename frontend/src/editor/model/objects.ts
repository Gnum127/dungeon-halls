import type { MapObject } from './types'

/**
 * Реестр видов объектов — данные, а не логика: новый вид добавляется
 * записью сюда (+ ключи i18n), без изменения кода потребителей.
 */
export const OBJECT_KIND_REGISTRY = {
  door: { labelKey: 'editor.objects.door', color: '#b0762f' },
  stairs: { labelKey: 'editor.objects.stairs', color: '#7a7f8c' },
  table: { labelKey: 'editor.objects.table', color: '#8a5a2b' },
  chair: { labelKey: 'editor.objects.chair', color: '#6b4423' },
  chest: { labelKey: 'editor.objects.chest', color: '#9c6b30' },
  torch: { labelKey: 'editor.objects.torch', color: '#e08a2d' },
} as const

export type ObjectKindId = keyof typeof OBJECT_KIND_REGISTRY

export interface ObjectKindEntry {
  readonly id: ObjectKindId
  readonly labelKey: string
  readonly color: string
}

/** Порядок видов в UI фиксируется порядком записей реестра. */
export const OBJECT_KIND_ENTRIES: readonly ObjectKindEntry[] = (
  Object.keys(OBJECT_KIND_REGISTRY) as ObjectKindId[]
).map((id) => ({ id, ...OBJECT_KIND_REGISTRY[id] }))

export const OBJECT_KINDS: readonly ObjectKindId[] = OBJECT_KIND_ENTRIES.map((entry) => entry.id)

// Выводится из реестра во время выполнения; приведение безопасно,
// т.к. ключи взяты из того же объекта.
export const OBJECT_COLORS = Object.fromEntries(
  OBJECT_KIND_ENTRIES.map((entry) => [entry.id, entry.color]),
) as Record<ObjectKindId, string>

export function isKnownKind(kindId: string): kindId is ObjectKindId {
  return Object.hasOwn(OBJECT_KIND_REGISTRY, kindId)
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
