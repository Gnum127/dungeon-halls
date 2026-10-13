import { describe, expect, it } from 'vitest'
import { generatorResultToSnapshot } from './generatorAdapter'

describe('generatorResultToSnapshot', () => {
  it('folds horizontal runs of the same tile into rectangular regions', () => {
    // row 0: floor floor empty grass ; row 1: empty...
    const tiles = [1, 1, 0, 2, 0, 0, 0, 0]
    const snapshot = generatorResultToSnapshot({ width: 4, height: 2, tiles })

    expect(snapshot.grid).toMatchObject({ width: 4, height: 2 })
    expect(snapshot.walls).toEqual([])
    expect(snapshot.doors).toEqual([])
    expect(snapshot.regions.map((r) => r.tileType)).toEqual(['floor', 'grass'])
    expect(snapshot.regions[0].polygon).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 },
    ])
    expect(snapshot.regions.map((r) => r.zOrder)).toEqual([0, 1])
  })

  it('produces no regions for an all-empty grid', () => {
    const snapshot = generatorResultToSnapshot({
      width: 3,
      height: 3,
      tiles: new Array(9).fill(0),
    })
    expect(snapshot.regions).toEqual([])
  })
})
