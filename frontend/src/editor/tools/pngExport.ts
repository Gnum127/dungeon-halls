import { renderMap } from '../render/renderMap'
import { BASE_CELL_SIZE } from '../render/viewport'
import type { MapModel } from '../model/types'

export const EXPORT_CELL_SIZE = BASE_CELL_SIZE * 2

/**
 * Рендерит карту в offscreen canvas и отдаёт PNG.
 * 1 клетка = EXPORT_CELL_SIZE px, сетка сохраняется для печати.
 */
export function exportMapToPng(model: MapModel, cellSize = EXPORT_CELL_SIZE): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = model.width * cellSize
  canvas.height = model.height * cellSize

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('2D context is unavailable'))
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  renderMap(ctx, model, {
    width: canvas.width,
    height: canvas.height,
    cellSize,
    offsetX: 0,
    offsetY: 0,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG encoding failed'))
    }, 'image/png')
  })
}
