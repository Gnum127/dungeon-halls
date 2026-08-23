import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel, MapObject } from '../model/types'
import { isCellFree, topmostObjectAt } from './objects'

const DOOR_KIND = 'door'
const CHEST_KIND = 'chest'

function makeModel(objects: Array<{ id: number; x: number; y: number; kindId: string }>): MapModel {
  const map = createEmptyMap(4, 4)
  return {
    ...map,
    objects: objects.map(({ id, x, y, kindId }): MapObject => ({ id, kindId, x, y })),
  }
}

describe('topmostObjectAt', () => {
  it('returns the last object placed in the cell', () => {
    const model = makeModel([
      { id: 1, x: 1, y: 1, kindId: DOOR_KIND },
      { id: 2, x: 2, y: 2, kindId: CHEST_KIND },
    ])

    expect(topmostObjectAt(model, 1, 1)?.id).toBe(1)
    expect(topmostObjectAt(model, 2, 2)?.id).toBe(2)
  })

  it('returns null for empty cells and outside coordinates', () => {
    const model = makeModel([{ id: 1, x: 0, y: 0, kindId: DOOR_KIND }])

    expect(topmostObjectAt(model, 3, 3)).toBeNull()
    expect(topmostObjectAt(model, -1, 0)).toBeNull()
    expect(topmostObjectAt(model, Number.NaN, 0)).toBeNull()
  })
})

describe('isCellFree', () => {
  it('mirrors topmostObjectAt', () => {
    const model = makeModel([{ id: 1, x: 1, y: 1, kindId: DOOR_KIND }])

    expect(isCellFree(model, 0, 0)).toBe(true)
    expect(isCellFree(model, 1, 1)).toBe(false)
  })
})
