import type { MapObject, ObjectScale } from './types'

export type ObjectCategory = 'structural' | 'furniture' | 'dungeon'

/**
 * Реестр видов объектов — данные, а не логика: новый вид добавляется
 * записью сюда (+ ключи i18n), без изменения кода потребителей.
 */
export const OBJECT_KIND_REGISTRY = {
  table: {
    labelKey: 'editor.objects.table',
    color: '#8a5a2b',
    category: 'furniture' as const,
    defaultScale: { w: 2, h: 1 },
    defaultImage: 'table-wooden',
    imagePool: ['table-wooden', 'table-round'],
    scales: [
      { w: 1, h: 1 },
      { w: 1, h: 2 },
      { w: 2, h: 1 },
      { w: 2, h: 2 },
    ],
  },
  chair: {
    labelKey: 'editor.objects.chair',
    color: '#6b4423',
    category: 'furniture' as const,
    defaultImage: 'chair-wooden',
    imagePool: ['chair-wooden', 'chair-stool'],
  },
  chest: {
    labelKey: 'editor.objects.chest',
    color: '#9c6b30',
    category: 'furniture' as const,
    defaultImage: 'chest-wooden',
    imagePool: ['chest-wooden', 'chest-mimic'],
  },
  barrel: {
    labelKey: 'editor.objects.barrel',
    color: '#7a5a2b',
    category: 'furniture' as const,
    defaultImage: 'barrel-wooden',
    imagePool: ['barrel-wooden', 'barrel-crate'],
  },
  torch: {
    labelKey: 'editor.objects.torch',
    color: '#e08a2d',
    category: 'dungeon' as const,
    defaultImage: 'torch-wall',
    imagePool: ['torch-wall', 'torch-stand'],
  },
  bush: {
    labelKey: 'editor.objects.bush',
    color: '#2d6b2d',
    category: 'dungeon' as const,
    defaultImage: 'bush-green',
    imagePool: ['bush-green', 'bush-barren'],
  },
  tree: {
    labelKey: 'editor.objects.tree',
    color: '#2d5a1e',
    category: 'dungeon' as const,
    defaultScale: { w: 2, h: 2 },
    defaultImage: 'tree-oak',
    imagePool: ['tree-oak'],
    scales: [
      { w: 1, h: 1 },
      { w: 2, h: 2 },
    ],
  },
  rock: {
    labelKey: 'editor.objects.rock',
    color: '#6e6e78',
    category: 'dungeon' as const,
    defaultScale: { w: 2, h: 2 },
    defaultImage: 'rock-boulder',
    imagePool: ['rock-boulder', 'rock-cave'],
    scales: [
      { w: 1, h: 1 },
      { w: 2, h: 2 },
    ],
  },
} as const

export type ObjectKindId = keyof typeof OBJECT_KIND_REGISTRY

export interface ObjectKindEntry {
  readonly id: ObjectKindId
  readonly labelKey: string
  readonly color: string
  readonly category: ObjectCategory
  readonly defaultScale?: ObjectScale
  /** Доступные размеры фигуры; отсутствует = одноклеточный вид без кнопки «Размер». */
  readonly scales?: ReadonlyArray<ObjectScale>
  /** Изображение вида по умолчанию: стабильный imageId из пула element-images. */
  readonly defaultImage?: string
  /** Доступные для пикера imageId пула; defaultImage обязан быть одним из них. */
  readonly imagePool?: ReadonlyArray<string>
}

/**
 * Порядок видов в UI фиксируется порядком записей реестра.
 * Всегда должен содержать `defaultScale` (или 1×1) внутри `scales`.
 */
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
    ...('scales' in entry && { scales: entry.scales }),
    ...('defaultImage' in entry && { defaultImage: entry.defaultImage }),
    ...('imagePool' in entry && { imagePool: entry.imagePool }),
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

/**
 * Следующий размер вида по списку `scales` (с заворотом в конец списка).
 * Холостого цикла нет: повторный вызов всегда двигает вперёд.
 * Для вида без `scales` возвращает текущее значение без изменений
 * (кнопка «Размер» для таких видов не показывается).
 */
export function cycleScale(kindId: ObjectKindId, current: ObjectScale): ObjectScale {
  const scales = (
    OBJECT_KIND_REGISTRY[kindId] as { readonly scales?: ReadonlyArray<ObjectScale> }
  ).scales
  if (!scales || scales.length === 0) return current
  const index = scales.findIndex((scale) => scale.w === current.w && scale.h === current.h)
  return scales[(index + 1) % scales.length]
}

// ---------------------------------------------------------------------------
// Footprint utilities
// ---------------------------------------------------------------------------

/**
 * Footprint объекта: прямоугольник [x..x+w) × [y..y+h) в мировых единицах
 * (клетках). `x`/`y` — float-координата левого-верхнего угла; `w`/`h` — размер
 * из scale (по умолчанию 1×1). Поворот на footprint НЕ влияет (косметика).
 */
export function objectFootprint(obj: MapObject): { x: number; y: number; w: number; h: number } {
  const w = obj.scale?.w ?? 1
  const h = obj.scale?.h ?? 1
  return { x: obj.x, y: obj.y, w, h }
}

/** Проверка пересечения двух прямоугольников (в клетках). */
export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Origin объекта внутри карты: левый-верхний угол неотрицателен. Правый-нижний
 * край может свисать за границу карты (этап 23: свободное float-размещение).
 */
export function footprintInBounds(obj: MapObject): boolean {
  return Number.isFinite(obj.x) && Number.isFinite(obj.y) && obj.x >= 0 && obj.y >= 0
}

/** Прямоугольник footprint'а (float, клетки) свободен от других объектов. */
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

/** Объект, чей footprint содержит точку (x,y), последний в массиве (z-order). */
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
