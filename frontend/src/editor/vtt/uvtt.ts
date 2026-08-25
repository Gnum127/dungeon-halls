import type { WallEdge } from '../model/walls'
import type { MapModel } from '../model/types'
import type { SpriteRenderContext } from '../render/sprites/loader'
import { EXPORT_CELL_SIZE, canvasToPngBytes, renderToCanvas } from '../tools/pngExport'
import { createZip, utf8 } from './zip'

export const UVTT_PIXELS_PER_GRID = EXPORT_CELL_SIZE

export const UVTT_FORMAT = '0.3'
export const UVTT_MAP_NAME = 'dungeon-halls-map'

interface Point {
  readonly x: number
  readonly y: number
}

function pointKey(p: Point): string {
  return `${p.x},${p.y}`
}

/** Концы сегмента ребра в координатах сетки (1 единица = клетка). */
export function edgeSegment(edge: WallEdge): [Point, Point] {
  const x = edge.x
  const y = edge.y
  switch (edge.side) {
    case 'N':
      return [
        { x, y },
        { x: x + 1, y },
      ]
    case 'S':
      return [
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
      ]
    case 'W':
      return [
        { x, y },
        { x, y: y + 1 },
      ]
    default:
      return [
        { x: x + 1, y },
        { x: x + 1, y: y + 1 },
      ]
  }
}

/**
 * Собирает замкнутые полигоны из набора стен-рёбер: классический обход
 * планарных граней (каждое неориентированное ребро проходится дважды,
 * в обе стороны). Внутренние грани (комнаты) имеют положительную площадь
 * в экранных координатах; внешняя грань отбрасывается знаком площади —
 * поэтому межкомнатные перегородки остаются отдельными контурами.
 * Висячие рёбра дают вырожденные грани с нулевой площадью и
 * отфильтровываются. Точки в пикселях (pixels_per_grid).
 */
export function buildLineOfSight(walls: readonly WallEdge[], pixelsPerGrid: number): Point[][] {
  // Направления по часовой стрелке в экранной системе (y вниз):
  // вправо, вниз, влево, вверх.
  const DIRS: ReadonlyArray<Point> = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ]
  const dirIndexOf = (d: Point): number =>
    DIRS.findIndex((candidate) => candidate.x === d.x && candidate.y === d.y)

  // Интернинг вершин: один объект на точку даёт сравнение по ссылке
  // и избавляет от парсинга координат обратно из строковых ключей.
  const vertices = new Map<string, Point>()
  const pointAt = (x: number, y: number): Point => {
    const key = `${x},${y}`
    const existing = vertices.get(key)
    if (existing) return existing
    const created = { x, y }
    vertices.set(key, created)
    return created
  }

  const outgoing = new Map<Point, Array<{ to: Point; dir: number }>>()
  const halfKey = (from: Point, to: Point): string => `${pointKey(from)}>${pointKey(to)}`
  const addDirected = (a: Point, b: Point): void => {
    const list = outgoing.get(a) ?? []
    list.push({ to: b, dir: dirIndexOf({ x: b.x - a.x, y: b.y - a.y }) })
    outgoing.set(a, list)
  }
  for (const wall of walls) {
    const [a, b] = edgeSegment(wall)
    addDirected(pointAt(a.x, a.y), pointAt(b.x, b.y))
    addDirected(pointAt(b.x, b.y), pointAt(a.x, a.y))
  }

  const used = new Set<string>()
  const signedArea = (points: readonly Point[]): number => {
    let sum = 0
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      sum += a.x * b.y - b.x * a.y
    }
    return sum / 2
  }

  const faces: Point[][] = []
  for (const [start, edges] of outgoing) {
    for (const first of edges) {
      if (used.has(halfKey(start, first.to))) continue

      const face: Point[] = []
      let current = start
      let next = first.to
      let incomingDir = first.dir
      let closed = false
      while (true) {
        used.add(halfKey(current, next))
        face.push(current)
        current = next
        if (current === start) {
          closed = true
          break
        }

        // Правило грани: приходя направлением d, уходим первым свободным
        // направлением ПРОТИВ часовой после обратного (-d). В экранной
        // системе (y вниз) это даёт внутренним граням (комнатам)
        // положительную площадь, а внешней — отрицательную: перегородки
        // между комнатами остаются в line_of_sight отдельными контурами.
        const reverse = (incomingDir + 2) % 4
        const outs = outgoing.get(current) ?? []
        let chosen: { to: Point; dir: number } | null = null
        for (let step = 1; step <= 4 && !chosen; step += 1) {
          const want = (reverse - step + 8) % 4
          const candidate = outs.find(
            (outgoingEdge) =>
              outgoingEdge.dir === want && !used.has(halfKey(current, outgoingEdge.to)),
          )
          if (candidate) chosen = candidate
        }
        if (!chosen) break
        incomingDir = chosen.dir
        next = chosen.to
      }

      // Незамкнутая грань (защита от неканоничного ввода) отбрасывается,
      // иначе полигон неявно замкнулся бы «через весь лист».
      if (!closed) continue
      const area = signedArea(face)
      if (face.length >= 3 && area > 0) {
        faces.push(face.map(scaleBy(pixelsPerGrid)))
      }
    }
  }
  return faces
}

function scaleBy(pixelsPerGrid: number): (point: Point) => Point {
  return (point) => ({ x: point.x * pixelsPerGrid, y: point.y * pixelsPerGrid })
}

/**
 * map.json формата Universal VTT. Поля сверяются с эталонным образцом .uvtt
 * в пункте 5.7 (см. README этапа); environment — консервативные дефолты.
 */
export function buildMapJson(model: MapModel): Record<string, unknown> {
  const ppg = UVTT_PIXELS_PER_GRID

  function centerOf(x: number, y: number): Point {
    return { x: (x + 0.5) * ppg, y: (y + 0.5) * ppg }
  }

  return {
    format: UVTT_FORMAT,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: model.width, y: model.height },
      pixels_per_grid: ppg,
    },
    line_of_sight: buildLineOfSight(model.walls, ppg),
    portals: model.doors.map((door) => {
      const [a, b] = edgeSegment(door.edge)
      const bounds = [
        { x: a.x * ppg, y: a.y * ppg },
        { x: b.x * ppg, y: b.y * ppg },
      ]
      return {
        position: {
          x: (bounds[0].x + bounds[1].x) / 2,
          y: (bounds[0].y + bounds[1].y) / 2,
        },
        bounds,
        rotation: door.edge.side === 'N' || door.edge.side === 'S' ? 90 : 0,
        closed: !door.open,
        enabled: true,
      }
    }),
    lights: model.lights.map((light) => ({
      position: centerOf(light.x, light.y),
      range: light.radius,
      intensity: 1,
      color: light.color,
      shadows: true,
    })),
    environment: {
      ambient_light: '#ffffff',
      ambient_intensity: 0.4,
    },
  }
}

/**
 * Экспорт Universal VTT: ZIP из map.json + PNG-рендер карты.
 * Только квадратная сетка — формат описывает прямоугольные клетки.
 * Режим отображения тот же, что у PNG-экспорта: без атласа — цветами.
 */
export async function exportMapToUvtt(
  model: MapModel,
  sprites?: SpriteRenderContext,
): Promise<Blob> {
  if (model.gridType !== 'square') {
    throw new RangeError('Universal VTT export supports square grids only')
  }
  const canvas = renderToCanvas(model, UVTT_PIXELS_PER_GRID, sprites)
  const pngBytes = await canvasToPngBytes(canvas)

  const bytes = createZip([
    { name: 'map.json', data: utf8(JSON.stringify(buildMapJson(model))) },
    { name: `${UVTT_MAP_NAME}.png`, data: pngBytes },
  ])
  return new Blob([bytes as BlobPart], { type: 'application/octet-stream' })
}
