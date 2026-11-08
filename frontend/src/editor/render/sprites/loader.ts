import type { ObjectKindId } from '../../model/objects'
import type { TileTypeName } from '@/shared/tiles'
import type { ElementImageManifest, TextureManifest } from './manifest'
import {
  ELEMENT_IMAGE_MANIFEST_PATH,
  TEXTURE_MANIFEST_PATH,
  validateElementManifest,
  validateTextureManifest,
} from './manifest'

/** Таймаут ожидания одной картинки. */
export const TEXTURE_LOAD_TIMEOUT_MS = 10_000

/** Текстура ландшафта с размером плитки тайлинга (пиксели). */
export interface TileTexture {
  readonly image: HTMLImageElement
  readonly size: number
  /** Пул вариантов тайлинга (выбор детерминирован по координате плитки). */
  readonly pool?: readonly HTMLImageElement[]
}

/**
 * Готовый к рендеру снимок загруженных текстур: иммутабелен по контракту,
 * отсутствующие записи = fallback на цвет.
 */
export interface TextureAtlas {
  readonly tileTextures: Partial<Record<TileTypeName, TileTexture>>
  readonly objectTextures: Partial<Record<ObjectKindId, HTMLImageElement>>
  /** Пул готовых изображений элементов по imageId (см. ElementImageManifest). */
  readonly elementImages: Readonly<Partial<Record<string, HTMLImageElement>>>
}

/**
 * Контекст рендера (renderMap, pngExport): атлас + выбор изображения для вида.
 * imageOverrides — настройка просмотра (localStorage), не данные модели.
 * Приоритет резолва изображения объекта — в `renderMap.resolveObjectImage`
 * (override → `objectTextures` → `defaultImage` → цвет).
 */
export interface TextureRenderContext extends TextureAtlas {
  /**
   * Выбранные пользователем изображения видов пула; null = «по умолчанию»
   * (следовать обычному приоритету вида: `objectTextures` → `defaultImage`),
   * отсутствующий ключ = ничего не выбрано. Слой страницы, накладываемый на атлас.
   */
  readonly imageOverrides?: Readonly<Partial<Record<ObjectKindId, string | null>>>
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
    pending = decodeImage(url, TEXTURE_LOAD_TIMEOUT_MS).then((decoded) => {
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
export async function loadTextureManifest(
  path: string = TEXTURE_MANIFEST_PATH,
): Promise<TextureManifest | null> {
  return loadJson(path, validateTextureManifest)
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

/** Отказ одного файла не валит пайплайн: эта текстура просто отсутствует. */
export async function loadTextures(
  manifest: TextureManifest,
  elementManifest?: ElementImageManifest | null,
): Promise<TextureAtlas> {
  const [tileTextures, objectTextures, elementImages] = await Promise.all([
    resolveTileTextures(manifest.tileTextures),
    resolveObjectTextures(manifest.objectTextures),
    elementManifest ? resolveElementImages(elementManifest.items) : Promise.resolve({}),
  ])
  return { tileTextures, objectTextures, elementImages }
}

async function resolveTileTextures(
  entries: TextureManifest['tileTextures'],
): Promise<Partial<Record<TileTypeName, TileTexture>>> {
  const resolved = await Promise.all(
    Object.entries(entries).map(async ([key, entry]) => {
      if (!entry) return null
      const [base, pool] = await Promise.all([
        requestImage(resolveSpriteUrl(entry.path)),
        entry.pool ? requestPool(entry.pool) : Promise.resolve(undefined),
      ])
      // Отказ базового файла не убирает запись: берём первый живой вариант пула.
      const image = base ?? pool?.[0]
      if (!image) return null
      return [key, { image, size: entry.size, ...(pool && { pool }) }] as const
    }),
  )
  const result: Partial<Record<TileTypeName, TileTexture>> = {}
  for (const item of resolved) {
    if (item) result[item[0] as TileTypeName] = item[1]
  }
  return result
}

/** Пул вариантов: отказ отдельного файла не убирает весь пул; пустой пул — undefined. */
async function requestPool(paths: readonly string[]): Promise<readonly HTMLImageElement[] | undefined> {
  const images = await Promise.all(paths.map((path) => requestImage(resolveSpriteUrl(path))))
  const loaded = images.filter((image): image is HTMLImageElement => image !== null)
  return loaded.length > 0 ? loaded : undefined
}

async function resolveObjectTextures(
  entries: TextureManifest['objectTextures'],
): Promise<Partial<Record<ObjectKindId, HTMLImageElement>>> {
  const resolved = await Promise.all(
    Object.entries(entries).map(async ([key, entry]) => {
      if (!entry) return null
      const image = await requestImage(resolveSpriteUrl(entry.path))
      return image ? ([key, image] as const) : null
    }),
  )
  const result: Partial<Record<ObjectKindId, HTMLImageElement>> = {}
  for (const item of resolved) {
    if (item) result[item[0] as ObjectKindId] = item[1]
  }
  return result
}

async function resolveElementImages(
  items: Readonly<Record<string, string>>,
): Promise<Partial<Record<string, HTMLImageElement>>> {
  const resolved = await Promise.all(
    Object.entries(items).map(async ([id, path]) => {
      const image = await requestImage(resolveSpriteUrl(path))
      return image ? ([id, image] as const) : null
    }),
  )
  const result: Partial<Record<string, HTMLImageElement>> = {}
  for (const item of resolved) {
    if (item) result[item[0]] = item[1]
  }
  return result
}
