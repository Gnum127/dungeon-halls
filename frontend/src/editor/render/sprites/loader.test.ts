import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadElementManifest,
  loadTextureManifest,
  loadTextures,
  resetSpriteCache,
  resolveSpriteUrl,
  TEXTURE_LOAD_TIMEOUT_MS,
} from './loader'
import type { TextureManifest } from './manifest'

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

describe('loadTextureManifest', () => {
  it('returns null on a non-ok response (404)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(null, false)))
    expect(await loadTextureManifest()).toBeNull()
  })

  it('returns null for invalid JSON shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ version: 99 })))
    expect(await loadTextureManifest()).toBeNull()
  })

  it('returns null when the response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => {
              throw new SyntaxError('bad json')
            },
          }) as unknown as Response,
      ),
    )
    expect(await loadTextureManifest()).toBeNull()
  })

  it('returns null when fetch itself rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down')
      }),
    )
    expect(await loadTextureManifest()).toBeNull()
  })

  it('returns a validated manifest', async () => {
    const manifest = {
      version: 2,
      tileTextures: { floor: { path: 'tiles/floor_stone.png', size: 256 } },
      objectTextures: {},
    }
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(manifest)))
    expect(await loadTextureManifest()).toEqual(manifest)
  })
})

describe('loadElementManifest', () => {
  it('validates the element image pool', async () => {
    const manifest = { version: 1, items: { 'img-1': 'element-images/a.png' } }
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(manifest)))
    expect(await loadElementManifest()).toEqual(manifest)
  })
})

describe('loadTextures', () => {
  it('resolves tile textures with their size and skips failures', async () => {
    const atlas = await loadTextures({
      version: 2,
      tileTextures: {
        floor: { path: 'tiles/floor_stone.png', size: 256 },
        grass: { path: 'tiles/missing.png', size: 128 },
      },
      objectTextures: {},
    })
    expect(atlas.tileTextures.floor).toEqual({ image: expect.any(FakeImage), size: 256 })
    expect(atlas.tileTextures.grass).toBeUndefined()
  })

  it('resolves object textures and skips failures', async () => {
    const atlas = await loadTextures({
      version: 2,
      tileTextures: {},
      objectTextures: {
        table: { path: 'objects/table_wooden.png' },
        rock: { path: 'objects/missing.png' },
      },
    })
    expect(atlas.objectTextures.table).toBeInstanceOf(FakeImage)
    expect(atlas.objectTextures.rock).toBeUndefined()
  })

  it('loads the element image pool alongside textures', async () => {
    const atlas = await loadTextures(
      { version: 2, tileTextures: {}, objectTextures: {} },
      { version: 1, items: { 'table-wooden': 'element-images/table-wooden.png' } },
    )
    expect(atlas.elementImages['table-wooden']).toBeInstanceOf(FakeImage)
  })

  it('resolves a tile texture pool and skips failed variants', async () => {
    const atlas = await loadTextures({
      version: 2,
      tileTextures: {
        floor: { path: 'tiles/base.png', size: 64, pool: ['tiles/a.png', 'tiles/missing.png'] },
      },
      objectTextures: {},
    })
    expect(atlas.tileTextures.floor?.pool).toHaveLength(1)
    expect(atlas.tileTextures.floor?.pool?.[0]).toBeInstanceOf(FakeImage)
  })

  it('keeps the tile entry from a live pool variant when the base file fails', async () => {
    const atlas = await loadTextures({
      version: 2,
      tileTextures: {
        floor: { path: 'tiles/missing.png', size: 64, pool: ['tiles/a.png'] },
      },
      objectTextures: {},
    })
    expect(atlas.tileTextures.floor).toBeDefined()
    expect(atlas.tileTextures.floor?.image).toBe(atlas.tileTextures.floor?.pool?.[0])
  })

  it('deduplicates parallel requests for the same path', async () => {
    const atlas = await loadTextures({
      version: 2,
      tileTextures: { floor: { path: 'tiles/same.png', size: 64 } },
      objectTextures: { table: { path: 'tiles/same.png' } },
    })
    expect(constructed).toBe(1)
    expect(atlas.tileTextures.floor?.image).toBe(atlas.objectTextures.table)
  })

  it('caches a successful load across calls', async () => {
    const manifest: TextureManifest = {
      version: 2,
      tileTextures: { floor: { path: 'tiles/floor.png', size: 64 } },
      objectTextures: {},
    }
    await loadTextures(manifest)
    await loadTextures(manifest)
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
      const pending = loadTextures({
        version: 2,
        tileTextures: { floor: { path: 'tiles/hang.png', size: 64 } },
        objectTextures: {},
      })
      await vi.advanceTimersByTimeAsync(TEXTURE_LOAD_TIMEOUT_MS + 1)
      const atlas = await pending
      expect(atlas.tileTextures.floor).toBeUndefined()
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
    const manifest: TextureManifest = {
      version: 2,
      tileTextures: { floor: { path: 'tiles/flaky.png', size: 64 } },
      objectTextures: {},
    }

    const first = await loadTextures(manifest)
    expect(first.tileTextures.floor).toBeUndefined()

    const second = await loadTextures(manifest)
    expect(second.tileTextures.floor).toBeDefined()
    expect(attempts).toBe(2)
  })
})
