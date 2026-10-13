import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { createEmptyMap } from './createEmptyMap'
import { createTerrainRegion } from './regions'
import { createWallSegment } from './wallSegments'
import { DOOR_POSITION_TOLERANCE, findDoorById } from './doors'
import type { MapModel } from './types'

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

  it('cascades: removing a wall removes its doors in the same command', () => {
    let model = applyCommand(makeMap(), {
      kind: 'setWalls',
      updates: [{ segment: wall('w1'), present: true }],
    })
    model = applyCommand(model, { kind: 'addDoor', wallSegmentId: 'w1', position: 0.5 })
    expect(model.doors).toHaveLength(1)

    model = applyCommand(model, {
      kind: 'setWalls',
      updates: [{ segment: wall('w1'), present: false }],
    })
    expect(model.walls).toEqual([])
    expect(model.doors).toEqual([])
  })

  it('rejects an invalid wall segment', () => {
    const broken = { ...wall('w1'), thickness: -1 }
    expect(() =>
      applyCommand(makeMap(), { kind: 'setWalls', updates: [{ segment: broken, present: true }] }),
    ).toThrow(RangeError)
  })
})

describe('doors', () => {
  const withWall = () =>
    applyCommand(makeMap(), { kind: 'setWalls', updates: [{ segment: wall('w1'), present: true }] })

  it('adds a door on an existing wall segment', () => {
    const model = applyCommand(withWall(), {
      kind: 'addDoor',
      wallSegmentId: 'w1',
      position: 0.3,
      imageId: 'door-wooden',
    })
    expect(model.doors).toHaveLength(1)
    expect(model.doors[0]).toMatchObject({
      wallSegmentId: 'w1',
      position: 0.3,
      imageId: 'door-wooden',
    })
  })

  it('rejects a door on an unknown segment', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addDoor', wallSegmentId: 'nope', position: 0.5 }),
    ).toThrow(/existing wall segment/)
  })

  it('rejects a door too close to another on the same segment', () => {
    const model = applyCommand(withWall(), { kind: 'addDoor', wallSegmentId: 'w1', position: 0.5 })
    expect(() =>
      applyCommand(model, { kind: 'addDoor', wallSegmentId: 'w1', position: 0.52 }),
    ).toThrow(/too close/)
  })

  it('uses a strict tolerance boundary (exactly at tolerance is allowed)', () => {
    const model = applyCommand(withWall(), { kind: 'addDoor', wallSegmentId: 'w1', position: 0.5 })
    expect(() =>
      applyCommand(model, {
        kind: 'addDoor',
        wallSegmentId: 'w1',
        position: 0.5 + DOOR_POSITION_TOLERANCE,
      }),
    ).not.toThrow()
    expect(() =>
      applyCommand(model, {
        kind: 'addDoor',
        wallSegmentId: 'w1',
        position: 0.5 + DOOR_POSITION_TOLERANCE - 1e-6,
      }),
    ).toThrow(/too close/)
  })

  it('rejects an out-of-range door position', () => {
    expect(() =>
      applyCommand(withWall(), { kind: 'addDoor', wallSegmentId: 'w1', position: 1.5 }),
    ).toThrow(/position/)
  })

  it('throws when toggling an unknown door', () => {
    expect(() => applyCommand(makeMap(), { kind: 'setDoorOpen', id: 'nope', open: true })).toThrow(
      /not found/,
    )
  })

  it('toggles open state and no-ops on same value', () => {
    const model = applyCommand(withWall(), { kind: 'addDoor', wallSegmentId: 'w1', position: 0.5 })
    const id = model.doors[0].id
    const opened = applyCommand(model, { kind: 'setDoorOpen', id, open: true })
    expect(findDoorById(opened.doors, id)?.open).toBe(true)
    expect(applyCommand(opened, { kind: 'setDoorOpen', id, open: true })).toBe(opened)
  })

  it('removes a door and throws for an unknown id', () => {
    const model = applyCommand(withWall(), { kind: 'addDoor', wallSegmentId: 'w1', position: 0.5 })
    const id = model.doors[0].id
    expect(applyCommand(model, { kind: 'removeDoor', id }).doors).toEqual([])
    expect(() => applyCommand(model, { kind: 'removeDoor', id: 'nope' })).toThrow(/not found/)
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

  it('rejects an unknown kind and out-of-bounds placement', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addObject', x: 0, y: 0, kindId: 'dragon' }),
    ).toThrow(/Unknown object kind/)
    expect(() =>
      applyCommand(makeMap(), { kind: 'addObject', x: 25, y: 0, kindId: 'chair' }),
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
      objects: [],
      lights: [],
    }
    const next = applyCommand(model, { kind: 'replaceMap', snapshot })
    expect(next.grid).toEqual({ width: 10, height: 10, cellSize: 64 })
    expect(next.regions).toHaveLength(1)
    expect(next.objects).toEqual([])
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
  it('rejects overlap when moving into an occupied cell', () => {
    let model = applyCommand(makeMap(), { kind: 'addObject', x: 0, y: 0, kindId: 'chair' })
    model = applyCommand(model, { kind: 'addObject', x: 2, y: 0, kindId: 'chair' })
    const id = model.objects[0].id
    expect(() => applyCommand(model, { kind: 'moveObject', id, x: 2, y: 0 })).toThrow(/overlaps/)
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

  it('rejects a footprint that exceeds the grid', () => {
    expect(() =>
      applyCommand(createEmptyMap(3, 3), {
        kind: 'addObject',
        x: 2,
        y: 0,
        kindId: 'table',
        scale: { w: 2, h: 1 },
      }),
    ).toThrow(/out of bounds/)
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
      objects: [],
      lights: [],
    }
    expect(applyCommand(base, { kind: 'replaceMap', snapshot })).toBe(base)
  })

  it('rejects a snapshot with a door on an unknown wall segment', () => {
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [
            { id: 'd1', wallSegmentId: 'missing', position: 0.5, open: false, imageId: null },
          ],
          objects: [],
          lights: [],
        },
      }),
    ).toThrow(/unknown wall/)
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
          objects: [{ id: 1, kindId: 'dragon', x: 0, y: 0 }],
          lights: [],
        },
      }),
    ).toThrow(/Unknown object kind/)
  })

  it('rejects a snapshot with overlapping objects or duplicate object/light ids', () => {
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [],
          objects: [
            { id: 1, kindId: 'chair', x: 0, y: 0 },
            { id: 2, kindId: 'chair', x: 0, y: 0 },
          ],
          lights: [],
        },
      }),
    ).toThrow(/overlaps/)
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'replaceMap',
        snapshot: {
          grid: { width: 10, height: 10, cellSize: 64 },
          regions: [],
          walls: [],
          doors: [],
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
  it('rebuilds auto walls while keeping manual walls and doors on surviving edges', () => {
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
    model = applyCommand(model, { kind: 'addDoor', wallSegmentId: 'auto:h:0,0', position: 0.5 })
    model = applyCommand(model, { kind: 'addDoor', wallSegmentId: 'auto:h:1,0', position: 0.5 })
    expect(model.doors).toHaveLength(2)

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
    expect(next.doors.map((d) => d.wallSegmentId)).toEqual(['auto:h:0,0'])
    expect(next.regions.map((r) => r.id)).toContain('r2')
  })
})
