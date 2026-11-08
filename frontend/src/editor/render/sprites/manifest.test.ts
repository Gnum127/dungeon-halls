import { describe, expect, it } from 'vitest'
import { TILE_TYPES } from '@/shared/tiles'
import { OBJECT_KINDS } from '../../model/objects'
import textureManifest from '../../../../public/sprites/manifest.json'
import {
  ELEMENT_IMAGE_MANIFEST_PATH,
  ELEMENT_IMAGE_MANIFEST_VERSION,
  TEXTURE_MANIFEST_PATH,
  TEXTURE_MANIFEST_VERSION,
  validateElementManifest,
  validateTextureManifest,
} from './manifest'

const VALID = {
  version: 2,
  tileTextures: {
    floor: { path: 'sprites/tiles/floor_stone.png', size: 256 },
    grass: { path: 'sprites/tiles/grass.png', size: 512 },
  },
  objectTextures: { table: { path: 'sprites/objects/table_wooden.png' } },
}

const VALID_ELEMENT = {
  version: 1,
  items: { 'table-wooden': 'element-images/table-wooden.png', 'door-iron': 'element-images/door-iron.png' },
}

describe('validateTextureManifest', () => {
  it('accepts a valid manifest and an empty one', () => {
    expect(validateTextureManifest(VALID)).toEqual({
      version: 2,
      tileTextures: {
        floor: { path: 'sprites/tiles/floor_stone.png', size: 256 },
        grass: { path: 'sprites/tiles/grass.png', size: 512 },
      },
      objectTextures: { table: { path: 'sprites/objects/table_wooden.png' } },
    })
    expect(validateTextureManifest({ version: 2, tileTextures: {}, objectTextures: {} })).toEqual({
      version: 2,
      tileTextures: {},
      objectTextures: {},
    })
  })

  it('rejects non-objects, null and arrays', () => {
    expect(validateTextureManifest(null)).toBeNull()
    expect(validateTextureManifest(undefined)).toBeNull()
    expect(validateTextureManifest('manifest')).toBeNull()
    expect(validateTextureManifest(42)).toBeNull()
    expect(validateTextureManifest([])).toBeNull()
  })

  it('rejects unsupported versions', () => {
    expect(validateTextureManifest({ ...VALID, version: 1 })).toBeNull()
    expect(validateTextureManifest({ ...VALID, version: 3 })).toBeNull()
    expect(validateTextureManifest({ ...VALID, version: '2' })).toBeNull()
    expect(validateTextureManifest({ tileTextures: {}, objectTextures: {} })).toBeNull()
  })

  it('rejects unknown tile or object keys', () => {
    expect(
      validateTextureManifest({ ...VALID, tileTextures: { lava: { path: 'x.png', size: 256 } } }),
    ).toBeNull()
    expect(
      validateTextureManifest({ ...VALID, objectTextures: { dragon: { path: 'x.png' } } }),
    ).toBeNull()
  })

  it('rejects missing sections, bad paths and bad sizes', () => {
    expect(validateTextureManifest({ version: 2, objectTextures: {} })).toBeNull()
    expect(validateTextureManifest({ version: 2, tileTextures: {} })).toBeNull()
    expect(
      validateTextureManifest({ ...VALID, tileTextures: { floor: { path: '', size: 256 } } }),
    ).toBeNull()
    expect(
      validateTextureManifest({ ...VALID, tileTextures: { floor: { path: 'x.png' } } }),
    ).toBeNull()
    expect(
      validateTextureManifest({ ...VALID, tileTextures: { floor: { path: 'x.png', size: 0 } } }),
    ).toBeNull()
    expect(
      validateTextureManifest({
        ...VALID,
        tileTextures: { floor: { path: 'x.png', size: Number.POSITIVE_INFINITY } },
      }),
    ).toBeNull()
    expect(
      validateTextureManifest({
        ...VALID,
        tileTextures: { floor: { path: 'x.png', size: Number.NaN } },
      }),
    ).toBeNull()
    expect(validateTextureManifest({ ...VALID, objectTextures: { table: {} } })).toBeNull()
    expect(validateTextureManifest({ ...VALID, objectTextures: { table: 42 } })).toBeNull()
    expect(validateTextureManifest({ ...VALID, tileTextures: { floor: 42 } })).toBeNull()
  })

  it('exposes the manifest path and schema version constants', () => {
    expect(TEXTURE_MANIFEST_PATH).toBe('sprites/manifest.json')
    expect(TEXTURE_MANIFEST_VERSION).toBe(2)
  })

  it('accepts an optional tile pool and rejects malformed pools', () => {
    expect(
      validateTextureManifest({
        ...VALID,
        tileTextures: { floor: { path: 'x.png', size: 256, pool: ['a.png', 'b.png'] } },
      }),
    ).toEqual({
      version: 2,
      tileTextures: { floor: { path: 'x.png', size: 256, pool: ['a.png', 'b.png'] } },
      objectTextures: { table: { path: 'sprites/objects/table_wooden.png' } },
    })
    expect(
      validateTextureManifest({
        ...VALID,
        tileTextures: { floor: { path: 'x.png', size: 256, pool: [] } },
      }),
    ).toBeNull()
    expect(
      validateTextureManifest({
        ...VALID,
        tileTextures: { floor: { path: 'x.png', size: 256, pool: [''] } },
      }),
    ).toBeNull()
    expect(
      validateTextureManifest({
        ...VALID,
        tileTextures: { floor: { path: 'x.png', size: 256, pool: [42] } },
      }),
    ).toBeNull()
    expect(
      validateTextureManifest({
        ...VALID,
        tileTextures: { floor: { path: 'x.png', size: 256, pool: 'x.png' } },
      }),
    ).toBeNull()
    expect(
      validateTextureManifest({
        ...VALID,
        tileTextures: { floor: { path: 'x.png', size: 256, pool: null } },
      }),
    ).toBeNull()
  })
})

describe('shipped texture manifest', () => {
  it('validates and covers only known tiles and object kinds', () => {
    const parsed = validateTextureManifest(textureManifest)
    expect(parsed).not.toBeNull()

    const tileKeys = Object.keys(parsed?.tileTextures ?? {})
    expect(tileKeys).toContain('floor')
    expect(tileKeys.every((key) => (TILE_TYPES as readonly string[]).includes(key))).toBe(true)

    const objectKeys = Object.keys(parsed?.objectTextures ?? {})
    expect(objectKeys.length).toBeGreaterThan(0)
    expect(objectKeys.every((key) => (OBJECT_KINDS as readonly string[]).includes(key))).toBe(true)
  })
})

describe('validateElementManifest', () => {
  it('accepts a valid pool manifest and an empty one', () => {
    expect(validateElementManifest(VALID_ELEMENT)).toEqual({
      version: 1,
      items: {
        'table-wooden': 'element-images/table-wooden.png',
        'door-iron': 'element-images/door-iron.png',
      },
    })
    expect(validateElementManifest({ version: 1, items: {} })).toEqual({ version: 1, items: {} })
  })

  it('accepts arbitrary imageIds (slugs not bound to the kind registry)', () => {
    expect(
      validateElementManifest({ version: 1, items: { 'very-unique-workbench-v1': 'a.png' } }),
    ).toEqual({ version: 1, items: { 'very-unique-workbench-v1': 'a.png' } })
  })

  it('rejects non-objects, null, arrays and wrong versions', () => {
    expect(validateElementManifest(null)).toBeNull()
    expect(validateElementManifest([])).toBeNull()
    expect(validateElementManifest({ version: 2, items: {} })).toBeNull()
    expect(validateElementManifest({ items: {} })).toBeNull()
  })

  it('rejects missing items and non-string paths', () => {
    expect(validateElementManifest({ version: 1 })).toBeNull()
    expect(validateElementManifest({ version: 1, items: { 'table-wooden': '' } })).toBeNull()
    expect(validateElementManifest({ version: 1, items: { 'table-wooden': 42 } })).toBeNull()
    expect(validateElementManifest({ version: 1, items: [] })).toBeNull()
  })

  it('exposes the pool manifest path and schema version constants', () => {
    expect(ELEMENT_IMAGE_MANIFEST_PATH).toBe('element-images/manifest.json')
    expect(ELEMENT_IMAGE_MANIFEST_VERSION).toBe(1)
  })
})
