import { describe, expect, it } from 'vitest'
import {
  ELEMENT_IMAGE_MANIFEST_PATH,
  ELEMENT_IMAGE_MANIFEST_VERSION,
  SPRITE_MANIFEST_PATH,
  SPRITE_MANIFEST_VERSION,
  validateElementManifest,
  validateManifest,
} from './manifest'

const VALID = {
  version: 1,
  tiles: { floor: 'tiles/floor.png', wall: 'tiles/wall.png' },
  objects: { table: 'objects/table.png' },
}

const VALID_ELEMENT = {
  version: 1,
  items: { 'table-wooden': 'element-images/table-wooden.png', 'door-iron': 'element-images/door-iron.png' },
}

describe('validateManifest', () => {
  it('accepts a valid manifest and an empty one', () => {
    expect(validateManifest(VALID)).toEqual({
      version: 1,
      tiles: { floor: 'tiles/floor.png', wall: 'tiles/wall.png' },
      objects: { table: 'objects/table.png' },
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
    expect(validateManifest({ ...VALID, tiles: { lava: 'tiles/lava.png' } })).toBeNull()
    expect(validateManifest({ ...VALID, objects: { dragon: 'objects/dragon.png' } })).toBeNull()
  })

  it('rejects missing sections and bad paths', () => {
    expect(validateManifest({ version: 1, objects: {} })).toBeNull()
    expect(validateManifest({ version: 1, tiles: {} })).toBeNull()
    expect(validateManifest({ ...VALID, tiles: { floor: '' } })).toBeNull()
    expect(validateManifest({ ...VALID, objects: { table: 42 } })).toBeNull()
  })

  it('exposes the manifest path and schema version constants', () => {
    expect(SPRITE_MANIFEST_PATH).toBe('sprites/manifest.json')
    expect(SPRITE_MANIFEST_VERSION).toBe(1)
  })

  it('accepts a tile pool and omits the field when absent', () => {
    const pools = { floor: ['tiles/floor_01.png', 'tiles/floor_02.png'] }
    expect(validateManifest({ ...VALID, tilePools: pools })).toEqual({
      version: 1,
      tiles: { floor: 'tiles/floor.png', wall: 'tiles/wall.png' },
      objects: { table: 'objects/table.png' },
      tilePools: pools,
    })
    expect(validateManifest(VALID)).not.toHaveProperty('tilePools')
  })

  it('rejects malformed tile pools', () => {
    expect(validateManifest({ ...VALID, tilePools: { lava: ['tiles/x.png'] } })).toBeNull()
    expect(validateManifest({ ...VALID, tilePools: { floor: [] } })).toBeNull()
    expect(validateManifest({ ...VALID, tilePools: { floor: [''] } })).toBeNull()
    expect(validateManifest({ ...VALID, tilePools: { floor: [42] } })).toBeNull()
    expect(validateManifest({ ...VALID, tilePools: { floor: 'tiles/x.png' } })).toBeNull()
    expect(validateManifest({ ...VALID, tilePools: null })).toBeNull()
    expect(validateManifest({ ...VALID, tilePools: [] })).toBeNull()
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
