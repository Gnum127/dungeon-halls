import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import { TILE_TYPES } from '../model/types'
import { EditorStore, HISTORY_LIMIT } from './EditorStore'

const FLOOR = TILE_TYPES.indexOf('floor')
const WATER = TILE_TYPES.indexOf('water')

function makeStore(): EditorStore {
  return new EditorStore(createEmptyMap(3, 3))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EditorStore', () => {
  it('returns the same model reference until a command is dispatched', () => {
    const store = makeStore()

    expect(store.getModel()).toBe(store.getModel())

    store.dispatch({ kind: 'setTile', x: 0, y: 0, tile: FLOOR })
    const afterDispatch = store.getModel()
    expect(store.getModel()).toBe(afterDispatch)
  })

  it('notifies subscribers on dispatch and allows unsubscribing', () => {
    const store = makeStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.dispatch({ kind: 'setTile', x: 0, y: 0, tile: FLOOR })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    store.dispatch({ kind: 'setTile', x: 1, y: 1, tile: FLOOR })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('undo restores the exact previous model and redo reapplies it', () => {
    const store = makeStore()
    const initial = store.getModel()
    store.dispatch({ kind: 'setTile', x: 0, y: 0, tile: FLOOR })
    const afterFirst = store.getModel()
    store.dispatch({ kind: 'setTile', x: 1, y: 1, tile: WATER })

    expect(store.undo()).toBe(true)
    expect(store.getModel()).toBe(afterFirst)
    expect(store.canUndo()).toBe(true)
    expect(store.canRedo()).toBe(true)

    expect(store.redo()).toBe(true)
    expect(store.getModel()).not.toBe(afterFirst)

    expect(store.undo()).toBe(true)
    expect(store.undo()).toBe(true)
    expect(store.getModel()).toBe(initial)
    expect(store.undo()).toBe(false)
    expect(store.canRedo()).toBe(true)
  })

  it('a new dispatch after undo clears the redo branch', () => {
    const store = makeStore()
    store.dispatch({ kind: 'setTile', x: 0, y: 0, tile: FLOOR })
    store.undo()
    expect(store.canRedo()).toBe(true)

    store.dispatch({ kind: 'setTile', x: 2, y: 2, tile: WATER })
    expect(store.canRedo()).toBe(false)
    expect(store.redo()).toBe(false)
  })

  it('keeps history depth at HISTORY_LIMIT entries', () => {
    const store = makeStore()
    const total = HISTORY_LIMIT + 7
    for (let i = 0; i < total; i += 1) {
      store.dispatch({
        kind: 'setTile',
        x: i % 3,
        y: Math.floor(i / 3) % 3,
        tile: FLOOR,
      })
    }

    let undos = 0
    while (store.undo()) undos += 1

    expect(undos).toBe(HISTORY_LIMIT)
    expect(store.canUndo()).toBe(false)

    let redos = 0
    while (store.redo()) redos += 1
    expect(redos).toBe(HISTORY_LIMIT)
  })
})
