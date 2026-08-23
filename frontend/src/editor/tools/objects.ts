import type { MapModel, MapObject } from '../model/types'

/** Верхний объект в клетке (последний в массиве — рисуется последним). */
export function topmostObjectAt(model: MapModel, x: number, y: number): MapObject | null {
  for (let i = model.objects.length - 1; i >= 0; i -= 1) {
    const object = model.objects[i]
    if (object && object.x === x && object.y === y) return object
  }
  return null
}

export function isCellFree(model: MapModel, x: number, y: number): boolean {
  return topmostObjectAt(model, x, y) === null
}
