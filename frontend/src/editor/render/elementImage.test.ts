import { describe, expect, it } from 'vitest'
import {
  ELEMENT_IMAGE_STORAGE_KEY_PREFIX,
  loadElementImage,
  saveElementImage,
} from './elementImage'

function makeStorage(backing: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(backing))
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value),
  }
}

const THROWING_STORAGE = {
  getItem: () => {
    throw new Error('denied')
  },
  removeItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('denied')
  },
} as unknown as Storage

describe('element image persistence', () => {
  it('loads null when nothing is stored', () => {
    expect(loadElementImage('table', makeStorage())).toBeNull()
    expect(loadElementImage('table', null)).toBeNull()
  })

  it('loads the stored imageId or null for garbage', () => {
    const storage = makeStorage({
      [`${ELEMENT_IMAGE_STORAGE_KEY_PREFIX}door`]: 'door-iron',
    })
    expect(loadElementImage('door', storage)).toBe('door-iron')
    expect(loadElementImage('table', storage)).toBeNull()
    expect(loadElementImage('door', makeStorage({ [`${ELEMENT_IMAGE_STORAGE_KEY_PREFIX}door`]: '' }))).toBeNull()
  })

  it('saves an imageId and removes it when reset to default', () => {
    const storage = makeStorage()

    saveElementImage('rock', 'rock-cave', storage)
    expect(loadElementImage('rock', storage)).toBe('rock-cave')
    expect(storage.getItem(`${ELEMENT_IMAGE_STORAGE_KEY_PREFIX}rock`)).toBe('rock-cave')

    saveElementImage('rock', null, storage)
    expect(loadElementImage('rock', storage)).toBeNull()
    expect(storage.getItem(`${ELEMENT_IMAGE_STORAGE_KEY_PREFIX}rock`)).toBeNull()
  })

  it('is happy with a kind that has no persisted choice', () => {
    const storage = makeStorage({ other: 'x' })
    expect(loadElementImage('chair', storage)).toBeNull()
  })

  it('swallows storage failures for reads and writes', () => {
    expect(loadElementImage('table', THROWING_STORAGE)).toBeNull()
    expect(() => saveElementImage('table', 'table-wooden', THROWING_STORAGE)).not.toThrow()
    expect(() => saveElementImage('table', null, THROWING_STORAGE)).not.toThrow()
  })
})