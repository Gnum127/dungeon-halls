import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { createEmptyMap } from './createEmptyMap'
import type { MapModel } from './types'

function makeMap(): MapModel {
  return createEmptyMap(3, 3)
}

describe('light commands', () => {
  it('adds lights with sequential ids', () => {
    let model = applyCommand(makeMap(), {
      kind: 'addLight',
      x: 1,
      y: 1,
      radius: 5,
      color: '#ffd682',
    })
    model = applyCommand(model, {
      kind: 'addLight',
      x: 0,
      y: 0,
      radius: 2,
      color: '#88aaff',
    })

    expect(model.lights).toHaveLength(2)
    expect(model.lights[0]).toMatchObject({ id: 1, x: 1, y: 1, radius: 5 })
    expect(model.lights[1]).toMatchObject({ id: 2 })
  })

  it.each([{ radius: 0 }, { radius: 31 }, { radius: 2.5 }])(
    'rejects invalid radius %j',
    ({ radius }) => {
      expect(() =>
        applyCommand(makeMap(), {
          kind: 'addLight',
          x: 1,
          y: 1,
          radius,
          color: '#ffd682',
        }),
      ).toThrow(/radius/)
    },
  )

  it.each(['red', '#ffdd8', '#ffdd88ff', ''])('rejects invalid color %s', (color) => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addLight', x: 1, y: 1, radius: 3, color }),
    ).toThrow(/color/)
  })

  it('rejects placement outside the map', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addLight', x: 5, y: 1, radius: 3, color: '#ffd682' }),
    ).toThrow(RangeError)
  })

  it('allows stacking several lights on one cell and removes by id', () => {
    let model = applyCommand(makeMap(), {
      kind: 'addLight',
      x: 1,
      y: 1,
      radius: 3,
      color: '#ffd682',
    })
    model = applyCommand(model, {
      kind: 'addLight',
      x: 1,
      y: 1,
      radius: 6,
      color: '#88aaff',
    })
    expect(model.lights).toHaveLength(2)

    model = applyCommand(model, { kind: 'removeLight', id: 1 })
    expect(model.lights).toHaveLength(1)
    expect(model.lights[0]?.id).toBe(2)

    expect(() => applyCommand(model, { kind: 'removeLight', id: 1 })).toThrow(/not found/)
  })

  it('accepts the radius boundaries 1 and 30 and never mutates the source', () => {
    const source = makeMap()
    let next = applyCommand(source, {
      kind: 'addLight',
      x: 0,
      y: 0,
      radius: 1,
      color: '#ffd682',
    })
    expect(next.lights[0]?.radius).toBe(1)
    expect(next.lights).not.toBe(source.lights)
    expect(source.lights).toEqual([])

    next = applyCommand(next, {
      kind: 'addLight',
      x: 1,
      y: 0,
      radius: 30,
      color: '#ffd682',
    })
    expect(next.lights[1]?.radius).toBe(30)
  })

  it('replaceMap clears lights atomically; no-op requires empty lights', () => {
    const source = applyCommand(makeMap(), {
      kind: 'addLight',
      x: 0,
      y: 0,
      radius: 3,
      color: '#ffd682',
    })

    const next = applyCommand(source, {
      kind: 'replaceMap',
      width: 3,
      height: 3,
      tiles: [...source.tiles],
    })
    expect(next).not.toBe(source)
    expect(next.lights).toEqual([])

    const clean = makeMap()
    expect(
      applyCommand(clean, {
        kind: 'replaceMap',
        width: 3,
        height: 3,
        tiles: [...clean.tiles],
      }),
    ).toBe(clean)
  })

  it('setGridType is forbidden while lights exist', () => {
    const source = applyCommand(makeMap(), {
      kind: 'addLight',
      x: 0,
      y: 0,
      radius: 3,
      color: '#ffd682',
    })
    expect(applyCommand(source, { kind: 'setGridType', gridType: 'hex-flat' })).toBe(source)
  })
})
