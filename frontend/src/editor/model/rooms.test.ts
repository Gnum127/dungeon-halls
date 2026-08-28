import { describe, expect, it } from 'vitest'
import { polygonRoom, rectRoom, regularPolygonVertices } from './rooms'
import type { RoomGeometry } from './rooms'
import { EMPTY_TILE, TILE_TYPES } from './types'
import type { TileValue } from './types'
import type { Cell } from '../tools/brush'
import { edgeKey } from './walls'

const FLOOR = TILE_TYPES.indexOf('floor')
const STONE = TILE_TYPES.indexOf('stone')

function tileMatrix(geometry: RoomGeometry, width: number, height: number): string[] {
  const rows: string[] = []
  for (let y = 0; y < height; y += 1) {
    let row = ''
    for (let x = 0; x < width; x += 1) {
      const filled = geometry.tiles.some((t) => t.x === x && t.y === y)
      row += filled ? '#' : '.'
    }
    rows.push(row)
  }
  return rows
}

function tileValues(geometry: RoomGeometry): Set<TileValue> {
  return new Set(geometry.tiles.map(({ tile }) => tile))
}

function wallKeys(geometry: RoomGeometry): Set<string> {
  return new Set(geometry.walls.map(({ edge }) => edgeKey(edge)))
}

describe('rectRoom', () => {
  it('fills a floor rectangle and rings it with perimeter walls', () => {
    const g = rectRoom(1, 1, 3, 2, 5, 4, FLOOR)

    expect(tileMatrix(g, 5, 4)).toEqual(['.....', '.###.', '.###.', '.....'])
    expect(tileValues(g)).toEqual(new Set([FLOOR]))
    expect(wallKeys(g)).toEqual(
      new Set([
        '1,1,N', '2,1,N', '3,1,N',
        '1,2,S', '2,2,S', '3,2,S',
        '1,1,W', '1,2,W',
        '3,1,E', '3,2,E',
      ]),
    )
  })

  it('fills the room with the selected tile', () => {
    const g = rectRoom(1, 1, 3, 2, 5, 4, STONE)

    expect(tileMatrix(g, 5, 4)).toEqual(['.....', '.###.', '.###.', '.....'])
    expect(tileValues(g)).toEqual(new Set([STONE]))
    // Периметровые стены строятся для любого конкретного покрытия.
    expect(g.walls.length).toBeGreaterThan(0)
  })

  it('an eraser room clears the area without building walls', () => {
    const g = rectRoom(1, 1, 3, 2, 5, 4, EMPTY_TILE)

    expect(tileMatrix(g, 5, 4)).toEqual(['.....', '.###.', '.###.', '.....'])
    expect(tileValues(g)).toEqual(new Set([EMPTY_TILE]))
    expect(g.walls).toEqual([])
  })

  it('normalizes dragged corners regardless of direction', () => {
    const forward = rectRoom(2, 3, 0, 1, 5, 5, FLOOR)
    const backward = rectRoom(0, 1, 2, 3, 5, 5, FLOOR)

    expect(forward.tiles).toEqual(backward.tiles)
    expect(forward.walls).toEqual(backward.walls)
  })

  it('clips floor and drops walls at the map border', () => {
    const g = rectRoom(0, 0, 2, 1, 5, 4, FLOOR)

    expect(tileMatrix(g, 5, 4)).toEqual(['###..', '###..', '.....', '.....'])
    const keys = wallKeys(g)
    expect(keys.has('0,0,N')).toBe(false)
    expect(keys.has('0,0,W')).toBe(false)
    expect(keys.has('2,0,E')).toBe(true)
    expect(keys.has('0,1,S')).toBe(true)
    expect(keys.has('1,1,S')).toBe(true)
    expect(keys.has('2,1,S')).toBe(true)
  })

  it('returns empty geometry when clipping removes every cell', () => {
    const g = rectRoom(-3, -2, -1, -1, 5, 5, FLOOR)

    expect(g.tiles).toEqual([])
    expect(g.walls).toEqual([])
  })

  it('rings a single-cell room in four walls', () => {
    const g = rectRoom(2, 2, 2, 2, 5, 5, FLOOR)

    expect(tileMatrix(g, 5, 5)).toEqual([
      '.....', '.....', '..#..', '.....', '.....',
    ])
    expect(wallKeys(g)).toEqual(new Set(['2,2,N', '2,2,S', '2,2,W', '2,2,E']))
  })

  it('a single-row room has two horizontal walls', () => {
    const g = rectRoom(1, 2, 3, 2, 5, 5, FLOOR)

    expect(wallKeys(g)).toEqual(new Set([
      '1,2,N', '2,2,N', '3,2,N',
      '1,2,S', '2,2,S', '3,2,S',
      '1,2,W', '3,2,E',
    ]))
  })

  it('produces deterministic (sorted) wall order', () => {
    const forward = rectRoom(1, 1, 3, 2, 5, 4, FLOOR)
    const reversed = rectRoom(3, 2, 1, 1, 5, 4, FLOOR)

    expect(forward.walls.map(({ edge }) => edgeKey(edge))).toEqual(
      reversed.walls.map(({ edge }) => edgeKey(edge)),
    )
  })
})

describe('polygonRoom', () => {
  it('fills a rectangle through vertex points (equivalent to rectRoom)', () => {
    const g = polygonRoom(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
      ],
      5,
      4,
      FLOOR,
    )

    expect(tileMatrix(g, 5, 4)).toEqual(['.....', '.###.', '.###.', '.....'])
    expect(wallKeys(g)).toEqual(
      new Set([
        '1,1,N', '2,1,N', '3,1,N',
        '1,2,S', '2,2,S', '3,2,S',
        '1,1,W', '1,2,W',
        '3,1,E', '3,2,E',
      ]),
    )
  })

  it('fills the room with the selected tile', () => {
    const g = polygonRoom(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
      ],
      5,
      4,
      STONE,
    )

    expect(tileValues(g)).toEqual(new Set([STONE]))
    expect(g.walls.length).toBeGreaterThan(0)
  })

  it('an eraser polygon clears interior cells without walls', () => {
    const g = polygonRoom(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
      ],
      5,
      4,
      EMPTY_TILE,
    )

    expect(tileMatrix(g, 5, 4)).toEqual(['.....', '.###.', '.###.', '.....'])
    expect(tileValues(g)).toEqual(new Set([EMPTY_TILE]))
    expect(g.walls).toEqual([])
  })

  it('fills a concave L-shape and walls its outer boundary', () => {
    // Г-образная комната с кликнутыми вершинами-клетками:
    // (1,1), (3,1), (3,2), (2,2), (2,3), (1,3).
    const g = polygonRoom(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      5,
      5,
      FLOOR,
    )

    expect(tileMatrix(g, 5, 5)).toEqual([
      '.....',
      '.###.',
      '.###.',
      '.##..',
      '.....',
    ])
    expect(wallKeys(g)).toEqual(
      new Set([
        // Внешний периметр (включая стенки выемки у угла (3,2)/(2,3)).
        '1,1,N', '2,1,N', '3,1,N',
        '1,1,W', '3,1,E',
        '1,2,W', '3,2,E', '3,2,S',
        '1,3,W', '2,3,E', '2,3,S', '1,3,S',
      ]),
    )
  })

  it('treats an empty polygon as no-op geometry', () => {
    expect(polygonRoom([], 5, 5, FLOOR)).toEqual({ tiles: [], walls: [] })
    expect(polygonRoom([{ x: 1, y: 1 }], 5, 5, FLOOR)).toEqual({ tiles: [], walls: [] })
    expect(
      polygonRoom(
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        5,
        5,
        FLOOR,
      ),
    ).toEqual({ tiles: [], walls: [] })
  })

  it('ignores duplicate consecutive vertices', () => {
    const clean = polygonRoom(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
      ],
      5,
      4,
      FLOOR,
    )
    const withDuplicates = polygonRoom(
      [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
      ],
      5,
      4,
      FLOOR,
    )

    expect(withDuplicates.tiles).toEqual(clean.tiles)
    expect(withDuplicates.walls).toEqual(clean.walls)
  })

  it('clamps out-of-bounds vertices into the map', () => {
    const g = polygonRoom(
      [
        { x: -1, y: -1 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      4,
      3,
      FLOOR,
    )

    expect(tileMatrix(g, 4, 3)).toEqual(['###.', '###.', '###.'])
  })

  it('rings the outer boundary without interior walls', () => {
    // Сплошной блок 2×2 в центре карты: общие рёбра внутренних клеток
    // стеной не становятся, периметр — все восемь рёбер.
    const g = polygonRoom(
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      4,
      4,
      FLOOR,
    )

    expect(wallKeys(g)).toEqual(
      new Set([
        '1,1,N', '2,1,N',
        '1,1,W', '2,1,E',
        '1,2,S', '2,2,S',
        '1,2,W', '2,2,E',
      ]),
    )
  })

  it('produces deterministic sorted walls for same polygon regardless of rotation start', () => {
    const a = polygonRoom(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
      ],
      5,
      4,
      FLOOR,
    )
    const b = polygonRoom(
      [
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ],
      5,
      4,
      FLOOR,
    )

    expect(a.walls.map(({ edge }) => edgeKey(edge))).toEqual(
      b.walls.map(({ edge }) => edgeKey(edge)),
    )
  })
})

describe('regularPolygonVertices', () => {
  it('starts the first vertex towards the radial point (sets the rotation)', () => {
    // Соседние клетки вокруг радиуса могут попасть на границу округления
    // (±float-шум), поэтому проверяем инвариант поворота, а не все 4 клетки.
    const east = regularPolygonVertices({ x: 4, y: 4 }, { x: 7, y: 4 }, 4, 8, 8)
    expect(east).toHaveLength(4)
    expect(east[0]).toEqual({ x: 7, y: 4 })
    expect(Math.max(...east.map((v) => v.x))).toBe(7)
    expect(Math.min(...east.map((v) => v.x))).toBe(1)
    expect(Math.max(...east.map((v) => v.y))).toBe(7)
    expect(Math.min(...east.map((v) => v.y))).toBe(1)

    const south = regularPolygonVertices({ x: 4, y: 4 }, { x: 4, y: 7 }, 4, 8, 8)
    expect(south[0]).toEqual({ x: 4, y: 7 })
  })

  it('works across the 3..12 vertex range', () => {
    for (let count = 3; count <= 12; count += 1) {
      const vertices = regularPolygonVertices({ x: 4, y: 4 }, { x: 9, y: 5 }, count, 16, 10)
      expect(vertices).toHaveLength(count)
      expect(new Set(vertices.map((v) => `${v.x},${v.y}`)).size).toBe(count)
    }
  })

  it('rounds continuous vertices onto the nearest cell centers', () => {
    // Радиус 1 клетка: вершины точно на соседних центрах.
    const square = regularPolygonVertices({ x: 4, y: 4 }, { x: 5, y: 4 }, 4, 8, 8)
    expect(square).toEqual([
      { x: 5, y: 4 },
      { x: 4, y: 5 },
      { x: 3, y: 4 },
      { x: 4, y: 3 },
    ])
  })

  it('returns an empty array for a count below 3', () => {
    expect(regularPolygonVertices({ x: 4, y: 4 }, { x: 6, y: 4 }, 2, 8, 8)).toEqual([])
  })

  it('returns an empty array when the radius collapses to the center cell', () => {
    expect(regularPolygonVertices({ x: 4, y: 4 }, { x: 4, y: 4 }, 6, 8, 8)).toEqual([])
  })

  it('dedups vertices globally when rounding/clamping merge them', () => {
    // Радиус 1 клетка у края: из 12 запрошенных вершин многие ложатся в одни
    // и те же клетки (не-соседние повторы), остаётся 4 уникальных — глобальная
    // дедупликация до возврата реально срабатывает.
    const center: Cell = { x: 0, y: 3 }
    const radial: Cell = { x: 1, y: 3 }
    const vertices = regularPolygonVertices(center, radial, 12, 8, 8)
    const keys = vertices.map((v) => `${v.x},${v.y}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(vertices.length).toBe(4)
    expect(vertices.length).toBeLessThan(12)
    expect(vertices).toEqual([
      { x: 1, y: 3 },
      { x: 0, y: 3 },
      { x: 0, y: 4 },
      { x: 0, y: 2 },
    ])
  })

  it('returns an empty array for a zero radius (same cell as the center)', () => {
    // Второй клик в ту же клетку, что и центр: радиус 0 — инструмент не коммитит.
    expect(regularPolygonVertices({ x: 4, y: 4 }, { x: 4, y: 4 }, 6, 8, 8)).toEqual([])
  })

  it('treats an over-large vertex count as MAX_POLYGON_VERTICES', () => {
    const clamped = regularPolygonVertices({ x: 0, y: 3 }, { x: 1, y: 3 }, 20, 8, 8)
    const max = regularPolygonVertices({ x: 0, y: 3 }, { x: 1, y: 3 }, 12, 8, 8)
    expect(clamped).toEqual(max)
  })

  it('clamps vertices into the map bounds', () => {
    const vertices = regularPolygonVertices({ x: 1, y: 2 }, { x: 1, y: 5 }, 6, 8, 8)
    expect(vertices.length).toBeGreaterThanOrEqual(3)
    for (const v of vertices) {
      expect(v.x).toBeGreaterThanOrEqual(0)
      expect(v.x).toBeLessThan(8)
      expect(v.y).toBeGreaterThanOrEqual(0)
      expect(v.y).toBeLessThan(8)
    }
  })

  it('yields unequal sides after clamping near the map edge (angles stay fixed)', () => {
    // Центр у левого края: левая вершина клампится в x=0, а соседние снизу/сверху
    // зависят от округления — углы не трогаем, стороны становятся неравными.
    const square: Cell[] = regularPolygonVertices({ x: 1, y: 3 }, { x: 1, y: 5 }, 4, 8, 8)
    expect(square).toEqual([
      { x: 1, y: 5 },
      { x: 0, y: 3 },
      { x: 0, y: 1 },
      { x: 3, y: 2 },
    ])
    const edges = edgesLengths(square)
    expect(new Set(edges).size).toBeGreaterThan(1)
  })

  it('is deterministic for identical inputs', () => {
    const a = regularPolygonVertices({ x: 4, y: 4 }, { x: 9, y: 5 }, 7, 16, 10)
    const b = regularPolygonVertices({ x: 4, y: 4 }, { x: 9, y: 5 }, 7, 16, 10)
    expect(a).toEqual(b)
  })
})

function edgesLengths(vertices: readonly Cell[]): number[] {
  const lengths: number[] = []
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]
    const b = vertices[(i + 1) % vertices.length]
    lengths.push(Math.hypot(b.x - a.x, b.y - a.y))
  }
  return lengths
}