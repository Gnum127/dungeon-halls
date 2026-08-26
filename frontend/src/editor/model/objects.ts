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

// ---------------------------------------------------------------------------
// Footprint utilities
// ---------------------------------------------------------------------------

/** Footprint объекта: прямоугольник [x..x+w) × [y..y+h). scale undefined = 1×1. */
export function objectFootprint(obj: MapObject): { x: number; y: number; w: number; h: number } {
  const w = obj.scale?.w ?? 1
  const h = obj.scale?.h ?? 1
  return { x: obj.x, y: obj.y, w, h }
}

/** Все ключи клеток, которые занимает объект. */
export function footprintCells(obj: MapObject): string[] {
  const { x, y, w, h } = objectFootprint(obj)
  const cells: string[] = []
  for (let dx = 0; dx < w; dx += 1) {
    for (let dy = 0; dy < h; dy += 1) {
      cells.push(`${x + dx},${y + dy}`)
    }
  }
  return cells
}

/** Проверка пересечения двух прямоугольников (в клетках). */
export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Footprint в границах карты? */
export function footprintInBounds(
  obj: MapObject,
  mapWidth: number,
  mapHeight: number,
): boolean {
  const { w, h } = objectFootprint(obj)
  return obj.x >= 0 && obj.y >= 0 && obj.x + w <= mapWidth && obj.y + h <= mapHeight
}

/** Клетка занята, если она в footprint'е любого объекта. */
export function isCellOccupied(objects: readonly MapObject[], x: number, y: number): boolean {
  return objects.some((obj) => {
    const { x: ox, y: oy, w, h } = objectFootprint(obj)
    return x >= ox && x < ox + w && y >= oy && y < oy + h
  })
}

/** Все клетки footprint'а назначения свободны от других объектов. */
export function isFootprintFree(
  objects: readonly MapObject[],
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const target = { x, y, w, h }
  return !objects.some((obj) => rectsOverlap(target, objectFootprint(obj)))
}

/** Объект, чей footprint содержит (x,y), последний в массиве (z-order). */
export function topmostObjectAt(objects: readonly MapObject[], x: number, y: number): MapObject | undefined {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const obj = objects[i]
    const { x: ox, y: oy, w, h } = objectFootprint(obj)
    if (x >= ox && x < ox + w && y >= oy && y < oy + h) return obj
  }
  return undefined
}

export function nextObjectId(objects: readonly MapObject[]): number {
  return objects.reduce((max, object) => Math.max(max, object.id), 0) + 1
}

export function findObjectById(objects: readonly MapObject[], id: number): MapObject | undefined {
  return objects.find((object) => object.id === id)
}
