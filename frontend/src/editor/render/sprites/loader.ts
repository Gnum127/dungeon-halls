import type { ObjectKindId } from '../../model/objects'
import type { TileTypeName } from '@/shared/tiles'
import type { ElementImageManifest, SpriteManifest } from './manifest'
import {
  ELEMENT_IMAGE_MANIFEST_PATH,
  SPRITE_MANIFEST_PATH,
  validateElementManifest,
  validateManifest,
} from './manifest'

/** Таймаут ожидания одной картинки. */
export const SPRITE_LOAD_TIMEOUT_MS = 10_000

/**
 * Готовый к рендеру снимок загруженных спрайтов: иммутабелен по контракту,
 * отсутствующие записи = fallback на цвет.
 */
export interface SpriteAtlas {
  readonly tiles: Partial<Record<TileTypeName, HTMLImageElement>>
  readonly objects: Partial<Record<ObjectKindId, HTMLImageElement>>
  /** Пул готовых изображений элементов по imageId (см. ElementImageManifest). */
  readonly elementImages: Readonly<Partial<Record<string, HTMLImageElement>>>
}

/**
 * Контекст рендера (renderMap, pngExport): атлас + выбор изображения для вида.
 * imageOverrides — настройка просмотра (localStorage), не данные модели:
 * приоритет override → defaultImage → спрайт-ассет → цвет.
 */
export interface SpriteRenderContext extends SpriteAtlas {
  readonly imageOverrides?: Readonly<Partial<Record<ObjectKindId, string>>>
}

// Пути в манифесте относительны базовому URL статики Vite ('/' по умолчанию).
export function resolveSpriteUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`
}

const imageCache = new Map<string, HTMLImageElement>()
const inflight = new Map<string, Promise<HTMLImageElement | null>>()

/** Только для тестов: сброс кэша между тестами. */
export function resetSpriteCache(): void {
  imageCache.clear()
  inflight.clear()
}

function decodeImage(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    const timer = setTimeout(() => resolve(null), timeoutMs)
    image.onload = () => {
      clearTimeout(timer)
      resolve(image)
    }
    image.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    image.src = url
  })
}

/**
 * Дедупликация параллельных запросов одного пути; успешная загрузка
 * кэшируется, провал — нет (повтор после ошибки возможен).
 */
function requestImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(url)
  if (cached) return Promise.resolve(cached)

  let pending = inflight.get(url)
  if (!pending) {
    pending = decodeImage(url, SPRITE_LOAD_TIMEOUT_MS).then((decoded) => {
      if (decoded) imageCache.set(url, decoded)
      return decoded
    })
    void pending.finally(() => {
      inflight.delete(url)
    })
    inflight.set(url, pending)
  }
  return pending
}

/**
 * Отсутствие файла манифеста (404), сетевые ошибки и невалидный JSON —
 * нормальный путь: null, без необработанных rejection.
 */
export async function loadManifest(
  path: string = SPRITE_MANIFEST_PATH,
): Promise<SpriteManifest | null> {
  return loadJson(path, validateManifest)
}

/** То же для пула готовых изображений элементов. */
export async function loadElementManifest(
  path: string = ELEMENT_IMAGE_MANIFEST_PATH,
): Promise<ElementImageManifest | null> {
  return loadJson(path, validateElementManifest)
}

async function loadJson<T>(
  path: string,
  validate: (data: unknown) => T | null,
): Promise<T | null> {
  try {
    const response = await fetch(resolveSpriteUrl(path))
    if (!response.ok) return null
    return validate(await response.json())
  } catch {
    return null
  }
}

/** Отказ одного файла не валит пайплайн: этот спрайт просто отсутствует. */
export async function loadSprites(
  manifest: SpriteManifest,
  elementManifest?: ElementImageManifest | null,
): Promise<SpriteAtlas> {
  const [tiles, objects, elementImages] = await Promise.all([
    resolveGroup(manifest.tiles),
    resolveGroup(manifest.objects),
    elementManifest ? resolveGroup(elementManifest.items) : Promise.resolve({}),
  ])
  return { tiles, objects, elementImages }
}

async function resolveGroup(
  group: Readonly<Record<string, string>>,
): Promise<Partial<Record<string, HTMLImageElement>>> {
  const entries = await Promise.all(
    Object.entries(group).map(async ([key, path]) => {
      const image = await requestImage(resolveSpriteUrl(path))
      return [key, image] as const
    }),
  )
  const result: Partial<Record<string, HTMLImageElement>> = {}
  for (const [key, image] of entries) {
    if (image) result[key] = image
  }
  return result
}
