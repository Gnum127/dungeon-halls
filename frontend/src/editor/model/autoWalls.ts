import { difference, union } from 'polygon-clipping'
import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping'
import { createWallSegment, DEFAULT_WALL_THICKNESS } from './wallSegments'
import type { WallSegment } from './wallSegments'
import type { TerrainRegion } from './regions'
import type { Point } from '@/shared/point'

/** Префикс id авто-стен: отличает их от ручных и позволяет пересобирать слой. */
export const AUTO_WALL_ID_PREFIX = 'auto:'

export function isAutoWallSegmentId(id: string): boolean {
  return id.startsWith(AUTO_WALL_ID_PREFIX)
}

/** Точность координат в id и в геометрии (стабилизирует id и убирает шум). */
const COORD_DECIMALS = 4
const COORD_FACTOR = 10 ** COORD_DECIMALS

function roundCoord(value: number): number {
  return Math.round(value * COORD_FACTOR) / COORD_FACTOR
}

function regionToRing(region: TerrainRegion): Ring {
  const ring: Ring = region.polygon.map((point) => [roundCoord(point.x), roundCoord(point.y)])
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
  return ring
}

function regionToPolygon(region: TerrainRegion): Polygon {
  return [regionToRing(region)]
}

/** Сравнение точек в лексикографическом порядке (сначала x, затем y). */
function comparePoint(a: [number, number], b: [number, number]): number {
  return a[0] - b[0] || a[1] - b[1]
}

/** Вершины кольца без дублирующей замыкающей точки, округлённые до стабильных. */
function ringVertices(ring: Ring): Array<[number, number]> {
  const points: Array<[number, number]> = ring.map(([x, y]) => [roundCoord(x), roundCoord(y)])
  const first = points[0]
  const last = points[points.length - 1]
  if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop()
  return points
}

/** Поворот кольца к старту с лексикографически минимальной вершины. */
function rotateToMin(points: Array<[number, number]>): Array<[number, number]> {
  let minIndex = 0
  for (let i = 1; i < points.length; i += 1) {
    if (comparePoint(points[i], points[minIndex]) < 0) minIndex = i
  }
  return [...points.slice(minIndex), ...points.slice(0, minIndex)]
}

function compareRings(a: Array<[number, number]>, b: Array<[number, number]>): number {
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    const diff = comparePoint(a[i], b[i])
    if (diff !== 0) return diff
  }
  return a.length - b.length
}

/** FNV-1a: короткий детерминированный ключ контура (id не должен дублировать геометрию). */
function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Детерминированный id контура: кольцо канонизируется (старт с минимальной
 * вершины, из двух ориентаций берётся лексикографически меньшая) и хешируется.
 * Инвариантен к порядку/ориентации ring, которую polygon-clipping не гарантирует.
 */
function contourId(ring: Ring): string {
  const points = ringVertices(ring)
  const forward = rotateToMin(points)
  const reversed = rotateToMin([...points].reverse())
  const canonical = compareRings(forward, reversed) <= 0 ? forward : reversed
  const signature = canonical.map(([x, y]) => `${x},${y}`).join(';')
  return `${AUTO_WALL_ID_PREFIX}${hashText(signature)}`
}

/** Вычитание из покрытия; пустой операнд polygon-clipping не принимает. */
function subtract(coverage: MultiPolygon, geom: Polygon | MultiPolygon): MultiPolygon {
  if (coverage.length === 0 || geom.length === 0) return coverage
  return difference(coverage, geom)
}

/**
 * Наносит один регион на покрытие по правилу «верхний побеждает»: `empty`
 * вычитает уже нанесённое (дыра), любой другой тип добавляет.
 */
function paintRegion(coverage: MultiPolygon, region: TerrainRegion): MultiPolygon {
  const geom = regionToPolygon(region)
  if (region.tileType === 'empty') return subtract(coverage, geom)
  if (coverage.length === 0) return [geom]
  return union(coverage, geom)
}

/**
 * Покрытие карты: регионы наносятся в порядке zOrder (возрастание), каждый
 * верхний «перекрывает» нижний — `empty` вырезает дыру, остальные добавляют.
 * Заменяет прежнюю формулу `union(solid) − union(holes)`: заливка поверх
 * стёртого корректно восстанавливает покрытие и не оставляет «призрачных» стен.
 */
export function computeCoverage(regions: readonly TerrainRegion[]): MultiPolygon {
  const sorted = [...regions].sort((a, b) => a.zOrder - b.zOrder)
  let coverage: MultiPolygon = []
  for (const region of sorted) {
    coverage = paintRegion(coverage, region)
  }
  return coverage
}

/** Точки кольца как замкнутый контур: первая точка дублируется в конце. */
function closedContourPoints(ring: Ring): Point[] {
  const points: Point[] = ring.map(([x, y]) => ({ x, y }))
  const first = points[0]
  const last = points[points.length - 1]
  if (first.x !== last.x || first.y !== last.y) points.push({ x: first.x, y: first.y })
  return points
}

/**
 * Каждое кольцо покрытия (внешняя граница или дыра) → ОДИН замкнутый
 * `WallSegment` с `points[0] === points[last]`. Вложенные контуры (граница
 * комнаты и граница дыры) — отдельные сегменты.
 */
function coverageToWalls(coverage: MultiPolygon): WallSegment[] {
  const walls: WallSegment[] = []
  const seenIds = new Set<string>()
  for (const polygon of coverage) {
    for (const ring of polygon) {
      const points = closedContourPoints(ring)
      if (points.length < 4) continue
      const baseId = contourId(ring)
      let id = baseId
      let suffix = 1
      while (seenIds.has(id)) {
        id = `${baseId}#${suffix}`
        suffix += 1
      }
      seenIds.add(id)
      walls.push(createWallSegment(points, { thickness: DEFAULT_WALL_THICKNESS, id }))
    }
  }
  return walls
}

/**
 * Кэш покрытия базовых регионов по ссылке на массив. Модель иммутабельна: между
 * коммитами `model.regions` — тот же массив, поэтому при живом превью покрытие
 * считается один раз, а не на каждом pointermove.
 */
const baseCoverageCache = new WeakMap<readonly TerrainRegion[], MultiPolygon>()

function cachedBaseCoverage(regions: readonly TerrainRegion[]): MultiPolygon {
  const cached = baseCoverageCache.get(regions)
  if (cached) return cached
  const coverage = computeCoverage(regions)
  baseCoverageCache.set(regions, coverage)
  return coverage
}

/**
 * Авто-стены: точная граница покрытия карты (см. `computeCoverage`).
 * Boolean-union (polygon-clipping) даёт точные кромки без «лесенки»;
 * id контуров детерминированы по координатам, а `replaceWallLayer` сохраняет
 * ручные стены.
 */
export function computeAutoWalls(regions: readonly TerrainRegion[]): WallSegment[] {
  return coverageToWalls(computeCoverage(regions))
}

/**
 * Стены после добавления региона поверх текущего покрытия: базовое покрытие
 * берётся из кэша, новый регион наносится последним (верхним слоем). Совпадает
 * с `computeAutoWalls` при максимальном zOrder у нового региона; используется и
 * для живого превью, и для коммита (одна геометрия — одни стены).
 */
export function computeWallsWithRegion(
  base: readonly TerrainRegion[],
  region: TerrainRegion,
): WallSegment[] {
  return coverageToWalls(paintRegion(cachedBaseCoverage(base), region))
}
