import { describe, expect, it } from 'vitest'
import {
  SPRITE_MANIFEST_PATH,
  SPRITE_MANIFEST_VERSION,
  validateManifest,
} from './manifest'

const VALID = {
  version: 1,
  tiles: { floor: 'tiles/floor.png', wall: 'tiles/wall.png' },
  objects: { door: 'objects/door.png' },
}

describe('validateManifest', () => {
  it('accepts a valid manifest and an empty one', () => {
    expect(validateManifest(VALID)).toEqual({
      version: 1,
      tiles: { floor: 'tiles/floor.png', wall: 'tiles/wall.png' },
      objects: { door: 'objects/door.png' },
    })
    expect(validateManifest({ version: 1, tiles: {}, objects: {} })).toEqual({
      version: 1,
      tiles: {},
      objects: {},
    })
  })

  it('rejects non-objects, null and arrays', () => {
    expect(validateManifest(null)).toBeNull()
    expect(validateManifest(undefined)).toBeNull()
    expect(validateManifest('manifest')).toBeNull()
    expect(validateManifest(42)).toBeNull()
    expect(validateManifest([])).toBeNull()
  })

  it('rejects unsupported versions', () => {
    expect(validateManifest({ ...VALID, version: 0 })).toBeNull()
    expect(validateManifest({ ...VALID, version: 2 })).toBeNull()
    expect(validateManifest({ ...VALID, version: '1' })).toBeNull()
    expect(validateManifest({ tiles: {}, objects: {} })).toBeNull()
  })

  it('rejects unknown tile or object keys', () => {
    expect(
      validateManifest({ ...VALID, tiles: { lava: 'tiles/lava.png' } }),
    ).toBeNull()
    expect(
      validateManifest({ ...VALID, objects: { dragon: 'objects/dragon.png' } }),
    ).toBeNull()
  })

  it('rejects missing sections and bad paths', () => {
    expect(validateManifest({ version: 1, objects: {} })).toBeNull()
    expect(validateManifest({ version: 1, tiles: {} })).toBeNull()
    expect(
      validateManifest({ ...VALID, tiles: { floor: '' } }),
    ).toBeNull()
    expect(
      validateManifest({ ...VALID, objects: { door: 42 } }),
    ).toBeNull()
  })

  it('exposes the manifest path and schema version constants', () => {
    expect(SPRITE_MANIFEST_PATH).toBe('sprites/manifest.json')
    expect(SPRITE_MANIFEST_VERSION).toBe(1)
  })
})
