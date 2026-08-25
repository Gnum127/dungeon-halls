import { afterEach, describe, expect, it, vi } from 'vitest'
import { RENDER_MODE_STORAGE_KEY, isRenderMode, loadRenderMode, saveRenderMode } from './renderMode'

function makeStorage(backing: Record<string, string> = {}): Storage {
  return {
    getItem: (key: string) => backing[key] ?? null,
    setItem: (key: string, value: string) => {
      backing[key] = value
    },
    removeItem: (key: string) => {
      delete backing[key]
    },
    clear: () => {
      for (const key of Object.keys(backing)) delete backing[key]
    },
    key: () => null,
    length: 0,
  } as Storage
}

describe('renderMode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts only known modes', () => {
    expect(isRenderMode('colors')).toBe(true)
    expect(isRenderMode('sprites')).toBe(true)
    expect(isRenderMode('hex')).toBe(false)
    expect(isRenderMode(42)).toBe(false)
  })

  it('defaults to colors without storage or stored value', () => {
    expect(loadRenderMode(null)).toBe('colors')
    expect(loadRenderMode(makeStorage())).toBe('colors')
    expect(loadRenderMode(makeStorage({ [RENDER_MODE_STORAGE_KEY]: 'garbage' }))).toBe('colors')
  })

  it('reads a persisted mode back', () => {
    const backing: Record<string, string> = { [RENDER_MODE_STORAGE_KEY]: 'sprites' }
    expect(loadRenderMode(makeStorage(backing))).toBe('sprites')
  })

  it('persists the chosen mode', () => {
    const backing: Record<string, string> = {}
    saveRenderMode('sprites', makeStorage(backing))
    expect(backing[RENDER_MODE_STORAGE_KEY]).toBe('sprites')
  })

  it('survives a throwing storage', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(loadRenderMode(throwing)).toBe('colors')
    expect(() => saveRenderMode('sprites', throwing)).not.toThrow()
  })
})
