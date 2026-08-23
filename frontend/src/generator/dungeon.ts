import { MAX_MAP_DIMENSION, TILE_TYPES } from '@/shared/tiles'
import type { TileGrid } from '@/shared/tiles'
import type { Rng } from './rng'
import type { DungeonParams, GenerationResult } from './types'

interface Room {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Минимальная сторона комнаты; карта должна вмещать её плюс рамку стен. */
const ROOM_MIN_SIZE = 3
const ROOM_MAX_SIZE = 8
const MIN_DIMENSION = ROOM_MIN_SIZE + 2
const MAX_ROOM_ATTEMPTS = 10000
/** Комнаты держат клетку стен между собой — коридоры прорезают их отдельно. */
const ROOM_GAP = 1

function tileIndex(name: string): number {
  const index = TILE_TYPES.indexOf(name as (typeof TILE_TYPES)[number])
  if (index < 0) throw new Error(`Unknown tile: ${name}`)
  return index
}

const FLOOR = tileIndex('floor')
const WALL = tileIndex('wall')

function assertDimension(value: number, name: string): void {
  if (!Number.isInteger(value) || value < MIN_DIMENSION || value > MAX_MAP_DIMENSION) {
    throw new RangeError(
      `${name} must be an integer in [${MIN_DIMENSION}, ${MAX_MAP_DIMENSION}], got ${value}`,
    )
  }
}

/**
 * Раскладывает непересекающиеся комнаты с зазором в одну клетку стен
 * (коридоры прорезают зазоры отдельно). Экспортируется для прямых тестов
 * геометрии; потребители используют generateDungeon.
 */
export function layoutRooms(params: DungeonParams, rng: Rng): readonly Room[] {
  if (
    !Number.isInteger(params.roomAttempts) ||
    params.roomAttempts < 1 ||
    params.roomAttempts > MAX_ROOM_ATTEMPTS
  ) {
    throw new RangeError(
      `roomAttempts must be an integer in [1, ${MAX_ROOM_ATTEMPTS}], got ${params.roomAttempts}`,
    )
  }

  const rooms: Room[] = []
  const maxWidth = Math.min(ROOM_MAX_SIZE, params.width - 2)
  const maxHeight = Math.min(ROOM_MAX_SIZE, params.height - 2)

  for (let attempt = 0; attempt < params.roomAttempts; attempt += 1) {
    const w = ROOM_MIN_SIZE + rng.nextInt(maxWidth - ROOM_MIN_SIZE + 1)
    const h = ROOM_MIN_SIZE + rng.nextInt(maxHeight - ROOM_MIN_SIZE + 1)
    const x = ROOM_GAP + rng.nextInt(params.width - w - ROOM_GAP * 2)
    const y = ROOM_GAP + rng.nextInt(params.height - h - ROOM_GAP * 2)

    const candidate: Room = { x, y, w, h }
    const overlaps = rooms.some((room) => intersects(candidate, room, ROOM_GAP))
    if (!overlaps) rooms.push(candidate)
  }

  return rooms
}

function intersects(a: Room, b: Room, gap: number): boolean {
  return (
    a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h
  )
}

function carveRect(tiles: Uint8Array, width: number, room: Room, value: number): void {
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      tiles[y * width + x] = value
    }
  }
}

function carveHorizontal(
  tiles: Uint8Array,
  width: number,
  x1: number,
  x2: number,
  y: number,
): void {
  const [from, to] = x1 <= x2 ? [x1, x2] : [x2, x1]
  for (let x = from; x <= to; x += 1) tiles[y * width + x] = FLOOR
}

function carveVertical(tiles: Uint8Array, width: number, y1: number, y2: number, x: number): void {
  const [from, to] = y1 <= y2 ? [y1, y2] : [y2, y1]
  for (let y = from; y <= to; y += 1) tiles[y * width + x] = FLOOR
}

function centerOf(room: Room): { x: number; y: number } {
  return {
    x: room.x + (room.w >> 1),
    y: room.y + (room.h >> 1),
  }
}

/**
 * Классический данж: стены везде, вырезаются комнаты и L-образные коридоры,
 * соединяющие центры комнат последовательно — связность гарантирована цепочкой.
 */
export function generateDungeon(params: DungeonParams, rng: Rng): GenerationResult {
  assertDimension(params.width, 'width')
  assertDimension(params.height, 'height')

  const tiles: TileGrid = new Uint8Array(params.width * params.height).fill(WALL) as TileGrid
  const rooms = layoutRooms(params, rng)

  rooms.forEach((room, index) => {
    carveRect(tiles, params.width, room, FLOOR)
    if (index === 0) return
    const from = centerOf(rooms[index - 1]!)
    const to = centerOf(room)
    if (rng.next() < 0.5) {
      carveHorizontal(tiles, params.width, from.x, to.x, from.y)
      carveVertical(tiles, params.width, from.y, to.y, to.x)
    } else {
      carveVertical(tiles, params.width, from.y, to.y, from.x)
      carveHorizontal(tiles, params.width, from.x, to.x, to.y)
    }
  })

  return { width: params.width, height: params.height, tiles }
}
