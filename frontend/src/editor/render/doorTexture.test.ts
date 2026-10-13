import { describe, expect, it } from 'vitest'
import { DOOR_IMAGE_STORAGE_KEY, loadDoorImageId, saveDoorImageId } from './doorTexture'

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  } as unknown as Storage
}

describe('doorTexture persist', () => {
  it('saves a known door image and loads it back', () => {
    const storage = fakeStorage()
    saveDoorImageId('door-iron', storage)
    expect(loadDoorImageId(storage)).toBe('door-iron')
  })

  it('treats an unknown stored value as default (null)', () => {
    const storage = fakeStorage({ [DOOR_IMAGE_STORAGE_KEY]: 'bogus' })
    expect(loadDoorImageId(storage)).toBeNull()
  })

  it('removes the key when set to null', () => {
    const storage = fakeStorage()
    saveDoorImageId('door-stone', storage)
    saveDoorImageId(null, storage)
    expect(loadDoorImageId(storage)).toBeNull()
  })

  it('does not persist an unknown image id', () => {
    const storage = fakeStorage()
    saveDoorImageId('bogus', storage)
    expect(storage.getItem(DOOR_IMAGE_STORAGE_KEY)).toBeNull()
    expect(loadDoorImageId(storage)).toBeNull()
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
    expect(loadDoorImageId(throwing)).toBeNull()
    expect(() => saveDoorImageId('door-iron', throwing)).not.toThrow()
  })
})
