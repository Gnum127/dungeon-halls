import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel, MapObject } from '../model/types'
import { isFootprintFreeAt, topmostObjectAt } from './objects'

const TORCH_KIND = 'torch'
const CHEST_KIND = 'chest'

function makeModel(
  objects: Array<{ id: number; x: number; y: number; kindId: string; w?: number; h?: number }>,
): MapModel {
  const map = createEmptyMap(4, 4)
  return {
    ...map,
    objects: objects.map(({ id, x, y, kindId, w, h }): MapObject => ({
      id,
      kindId,
      x,
      y,
      ...(w !== undefined && h !== undefined && { scale: { w, h } }),
    })),
  }
}

describe('topmostObjectAt', () => {
  it('returns the last object in the array when several share a point', () => {
    const model = makeModel([
      { id: 1, x: 1, y: 1, kindId: TORCH_KIND },
      { id: 2, x: 1, y: 1, kindId: CHEST_KIND },
    ])

    expect(topmostObjectAt(model, 1, 1)?.id).toBe(2)
  })

  it('finds objects in their own cells', () => {
    const model = makeModel([{ id: 2, x: 2, y: 2, kindId: CHEST_KIND }])

    expect(topmostObjectAt(model, 2, 2)?.id).toBe(2)
  })

  it('hit-tests float points inside a footprint', () => {
    const model = makeModel([{ id: 1, x: 1.25, y: 0.5, kindId: CHEST_KIND, w: 2, h: 1 }])

    expect(topmostObjectAt(model, 1.25, 0.5)?.id).toBe(1)
    expect(topmostObjectAt(model, 3, 1.4)?.id).toBe(1)
    expect(topmostObjectAt(model, 3.25, 1)?.id).toBeUndefined()
  })

  it('returns null for empty cells and outside coordinates', () => {
    const model = makeModel([{ id: 1, x: 0, y: 0, kindId: TORCH_KIND }])

    expect(topmostObjectAt(model, 3, 3)).toBeNull()
    expect(topmostObjectAt(model, -1, 0)).toBeNull()
    expect(topmostObjectAt(model, Number.NaN, 0)).toBeNull()
  })

  it('finds objects whose footprint overhangs the grid edge', () => {
    const model = makeModel([{ id: 1, x: 3.5, y: 3.5, kindId: CHEST_KIND, w: 2, h: 2 }])

    expect(topmostObjectAt(model, 4.5, 4.5)?.id).toBe(1)
    expect(topmostObjectAt(model, 5.5, 5.5)).toBeNull()
  })
})

describe('isFootprintFreeAt', () => {
  it('mirrors topmostObjectAt for a 1×1 footprint', () => {
    const model = makeModel([{ id: 1, x: 1, y: 1, kindId: TORCH_KIND }])

    expect(isFootprintFreeAt(model, 0, 0, 1, 1)).toBe(true)
    expect(isFootprintFreeAt(model, 1, 1, 1, 1)).toBe(false)
  })

  it('rejects a footprint overlapping a float object', () => {
    const model = makeModel([{ id: 1, x: 1.5, y: 1.5, kindId: TORCH_KIND }])

    expect(isFootprintFreeAt(model, 1, 1, 1, 1)).toBe(false)
    expect(isFootprintFreeAt(model, 2.5, 2.5, 1, 1)).toBe(true)
  })
})
