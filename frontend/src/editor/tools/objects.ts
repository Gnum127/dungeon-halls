import { isFootprintFree, topmostObjectAt as topmostObjectIn } from '../model/objects'
import type { MapModel, MapObject } from '../model/types'

/** Верхний объект в точке (float, мировые клетки); мимо — null. */
export function topmostObjectAt(model: MapModel, x: number, y: number): MapObject | null {
  return topmostObjectIn(model.objects, x, y) ?? null
}

/** Footprint (x,y,w,h) свободен от других объектов карты. */
export function isFootprintFreeAt(
  model: MapModel,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  return isFootprintFree(model.objects, x, y, w, h)
}
