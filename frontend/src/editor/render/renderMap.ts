import { isKnownKind, OBJECT_COLORS, OBJECT_KIND_ENTRIES } from '../model/objects'
import { regionBounds } from '../model/regions'
import { gridPoints } from '../model/coverage'
import { doorLeafEnd, doorLength } from '../model/doors'
import type { WallSegment } from '../model/wallSegments'
import type { MapModel } from '../model/types'
import type { TerrainRegion } from '../model/regions'
import type { StairsPolygon } from '../model/stairs'
import type { Point } from '@/shared/point'
import type { TextureRenderContext } from './sprites/loader'
import {
  CANVAS_BACKGROUND_COLOR,
  DOOR_FILL_COLOR,
  DOOR_THICKNESS_FRACTION,
  EMPTY_GRID_POINT_COLOR,
  EMPTY_GRID_POINT_RADIUS_SCALE,
  FALLBACK_OBJECT_COLOR,
  GRID_POINT_COLOR,
  GRID_POINT_RADIUS,
  LIGHT_GLOW_COLOR,
  LIGHT_MARKER_COLOR,
  OBJECT_OUTLINE_COLOR,
  STAIRS_OUTLINE_COLOR,
  STAIRS_STEP_COLOR,
  TILE_COLORS,
  WALL_BODY_COLOR,
  WALL_LINE_COLOR,
} from './colors'
import {
  cellCenterAt,
  DOOR_GAP_CLEARANCE,
  stairsStepSegments,
  visibleCellRange,
  wallRuns,
} from './geometry'
import { pickIndexFromCoords } from '@/shared/random'
import { DEFAULT_CELL_SIZE } from '@/config/map.config'
import type { Viewport } from './viewport'

export interface RenderMapOptions {
  /** false = не рисовать свет (печать по чекбоксу); по умолчанию свет есть. */
  readonly includeLight?: boolean
}

/**
 * Верхний предел числа плиток текстуры на один регион: страховка от абсурдно
 * малого `size` в манифесте (иначе тайлинг мог бы «подвесить» канву). При
 * превышении регион остаётся с цветной заливкой.
 */
export const MAX_TEXTURE_TILES_PER_REGION = 20_000

/**
 * Изображение объекта по приоритету:
 * override изображения для вида (localStorage) → текстурный ассет вида (манифест
 * текстур) → defaultImage вида (element-images) → undefined (= цветной свотч).
 *
 * Текстурный ассет идёт ВЫШЕ element-image по умолчанию: сгенерированные
 * крупные текстуры объектов — основная графика этапа 24, а `defaultImage` из
 * element-images остаётся лишь фолбэком для видов без текстуры. Явный выбор
 * пользователя (override) по-прежнему побеждает всё.
 */
function resolveObjectImage(
  textures: TextureRenderContext | undefined,
  kindId: string,
): HTMLImageElement | undefined {
  if (!textures || !isKnownKind(kindId)) return undefined

  const overrideId = textures.imageOverrides?.[kindId]
  const overrideImage = overrideId ? textures.elementImages[overrideId] : undefined
  if (overrideImage) return overrideImage

  const texture = textures.objectTextures[kindId]
  if (texture) return texture

  const entry = OBJECT_KIND_ENTRIES.find((e) => e.id === kindId)
  const defaultId = entry?.defaultImage
  const defaultImage = defaultId ? textures.elementImages[defaultId] : undefined
  return defaultImage
}

/**
 * Единственная точка рендера карты: чистая функция от модели и вьюпорта.
 * Порядок слоёв: фон → регионы (по zOrder) → лестницы → сетка → объекты →
 * стены → двери → свет. Текстуры всегда с fallback на цвет: отсутствие
 * атласа/текстуры = цветная плитка/свотч.
 *
 * Контракт: вызывающий обязан выставить ctx.setTransform(dpr,…) и передать
 * viewport в CSS-пикселях; renderMap работает в CSS-координатах.
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  viewport: Viewport,
  textures?: TextureRenderContext,
  options?: RenderMapOptions,
): void {
  const { width, height } = viewport

  ctx.fillStyle = CANVAS_BACKGROUND_COLOR
  ctx.fillRect(0, 0, width, height)

  const sortedRegions = [...model.regions].sort((a, b) => a.zOrder - b.zOrder)
  for (const region of sortedRegions) {
    drawRegion(ctx, region, viewport, textures)
  }

  for (const stairs of model.stairs) {
    drawStairs(ctx, stairs, viewport)
  }

  drawGridPoints(ctx, model, viewport)

  for (const object of model.objects) {
    drawObject(ctx, object, viewport, textures)
  }

  for (const wall of model.walls) {
    drawWall(ctx, wall, model.doors, viewport)
  }

  for (const door of model.doors) {
    drawDoor(ctx, door, viewport, textures)
  }

  if (options?.includeLight !== false) {
    drawLights(ctx, model, viewport)
  }
}

/** Трассирует замкнутый путь произвольного полигона в экранных координатах (fill/clip). */
function tracePolygonPoints(
  ctx: CanvasRenderingContext2D,
  polygon: readonly Point[],
  viewport: Viewport,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  ctx.beginPath()
  polygon.forEach((point, index) => {
    const x = point.x * cellSize - offsetX
    const y = point.y * cellSize - offsetY
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
}

/**
 * Заливка полигона региона цветом (fallback) + тайлинг текстуры поверх, если
 * загружена. Текстура привязана к миру: ассет `size`px = `size / DEFAULT_CELL_SIZE`
 * клеткам, поэтому на экране плитка масштабируется с зумом
 * (`worldSize * viewport.cellSize`), а фаза тайлинга выровнена по мировому нулю
 * (рисунок согласован между регионами и независим от вьюпорта). При абсурдно
 * большом числе плиток регион остаётся с цветной заливкой.
 */
function drawRegion(
  ctx: CanvasRenderingContext2D,
  region: TerrainRegion,
  viewport: Viewport,
  textures?: TextureRenderContext,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  tracePolygonPoints(ctx, region.polygon, viewport)
  ctx.fillStyle = TILE_COLORS[region.tileType] ?? CANVAS_BACKGROUND_COLOR
  ctx.fill()

  const texture = textures?.tileTextures[region.tileType]
  if (!texture) return
  const { image, size, pool } = texture
  // Ассет = size/REF клеток; на экране плитка масштабируется с зумом.
  const worldSize = size / DEFAULT_CELL_SIZE
  const screenSize = worldSize * cellSize
  const bounds = regionBounds(region)
  const startCol = Math.floor(bounds.minX / worldSize)
  const startRow = Math.floor(bounds.minY / worldSize)
  const endCol = Math.ceil(bounds.maxX / worldSize)
  const endRow = Math.ceil(bounds.maxY / worldSize)
  if ((endCol - startCol) * (endRow - startRow) > MAX_TEXTURE_TILES_PER_REGION) return

  // Путь полигона ещё активен после fill(): clip() обрезает тайлинг по региону.
  ctx.save()
  ctx.clip()
  for (let row = startRow; row < endRow; row += 1) {
    for (let col = startCol; col < endCol; col += 1) {
      // Пул: вариант выбирается детерминированно по координате текстурной плитки.
      const variant =
        pool && pool.length > 0 ? pool[pickIndexFromCoords(col, row, pool.length)] : image
      ctx.drawImage(variant, col * screenSize - offsetX, row * screenSize - offsetY, screenSize, screenSize)
    }
  }
  ctx.restore()
}

/**
 * Поперечные линии-ступени внутри лестницы: ось — от середины базы (p0–p1) к
 * середине дальнего края (p2–p3), ступени перпендикулярны оси. Контур — без
 * заливки; линии обрезаны по контуру. Для полигонов ≠4 вершин — горизонтальный
 * фолбэк по bounding box.
 */
function drawStairs(
  ctx: CanvasRenderingContext2D,
  stairs: StairsPolygon,
  viewport: Viewport,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  const polygon = stairs.polygon
  if (polygon.length < 3) return

  ctx.save()
  tracePolygonPoints(ctx, polygon, viewport)
  ctx.strokeStyle = STAIRS_OUTLINE_COLOR
  ctx.lineWidth = Math.max(1.5, cellSize * 0.06)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.clip()

  ctx.strokeStyle = STAIRS_STEP_COLOR
  ctx.lineWidth = Math.max(1, cellSize * 0.05)
  for (const segment of stairsStepSegments(stairs.polygon)) {
    ctx.beginPath()
    ctx.moveTo(segment.a.x * cellSize - offsetX, segment.a.y * cellSize - offsetY)
    ctx.lineTo(segment.b.x * cellSize - offsetX, segment.b.y * cellSize - offsetY)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Точечная сетка: точки в углах клеток. Покрытые — ярче и крупнее
 * (`gridPoints.covered`), свободное поле — тусклые уменьшенные точки
 * (`gridPoints.empty`). Радиус постоянный (экранные пиксели), не зависит от зума.
 */
function drawGridPoints(ctx: CanvasRenderingContext2D, model: MapModel, viewport: Viewport): void {
  const { cellSize, offsetX, offsetY } = viewport
  const { width: cols, height: rows } = model.grid
  const range = visibleCellRange(viewport, cols, rows)

  const drawPoints = (points: readonly Point[], radius: number) => {
    for (const point of points) {
      ctx.beginPath()
      ctx.arc(
        point.x * cellSize - offsetX,
        point.y * cellSize - offsetY,
        radius,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  const { covered, empty } = gridPoints(model, range)

  ctx.fillStyle = GRID_POINT_COLOR
  drawPoints(covered, GRID_POINT_RADIUS)
  ctx.fillStyle = EMPTY_GRID_POINT_COLOR
  drawPoints(empty, GRID_POINT_RADIUS * EMPTY_GRID_POINT_RADIUS_SCALE)
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  object: MapModel['objects'][number],
  viewport: Viewport,
  textures?: TextureRenderContext,
): void {
  const { width, height, cellSize, offsetX, offsetY } = viewport
  // x/y — float-координата левого-верхнего угла в мировых клетках.
  const scaleX = object.scale?.w ?? 1
  const scaleY = object.scale?.h ?? 1
  const w = cellSize * scaleX
  const h = cellSize * scaleY
  const cx = object.x * cellSize + w / 2 - offsetX
  const cy = object.y * cellSize + h / 2 - offsetY
  if (
    cx < -cellSize * 3 ||
    cx > width + cellSize * 3 ||
    cy < -cellSize * 3 ||
    cy > height + cellSize * 3
  ) {
    return
  }
  const rotation = object.rotation ?? 0
  const image = resolveObjectImage(textures, object.kindId)

  ctx.save()
  ctx.translate(cx, cy)
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180)
  }

  if (image) {
    ctx.drawImage(image, -w / 2, -h / 2, w, h)
  } else {
    const baseRadius = Math.max(3, cellSize * 0.3)
    const rx = baseRadius * scaleX
    const ry = baseRadius * scaleY
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = isKnownKind(object.kindId)
      ? OBJECT_COLORS[object.kindId]
      : FALLBACK_OBJECT_COLOR
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = OBJECT_OUTLINE_COLOR
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Тело стены (утолщение) + тонкий контур поверх; замкнутый контур — одним
 * путём. Проёмы дверей вырезают интервал стены плюс зазор (`DOOR_GAP_CLEARANCE`).
 */
function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: WallSegment,
  doors: MapModel['doors'],
  viewport: Viewport,
): void {
  if (wall.points.length < 2) return
  const { cellSize, offsetX, offsetY } = viewport
  const bodyWidth = Math.max(3, wall.thickness * cellSize)
  const runs = wallRuns(wall, doors, DOOR_GAP_CLEARANCE)

  ctx.lineCap = 'round'
  // Скруглённые углы: у замкнутого контура нет концов — только стыки.
  ctx.lineJoin = 'round'

  for (const run of runs) {
    ctx.beginPath()
    ctx.moveTo(run[0].x * cellSize - offsetX, run[0].y * cellSize - offsetY)
    for (let i = 1; i < run.length; i += 1) {
      ctx.lineTo(run[i].x * cellSize - offsetX, run[i].y * cellSize - offsetY)
    }
    const first = run[0]
    const last = run[run.length - 1]
    if (first.x === last.x && first.y === last.y) ctx.closePath()

    ctx.strokeStyle = WALL_BODY_COLOR
    ctx.lineWidth = bodyWidth
    ctx.stroke()

    ctx.strokeStyle = WALL_LINE_COLOR
    ctx.lineWidth = Math.max(1.5, bodyWidth * 0.35)
    ctx.stroke()
  }
}

/**
 * Дверь — самостоятельный проём: закрытая створка лежит на отрезке `a`–`b`,
 * открытая повёрнута вокруг петли `a` на `openAngle`. Закрытая рисуется
 * текстурой (по проёму) или жирной заливкой; открытая — заливкой-полосой по
 * створке (текстура не поворачивается).
 */
function drawDoor(
  ctx: CanvasRenderingContext2D,
  door: MapModel['doors'][number],
  viewport: Viewport,
  textures?: TextureRenderContext,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  const thickness = Math.max(4, cellSize * DOOR_THICKNESS_FRACTION)
  const leaf = doorLeafEnd(door)
  const length = doorLength(door) * cellSize
  const angle = Math.atan2(leaf.y - door.a.y, leaf.x - door.a.x)

  ctx.save()
  ctx.translate(door.a.x * cellSize - offsetX, door.a.y * cellSize - offsetY)
  ctx.rotate(angle)

  const image =
    door.imageId && door.openAngle === 0 ? textures?.elementImages[door.imageId] : undefined
  ctx.fillStyle = DOOR_FILL_COLOR
  if (image) {
    ctx.drawImage(image, 0, -thickness / 2, length, thickness)
  } else {
    ctx.fillRect(0, -thickness / 2, length, thickness)
  }

  ctx.restore()
}

/** Свечение (полупрозрачный круг) + маркер источника; поверх остального. */
function drawLights(ctx: CanvasRenderingContext2D, model: MapModel, viewport: Viewport): void {
  if (model.lights.length === 0) return
  const { cellSize, offsetX, offsetY } = viewport
  const marker = Math.max(3, Math.round(cellSize * 0.12))
  for (const light of model.lights) {
    const center = cellCenterAt(light.x, light.y, cellSize)
    const cx = center.x - offsetX
    const cy = center.y - offsetY
    ctx.fillStyle = LIGHT_GLOW_COLOR
    ctx.beginPath()
    ctx.arc(cx, cy, light.radius * cellSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = LIGHT_MARKER_COLOR
    ctx.beginPath()
    ctx.arc(cx, cy, marker, 0, Math.PI * 2)
    ctx.fill()
  }
}
