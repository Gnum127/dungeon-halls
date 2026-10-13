import { describe, expect, it } from 'vitest'
import elementManifest from '../../../public/element-images/manifest.json'
import { DOOR_CATALOG, isKnownDoorImage } from './doorCatalog'

describe('DOOR_CATALOG', () => {
  it('offers at least three door kinds with unique ids and images', () => {
    expect(DOOR_CATALOG.length).toBeGreaterThanOrEqual(3)
    const kindIds = DOOR_CATALOG.map((entry) => entry.doorKindId)
    const imageIds = DOOR_CATALOG.map((entry) => entry.defaultImageId)
    expect(new Set(kindIds).size).toBe(kindIds.length)
    expect(new Set(imageIds).size).toBe(imageIds.length)
  })

  it('has unique, non-empty label keys', () => {
    const labels = DOOR_CATALOG.map((entry) => entry.labelKey)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels.every((label) => label.length > 0)).toBe(true)
  })

  it('references images that exist in the element-images manifest', () => {
    const poolIds = new Set(Object.keys(elementManifest.items))
    for (const entry of DOOR_CATALOG) {
      expect(poolIds.has(entry.defaultImageId)).toBe(true)
    }
  })
})

describe('isKnownDoorImage', () => {
  it('accepts catalog images and rejects unknown ids and null', () => {
    expect(isKnownDoorImage('door-iron')).toBe(true)
    expect(isKnownDoorImage('nope')).toBe(false)
    expect(isKnownDoorImage(null)).toBe(false)
  })
})
