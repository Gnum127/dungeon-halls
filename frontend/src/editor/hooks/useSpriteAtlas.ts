import { useEffect, useState } from 'react'
import { loadManifest, loadSprites } from '../render/sprites/loader'
import type { SpriteAtlas } from '../render/sprites/loader'
import { SPRITE_MANIFEST_PATH } from '../render/sprites/manifest'

export type AtlasStatus = 'loading' | 'ready' | 'unavailable'

export interface SpriteAtlasState {
  atlas: SpriteAtlas | null
  status: AtlasStatus
}

/**
 * Атлас — настройка просмотра (не модель карты), поэтому живёт в
 * React-состоянии EditorPage и прокидывается в CanvasView и MapFileActions.
 */
export function useSpriteAtlas(): SpriteAtlasState {
  const [state, setState] = useState<SpriteAtlasState>({ atlas: null, status: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadManifest(SPRITE_MANIFEST_PATH)
      .then((manifest) => (manifest ? loadSprites(manifest) : null))
      .then((atlas) => {
        if (!cancelled) {
          setState(atlas ? { atlas, status: 'ready' } : { atlas: null, status: 'unavailable' })
        }
      })
      .catch(() => {
        // loadManifest/loadSprites уже гасят отказы; страховка от будущих правок.
        if (!cancelled) setState({ atlas: null, status: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
