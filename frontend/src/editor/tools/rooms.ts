import type { Command } from '../model/commands'
import type { RoomGeometry } from '../model/rooms'

/**
 * Обёртка геометрии комнаты в одну атомарную команду; null, если комната
 * пуста (вся заливка и стены уже были на месте или вышли за границы карты).
 */
export function commitRoom(geometry: RoomGeometry): Command | null {
  if (geometry.tiles.length === 0 && geometry.walls.length === 0) return null
  return { kind: 'addRoom', tiles: geometry.tiles, walls: geometry.walls }
}