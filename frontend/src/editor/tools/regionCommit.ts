import { computeWallsWithRegion } from '../model/autoWalls'
import { createTerrainRegion } from '../model/regions'
import type { Command } from '../model/commands'
import type { MapModel, TileTypeName } from '../model/types'
import type { Point } from '@/shared/point'

/**
 * Собирает команду размещения региона: с авто-стенами — одна составная
 * команда addRegionWithWalls (одна запись истории), иначе — просто addRegion.
 * Регион 'empty' (ластик) с авто-стенами вырезает дыру в контуре (boolean
 * difference, см. autoWalls.ts).
 */
export function buildRegionCommand(
  model: MapModel,
  tileType: TileTypeName,
  polygon: readonly Point[],
  autoWalls: boolean,
): Command {
  const region = createTerrainRegion(tileType, polygon, 0)
  if (!autoWalls) {
    return { kind: 'addRegion', region }
  }
  const walls = computeWallsWithRegion(model.regions, region)
  return { kind: 'addRegionWithWalls', region, walls }
}
