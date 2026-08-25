import { renderMap } from '../render/renderMap'
import { mapPixelBounds } from '../render/gridGeometry'
import type { MapModel } from '../model/types'

/** 1 клетка = 64px: печатный масштаб, независимый от экранного зума. */
export const EXPORT_CELL_SIZE = 64

const MAX_EXPORT_SIDE = 16384
const MAX_EXPORT_AREA = 134_217_728

/**
 * Рендерит карту в offscreen canvas и отдаёт PNG через тот же renderMap,
 * что и на экране. Сетка сохраняется для печати.
 */
export function exportMapToPng(model: MapModel, cellSize = EXPORT_CELL_SIZE): Promise<Blob> {
  // Габариты от геометрии сетки: у гексов холст шире/выше w·cellSize,
  // иначе крайние клетки молча обрезаются. canvas.width/height — целые
  // (дробная часть отбрасывается браузером), поэтому округляем вверх.
  const bounds = mapPixelBounds(model.width, model.height, model.gridType, cellSize)
  const width = Math.ceil(bounds.width)
  const height = Math.ceil(bounds.height)
  // Большие canvas браузеры молча не растеризуют — отказываем заранее с причиной.
  if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE || width * height > MAX_EXPORT_AREA) {
    return Promise.reject(new Error(`Export size ${width}x${height} exceeds canvas limits`))
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('2D context is unavailable'))
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // Координаты клеток (cellCenterAt) уже нормализованы к [0..bounds].
  renderMap(ctx, model, {
    width,
    height,
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
