import type { ObjectKindId } from '../../model/objects'
import { OBJECT_KINDS } from '../../model/objects'
import type { TileTypeName } from '@/shared/tiles'
import { TILE_TYPES } from '@/shared/tiles'

export const SPRITE_MANIFEST_VERSION = 1

/** Путь к манифесту относительно base URL статики Vite. */
export const SPRITE_MANIFEST_PATH = 'sprites/manifest.json'

export const ELEMENT_IMAGE_MANIFEST_VERSION = 1

/** Путь к манифесту готовых изображений элементов относительно base URL статики. */
export const ELEMENT_IMAGE_MANIFEST_PATH = 'element-images/manifest.json'

/**
 * Пул готовых изображений элементов: imageId (глобальный стабильный slug,
 * независимый от kindId) → путь к файлу. Ключи произвольные и не связаны
 * с реестром видов: привязка идёт через `imagePool`/`defaultImage` в
 * ObjectKindEntry (проверяется тестами реестра).
 */
export interface ElementImageManifest {
  readonly version: typeof ELEMENT_IMAGE_MANIFEST_VERSION
  readonly items: Readonly<Record<string, string>>
}

/**
 * Записи опциональны: нет записи — рендер уходит в fallback на цвет.
 * Единственный источник путей к спрайтам — манифест.
 * `tilePools` — необязательный пул вариантов текстуры тайла: при тайлинге
 * варианта выбирается детерминированно по координате клетки (shared/random).
 */
export interface SpriteManifest {
  readonly version: typeof SPRITE_MANIFEST_VERSION
  readonly tiles: Partial<Record<TileTypeName, string>>
  readonly objects: Partial<Record<ObjectKindId, string>>
  readonly tilePools?: Partial<Record<TileTypeName, readonly string[]>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Строгая валидация пула изображений: битый JSON / непустой-не-строковый путь /
 * неподдерживаемая version ⇒ null. Пустой пул валиден (все виды уходят в
 * fallback на цвет/спрайт).
 */
export function validateElementManifest(data: unknown): ElementImageManifest | null {
  if (!isRecord(data)) return null
  const { version, items } = data
  if (version !== ELEMENT_IMAGE_MANIFEST_VERSION) return null

  const validatedItems = validatePaths(items, null)
  if (!validatedItems) return null

  return {
    version: ELEMENT_IMAGE_MANIFEST_VERSION,
    items: validatedItems,
  }
}

function validatePaths(
  value: unknown,
  allowedKeys: readonly string[] | null,
): Record<string, string> | null {
  if (!isRecord(value)) return null
  const paths: Record<string, string> = {}
  for (const [key, path] of Object.entries(value)) {
    if (
      (allowedKeys && !allowedKeys.includes(key)) ||
      typeof path !== 'string' ||
      path.length === 0
    ) {
      return null
    }
    paths[key] = path
  }
  return paths
}

/**
 * Строгая валидация: битый JSON / неизвестные ключи тайлов или видов /
 * неподдерживаемая version ⇒ null («манифест невалиден») — вызывающий
 * уходит в цветной режим, падения нет. Отсутствие записи ошибкой не является.
 */
export function validateManifest(data: unknown): SpriteManifest | null {
  if (!isRecord(data)) return null
  const { version, tiles, objects, tilePools } = data
  if (version !== SPRITE_MANIFEST_VERSION) return null

  const validatedTiles = validatePaths(tiles, TILE_TYPES as readonly string[])
  if (!validatedTiles) return null
  const validatedObjects = validatePaths(objects, OBJECT_KINDS as readonly string[])
  if (!validatedObjects) return null

  const manifest: SpriteManifest = {
    version: SPRITE_MANIFEST_VERSION,
    tiles: validatedTiles,
    objects: validatedObjects,
  }
  if (tilePools === undefined) return manifest

  const validatedPools = validatePools(tilePools)
  if (!validatedPools) return null
  return { ...manifest, tilePools: validatedPools }
}

/**
 * Пул вариантов текстур: ключи — только известные тайлы, значения — непустые
 * массивы непустых путей (пустой пул бессмыслен и отклоняется).
 */
function validatePools(value: unknown): Partial<Record<TileTypeName, readonly string[]>> | null {
  if (!isRecord(value)) return null
  const pools: Partial<Record<TileTypeName, readonly string[]>> = {}
  for (const [key, paths] of Object.entries(value)) {
    if (!(TILE_TYPES as readonly string[]).includes(key)) return null
    if (
      !Array.isArray(paths) ||
      paths.length === 0 ||
      !paths.every((path) => typeof path === 'string' && path.length > 0)
    ) {
      return null
    }
    pools[key as TileTypeName] = paths as string[]
  }
  return pools
}
