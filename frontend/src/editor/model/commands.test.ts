import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { createEmptyMap } from './createEmptyMap'
import { createTerrainRegion } from './regions'
import { createWallSegment } from './wallSegments'
import type { MapModel, ObjectRotation } from './types'

const SQUARE = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
]

const makeMap = (): MapModel => createEmptyMap(20, 20)
const region = (id = 'r1') => createTerrainRegion('floor', SQUARE, 0, id)
const wall = (id = 'w1') =>
  createWallSegment(
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ],
    { id },
  )

describe('addRegion', () => {
  it('adds a region and assigns an increasing zOrder (last on top)', () => {
    let model = applyCommand(makeMap(), { kind: 'addRegion', region: region('a') })
    model = applyCommand(model, { kind: 'addRegion', region: region('b') })
    expect(model.regions.map((r) => r.zOrder)).toEqual([0, 1])
    expect(model.regions[0]).not.toBe(model.regions[1])
  })

  it('overrides an incoming zOrder to keep the last-built on top', () => {
    const withBigZ = createTerrainRegion('floor', SQUARE, 99, 'a')
    const model = applyCommand(makeMap(), { kind: 'addRegion', region: withBigZ })
    expect(model.regions[0].zOrder).toBe(0)
  })

  it('rejects a duplicate region id', () => {
    const model = applyCommand(makeMap(), { kind: 'addRegion', region: region('a') })
    expect(() => applyCommand(model, { kind: 'addRegion', region: region('a') })).toThrow(
      /already exists/,
    )
  })

  it('rejects an invalid region', () => {
    const bowtie = createTerrainRegion('floor', SQUARE, 0, 'a')
    const broken = {
      ...bowtie,
      polygon: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }
    expect(() => applyCommand(makeMap(), { kind: 'addRegion', region: broken })).toThrow(RangeError)
  })
})

describe('removeRegion', () => {
  it('removes a region by id', () => {
    const model = applyCommand(makeMap(), { kind: 'addRegion', region: region('a') })
    expect(applyCommand(model, { kind: 'removeRegion', id: 'a' }).regions).toEqual([])
  })

  it('is a no-op for an unknown id', () => {
    const model = makeMap()
    expect(applyCommand(model, { kind: 'removeRegion', id: 'missing' })).toBe(model)
  })
})

describe('setWalls', () => {
  it('adds and removes wall segments by id', () => {
    let model = applyCommand(makeMap(), {
      kind: 'setWalls',
      updates: [{ segment: wall('w1'), present: true }],
    })
    expect(model.walls.map((w) => w.id)).toEqual(['w1'])
    model = applyCommand(model, {
      kind: 'setWalls',
      updates: [{ segment: wall('w1'), present: false }],
    })
    expect(model.walls).toEqual([])
  })

  it('is a no-op when nothing changes', () => {
    const model = makeMap()
    expect(applyCommand(model, { kind: 'setWalls', updates: [] })).toBe(model)
  })

  it('keeps doors when a wall is removed (doors are independent)', () => {
    let model = applyCommand(makeMap(), {
      kind: 'setWalls',
      updates: [{ segment: wall('w1'), present: true }],
    })
    model = applyCommand(model, { kind: 'addDoor', a: { x: 1, y: 0 }, b: { x: 2, y: 0 } })
    expect(model.doors).toHaveLength(1)

    model = applyCommand(model, {
      kind: 'setWalls',
      updates: [{ segment: wall('w1'), present: false }],
    })
    expect(model.walls).toEqual([])
    expect(model.doors).toHaveLength(1)
  })

  it('rejects an invalid wall segment', () => {
    const broken = { ...wall('w1'), thickness: -1 }
    expect(() =>
      applyCommand(makeMap(), { kind: 'setWalls', updates: [{ segment: broken, present: true }] }),
    ).toThrow(RangeError)
  })
})

describe('doors', () => {
  const addDoor = (model: MapModel) =>
    applyCommand(model, {
      kind: 'addDoor',
      a: { x: 1, y: 0 },
      b: { x: 2, y: 0 },
      imageId: 'door-wooden',
    })

  it('adds a door as an independent segment', () => {
    const model = addDoor(makeMap())
    expect(model.doors).toHaveLength(1)
    expect(model.doors[0]).toMatchObject({
      a: { x: 1, y: 0 },
      b: { x: 2, y: 0 },
      imageId: 'door-wooden',
    })
  })

  it('does not require a wall (doors are independent of walls)', () => {
    const model = addDoor(makeMap())
    expect(model.walls).toEqual([])
    expect(model.doors).toHaveLength(1)
  })

  it('rejects coinciding endpoints', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addDoor', a: { x: 1, y: 1 }, b: { x: 1, y: 1 } }),
    ).toThrow(/coincide/)
  })

  it('defaults the image to null when none is given', () => {
    const model = applyCommand(makeMap(), { kind: 'addDoor', a: { x: 1, y: 0 }, b: { x: 2, y: 0 } })
    expect(model.doors[0].imageId).toBeNull()
  })

  it('removes a door and throws for an unknown id', () => {
    const model = addDoor(makeMap())
    const id = model.doors[0].id
    expect(applyCommand(model, { kind: 'removeDoor', id }).doors).toEqual([])
    expect(() => applyCommand(model, { kind: 'removeDoor', id: 'nope' })).toThrow(/not found/)
  })
})

describe('stairs', () => {
  const squareStairs = [
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 2 },
    { x: 1, y: 2 },
  ]

  it('adds a stairs entity and removes it by id', () => {
    const model = applyCommand(makeMap(), { kind: 'addStairs', polygon: squareStairs })
    expect(model.stairs).toHaveLength(1)
    const id = model.stairs[0].id
    expect(model.stairs[0].polygon).toHaveLength(4)
    expect(applyCommand(model, { kind: 'removeStairs', id }).stairs).toEqual([])
  })

  it('is a no-op when removing an unknown stairs id', () => {
    const model = makeMap()
    expect(applyCommand(model, { kind: 'removeStairs', id: 'missing' })).toBe(model)
  })

  it('rejects a degenerate stairs polygon', () => {
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'addStairs',
        polygon: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
    ).toThrow(RangeError)
  })
})

describe('objects', () => {
  it('adds, moves and removes an object', () => {
    let model = applyCommand(makeMap(), { kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    expect(model.objects).toHaveLength(1)
    const id = model.objects[0].id

    model = applyCommand(model, { kind: 'moveObject', id, x: 3, y: 4 })
    expect(model.objects[0]).toMatchObject({ x: 3, y: 4 })

    model = applyCommand(model, { kind: 'removeObject', id })
    expect(model.objects).toEqual([])
  })

  it('accepts float move coordinates and rejects a negative origin', () => {
    const model = applyCommand(makeMap(), { kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const id = model.objects[0].id

    const moved = applyCommand(model, { kind: 'moveObject', id, x: 2.5, y: 1.75 })
    expect(moved.objects[0]).toMatchObject({ x: 2.5, y: 1.75 })

    expect(() => applyCommand(moved, { kind: 'moveObject', id, x: -1, y: 0 })).toThrow(RangeError)
    expect(() => applyCommand(moved, { kind: 'moveObject', id, x: 0, y: -1 })).toThrow(RangeError)
  })

  it('accepts a fractional addObject origin and no-ops a float move to the same point', () => {
    const model = applyCommand(makeMap(), { kind: 'addObject', x: 1.25, y: 2.5, kindId: 'chair' })
    expect(model.objects[0]).toMatchObject({ x: 1.25, y: 2.5 })

    const id = model.objects[0].id
    expect(applyCommand(model, { kind: 'moveObject', id, x: 1.25, y: 2.5 })).toBe(model)
  })

  it('rejects an unknown kind and a negative origin', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addObject', x: 0, y: 0, kindId: 'dragon' }),
    ).toThrow(/Unknown object kind/)
    expect(() =>
      applyCommand(makeMap(), { kind: 'addObject', x: -1, y: 0, kindId: 'chair' }),
    ).toThrow(RangeError)
  })
})

describe('lights', () => {
  it('adds and removes a light', () => {
    let model = applyCommand(makeMap(), {
      kind: 'addLight',
      x: 2,
      y: 2,
      radius: 5,
      color: '#ffdd88',
    })
    expect(model.lights[0]).toMatchObject({ id: 1, radius: 5 })
    model = applyCommand(model, { kind: 'removeLight', id: 1 })
    expect(model.lights).toEqual([])
  })

  it('rejects an invalid radius', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addLight', x: 0, y: 0, radius: 0, color: '#ffdd88' }),
    ).toThrow(/radius/)
  })
})

describe('replaceMap', () => {
  it('is a no-op for an identical snapshot', () => {
    const model = makeMap()
    expect(
      applyCommand(model, {
        kind: 'replaceMap',
        snapshot: {
          grid: model.grid,
          regions: model.regions,
          walls: model.walls,
          doors: model.doors,
          stairs: model.stairs,
          objects: model.objects,
          lights: model.lights,
        },
      }),
    ).toBe(model)
  })

  it('replaces the whole document atomically', () => {
    const model = applyCommand(makeMap(), { kind: 'addObject', x: 0, y: 0, kindId: 'chair' })
    const snapshot = {
      grid: { width: 10, height: 10, cellSize: 64 },
      regions: [region('a')],
      walls: [wall('w1')],
      doors: [],
      stairs: [],
      objects: [],
      lights: [],
    }
    const next = applyCommand(model, { kind: 'replaceMap', snapshot })
    expect(next.grid).toEqual({ width: 10, height: 10, cellSize: 64 })
    expect(next.regions).toHaveLength(1)
    expect(next.objects).toEqual([])
  })

  it('replaces stairs and rejects an invalid stairs polygon', () => {
    const snapshot = {
      grid: { width: 10, height: 10, cellSize: 64 },
      regions: [],
      walls: [],
      doors: [],
      stairs: [
        {
          id: 's1',
          polygon: [
            { x: 1, y: 1 },
            { x: 3, y: 1 },
            { x: 3, y: 2 },
            { x: 1, y: 2 },
          ],
        },
      ],
      objects: [],
      lights: [],
    }
    const next = applyCommand(makeMap(), { kind: 'replaceMap', snapshot })
    expect(next.stairs).toHaveLength(1)
    expect(next.stairs[0]).not.toBe(snapshot.stairs[0])

    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          ...snapshot,
          stairs: [
            {
              id: 's2',
              polygon: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          ],
        },
      }),
    ).toThrow(RangeError)
  })

  it('rejects an invalid snapshot grid', () => {
    const model = makeMap()
    expect(() =>
      applyCommand(model, {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 0, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [],
          stairs: [],
          objects: [],
          lights: [],
        },
      }),
    ).toThrow(RangeError)
  })
})

describe('setWalls set-semantics', () => {
  it('updates an existing segment when its geometry changes', () => {
    let model = applyCommand(makeMap(), {
      kind: 'setWalls',
      updates: [{ segment: wall('w1'), present: true }],
    })
    const thicker = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      { id: 'w1', thickness: 1 },
    )
    model = applyCommand(model, {
      kind: 'setWalls',
      updates: [{ segment: thicker, present: true }],
    })
    expect(model.walls[0].thickness).toBe(1)
  })

  it('is a no-op when the same segment is re-added unchanged', () => {
    const model = applyCommand(makeMap(), {
      kind: 'setWalls',
      updates: [{ segment: wall('w1'), present: true }],
    })
    expect(
      applyCommand(model, { kind: 'setWalls', updates: [{ segment: wall('w1'), present: true }] }),
    ).toBe(model)
  })

  it('is a no-op when removing an absent segment', () => {
    const model = makeMap()
    expect(
      applyCommand(model, { kind: 'setWalls', updates: [{ segment: wall('w9'), present: false }] }),
    ).toBe(model)
  })
})

describe('objects (edge cases)', () => {
  it('allows moving into an occupied cell (collisions removed, этап 28)', () => {
    let model = applyCommand(makeMap(), { kind: 'addObject', x: 0, y: 0, kindId: 'chair' })
    model = applyCommand(model, { kind: 'addObject', x: 2, y: 0, kindId: 'chair' })
    const id = model.objects[0].id
    const moved = applyCommand(model, { kind: 'moveObject', id, x: 2, y: 0 })
    expect(moved.objects.find((object) => object.id === id)).toMatchObject({ x: 2, y: 0 })
  })

  it('is a no-op when moving to the same cell', () => {
    const model = applyCommand(makeMap(), { kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const id = model.objects[0].id
    expect(applyCommand(model, { kind: 'moveObject', id, x: 1, y: 1 })).toBe(model)
  })

  it('throws for unknown object ids', () => {
    expect(() => applyCommand(makeMap(), { kind: 'moveObject', id: 99, x: 1, y: 1 })).toThrow(
      /not found/,
    )
    expect(() => applyCommand(makeMap(), { kind: 'removeObject', id: 99 })).toThrow(/not found/)
  })

  it('allows a footprint that overhangs the grid when the origin stays inside', () => {
    const model = applyCommand(createEmptyMap(3, 3), {
      kind: 'addObject',
      x: 2,
      y: 0,
      kindId: 'table',
      scale: { w: 2, h: 1 },
    })
    expect(model.objects[0]).toMatchObject({ x: 2, y: 0, scale: { w: 2, h: 1 } })
  })

  it('stores the per-instance imageId on placement', () => {
    const model = applyCommand(makeMap(), {
      kind: 'addObject',
      x: 1,
      y: 1,
      kindId: 'table',
      imageId: 'table-round',
    })
    expect(model.objects[0].imageId).toBe('table-round')
  })
})

describe('setObject* commands (этап 28)', () => {
  const withObject = () =>
    applyCommand(makeMap(), { kind: 'addObject', x: 1, y: 1, kindId: 'table' })

  it('sets the per-instance image and no-ops on the same value', () => {
    const model = withObject()
    const id = model.objects[0].id
    const next = applyCommand(model, { kind: 'setObjectImage', id, imageId: 'table-round' })
    expect(next.objects[0].imageId).toBe('table-round')
    expect(applyCommand(next, { kind: 'setObjectImage', id, imageId: 'table-round' })).toBe(next)
    expect(
      applyCommand(model, { kind: 'setObjectImage', id, imageId: null }).objects[0],
    ).toHaveProperty('imageId', null)
  })

  it('resets to the default image (undefined removes the property)', () => {
    const model = withObject()
    const id = model.objects[0].id
    const withImage = applyCommand(model, { kind: 'setObjectImage', id, imageId: 'table-round' })
    const reset = applyCommand(withImage, { kind: 'setObjectImage', id, imageId: undefined })
    expect(reset.objects[0]).not.toHaveProperty('imageId')
    // Повторный сброс — no-op.
    expect(applyCommand(reset, { kind: 'setObjectImage', id, imageId: undefined })).toBe(reset)
  })

  it('sets scale/rotation, no-ops on the same value, rejects invalid input', () => {
    const model = withObject()
    const id = model.objects[0].id
    expect(
      applyCommand(model, { kind: 'setObjectScale', id, scale: { w: 2, h: 2 } }).objects[0].scale,
    ).toEqual({ w: 2, h: 2 })
    expect(
      applyCommand(model, { kind: 'setObjectRotation', id, rotation: 270 }).objects[0].rotation,
    ).toBe(270)
    // no-op не увеличивает историю (возвращается тот же объект модели).
    const scaled = applyCommand(model, { kind: 'setObjectScale', id, scale: { w: 2, h: 2 } })
    expect(applyCommand(scaled, { kind: 'setObjectScale', id, scale: { w: 2, h: 2 } })).toBe(scaled)
    const rotated = applyCommand(model, { kind: 'setObjectRotation', id, rotation: 90 })
    expect(applyCommand(rotated, { kind: 'setObjectRotation', id, rotation: 90 })).toBe(rotated)
    expect(() =>
      applyCommand(model, { kind: 'setObjectScale', id, scale: { w: 0, h: 1 } }),
    ).toThrow(/scale/)
    expect(() =>
      applyCommand(model, { kind: 'setObjectRotation', id, rotation: 45 as ObjectRotation }),
    ).toThrow(/rotation/)
    expect(() => applyCommand(model, { kind: 'setObjectImage', id: 99, imageId: null })).toThrow(
      /not found/,
    )
    expect(() => applyCommand(model, { kind: 'setObjectImage', id, imageId: '' })).toThrow(
      /imageId/,
    )
  })

  it('sets origin and size together via setObjectBounds and no-ops on the same value', () => {
    const model = withObject()
    const id = model.objects[0].id
    const next = applyCommand(model, {
      kind: 'setObjectBounds',
      id,
      x: 2,
      y: 3,
      scale: { w: 2, h: 4 },
    })
    expect(next.objects[0]).toMatchObject({ x: 2, y: 3, scale: { w: 2, h: 4 } })
    expect(
      applyCommand(next, { kind: 'setObjectBounds', id, x: 2, y: 3, scale: { w: 2, h: 4 } }),
    ).toBe(next)
  })

  it('rejects setObjectBounds outside the grid or with an invalid scale', () => {
    const model = withObject()
    const id = model.objects[0].id
    // origin за верхним/левым краем — недопустим (как при размещении кликом).
    expect(() =>
      applyCommand(model, { kind: 'setObjectBounds', id, x: -1, y: 0, scale: { w: 1, h: 1 } }),
    ).toThrow(/out of bounds/)
    expect(() =>
      applyCommand(model, { kind: 'setObjectBounds', id, x: 0, y: 0, scale: { w: 0, h: 1 } }),
    ).toThrow(/scale/)
  })
})

describe('setDoorImage (этап 28)', () => {
  const withDoor = () =>
    applyCommand(makeMap(), { kind: 'addDoor', a: { x: 1, y: 1 }, b: { x: 2, y: 1 } })

  it('sets the door image, no-ops on the same value and validates input', () => {
    const model = withDoor()
    const id = model.doors[0].id
    const next = applyCommand(model, { kind: 'setDoorImage', id, imageId: 'door-iron' })
    expect(next.doors[0].imageId).toBe('door-iron')
    expect(applyCommand(next, { kind: 'setDoorImage', id, imageId: 'door-iron' })).toBe(next)
    expect(() => applyCommand(model, { kind: 'setDoorImage', id: 'nope', imageId: null })).toThrow(
      /not found/,
    )
    expect(() => applyCommand(model, { kind: 'setDoorImage', id, imageId: '' })).toThrow(/imageId/)
  })
})

describe('lights (edge cases)', () => {
  it('rejects out-of-bounds placement', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addLight', x: 99, y: 0, radius: 3, color: '#ffdd88' }),
    ).toThrow(/Cell x/)
  })

  it('rejects an invalid radius or color and unknown removal', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addLight', x: 0, y: 0, radius: 31, color: '#ffdd88' }),
    ).toThrow(/radius/)
    expect(() =>
      applyCommand(makeMap(), { kind: 'addLight', x: 0, y: 0, radius: 3, color: 'red' }),
    ).toThrow(/color/)
    expect(() => applyCommand(makeMap(), { kind: 'removeLight', id: 7 })).toThrow(/not found/)
  })
})

describe('replaceMap (invariants & aliasing)', () => {
  it('is a no-op for a structurally equal but reference-distinct snapshot', () => {
    const base = applyCommand(makeMap(), { kind: 'addRegion', region: region('a') })
    const snapshot = {
      grid: { ...base.grid },
      regions: base.regions.map((r) => ({
        id: r.id,
        tileType: r.tileType,
        polygon: r.polygon.map((p) => ({ x: p.x, y: p.y })),
        zOrder: r.zOrder,
      })),
      walls: [],
      doors: [],
      stairs: [],
      objects: [],
      lights: [],
    }
    expect(applyCommand(base, { kind: 'replaceMap', snapshot })).toBe(base)
  })

  it('rejects a snapshot with a door whose endpoints coincide', () => {
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [{ id: 'd1', a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, imageId: null }],
          stairs: [],
          objects: [],
          lights: [],
        },
      }),
    ).toThrow(/coincide/)
  })

  it('rejects a snapshot with an invalid region or object', () => {
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [
            {
              id: 'a',
              tileType: 'floor',
              polygon: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
              ],
              zOrder: 0,
            },
          ],
          walls: [],
          doors: [],
          stairs: [],
          objects: [],
          lights: [],
        },
      }),
    ).toThrow(RangeError)
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [],
          stairs: [],
          objects: [{ id: 1, kindId: 'dragon', x: 0, y: 0 }],
          lights: [],
        },
      }),
    ).toThrow(/Unknown object kind/)
  })

  it('accepts overlapping objects in a snapshot but rejects duplicate object/light ids', () => {
    expect(
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [],
          stairs: [],
          objects: [
            { id: 1, kindId: 'chair', x: 0, y: 0 },
            { id: 2, kindId: 'chair', x: 0, y: 0 },
          ],
          lights: [],
        },
      }).objects,
    ).toHaveLength(2)
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [],
          stairs: [],
          objects: [
            { id: 1, kindId: 'chair', x: 0, y: 0 },
            { id: 1, kindId: 'chair', x: 2, y: 2 },
          ],
          lights: [],
        },
      }),
    ).toThrow(/Duplicate object id/)
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [],
          stairs: [],
          objects: [],
          lights: [
            { id: 1, x: 0, y: 0, radius: 3, color: '#ffdd88' },
            { id: 1, x: 2, y: 2, radius: 3, color: '#ffdd88' },
          ],
        },
      }),
    ).toThrow(/Duplicate light id/)
  })

  it('does not alias snapshot collections or elements', () => {
    const model = makeMap()
    const regionEntry = createTerrainRegion('floor', SQUARE, 0, 'a')
    const snapshot = {
      grid: { width: 10, height: 10, cellSize: 64 },
      regions: [regionEntry],
      walls: [],
      doors: [],
      stairs: [],
      objects: [],
      lights: [],
    }
    const next = applyCommand(model, { kind: 'replaceMap', snapshot })
    expect(next.regions[0]).not.toBe(regionEntry)
    ;(snapshot.regions[0].polygon as { x: number; y: number }[])[0] = { x: 999, y: 999 }
    expect(next.regions[0].polygon[0].x).not.toBe(999)
    snapshot.regions.push(regionEntry)
    expect(next.regions).toHaveLength(1)
  })

  it('returns a new model and does not mutate the input region on addRegion', () => {
    const model = makeMap()
    const input = createTerrainRegion('floor', SQUARE, 5, 'a')
    const next = applyCommand(model, { kind: 'addRegion', region: input })
    expect(next).not.toBe(model)
    expect(input.zOrder).toBe(5)
    expect(next.regions[0].zOrder).toBe(0)
  })
})

describe('addRegionWithWalls', () => {
  it('rebuilds auto walls while keeping manual walls, and leaves doors untouched', () => {
    const manual = createWallSegment([
      { x: 10, y: 10 },
      { x: 12, y: 10 },
    ])
    const autoKept = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      { id: 'auto:h:0,0' },
    )
    const autoGone = createWallSegment(
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      { id: 'auto:h:1,0' },
    )

    let model = applyCommand(makeMap(), {
      kind: 'setWalls',
      updates: [
        { segment: manual, present: true },
        { segment: autoKept, present: true },
        { segment: autoGone, present: true },
      ],
    })
    // Doors are independent of walls → survive the wall rebuild.
    model = applyCommand(model, { kind: 'addDoor', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } })
    expect(model.doors).toHaveLength(1)

    const recomputed = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      { id: 'auto:h:0,0' },
    )
    const next = applyCommand(model, {
      kind: 'addRegionWithWalls',
      region: createTerrainRegion('floor', SQUARE, 0, 'r2'),
      walls: [recomputed],
    })

    const ids = next.walls.map((w) => w.id)
    expect(ids).toContain(manual.id)
    expect(ids).toContain('auto:h:0,0')
    expect(ids).not.toContain('auto:h:1,0')
    expect(next.doors).toHaveLength(1)
    expect(next.regions.map((r) => r.id)).toContain('r2')
  })
})
