import { describe, expect, it } from 'vitest'
import {
  ELEMENT_IMAGE_STORAGE_KEY_PREFIX,
  loadElementImage,
  saveElementImage,
} from './elementImage'

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  } as unknown as Storage
}

describe('elementImage', () => {
  it('loads a stored override; missing or empty means default (null)', () => {
    const storage = fakeStorage({ [`${ELEMENT_IMAGE_STORAGE_KEY_PREFIX}table`]: 'img-1' })
    expect(loadElementImage('table', storage)).toBe('img-1')
    expect(loadElementImage('chair', storage)).toBeNull()

    const empty = fakeStorage({ [`${ELEMENT_IMAGE_STORAGE_KEY_PREFIX}table`]: '' })
    expect(loadElementImage('table', empty)).toBeNull()
  })

  it('persists a choice and removes the key for default', () => {
    const storage = fakeStorage()
    saveElementImage('table', 'img-2', storage)
    expect(loadElementImage('table', storage)).toBe('img-2')
    saveElementImage('table', null, storage)
    expect(loadElementImage('table', storage)).toBeNull()
  })

  it('swallows storage errors (private mode / quota)', () => {
    const throwing = {
      getItem() {
        throw new Error('nope')
      },
      setItem() {
        throw new Error('nope')
      },
      removeItem() {
        throw new Error('nope')
      },
    } as unknown as Storage

    expect(loadElementImage('table', throwing)).toBeNull()
    expect(() => saveElementImage('table', 'img', throwing)).not.toThrow()
  })
})
