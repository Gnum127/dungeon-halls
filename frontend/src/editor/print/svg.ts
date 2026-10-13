import { isKnownKind, OBJECT_COLORS } from '../model/objects'
import { pointAlongWallSegment } from '../model/wallSegments'
import type { MapModel } from '../model/types'
import {
  CANVAS_BACKGROUND_COLOR,
  DOOR_FILL_COLOR,
  DOOR_LENGTH_FRACTION,
  DOOR_THICKNESS_FRACTION,
  FALLBACK_OBJECT_COLOR,
  GRID_LINE_COLOR,
  LIGHT_GLOW_COLOR,
  LIGHT_MARKER_COLOR,
  OBJECT_OUTLINE_COLOR,
  STAIRS_STEP_COLOR,
  TILE_COLORS,
  WALL_BODY_COLOR,
  WALL_LINE_COLOR,
} from '../render/colors'
import { cellCenterAt } from '../render/geometry'

/** Единица координат SVG: толщины стен/дверей остаются пропорциональными. */
export const SVG_UNITS_PER_CELL = 64

/** Фиксированный формат чисел: float-координаты не должны ломать детерминизм. */
const SVG_DECIMALS = 3

export interface BuildSvgOptions {
  /** Печатать источники света (по умолчанию нет — портят чёрно-белую печать). */
  readonly includeLight?: boolean
}

function fmt(n: number): string {
  const formatted = n.toFixed(SVG_DECIMALS).replace(/\.?0+$/, '')
  if (formatted === '' || formatted === '-' || formatted === '-0') return '0'
  return formatted
}

/**
 * Векторная печать карты: чистая функция модель → строка SVG без DOM.
 * Слои повторяют порядок renderMap: фон → регионы (по zOrder) → сетка →
 * объекты → стены → двери; свет — только с includeLight.
 * Спрайтовый режим игнорируется: SVG всегда цветной векторный.
 */
export function buildSvg(model: MapModel, options?: BuildSvgOptions): string {
  const s = SVG_UNITS_PER_CELL
  const width = Math.ceil(model.grid.width * s)
  const height = Math.ceil(model.grid.height * s)

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  )
  parts.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${CANVAS_BACKGROUND_COLOR}"/>`,
  )

  const sortedRegions = [...model.regions].sort((a, b) => a.zOrder - b.zOrder)
  let stairsIndex = 0
  for (const region of sortedRegions) {
    const points = region.polygon.map((p) => `${fmt(p.x * s)},${fmt(p.y * s)}`).join(' ')
    parts.push(`<polygon points="${points}" fill="${TILE_COLORS[region.tileType]}"/>`)

    if (region.tileType === 'stairs') {
      const clipId = `stairs-${stairsIndex}`
      stairsIndex += 1
      const xs = region.polygon.map((p) => p.x * s)
      const ys = region.polygon.map((p) => p.y * s)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const steps: string[] = []
      for (let y = minY; y <= maxY; y += s * 0.25) {
        steps.push(`M${fmt(minX)} ${fmt(y)}L${fmt(maxX)} ${fmt(y)}`)
      }
      parts.push(`<clipPath id="${clipId}"><polygon points="${points}"/></clipPath>`)
      parts.push(
        `<path d="${steps.join('')}" clip-path="url(#${clipId})" fill="none" stroke="${STAIRS_STEP_COLOR}" stroke-width="${fmt(Math.max(1, s * 0.05))}"/>`,
      )
    }
  }

  const lines: string[] = []
  for (let col = 0; col <= model.grid.width; col += 1) {
    lines.push(`M${fmt(col * s)} 0L${fmt(col * s)} ${fmt(height)}`)
  }
  for (let row = 0; row <= model.grid.height; row += 1) {
    lines.push(`M0 ${fmt(row * s)}L${fmt(width)} ${fmt(row * s)}`)
  }
  parts.push(`<path d="${lines.join('')}" fill="none" stroke="${GRID_LINE_COLOR}" stroke-width="1"/>`)

  for (const object of model.objects) {
    const center = cellCenterAt(object.x, object.y, s)
    const scaleX = object.scale?.w ?? 1
    const scaleY = object.scale?.h ?? 1
    const rotation = object.rotation ?? 0
    const fill = isKnownKind(object.kindId) ? OBJECT_COLORS[object.kindId] : FALLBACK_OBJECT_COLOR
    const rx = fmt(Math.max(3, s * 0.3) * scaleX)
    const ry = fmt(Math.max(3, s * 0.3) * scaleY)
    const transform =
      rotation !== 0 ? ` transform="rotate(${rotation} ${fmt(center.x)} ${fmt(center.y)})"` : ''
    parts.push(
      `<ellipse cx="${fmt(center.x)}" cy="${fmt(center.y)}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${OBJECT_OUTLINE_COLOR}" stroke-width="1"${transform}/>`,
    )
  }

  if (model.walls.length > 0) {
    const byThickness = new Map<number, string>()
    for (const wall of model.walls) {
      if (wall.points.length < 2) continue
      const seg: string[] = [`M${fmt(wall.points[0].x * s)} ${fmt(wall.points[0].y * s)}`]
      for (let i = 1; i < wall.points.length; i += 1) {
        seg.push(`L${fmt(wall.points[i].x * s)} ${fmt(wall.points[i].y * s)}`)
      }
      byThickness.set(wall.thickness, (byThickness.get(wall.thickness) ?? '') + seg.join(''))
    }
    for (const [thickness, path] of byThickness) {
      const bodyWidth = fmt(Math.max(3, thickness * s))
      const lineWidth = fmt(Math.max(1.5, thickness * s * 0.35))
      const join = 'stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="2"'
      parts.push(
        `<path d="${path}" fill="none" stroke="${WALL_BODY_COLOR}" stroke-width="${bodyWidth}" ${join}/>`,
      )
      parts.push(
        `<path d="${path}" fill="none" stroke="${WALL_LINE_COLOR}" stroke-width="${lineWidth}" ${join}/>`,
      )
    }
  }

  for (const door of model.doors) {
    const wall = model.walls.find((candidate) => candidate.id === door.wallSegmentId)
    if (!wall) continue
    const point = pointAlongWallSegment(wall, door.position)
    const ahead = pointAlongWallSegment(wall, Math.min(1, door.position + 0.001))
    const behind = pointAlongWallSegment(wall, Math.max(0, door.position - 0.001))
    const angleDeg = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI
    const length = s * DOOR_LENGTH_FRACTION
    const thickness = Math.max(4, s * DOOR_THICKNESS_FRACTION)
    const transform = `translate(${fmt(point.x * s)} ${fmt(point.y * s)}) rotate(${fmt(angleDeg)}) translate(${fmt(-length / 2)} ${fmt(-thickness / 2)})`
    parts.push(
      `<rect x="0" y="0" width="${fmt(length)}" height="${fmt(thickness)}" fill="${DOOR_FILL_COLOR}" transform="${transform}"/>`,
    )
  }

  if (options?.includeLight) {
    const markerRadius = Math.max(3, Math.round(s * 0.12))
    for (const light of model.lights) {
      const center = cellCenterAt(light.x, light.y, s)
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
