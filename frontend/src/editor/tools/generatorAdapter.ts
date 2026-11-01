import { TILE_TYPES } from '../model/types'
import { createTerrainRegion } from '../model/regions'
import { DEFAULT_CELL_SIZE } from '@/config/map.config'
import type { MapSnapshot } from '../model/commands'
import type { TerrainRegion } from '../model/regions'
import type { TileTypeName } from '../model/types'

export interface GeneratorResult {
  readonly width: number
  readonly height: number
  readonly tiles: ArrayLike<number>
}

/**
 * Адаптер результата генератора (клеточная сетка) в векторный снапшот:
 * горизонтальные отрезки одинаковых непустых тайлов сворачиваются в
 * прямоугольные регионы.
 */
export function generatorResultToSnapshot(result: GeneratorResult): MapSnapshot {
  const regions: TerrainRegion[] = []
  let zOrder = 0
  for (let y = 0; y < result.height; y += 1) {
    let x = 0
    while (x < result.width) {
      const typeName = tileNameAt(result, x, y)
      if (typeName === 'empty') {
        x += 1
        continue
      }
      let endX = x
      while (endX + 1 < result.width && tileNameAt(result, endX + 1, y) === typeName) {
        endX += 1
      }
      regions.push(
        createTerrainRegion(
          typeName,
          [
            { x, y },
            { x: endX + 1, y },
            { x: endX + 1, y: y + 1 },
            { x, y: y + 1 },
          ],
          zOrder,
        ),
      )
      zOrder += 1
      x = endX + 1
    }
  }

  return {
    grid: { width: result.width, height: result.height, cellSize: DEFAULT_CELL_SIZE },
    regions,
    walls: [],
    doors: [],
    stairs: [],
    objects: [],
    lights: [],
  }
}

function tileNameAt(result: GeneratorResult, x: number, y: number): TileTypeName {
  const index = result.tiles[y * result.width + x]
  return TILE_TYPES[index] ?? 'empty'
}
