import { useEffect, useState } from 'react'
import {
  loadElementManifest,
  loadManifest,
  loadSprites,
} from '../render/sprites/loader'
import type { SpriteAtlas } from '../render/sprites/loader'
import { ELEMENT_IMAGE_MANIFEST_PATH, SPRITE_MANIFEST_PATH } from '../render/sprites/manifest'

export type AtlasStatus = 'loading' | 'ready' | 'unavailable'

export interface SpriteAtlasState {
  atlas: SpriteAtlas | null
  status: AtlasStatus
}

/**
 * Атлас — настройка просмотра (не модель карты), поэтому живёт в
 * React-состоянии EditorPage и прокидывается в CanvasView и MapFileActions.
 * Манифесты спрайтов и пула изображений грузятся независимо: отсутствие
 * одного не лишает другого (элементы падают на спрайт/цвет).
 */
export function useSpriteAtlas(): SpriteAtlasState {
  const [state, setState] = useState<SpriteAtlasState>({ atlas: null, status: 'loading' })

  useEffect(() => {
    let cancelled = false
    Promise.all([loadManifest(SPRITE_MANIFEST_PATH), loadElementManifest(ELEMENT_IMAGE_MANIFEST_PATH)])
      .then(([spriteManifest, elementManifest]) =>
        spriteManifest || elementManifest
          ? loadSprites(spriteManifest ?? { version: 1, tiles: {}, objects: {} }, elementManifest)
          : null,
      )
      .then((atlas) => {
        if (!cancelled) {
          setState(atlas ? { atlas, status: 'ready' } : { atlas: null, status: 'unavailable' })
        }
      })
      .catch(() => {
        // loadManifest/loadElementManifest/loadSprites уже гасят отказы;
        // страховка от будущих правок.
        if (!cancelled) setState({ atlas: null, status: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
