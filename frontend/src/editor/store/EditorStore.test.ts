import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import { TILE_TYPES } from '../model/types'
import type { MapModel } from '../model/types'
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

  it('no-op dispatch creates no history entry and does not notify', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)

    const before = store.getModel()
    store.dispatch({ kind: 'setTile', x: 0, y: 0, tile: 0 })

    expect(store.getModel()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    expect(store.canUndo()).toBe(false)
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

  it('notifies subscribers on undo and redo', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.dispatch({ kind: 'setTile', x: 0, y: 0, tile: FLOOR })
    expect(listener).toHaveBeenCalledTimes(1)

    store.undo()
    expect(listener).toHaveBeenCalledTimes(2)

    store.redo()
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('a fresh store has no history on either side', () => {
    const store = makeStore()

    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(false)
    expect(store.undo()).toBe(false)
    expect(store.redo()).toBe(false)
  })

  it('keeps history depth at HISTORY_LIMIT entries and evicts the oldest states', () => {
    const store = new EditorStore(createEmptyMap(10, 10))
    const snapshots: MapModel[] = [store.getModel()]
    const total = HISTORY_LIMIT + 7
    for (let i = 0; i < total; i += 1) {
      store.dispatch({
        kind: 'setTile',
        x: i % 10,
        y: Math.floor(i / 10),
        tile: FLOOR,
      })
      snapshots.push(store.getModel())
    }

    let undos = 0
    while (store.undo()) undos += 1

    expect(undos).toBe(HISTORY_LIMIT)
    expect(store.canUndo()).toBe(false)
    // Выживает ровно последняя HISTORY_LIMIT команд: после исчерпания undo
    // текущая модель — состояние сразу после (total - HISTORY_LIMIT)-го dispatch.
    expect(store.getModel()).toBe(snapshots[total - HISTORY_LIMIT])

    let redos = 0
    while (store.redo()) redos += 1
    expect(redos).toBe(HISTORY_LIMIT)
  })
})
