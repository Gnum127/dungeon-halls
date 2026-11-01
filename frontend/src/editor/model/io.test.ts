import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { createEmptyMap } from './createEmptyMap'
import { deserializeMap, MapLoadError, serializeMap } from './io'
import { createTerrainRegion } from './regions'
import { createWallSegment } from './wallSegments'
import type { MapModel } from './types'

const SQUARE = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
]

function richModel(): MapModel {
  let model = createEmptyMap(20, 20, 64)
  model = applyCommand(model, {
    kind: 'addRegion',
    region: createTerrainRegion('floor', SQUARE, 0, 'r1'),
  })
  model = applyCommand(model, {
    kind: 'addRegion',
    region: createTerrainRegion(
      'grass',
      [
        { x: 6, y: 6 },
        { x: 10, y: 6 },
        { x: 10, y: 10 },
        { x: 6, y: 10 },
      ],
      1,
      'r2',
    ),
  })
  model = applyCommand(model, {
    kind: 'setWalls',
    updates: [
      {
        segment: createWallSegment(
          [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
          ],
          { id: 'w1' },
        ),
        present: true,
      },
    ],
  })
  model = applyCommand(model, {
    kind: 'addDoor',
    a: { x: 0, y: 0 },
    b: { x: 1, y: 0 },
    openAngle: -30,
    imageId: 'door-wooden',
  })
  model = applyCommand(model, {
    kind: 'addStairs',
    polygon: [
      { x: 8, y: 1 },
      { x: 10, y: 1 },
      { x: 10, y: 3 },
      { x: 8, y: 3 },
    ],
  })
  model = applyCommand(model, {
    kind: 'addObject',
    x: 2,
    y: 2,
    kindId: 'table',
    scale: { w: 2, h: 1 },
  })
  model = applyCommand(model, { kind: 'addLight', x: 3, y: 3, radius: 6, color: '#ffdd88' })
  return model
}

function rawOf(model: MapModel): Record<string, unknown> {
  return JSON.parse(serializeMap(model)) as Record<string, unknown>
}

describe('serializeMap / deserializeMap (v6)', () => {
  it('roundtrips a rich model', () => {
    const model = richModel()
    const restored = deserializeMap(serializeMap(model))
    expect(restored).toEqual(model)
  })

  it('roundtrips an empty map', () => {
    const model = createEmptyMap(10, 12, 32)
    expect(deserializeMap(serializeMap(model))).toEqual(model)
  })

  it('writes version 6 and grid as an object', () => {
    const raw = rawOf(createEmptyMap(5, 5, 40))
    expect(raw.version).toBe(6)
    expect(raw.grid).toEqual({ width: 5, height: 5, cellSize: 40 })
  })

  it('rejects invalid JSON', () => {
    expect(() => deserializeMap('{not json')).toThrow(MapLoadError)
  })

  it('rejects a non-object payload', () => {
    expect(() => deserializeMap('[]')).toThrow(MapLoadError)
  })

  it('rejects an unsupported version (v5 is no longer read)', () => {
    const raw = rawOf(createEmptyMap(5, 5))
    raw.version = 5
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/Unsupported map version/)
  })

  it('rejects an invalid grid', () => {
    const raw = rawOf(createEmptyMap(5, 5))
    raw.grid = { width: 0, height: 5, cellSize: 64 }
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/grid/)
  })

  it('rejects an unknown region tileType', () => {
    const raw = rawOf(richModel())
    ;(raw.regions as Record<string, unknown>[])[0].tileType = 'lava'
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/tileType/)
  })

  it('rejects a self-intersecting region polygon', () => {
    const raw = rawOf(richModel())
    ;(raw.regions as Record<string, unknown>[])[0].polygon = [
      [0, 0],
      [4, 4],
      [4, 0],
      [0, 4],
    ]
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/polygon/)
  })

  it('rejects a duplicate region id', () => {
    const raw = rawOf(richModel())
    const regions = raw.regions as Record<string, unknown>[]
    regions[1].id = regions[0].id
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/Duplicate region id/)
  })

  it('rejects a door whose endpoints coincide', () => {
    const raw = rawOf(richModel())
    ;(raw.doors as Record<string, unknown>[])[0].b = [0, 0]
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/coincide/)
  })

  it('rejects an object placed out of bounds', () => {
    const raw = rawOf(richModel())
    ;(raw.objects as Record<string, unknown>[])[0].x = 25
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/Object x/)
  })

  it('rejects an unknown object kind', () => {
    const raw = rawOf(richModel())
    ;(raw.objects as Record<string, unknown>[])[0].kindId = 'dragon'
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/Unknown object kind/)
  })

  it('produces a byte-stable serialization across a roundtrip', () => {
    const once = serializeMap(richModel())
    expect(serializeMap(deserializeMap(once))).toBe(once)
  })
})

describe('deserializeMap rejects malformed sections', () => {
  const withRaw = (mutate: (raw: Record<string, unknown>) => void): Record<string, unknown> => {
    const raw = rawOf(richModel())
    mutate(raw)
    return raw
  }

  it('rejects a non-object grid and a bad cell size', () => {
    expect(() => deserializeMap(JSON.stringify(withRaw((raw) => (raw.grid = []))))).toThrow(/grid/)
    expect(() =>
      deserializeMap(
        JSON.stringify(withRaw((raw) => ((raw.grid as Record<string, unknown>).cellSize = 0))),
      ),
    ).toThrow(/cellSize/)
  })

  it('rejects non-array collections', () => {
    expect(() => deserializeMap(JSON.stringify(withRaw((raw) => (raw.regions = {}))))).toThrow(
      /regions must be an array/,
    )
    expect(() => deserializeMap(JSON.stringify(withRaw((raw) => (raw.walls = {}))))).toThrow(
      /walls must be an array/,
    )
    expect(() => deserializeMap(JSON.stringify(withRaw((raw) => (raw.doors = {}))))).toThrow(
      /doors must be an array/,
    )
    expect(() => deserializeMap(JSON.stringify(withRaw((raw) => (raw.stairs = {}))))).toThrow(
      /stairs must be an array/,
    )
    expect(() => deserializeMap(JSON.stringify(withRaw((raw) => (raw.objects = {}))))).toThrow(
      /objects must be an array/,
    )
    expect(() => deserializeMap(JSON.stringify(withRaw((raw) => (raw.lights = {}))))).toThrow(
      /lights must be an array/,
    )
  })

  it('rejects a region with an empty id, bad zOrder or a bad point', () => {
    expect(() =>
      deserializeMap(
        JSON.stringify(withRaw((raw) => ((raw.regions as Record<string, unknown>[])[0].id = ''))),
      ),
    ).toThrow(/Region id/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.regions as Record<string, unknown>[])[0].zOrder = -1)),
        ),
      ),
    ).toThrow(/zOrder/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.regions as Record<string, unknown>[])[0].polygon = [[0, 0], [1]])),
        ),
      ),
    ).toThrow(/pairs/)
  })

  it('rejects a wall with a duplicate id, bad extends, negative thickness or too few points', () => {
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => {
            const walls = raw.walls as Record<string, unknown>[]
            walls.push({ ...walls[0] })
          }),
        ),
      ),
    ).toThrow(/Duplicate wall id/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.walls as Record<string, unknown>[])[0].extends = 'center')),
        ),
      ),
    ).toThrow(/extends/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.walls as Record<string, unknown>[])[0].thickness = -1)),
        ),
      ),
    ).toThrow(/thickness/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.walls as Record<string, unknown>[])[0].points = [[0, 0]])),
        ),
      ),
    ).toThrow(/at least 2/)
  })

  it('rejects a door with a bad openAngle, coinciding endpoints or bad imageId', () => {
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.doors as Record<string, unknown>[])[0].openAngle = 999)),
        ),
      ),
    ).toThrow(/openAngle/)
    expect(() =>
      deserializeMap(
        JSON.stringify(withRaw((raw) => ((raw.doors as Record<string, unknown>[])[0].b = [0, 0]))),
      ),
    ).toThrow(/coincide/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.doors as Record<string, unknown>[])[0].imageId = '')),
        ),
      ),
    ).toThrow(/imageId/)
  })

  it('rejects a stairs entry with a degenerate polygon or duplicate id', () => {
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw(
            (raw) =>
              ((raw.stairs as Record<string, unknown>[])[0].polygon = [
                [0, 0],
                [1, 1],
              ]),
          ),
        ),
      ),
    ).toThrow(/Stairs polygon/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => {
            const stairs = raw.stairs as Record<string, unknown>[]
            stairs.push({ ...stairs[0] })
          }),
        ),
      ),
    ).toThrow(/Duplicate stairs id/)
  })

  it('rejects an object with bad rotation, scale or duplicate id', () => {
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.objects as Record<string, unknown>[])[0].rotation = 45)),
        ),
      ),
    ).toThrow(/rotation/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.objects as Record<string, unknown>[])[0].scale = { w: 0, h: 1 })),
        ),
      ),
    ).toThrow(/scale/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => {
            const objects = raw.objects as Record<string, unknown>[]
            objects.push({ ...objects[0] })
          }),
        ),
      ),
    ).toThrow(/Duplicate object id/)
  })

  it('rejects an object whose footprint exceeds the grid', () => {
    expect(() =>
      deserializeMap(
        JSON.stringify(withRaw((raw) => ((raw.objects as Record<string, unknown>[])[0].x = 19))),
      ),
    ).toThrow(/exceeds map bounds/)
  })

  it('rejects two distinct objects sharing a footprint cell', () => {
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => {
            const objects = raw.objects as Record<string, unknown>[]
            objects.push({ id: 2, kindId: 'chair', x: 3, y: 2 })
          }),
        ),
      ),
    ).toThrow(/Duplicate cell/)
  })

  it('rejects a light with a bad radius, color or duplicate id', () => {
    expect(() =>
      deserializeMap(
        JSON.stringify(withRaw((raw) => ((raw.lights as Record<string, unknown>[])[0].radius = 0))),
      ),
    ).toThrow(/radius/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => ((raw.lights as Record<string, unknown>[])[0].color = 'red')),
        ),
      ),
    ).toThrow(/color/)
    expect(() =>
      deserializeMap(
        JSON.stringify(
          withRaw((raw) => {
            const lights = raw.lights as Record<string, unknown>[]
            lights.push({ ...lights[0] })
          }),
        ),
      ),
    ).toThrow(/Duplicate light id/)
  })
})
