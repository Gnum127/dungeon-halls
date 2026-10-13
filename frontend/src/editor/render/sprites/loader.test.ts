import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadElementManifest,
  loadManifest,
  loadSprites,
  resetSpriteCache,
  resolveSpriteUrl,
  SPRITE_LOAD_TIMEOUT_MS,
} from './loader'
import type { SpriteManifest } from './manifest'

let constructed = 0

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private current = ''

  constructor() {
    constructed += 1
  }

  set src(value: string) {
    this.current = value
    queueMicrotask(() => {
      if (value.includes('missing')) this.onerror?.()
      else this.onload?.()
    })
  }

  get src(): string {
    return this.current
  }
}

function jsonResponse(payload: unknown, ok = true) {
  return { ok, json: async () => payload } as unknown as Response
}

beforeEach(() => {
  resetSpriteCache()
  constructed = 0
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveSpriteUrl', () => {
  it('joins the Vite base url with the manifest path', () => {
    expect(resolveSpriteUrl('tiles/floor.png')).toBe('/tiles/floor.png')
  })
})

describe('loadManifest', () => {
  it('returns null on a non-ok response (404)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(null, false)))
    expect(await loadManifest()).toBeNull()
  })

  it('returns null for invalid JSON shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ version: 99 })))
    expect(await loadManifest()).toBeNull()
  })

  it('returns a validated manifest', async () => {
    const manifest = { version: 1, tiles: { floor: 'tiles/floor.png' }, objects: {} }
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(manifest)))
    expect(await loadManifest()).toEqual(manifest)
  })
})

describe('loadElementManifest', () => {
  it('validates the element image pool', async () => {
    const manifest = { version: 1, items: { 'img-1': 'element-images/a.png' } }
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(manifest)))
    expect(await loadElementManifest()).toEqual(manifest)
  })
})

describe('loadSprites tile pools', () => {
  it('resolves a pool and skips failed variants', async () => {
    const atlas = await loadSprites({
      version: 1,
      tiles: {},
      objects: {},
      tilePools: { floor: ['tiles/floor_01.png', 'tiles/missing.png'] },
    })
    expect(atlas.tilePools.floor).toHaveLength(1)
    expect(atlas.tilePools.floor?.[0]).toBeInstanceOf(FakeImage)
  })

  it('omits a pool whose every variant failed', async () => {
    const atlas = await loadSprites({
      version: 1,
      tiles: {},
      objects: {},
      tilePools: { grass: ['tiles/missing.png'] },
    })
    expect(atlas.tilePools.grass).toBeUndefined()
  })
})

describe('loadSprites', () => {
  it('skips images that fail to load', async () => {
    const atlas = await loadSprites({
      version: 1,
      tiles: { floor: 'tiles/floor.png', grass: 'tiles/missing.png' },
      objects: {},
    })
    expect(atlas.tiles.floor).toBeDefined()
    expect(atlas.tiles.grass).toBeUndefined()
  })

  it('deduplicates parallel requests for the same path', async () => {
    const atlas = await loadSprites({
      version: 1,
      tiles: { floor: 'tiles/same.png' },
      objects: { table: 'tiles/same.png' },
    })
    expect(constructed).toBe(1)
    expect(atlas.tiles.floor).toBe(atlas.objects.table)
  })

  it('caches a successful load across calls', async () => {
    const manifest: SpriteManifest = { version: 1, tiles: { floor: 'tiles/floor.png' }, objects: {} }
    await loadSprites(manifest)
    await loadSprites(manifest)
    expect(constructed).toBe(1)
  })

  it('times out an image that never loads', async () => {
    class HangingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {}
    }
    vi.stubGlobal('Image', HangingImage as unknown as typeof Image)
    vi.useFakeTimers()
    try {
      const pending = loadSprites({ version: 1, tiles: { floor: 'tiles/hang.png' }, objects: {} })
      await vi.advanceTimersByTimeAsync(SPRITE_LOAD_TIMEOUT_MS + 1)
      const atlas = await pending
      expect(atlas.tiles.floor).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not cache a failed load (retries on the next request)', async () => {
    let attempts = 0
    class FlakyImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        attempts += 1
        const attempt = attempts
        queueMicrotask(() => {
          if (attempt === 1) this.onerror?.()
          else this.onload?.()
        })
      }
    }
    vi.stubGlobal('Image', FlakyImage as unknown as typeof Image)
    const manifest: SpriteManifest = { version: 1, tiles: { floor: 'tiles/flaky.png' }, objects: {} }

    const first = await loadSprites(manifest)
    expect(first.tiles.floor).toBeUndefined()

    const second = await loadSprites(manifest)
    expect(second.tiles.floor).toBeDefined()
    expect(attempts).toBe(2)
  })
})
