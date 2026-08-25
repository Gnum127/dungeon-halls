import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpriteManifest } from './manifest'
import {
  SPRITE_LOAD_TIMEOUT_MS,
  loadManifest,
  loadSprites,
  resetSpriteCache,
} from './loader'

type Behavior = 'ok' | 'error' | 'stall'

let createdImages: Array<{ src: string }> = []

class FakeImage {
  declare src: string
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    createdImages.push(this)
    const behavior: Behavior = script.shift() ?? 'stall'
    const store = { value: '' }
    Object.defineProperty(this, 'src', {
      set: (value: string) => {
        store.value = value
        if (behavior === 'ok') queueMicrotask(() => this.onload?.())
        if (behavior === 'error') queueMicrotask(() => this.onerror?.())
      },
      get: () => store.value,
    })
  }
}

// Поведение картинок по порядку создания: ok / error / stall (зависла).
let script: Behavior[] = []

const MANIFEST: SpriteManifest = {
  version: 1,
  tiles: { floor: 'tiles/floor.png', wall: 'tiles/wall.png' },
  objects: { door: 'objects/door.png' },
}

describe('loadManifest', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    resetSpriteCache()
    createdImages = []
    script = []
    fetchMock.mockClear()
    vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('parses a valid manifest', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, tiles: {}, objects: {} }),
    })
    expect(await loadManifest()).toEqual({ version: 1, tiles: {}, objects: {} })
  })

  it('returns null on http error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 })
    expect(await loadManifest()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null on broken json without unhandled rejection', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => '{broken' })
    expect(await loadManifest()).toBeNull()
  })

  it('returns null on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    expect(await loadManifest()).toBeNull()
  })

  it('returns null on schema-invalid payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: 99, tiles: {}, objects: {} }),
    })
    expect(await loadManifest()).toBeNull()
  })
})

describe('loadSprites', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    resetSpriteCache()
    createdImages = []
    script = []
    vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('loads all sprites and resolves urls against base url', async () => {
    script = ['ok', 'ok', 'ok']
    const atlas = await loadSprites(MANIFEST)

    expect(Object.keys(atlas.tiles)).toEqual(['floor', 'wall'])
    expect(atlas.objects.door).toBeDefined()
    expect(createdImages.map((image) => image.src)).toEqual([
      '/tiles/floor.png',
      '/tiles/wall.png',
      '/objects/door.png',
    ])
  })

  it('deduplicates parallel requests to the same path', async () => {
    script = ['ok', 'ok']
    const atlas = await Promise.all([
      loadSprites({ version: 1, tiles: { floor: 'a.png' }, objects: { chest: 'a.png' } }),
      loadSprites({ version: 1, tiles: { floor: 'a.png' }, objects: {} }),
    ])

    // Один уникальный путь — одна картинка на оба вызова.
    expect(createdImages).toHaveLength(1)
    expect(atlas[0]?.tiles.floor).toBe(atlas[0]?.objects.chest)
    expect(atlas[1]?.tiles.floor).toBe(atlas[0]?.tiles.floor)
  })

  it('keeps the pipeline alive when a single file fails', async () => {
    script = ['error', 'ok', 'ok']
    const atlas = await loadSprites(MANIFEST)

    expect(atlas.tiles.floor).toBeUndefined()
    expect(atlas.tiles.wall).toBeDefined()
  })

  it('allows retry after failure instead of caching it forever', async () => {
    script = ['error', 'ok']
    const failed = await loadSprites({
      version: 1,
      tiles: { floor: 'tiles/floor.png' },
      objects: {},
    })
    expect(failed.tiles.floor).toBeUndefined()

    const retried = await loadSprites({
      version: 1,
      tiles: { floor: 'tiles/floor.png' },
      objects: {},
    })
    expect(retried.tiles.floor).toBeDefined()
    expect(createdImages).toHaveLength(2)
  })

  it('serves repeated loads from cache without new images', async () => {
    script = ['ok']
    const first = await loadSprites({
      version: 1,
      tiles: { floor: 'tiles/floor.png' },
      objects: {},
    })
    const second = await loadSprites({
      version: 1,
      tiles: { floor: 'tiles/floor.png' },
      objects: {},
    })

    expect(createdImages).toHaveLength(1)
    expect(second.tiles.floor).toBe(first.tiles.floor)
  })

  it('drops stalled images after the load timeout', async () => {
    vi.useFakeTimers()
    script = ['stall']
    const pending = loadSprites({
      version: 1,
      tiles: { floor: 'tiles/floor.png' },
      objects: {},
    })

    await vi.advanceTimersByTimeAsync(SPRITE_LOAD_TIMEOUT_MS)
    expect((await pending).tiles.floor).toBeUndefined()
  })
})
