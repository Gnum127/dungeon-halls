import { useEffect, useState } from 'react'
import { loadElementManifest, loadTextureManifest, loadTextures } from '../render/sprites/loader'
import type { TextureAtlas } from '../render/sprites/loader'
import {
  ELEMENT_IMAGE_MANIFEST_PATH,
  TEXTURE_MANIFEST_PATH,
  TEXTURE_MANIFEST_VERSION,
} from '../render/sprites/manifest'
import type { TextureManifest } from '../render/sprites/manifest'

/** Пустой манифест текстур: только пул element-images доступен. */
const EMPTY_TEXTURE_MANIFEST: TextureManifest = {
  version: TEXTURE_MANIFEST_VERSION,
  tileTextures: {},
  objectTextures: {},
}

/**
 * Атлас текстур — настройка просмотра (не модель карты), поэтому живёт в
 * React-состоянии EditorPage и прокидывается в CanvasView и MapFileActions.
 * Режима «цвета/спрайты» больше нет: текстуры грузятся всегда, отсутствие
 * атласа/текстуры = цветной fallback. Манифесты текстур и пула изображений
 * грузятся независимо: отсутствие одного не лишает другого.
 */
export function useTextureAtlas(): TextureAtlas | null {
  const [atlas, setAtlas] = useState<TextureAtlas | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadTextureManifest(TEXTURE_MANIFEST_PATH),
      loadElementManifest(ELEMENT_IMAGE_MANIFEST_PATH),
    ])
      .then(([textureManifest, elementManifest]) =>
        textureManifest || elementManifest
          ? loadTextures(textureManifest ?? EMPTY_TEXTURE_MANIFEST, elementManifest)
          : null,
      )
      .then((loaded) => {
        if (!cancelled) setAtlas(loaded)
      })
      .catch(() => {
        // loadTextureManifest/loadElementManifest/loadTextures уже гасят отказы;
        // страховка от будущих правок.
        if (!cancelled) setAtlas(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return atlas
}
