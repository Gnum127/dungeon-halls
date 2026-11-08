import type { ObjectKindId } from '../../model/objects'
import { OBJECT_KINDS } from '../../model/objects'
import type { TileTypeName } from '@/shared/tiles'
import { TILE_TYPES } from '@/shared/tiles'

export const TEXTURE_MANIFEST_VERSION = 2

/** Путь к манифесту текстур относительно base URL статики Vite. */
export const TEXTURE_MANIFEST_PATH = 'sprites/manifest.json'

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

/** Текстура ландшафта: бесшовная картинка `size×size`, тайлится по региону. */
export interface TileTextureEntry {
  readonly path: string
  /** Размер текстурной плитки в пикселях (сторона квадрата). */
  readonly size: number
  /**
   * Опциональный пул вариантов: при тайлинге вариант выбирается
   * детерминированно по координате текстурной плитки (`shared/random`).
   * Если пул задан, он предпочитается одиночному `path`.
   */
  readonly pool?: readonly string[]
}

/** Текстура объекта: картинка растягивается на footprint (без тайлинга). */
export interface ObjectTextureEntry {
  readonly path: string
}

/**
 * Манифест текстур (v2): тайлы ландшафта тайлятся под сеткой, текстуры
 * объектов растягиваются на footprint поверх сетки. Записи опциональны:
 * нет записи — рендер уходит в fallback на цвет.
 */
export interface TextureManifest {
  readonly version: typeof TEXTURE_MANIFEST_VERSION
  readonly tileTextures: Partial<Record<TileTypeName, TileTextureEntry>>
  readonly objectTextures: Partial<Record<ObjectKindId, ObjectTextureEntry>>
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

  const validatedItems = validateStringMap(items)
  if (!validatedItems) return null

  return {
    version: ELEMENT_IMAGE_MANIFEST_VERSION,
    items: validatedItems,
  }
}

function validateStringMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null
  const paths: Record<string, string> = {}
  for (const [key, path] of Object.entries(value)) {
    if (typeof path !== 'string' || path.length === 0) return null
    paths[key] = path
  }
  return paths
}

/**
 * Строгая валидация манифеста текстур: битый JSON / неизвестные ключи тайлов
 * или видов / неположительный `size` / неподдерживаемая version ⇒ null
 * («манифест невалиден») — вызывающий уходит в цветной режим, падения нет.
 * Отсутствие записи ошибкой не является.
 */
export function validateTextureManifest(data: unknown): TextureManifest | null {
  if (!isRecord(data)) return null
  const { version, tileTextures, objectTextures } = data
  if (version !== TEXTURE_MANIFEST_VERSION) return null

  const validatedTiles = validateTileTextures(tileTextures)
  if (!validatedTiles) return null
  const validatedObjects = validateObjectTextures(objectTextures)
  if (!validatedObjects) return null

  return {
    version: TEXTURE_MANIFEST_VERSION,
    tileTextures: validatedTiles,
    objectTextures: validatedObjects,
  }
}

function validateTileTextures(
  value: unknown,
): Partial<Record<TileTypeName, TileTextureEntry>> | null {
  if (!isRecord(value)) return null
  const entries: Partial<Record<TileTypeName, TileTextureEntry>> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!(TILE_TYPES as readonly string[]).includes(key)) return null
    if (!isRecord(entry)) return null
    const { path, size, pool } = entry
    if (typeof path !== 'string' || path.length === 0) return null
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return null
    if (pool !== undefined) {
      if (
        !Array.isArray(pool) ||
        pool.length === 0 ||
        !pool.every((variant) => typeof variant === 'string' && variant.length > 0)
      ) {
        return null
      }
      entries[key as TileTypeName] = { path, size, pool: pool as string[] }
      continue
    }
    entries[key as TileTypeName] = { path, size }
  }
  return entries
}

function validateObjectTextures(
  value: unknown,
): Partial<Record<ObjectKindId, ObjectTextureEntry>> | null {
  if (!isRecord(value)) return null
  const entries: Partial<Record<ObjectKindId, ObjectTextureEntry>> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!(OBJECT_KINDS as readonly string[]).includes(key)) return null
    if (!isRecord(entry)) return null
    const { path } = entry
    if (typeof path !== 'string' || path.length === 0) return null
    entries[key as ObjectKindId] = { path }
  }
  return entries
}
