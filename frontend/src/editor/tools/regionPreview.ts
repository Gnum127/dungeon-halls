import { computePreviewWalls } from '../model/autoWalls'
import { isDrawablePolygon } from './regions'
import { drawRegionPreview } from '../render/regionPreview'
import type { TerrainRegion } from '../model/regions'
import type { MapModel, TileTypeName } from '../model/types'
import type { Viewport } from '../render/viewport'

/**
 * Превью строящегося региона: полигон + стены, посчитанные от контура
 * объединения с текущими регионами (если включены авто-стены). Гейт по
 * `isDrawablePolygon` рисует превью и для многогранника (N ≥ 3), а не только
 * для прямоугольника. Union базового покрытия кэшируется (см. autoWalls).
 */
export function drawRegionWithWalls(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  viewport: Viewport,
  tileType: TileTypeName,
  polygon: TerrainRegion['polygon'],
  autoWalls: boolean,
): void {
  if (!isDrawablePolygon(polygon)) return
  const region: TerrainRegion = { id: 'preview', tileType, polygon, zOrder: Number.MAX_SAFE_INTEGER }
  const walls = autoWalls ? computePreviewWalls(model.regions, region) : []
  drawRegionPreview(ctx, { polygon, walls, tileType }, viewport)
}
