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

type Geom = Polygon | MultiPolygon

/** Union геометрий, пропуская пустые (polygon-clipping не принимает пустой Geom). */
function unionGeoms(...geoms: Geom[]): MultiPolygon {
  const nonEmpty = geoms.filter((geom) => geom.length > 0)
  if (nonEmpty.length === 0) return []
  return union(nonEmpty[0], ...nonEmpty.slice(1))
}

function subtract(coverage: MultiPolygon, holes: MultiPolygon): MultiPolygon {
  if (coverage.length === 0 || holes.length === 0) return coverage
  return difference(coverage, holes)
}

interface BaseCoverage {
  readonly solid: MultiPolygon
  readonly holes: MultiPolygon
}

/** Отдельно union «твёрдых» регионов и union `empty` (дыр) — независимо от превью. */
function baseCoverageOf(regions: readonly TerrainRegion[]): BaseCoverage {
  return {
    solid: unionGeoms(...regions.filter((r) => r.tileType !== 'empty').map(regionToPolygon)),
    holes: unionGeoms(...regions.filter((r) => r.tileType === 'empty').map(regionToPolygon)),
  }
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
          createWallSegment([{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }], {
            thickness: DEFAULT_WALL_THICKNESS,
            id: edgeId(a, b),
          }),
        )
      }
    }
  }
  return walls
}

/**
 * Кэш покрытия базовых регионов по ссылке на массив. Модель иммутабельна: между
 * коммитами `model.regions` — тот же массив, поэтому при живом превью union
 * считается один раз, а не на каждом pointermove. Solid и holes кэшируются
 * раздельно, чтобы превью не «заращивало» дыры.
 */
const baseCoverageCache = new WeakMap<readonly TerrainRegion[], BaseCoverage>()

function cachedBaseCoverage(regions: readonly TerrainRegion[]): BaseCoverage {
  const cached = baseCoverageCache.get(regions)
  if (cached) return cached
  const coverage = baseCoverageOf(regions)
  baseCoverageCache.set(regions, coverage)
  return coverage
}

/**
 * Авто-стены: точная граница объединения «твёрдых» регионов (tileType ≠ empty)
 * за вычетом `empty` (ластик = дыра). Boolean-union (polygon-clipping) даёт
 * точные кромки без «лесенки»; id рёбер детерминированы по координатам, поэтому
 * двери на неизменных рёбрах переживают пересборку, а `replaceWallLayer`
 * сохраняет ручные стены.
 */
export function computeAutoWalls(regions: readonly TerrainRegion[]): WallSegment[] {
  const { solid, holes } = baseCoverageOf(regions)
  return coverageToWalls(subtract(solid, holes))
}

/**
 * Стены для живого превью: покрытие базовых регионов берётся из кэша и
 * объединяется лишь с одним строящимся регионом. Алгебраически совпадает с
 * полным `computeAutoWalls([...base, preview])`:
 * solid-превью → `(solid ∪ preview) \ holes`; empty-превью → `solid \ (holes ∪ preview)`.
 */
export function computePreviewWalls(
  base: readonly TerrainRegion[],
  preview: TerrainRegion,
): WallSegment[] {
  const baseCoverage = cachedBaseCoverage(base)
  const previewPoly = regionToPolygon(preview)

  if (preview.tileType === 'empty') {
    const holes = unionGeoms(baseCoverage.holes, previewPoly)
    return coverageToWalls(subtract(baseCoverage.solid, holes))
  }

  const solid = unionGeoms(baseCoverage.solid, previewPoly)
  return coverageToWalls(subtract(solid, baseCoverage.holes))
}
