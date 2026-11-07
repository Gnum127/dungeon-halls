import { isKnownKind, objectFootprint, rectsOverlap } from './objects'
import { isValidLightColor, isValidLightRadius } from './lights'
import { isMapDimension } from '@/config/map.config'
import { assertValidRegion, isTileTypeName, isValidPolygon } from './regions'
import { isWallExtends } from './wallSegments'
import { isValidDoorOpenAngle } from './doors'
import { isValidStairsPolygon } from './stairs'
import { MAP_VERSION } from './types'
import type { MapGrid, MapModel } from './types'
import type { TerrainRegion } from './regions'
import type { WallSegment } from './wallSegments'
import type { Door } from './doors'
import type { StairsPolygon } from './stairs'
import type { MapLight } from './lights'
import type { MapObject, ObjectRotation, ObjectScale } from './types'
import type { Point } from '@/shared/point'

/** Ошибка разбора файла карты: сообщение понятно пользователю без стека. */
export class MapLoadError extends Error {}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parsePoint(value: unknown): Point {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new MapLoadError('Points must be [x, y] pairs')
  }
  const [x, y] = value
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    throw new MapLoadError('Point coordinates must be finite numbers')
  }
  return { x, y }
}

function parseGrid(value: unknown): MapGrid {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MapLoadError('grid must be a JSON object')
  }
  const { width, height, cellSize } = value as Record<string, unknown>
  if (!isMapDimension(width as number) || !isMapDimension(height as number)) {
    throw new MapLoadError(`grid size must be in [1, max], got ${String(width)}×${String(height)}`)
  }
  if (!isFiniteNumber(cellSize) || cellSize <= 0) {
    throw new MapLoadError(`grid.cellSize must be a positive number, got ${String(cellSize)}`)
  }
  return { width: width as number, height: height as number, cellSize }
}

function parseRegions(value: unknown): TerrainRegion[] {
  if (!Array.isArray(value)) throw new MapLoadError('regions must be an array')
  const seen = new Set<string>()
  const regions: TerrainRegion[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new MapLoadError('Every region must be a JSON object')
    }
    const { id, tileType, polygon, zOrder } = candidate as Record<string, unknown>
    if (typeof id !== 'string' || id.length === 0) {
      throw new MapLoadError('Region id must be a non-empty string')
    }
    if (seen.has(id)) throw new MapLoadError(`Duplicate region id: ${id}`)
    seen.add(id)
    if (!isTileTypeName(tileType)) {
      throw new MapLoadError(`Unknown region tileType: ${String(tileType)}`)
    }
    if (!Array.isArray(polygon)) throw new MapLoadError('Region polygon must be an array')
    const points = polygon.map(parsePoint)
    if (!isValidPolygon(points)) {
      throw new MapLoadError(
        `Region ${id} polygon is invalid (needs ≥3 vertices, no self-intersection)`,
      )
    }
    if (!Number.isInteger(zOrder) || (zOrder as number) < 0) {
      throw new MapLoadError(`Region zOrder must be a non-negative integer, got ${String(zOrder)}`)
    }
    const region: TerrainRegion = {
      id,
      tileType,
      polygon: points,
      zOrder: zOrder as number,
    }
    assertValidRegion(region)
    regions.push(region)
  }
  return regions
}

function parseWalls(value: unknown): WallSegment[] {
  if (!Array.isArray(value)) throw new MapLoadError('walls must be an array')
  const seen = new Set<string>()
  const walls: WallSegment[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new MapLoadError('Every wall must be a JSON object')
    }
    const { id, points, extends: wallExtends, thickness } = candidate as Record<string, unknown>
    if (typeof id !== 'string' || id.length === 0) {
      throw new MapLoadError('Wall id must be a non-empty string')
    }
    if (seen.has(id)) throw new MapLoadError(`Duplicate wall id: ${id}`)
    seen.add(id)
    if (!Array.isArray(points) || points.length < 2) {
      throw new MapLoadError(`Wall ${id} points must have at least 2 entries`)
    }
    const parsedPoints = points.map(parsePoint)
    if (!isWallExtends(wallExtends)) {
      throw new MapLoadError(`Unknown wall extends: ${String(wallExtends)}`)
    }
    if (!isFiniteNumber(thickness) || thickness < 0) {
      throw new MapLoadError(`Wall thickness must be a number >= 0, got ${String(thickness)}`)
    }
    walls.push({ id, points: parsedPoints, extends: wallExtends, thickness })
  }
  return walls
}

function parseDoors(value: unknown): Door[] {
  if (!Array.isArray(value)) throw new MapLoadError('doors must be an array')
  const seen = new Set<string>()
  const doors: Door[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new MapLoadError('Every door must be a JSON object')
    }
    const { id, a, b, openAngle, imageId } = candidate as Record<string, unknown>
    if (typeof id !== 'string' || id.length === 0) {
      throw new MapLoadError('Door id must be a non-empty string')
    }
    if (seen.has(id)) throw new MapLoadError(`Duplicate door id: ${id}`)
    seen.add(id)
    const pointA = parsePoint(a)
    const pointB = parsePoint(b)
    if (pointA.x === pointB.x && pointA.y === pointB.y) {
      throw new MapLoadError(`Door ${id} endpoints must not coincide`)
    }
    if (!isValidDoorOpenAngle(openAngle)) {
      throw new MapLoadError(`Door openAngle must be within ±150°, got ${String(openAngle)}`)
    }
    if (imageId !== null && (typeof imageId !== 'string' || imageId.length === 0)) {
      throw new MapLoadError('Door imageId must be null or a non-empty string')
    }
    doors.push({ id, a: pointA, b: pointB, openAngle, imageId })
  }
  return doors
}

function parseStairs(value: unknown): StairsPolygon[] {
  if (!Array.isArray(value)) throw new MapLoadError('stairs must be an array')
  const seen = new Set<string>()
  const stairs: StairsPolygon[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new MapLoadError('Every stairs entry must be a JSON object')
    }
    const { id, polygon } = candidate as Record<string, unknown>
    if (typeof id !== 'string' || id.length === 0) {
      throw new MapLoadError('Stairs id must be a non-empty string')
    }
    if (seen.has(id)) throw new MapLoadError(`Duplicate stairs id: ${id}`)
    seen.add(id)
    if (!Array.isArray(polygon)) throw new MapLoadError('Stairs polygon must be an array')
    const points = polygon.map(parsePoint)
    const entry: StairsPolygon = { id, polygon: points }
    if (!isValidStairsPolygon(entry)) {
      throw new MapLoadError('Stairs polygon is invalid (needs ≥3 vertices, no self-intersection)')
    }
    stairs.push(entry)
  }
  return stairs
}

function parseObjects(value: unknown): MapObject[] {
  if (!Array.isArray(value)) throw new MapLoadError('objects must be an array')
  const seenIds = new Set<number>()
  const seenObjects: MapObject[] = []
  const objects: MapObject[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new MapLoadError('Every object must be a JSON object')
    }
    const { id, kindId, x, y, rotation, scale } = candidate as Record<string, unknown>
    if (!Number.isInteger(id) || (id as number) < 1) {
      throw new MapLoadError(`Object id must be a positive integer, got ${String(id)}`)
    }
    if (seenIds.has(id as number)) throw new MapLoadError(`Duplicate object id: ${id}`)
    seenIds.add(id as number)
    if (typeof kindId !== 'string' || !isKnownKind(kindId)) {
      throw new MapLoadError(`Unknown object kind: ${String(kindId)}`)
    }
    if (!isFiniteNumber(x) || x < 0) {
      throw new MapLoadError(`Object x must be a finite number >= 0, got ${String(x)}`)
    }
    if (!isFiniteNumber(y) || y < 0) {
      throw new MapLoadError(`Object y must be a finite number >= 0, got ${String(y)}`)
    }

    let parsedRotation: ObjectRotation | undefined
    if (rotation !== undefined) {
      if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270) {
        throw new MapLoadError(`Invalid object rotation: ${String(rotation)}`)
      }
      parsedRotation = rotation
    }

    let parsedScale: ObjectScale | undefined
    if (scale !== undefined) {
      if (typeof scale !== 'object' || scale === null || Array.isArray(scale)) {
        throw new MapLoadError('Object scale must be an object { w, h }')
      }
      const { w, h } = scale as Record<string, unknown>
      if (!Number.isInteger(w) || (w as number) < 1 || !Number.isInteger(h) || (h as number) < 1) {
        throw new MapLoadError('Object scale must be integers >= 1')
      }
      parsedScale = { w: w as number, h: h as number }
    }

    const object: MapObject = {
      id: id as number,
      kindId,
      x,
      y,
      ...(parsedRotation !== undefined && { rotation: parsedRotation }),
      ...(parsedScale !== undefined && { scale: parsedScale }),
    }
    const footprint = objectFootprint(object)
    for (const other of seenObjects) {
      if (rectsOverlap(footprint, objectFootprint(other))) {
        throw new MapLoadError(`Objects ${object.id} and ${other.id} overlap`)
      }
    }
    seenObjects.push(object)
    objects.push(object)
  }
  return objects
}

function parseLights(value: unknown, grid: MapGrid): MapLight[] {
  if (!Array.isArray(value)) throw new MapLoadError('lights must be an array')
  const seen = new Set<number>()
  const lights: MapLight[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new MapLoadError('Every light must be a JSON object')
    }
    const { id, x, y, radius, color } = candidate as Record<string, unknown>
    if (!Number.isInteger(id) || (id as number) < 1) {
      throw new MapLoadError(`Light id must be a positive integer, got ${String(id)}`)
    }
    if (seen.has(id as number)) throw new MapLoadError(`Duplicate light id: ${id}`)
    seen.add(id as number)
    if (!Number.isInteger(x) || (x as number) < 0 || (x as number) >= grid.width) {
      throw new MapLoadError(`Light x must be in [0, ${grid.width}), got ${String(x)}`)
    }
    if (!Number.isInteger(y) || (y as number) < 0 || (y as number) >= grid.height) {
      throw new MapLoadError(`Light y must be in [0, ${grid.height}), got ${String(y)}`)
    }
    if (!isValidLightRadius(radius)) {
      throw new MapLoadError(`Light radius must be an integer in [1, 30], got ${String(radius)}`)
    }
    if (!isValidLightColor(color)) {
      throw new MapLoadError(`Light color must be hex, got ${String(color)}`)
    }
    lights.push({ id: id as number, x: x as number, y: y as number, radius, color })
  }
  return lights
}

export function serializeMap(model: MapModel): string {
  return JSON.stringify({
    version: model.version,
    grid: { ...model.grid },
    regions: model.regions.map((region) => ({
      id: region.id,
      tileType: region.tileType,
      polygon: region.polygon.map((p) => [p.x, p.y]),
      zOrder: region.zOrder,
    })),
    walls: model.walls.map((wall) => ({
      id: wall.id,
      points: wall.points.map((p) => [p.x, p.y]),
      extends: wall.extends,
      thickness: wall.thickness,
    })),
    doors: model.doors.map((door) => ({
      id: door.id,
      a: [door.a.x, door.a.y],
      b: [door.b.x, door.b.y],
      openAngle: door.openAngle,
      imageId: door.imageId,
    })),
    stairs: model.stairs.map((entry) => ({
      id: entry.id,
      polygon: entry.polygon.map((p) => [p.x, p.y]),
    })),
    objects: model.objects.map((object) => ({
      id: object.id,
      kindId: object.kindId,
      x: object.x,
      y: object.y,
      ...(object.rotation !== undefined && { rotation: object.rotation }),
      ...(object.scale !== undefined && { scale: { ...object.scale } }),
    })),
    lights: model.lights.map((light) => ({ ...light })),
  })
}

export function deserializeMap(json: string): MapModel {
  let raw: Record<string, unknown>
  try {
    const parsed = JSON.parse(json) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new MapLoadError('Map file must contain a JSON object')
    }
    raw = parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof MapLoadError) throw error
    throw new MapLoadError('File is not valid JSON')
  }

  if (raw.version !== MAP_VERSION) {
    throw new MapLoadError(
      `Unsupported map version: ${String(raw.version)}, expected ${MAP_VERSION}`,
    )
  }

  const grid = parseGrid(raw.grid)
  const regions = parseRegions(raw.regions)
  const walls = parseWalls(raw.walls)
  const doors = parseDoors(raw.doors)
  const stairs = parseStairs(raw.stairs)
  const objects = parseObjects(raw.objects)
  const lights = parseLights(raw.lights, grid)

  return { version: MAP_VERSION, grid, regions, walls, doors, stairs, objects, lights }
}
