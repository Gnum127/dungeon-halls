import { describe, expect, it } from 'vitest'
import { polygonRoom, rectRoom } from './rooms'
import type { RoomGeometry } from './rooms'
import { EMPTY_TILE, TILE_TYPES } from './types'
import type { TileValue } from './types'
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