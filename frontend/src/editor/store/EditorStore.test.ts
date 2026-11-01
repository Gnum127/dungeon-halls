import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import { createTerrainRegion } from '../model/regions'
import type { MapModel } from '../model/types'
import { EditorStore, HISTORY_LIMIT } from './EditorStore'

const SQUARE = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

function region(id: string) {
  return createTerrainRegion('floor', SQUARE, 0, id)
}

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

    store.dispatch({ kind: 'addRegion', region: region('a') })
    const afterDispatch = store.getModel()
    expect(store.getModel()).toBe(afterDispatch)
  })

  it('notifies subscribers on dispatch and allows unsubscribing', () => {
    const store = makeStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.dispatch({ kind: 'addRegion', region: region('a') })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    store.dispatch({ kind: 'addRegion', region: region('b') })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('no-op dispatch creates no history entry and does not notify', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)

    const before = store.getModel()
    store.dispatch({ kind: 'removeRegion', id: 'missing' })

    expect(store.getModel()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    expect(store.canUndo()).toBe(false)
  })

  it('undo restores the exact previous model and redo reapplies it', () => {
    const store = makeStore()
    const initial = store.getModel()
    store.dispatch({ kind: 'addRegion', region: region('a') })
    const afterFirst = store.getModel()
    store.dispatch({ kind: 'addRegion', region: region('b') })

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
    store.dispatch({ kind: 'addRegion', region: region('a') })
    store.undo()
    expect(store.canRedo()).toBe(true)

    store.dispatch({ kind: 'addRegion', region: region('b') })
    expect(store.canRedo()).toBe(false)
    expect(store.redo()).toBe(false)
  })

  it('notifies subscribers on undo and redo', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.dispatch({ kind: 'addRegion', region: region('a') })
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

  it('replaceMap is one history entry: undo restores objects and grid', () => {
    const store = makeStore()
    store.dispatch({ kind: 'addObject', x: 0, y: 0, kindId: 'chair' })
    store.dispatch({ kind: 'addObject', x: 2, y: 2, kindId: 'chair' })
    const before = store.getModel()

    store.dispatch({
      kind: 'replaceMap',
      snapshot: {
        grid: { width: 2, height: 2, cellSize: 64 },
        regions: [],
        walls: [],
        doors: [],
        stairs: [],
        objects: [],
        lights: [],
      },
    })

    expect(store.getModel().objects).toEqual([])
    expect(store.getModel().grid.width).toBe(2)

    expect(store.undo()).toBe(true)
    expect(store.getModel()).toBe(before)
    expect(store.getModel().objects).toHaveLength(2)
    expect(store.canRedo()).toBe(true)
  })

  it('addRegionWithWalls is one history entry: undo restores region and walls', () => {
    const store = makeStore()
    const before = store.getModel()

    store.dispatch({
      kind: 'addRegionWithWalls',
      region: region('a'),
      walls: [
        {
          id: 'w1',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
          extends: 'right',
          thickness: 0.5,
        },
      ],
    })

    expect(store.getModel().regions).toHaveLength(1)
    expect(store.getModel().walls).toHaveLength(1)

    expect(store.undo()).toBe(true)
    expect(store.getModel()).toBe(before)
    expect(store.getModel().walls).toEqual([])
    expect(store.canRedo()).toBe(true)
  })

  it('reset replaces the document and clears history', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.dispatch({ kind: 'addRegion', region: region('a') })
    listener.mockClear()

    const replacement: MapModel = createEmptyMap(3, 3)
    store.reset(replacement)

    expect(store.getModel()).toBe(replacement)
    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)

    store.undo()
    expect(store.getModel()).toBe(replacement)
  })

  it('reset with the same model reference is a no-op', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.reset(store.getModel())

    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps history depth at HISTORY_LIMIT entries and evicts the oldest states', () => {
    const store = new EditorStore(createEmptyMap(320, 20))
    const snapshots: MapModel[] = [store.getModel()]
    const total = HISTORY_LIMIT + 7
    for (let i = 0; i < total; i += 1) {
      store.dispatch({
        kind: 'addRegion',
        region: createTerrainRegion(
          'floor',
          [
            { x: i % 300, y: 0 },
            { x: (i % 300) + 1, y: 0 },
            { x: (i % 300) + 1, y: 1 },
            { x: i % 300, y: 1 },
          ],
          0,
          `r${i}`,
        ),
      })
      snapshots.push(store.getModel())
    }

    let undos = 0
    while (store.undo()) undos += 1

    expect(undos).toBe(HISTORY_LIMIT)
    expect(store.canUndo()).toBe(false)
    expect(store.getModel()).toBe(snapshots[total - HISTORY_LIMIT])

    let redos = 0
    while (store.redo()) redos += 1
    expect(redos).toBe(HISTORY_LIMIT)
  })
})
