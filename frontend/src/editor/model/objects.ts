import type { MapObject } from './types'

export type ObjectCategory = 'structural' | 'furniture' | 'dungeon'

/**
 * Реестр видов объектов — данные, а не логика: новый вид добавляется
 * записью сюда (+ ключи i18n), без изменения кода потребителей.
 */
export const OBJECT_KIND_REGISTRY = {
  door: {
    labelKey: 'editor.objects.door',
    color: '#b0762f',
    category: 'structural' as const,
  },
  stairs: {
    labelKey: 'editor.objects.stairs',
    color: '#7a7f8c',
    category: 'structural' as const,
  },
  table: {
    labelKey: 'editor.objects.table',
    color: '#8a5a2b',
    category: 'furniture' as const,
    defaultScale: { w: 2, h: 1 },
  },
  chair: {
    labelKey: 'editor.objects.chair',
    color: '#6b4423',
    category: 'furniture' as const,
  },
  chest: {
    labelKey: 'editor.objects.chest',
    color: '#9c6b30',
    category: 'furniture' as const,
  },
  barrel: {
    labelKey: 'editor.objects.barrel',
    color: '#7a5a2b',
    category: 'furniture' as const,
  },
  torch: {
    labelKey: 'editor.objects.torch',
    color: '#e08a2d',
    category: 'dungeon' as const,
    gridRestriction: 'square' as const,
  },
  bush: {
    labelKey: 'editor.objects.bush',
    color: '#2d6b2d',
    category: 'dungeon' as const,
  },
  rock: {
    labelKey: 'editor.objects.rock',
    color: '#6e6e78',
    category: 'dungeon' as const,
    defaultScale: { w: 2, h: 2 },
  },
} as const

export type ObjectKindId = keyof typeof OBJECT_KIND_REGISTRY

export interface ObjectKindEntry {
  readonly id: ObjectKindId
  readonly labelKey: string
  readonly color: string
  readonly category: ObjectCategory
  readonly defaultScale?: { readonly w: number; readonly h: number }
  readonly gridRestriction?: 'square'
}

/** Порядок видов в UI фиксируется порядком записей реестра. */
export const OBJECT_KIND_ENTRIES: readonly ObjectKindEntry[] = (
  Object.keys(OBJECT_KIND_REGISTRY) as ObjectKindId[]
).map((id) => {
  const entry = OBJECT_KIND_REGISTRY[id]
  return {
    id,
    labelKey: entry.labelKey,
    color: entry.color,
    category: entry.category,
    ...('defaultScale' in entry && { defaultScale: entry.defaultScale }),
    ...('gridRestriction' in entry && { gridRestriction: entry.gridRestriction }),
  }
})

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
