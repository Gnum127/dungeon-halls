import { difference, union } from 'polygon-clipping'
import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping'
import { createWallSegment, DEFAULT_WALL_THICKNESS } from './wallSegments'
import type { WallSegment } from './wallSegments'
import type { TerrainRegion } from './regions'

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

function lexicographicallyFirst(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
}

/**
 * Canonical id ребра (порядок концов не важен): инвариант к ориентации ring,
 * которую polygon-clipping не гарантирует. Двери на неизменном ребре переживают
 * пересборку контура.
 */
function edgeId(a: [number, number], b: [number, number]): string {
  const [p, q] = lexicographicallyFirst(a, b) ? [a, b] : [b, a]
  return `${AUTO_WALL_ID_PREFIX}${p[0]},${p[1]};${q[0]},${q[1]}`
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

/** Каждое ребро каждого кольца (внешнего и дыр) → отдельный `WallSegment`. */
function coverageToWalls(coverage: MultiPolygon): WallSegment[] {
  const walls: WallSegment[] = []
  for (const polygon of coverage) {
    for (const ring of polygon) {
      for (let i = 0; i + 1 < ring.length; i += 1) {
        const a = ring[i]
        const b = ring[i + 1]
        if (a[0] === b[0] && a[1] === b[1]) continue
        walls.push(
          createWallSegment(
            [
              { x: a[0], y: a[1] },
              { x: b[0], y: b[1] },
            ],
            {
              thickness: DEFAULT_WALL_THICKNESS,
              id: edgeId(a, b),
            },
          ),
        )
      }
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
