import { isKnownKind, OBJECT_COLORS } from '../model/objects'
import type { MapModel } from '../model/types'
import { TILE_TYPES } from '../model/types'
import {
  CANVAS_BACKGROUND_COLOR,
  DOOR_FILL_COLOR,
  FALLBACK_OBJECT_COLOR,
  GRID_LINE_COLOR,
  LIGHT_GLOW_COLOR,
  LIGHT_MARKER_COLOR,
  OBJECT_OUTLINE_COLOR,
  TILE_COLORS,
  WALL_LINE_COLOR,
  WALL_LINE_WIDTH,
} from '../render/colors'
import {
  cellCenterAt,
  hexOrientationOf,
  mapPixelBounds,
  traceCellPolygon,
} from '../render/gridGeometry'
import { doorRects, wallSegment } from '../render/renderMap'
import { cellCorners } from '@/shared/hex'

/** Единица координат SVG: толщины стен/дверей остаются пропорциональными. */
export const SVG_UNITS_PER_CELL = 64

/** Фиксированный формат чисел: float-координаты гексов не должны ломать детерминизм. */
const SVG_DECIMALS = 3

export interface BuildSvgOptions {
  /** Печатать источники света (по умолчанию нет — портят чёрно-белую печать). */
  readonly includeLight?: boolean
}

function fmt(n: number): string {
  const formatted = n.toFixed(SVG_DECIMALS).replace(/\.?0+$/, '')
  // (-0.0005; 0) даёт "-", отрицательный ноль — "-0": нормализуем оба в "0".
  if (formatted === '' || formatted === '-' || formatted === '-0') return '0'
  return formatted
}

/** Коллектор вершин полигона клетки через PathSink-адаптер. */
function polygonPoints(cx: number, cy: number, corners: Array<[number, number]>): string {
  const points: string[] = []
  traceCellPolygon(
    {
      moveTo: (x, y) => points.push(`${fmt(x)},${fmt(y)}`),
      lineTo: (x, y) => points.push(`${fmt(x)},${fmt(y)}`),
      closePath: () => {},
    },
    cx,
    cy,
    corners,
  )
  return points.join(' ')
}

/**
 * Векторная печать карты: чистая функция модель → строка SVG без DOM.
 * Слои повторяют фактический порядок renderMap: фон → тайлы → сетка →
 * объекты → стены → двери; свет — только с includeLight.
 * Спрайтовый режим игнорируется: SVG всегда цветной векторный.
 */
export function buildSvg(model: MapModel, options?: BuildSvgOptions): string {
  const s = SVG_UNITS_PER_CELL
  // cellCenterAt нормализует контент в [0..bounds] (origin-сдвиг гексов уже
  // внутри), поэтому viewBox от нуля покрывает крайние клетки целиком.
  const bounds = mapPixelBounds(model.width, model.height, model.gridType, s)
  const width = Math.ceil(bounds.width)
  const height = Math.ceil(bounds.height)

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  )
  parts.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${CANVAS_BACKGROUND_COLOR}"/>`,
  )

  const orientation = hexOrientationOf(model.gridType)

  if (orientation === null) {
    for (let row = 0; row < model.height; row += 1) {
      for (let col = 0; col < model.width; col += 1) {
        const typeName = TILE_TYPES[model.tiles[row * model.width + col]] ?? 'empty'
        parts.push(
          `<rect x="${fmt(col * s)}" y="${fmt(row * s)}" width="${s}" height="${s}" fill="${TILE_COLORS[typeName]}"/>`,
        )
      }
    }
    const lines: string[] = []
    for (let col = 0; col <= model.width; col += 1) {
      lines.push(`M${fmt(col * s)} 0L${fmt(col * s)} ${fmt(height)}`)
    }
    for (let row = 0; row <= model.height; row += 1) {
      lines.push(`M0 ${fmt(row * s)}L${fmt(width)} ${fmt(row * s)}`)
    }
    parts.push(
      `<path d="${lines.join('')}" fill="none" stroke="${GRID_LINE_COLOR}" stroke-width="1"/>`,
    )
  } else {
    const corners = cellCorners(orientation, s)
    for (let row = 0; row < model.height; row += 1) {
      for (let col = 0; col < model.width; col += 1) {
        const typeName = TILE_TYPES[model.tiles[row * model.width + col]] ?? 'empty'
        const center = cellCenterAt(col, row, model.gridType, s)
        parts.push(
          `<polygon points="${polygonPoints(center.x, center.y, corners)}" fill="${TILE_COLORS[typeName]}"/>`,
        )
      }
    }
    const outlines: string[] = []
    const sink = {
      moveTo: (x: number, y: number) => outlines.push(`M${fmt(x)} ${fmt(y)}`),
      lineTo: (x: number, y: number) => outlines.push(`L${fmt(x)} ${fmt(y)}`),
      closePath: () => outlines.push('Z'),
    }
    for (let row = 0; row < model.height; row += 1) {
      for (let col = 0; col < model.width; col += 1) {
        const center = cellCenterAt(col, row, model.gridType, s)
        traceCellPolygon(sink, center.x, center.y, corners)
      }
    }
    parts.push(
      `<path d="${outlines.join('')}" fill="none" stroke="${GRID_LINE_COLOR}" stroke-width="1"/>`,
    )
  }

  // Объекты в порядке массива, как в renderMap.
  for (const object of model.objects) {
    const center = cellCenterAt(object.x, object.y, model.gridType, s)
    const radius = Math.max(3, s * 0.3)
    const fill = isKnownKind(object.kindId) ? OBJECT_COLORS[object.kindId] : FALLBACK_OBJECT_COLOR
    parts.push(
      `<circle cx="${fmt(center.x)}" cy="${fmt(center.y)}" r="${fmt(radius)}" fill="${fill}" stroke="${OBJECT_OUTLINE_COLOR}" stroke-width="1"/>`,
    )
  }

  // Defense-in-depth: рёбра определены только для квадратной сетки.
  if (model.gridType === 'square') {
    if (model.walls.length > 0) {
      const segments: string[] = []
      for (const wall of model.walls) {
        const [x1, y1, x2, y2] = wallSegment(wall, s)
        segments.push(`M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`)
      }
      parts.push(
        `<path d="${segments.join('')}" fill="none" stroke="${WALL_LINE_COLOR}" stroke-width="${WALL_LINE_WIDTH}"/>`,
      )
    }
    if (model.doors.length > 0) {
      for (const door of model.doors) {
        for (const rect of doorRects(door.edge, door.open, s)) {
          parts.push(
            `<rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.w)}" height="${fmt(rect.h)}" fill="${DOOR_FILL_COLOR}"/>`,
          )
        }
      }
    }
  }

  if (options?.includeLight) {
    const markerRadius = Math.max(3, Math.round(s * 0.12))
    for (const light of model.lights) {
      const center = cellCenterAt(light.x, light.y, model.gridType, s)
      parts.push(
        `<circle cx="${fmt(center.x)}" cy="${fmt(center.y)}" r="${fmt(light.radius * s)}" fill="${LIGHT_GLOW_COLOR}"/>`,
      )
      parts.push(
        `<circle cx="${fmt(center.x)}" cy="${fmt(center.y)}" r="${markerRadius}" fill="${LIGHT_MARKER_COLOR}"/>`,
      )
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}
