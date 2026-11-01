import { isKnownKind, OBJECT_COLORS, OBJECT_KIND_ENTRIES } from '../model/objects'
import { regionBounds } from '../model/regions'
import { pointAlongWallSegment } from '../model/wallSegments'
import type { WallSegment } from '../model/wallSegments'
import type { MapModel } from '../model/types'
import type { TerrainRegion } from '../model/regions'
import type { SpriteRenderContext } from './sprites/loader'
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
} from './colors'
import { cellCenterAt, visibleCellRange, wallPath } from './geometry'
import { pickIndexFromCoords } from '@/shared/random'
import type { Viewport } from './viewport'

export interface RenderMapOptions {
  /** false = не рисовать свет (печать по чекбоксу); по умолчанию свет есть. */
  readonly includeLight?: boolean
}

/**
 * Изображение объекта по приоритету:
 * override изображения для вида → defaultImage вида → спрайт-ассет → undefined
 * (= цветной свотч). Отсутствие записи пула или нарушение дефолта молча
 * уходит ниже по цепочке, без лога — как в спрайт-пайплайне.
 */
function resolveObjectImage(
  sprites: SpriteRenderContext | undefined,
  kindId: string,
): HTMLImageElement | undefined {
  if (!sprites || !isKnownKind(kindId)) return undefined

  const overrideId = sprites.imageOverrides?.[kindId]
  const overrideImage = overrideId ? sprites.elementImages[overrideId] : undefined
  if (overrideImage) return overrideImage

  const entry = OBJECT_KIND_ENTRIES.find((e) => e.id === kindId)
  const defaultId = entry?.defaultImage
  const defaultImage = defaultId ? sprites.elementImages[defaultId] : undefined
  if (defaultImage) return defaultImage

  return sprites.objects[kindId]
}

/**
 * Единственная точка рендера карты: чистая функция от модели и вьюпорта.
 * Порядок слоёв: фон → регионы (по zOrder) → сетка → объекты → стены →
 * двери → свет. Спрайтовый режим включается опциональным атласом; отсутствие
 * атласа/спрайта = fallback на цвет.
 *
 * Контракт: вызывающий обязан выставить ctx.setTransform(dpr,…) и передать
 * viewport в CSS-пикселях; renderMap работает в CSS-координатах.
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  viewport: Viewport,
  sprites?: SpriteRenderContext,
  options?: RenderMapOptions,
): void {
  const { width, height } = viewport

  ctx.fillStyle = CANVAS_BACKGROUND_COLOR
  ctx.fillRect(0, 0, width, height)

  // Пиксель-арт при зуме остаётся чётким; предыдущее значение возвращаем.
  const smoothingBefore = ctx.imageSmoothingEnabled
  if (sprites) ctx.imageSmoothingEnabled = false

  const sortedRegions = [...model.regions].sort((a, b) => a.zOrder - b.zOrder)
  for (const region of sortedRegions) {
    drawRegion(ctx, region, viewport, sprites)
  }

  drawGrid(ctx, model, viewport)

  for (const object of model.objects) {
    drawObject(ctx, object, viewport, sprites)
  }

  for (const wall of model.walls) {
    drawWall(ctx, wall, viewport)
  }

  for (const door of model.doors) {
    drawDoor(ctx, model, door, viewport, sprites)
  }

  if (sprites) ctx.imageSmoothingEnabled = smoothingBefore

  if (options?.includeLight !== false) {
    drawLights(ctx, model, viewport)
  }
}

/** Трассирует замкнутый путь полигона в экранных координатах (для fill/clip). */
function tracePolygon(
  ctx: CanvasRenderingContext2D,
  polygon: TerrainRegion['polygon'],
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

/** Заливка полигона региона цветом; в спрайтовом режиме — тайлинг текстуры. */
function drawRegion(
  ctx: CanvasRenderingContext2D,
  region: TerrainRegion,
  viewport: Viewport,
  sprites?: SpriteRenderContext,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  tracePolygon(ctx, region.polygon, viewport)
  ctx.fillStyle = TILE_COLORS[region.tileType] ?? CANVAS_BACKGROUND_COLOR
  ctx.fill()

  const pool = sprites?.tilePools?.[region.tileType]
  const hasPool = pool !== undefined && pool.length > 0
  const sprite = sprites?.tiles[region.tileType]
  if (hasPool || sprite) {
    const bounds = regionBounds(region)
    const startX = Math.floor(bounds.minX)
    const startY = Math.floor(bounds.minY)
    const endX = Math.ceil(bounds.maxX)
    const endY = Math.ceil(bounds.maxY)
    ctx.save()
    // Путь контекста мог быть изменён между вызовами — трассируем заново.
    tracePolygon(ctx, region.polygon, viewport)
    ctx.clip()
    for (let row = startY; row < endY; row += 1) {
      for (let col = startX; col < endX; col += 1) {
        // Пул: вариант выбирается детерминированно по координате клетки.
        const image = hasPool ? pool[pickIndexFromCoords(col, row, pool.length)] : sprite
        if (!image) continue
        ctx.drawImage(
          image,
          col * cellSize - offsetX,
          row * cellSize - offsetY,
          cellSize,
          cellSize,
        )
      }
    }
    ctx.restore()
  }

  if (region.tileType === 'stairs') {
    drawStairsSteps(ctx, region, viewport)
  }
}

/**
 * Поперечные линии-ступени внутри региона лестницы: рисуются по bounding box
 * региона с clip по его полигону. Шаг линий — четверть клетки.
 */
function drawStairsSteps(
  ctx: CanvasRenderingContext2D,
  region: TerrainRegion,
  viewport: Viewport,
): void {
  const { cellSize, offsetX, offsetY } = viewport
  const bounds = regionBounds(region)
  ctx.save()
  tracePolygon(ctx, region.polygon, viewport)
  ctx.clip()

  ctx.strokeStyle = STAIRS_STEP_COLOR
  ctx.lineWidth = Math.max(1, cellSize * 0.05)
  const step = cellSize * 0.25
  const left = bounds.minX * cellSize - offsetX
  const right = bounds.maxX * cellSize - offsetX
  for (let y = bounds.minY * cellSize - offsetY; y <= bounds.maxY * cellSize - offsetY; y += step) {
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }
  ctx.restore()
}

/** Линии сетки (квадратная сетка). */
function drawGrid(ctx: CanvasRenderingContext2D, model: MapModel, viewport: Viewport): void {
  const { width, height, cellSize, offsetX, offsetY } = viewport
  const { width: cols, height: rows } = model.grid
  const range = visibleCellRange(viewport, cols, rows)

  ctx.strokeStyle = GRID_LINE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let col = range.firstCol; col <= range.lastCol + 1; col += 1) {
    const x = Math.floor(col * cellSize - offsetX) + 0.5
    ctx.moveTo(x, Math.max(0, -offsetY))
    ctx.lineTo(x, Math.min(height, rows * cellSize - offsetY))
  }
  for (let row = range.firstRow; row <= range.lastRow + 1; row += 1) {
    const y = Math.floor(row * cellSize - offsetY) + 0.5
    ctx.moveTo(Math.max(0, -offsetX), y)
    ctx.lineTo(Math.min(width, cols * cellSize - offsetX), y)
  }
  ctx.stroke()
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  object: MapModel['objects'][number],
  viewport: Viewport,
  sprites?: SpriteRenderContext,
): void {
  const { width, height, cellSize, offsetX, offsetY } = viewport
  const center = cellCenterAt(object.x, object.y, cellSize)
  const cx = center.x - offsetX
  const cy = center.y - offsetY
  if (
    cx < -cellSize * 3 ||
    cx > width + cellSize * 3 ||
    cy < -cellSize * 3 ||
    cy > height + cellSize * 3
  ) {
    return
  }
  const scaleX = object.scale?.w ?? 1
  const scaleY = object.scale?.h ?? 1
  const rotation = object.rotation ?? 0
  const sprite = resolveObjectImage(sprites, object.kindId)

  ctx.save()
  ctx.translate(cx, cy)
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180)
  }

  if (sprite) {
    const w = cellSize * scaleX
    const h = cellSize * scaleY
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h)
  } else {
    const baseRadius = Math.max(3, cellSize * 0.3)
    const rx = baseRadius * scaleX
    const ry = baseRadius * scaleY
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = isKnownKind(object.kindId) ? OBJECT_COLORS[object.kindId] : FALLBACK_OBJECT_COLOR
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = OBJECT_OUTLINE_COLOR
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Тело стены (утолщение) + тонкий контур поверх; замкнутый контур — одним путём.
 */
function drawWall(ctx: CanvasRenderingContext2D, wall: WallSegment, viewport: Viewport): void {
  if (wall.points.length < 2) return
  const { cellSize, offsetX, offsetY } = viewport
  const bodyWidth = Math.max(3, wall.thickness * cellSize)
  const { points, closed } = wallPath(wall)

  ctx.lineCap = 'round'
  // Скруглённые углы: у замкнутого контура нет концов — только стыки.
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(points[0].x * cellSize - offsetX, points[0].y * cellSize - offsetY)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x * cellSize - offsetX, points[i].y * cellSize - offsetY)
  }
  if (closed) ctx.closePath()

  ctx.strokeStyle = WALL_BODY_COLOR
  ctx.lineWidth = bodyWidth
  ctx.stroke()

  ctx.strokeStyle = WALL_LINE_COLOR
  ctx.lineWidth = Math.max(1.5, bodyWidth * 0.35)
  ctx.stroke()
}

/** Дверь на стеновом сегменте: текстура, иначе жирное полотно. */
function drawDoor(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  door: MapModel['doors'][number],
  viewport: Viewport,
  sprites?: SpriteRenderContext,
): void {
  const wall = model.walls.find((candidate) => candidate.id === door.wallSegmentId)
  if (!wall) return
  const { cellSize, offsetX, offsetY } = viewport

  const point = pointAlongWallSegment(wall, door.position)
  const ahead = pointAlongWallSegment(wall, Math.min(1, door.position + 0.001))
  const behind = pointAlongWallSegment(wall, Math.max(0, door.position - 0.001))
  const tangentX = ahead.x - behind.x
  const tangentY = ahead.y - behind.y
  const angle = Math.atan2(tangentY, tangentX)

  const length = cellSize * DOOR_LENGTH_FRACTION
  const thickness = Math.max(4, cellSize * DOOR_THICKNESS_FRACTION)

  ctx.save()
  ctx.translate(point.x * cellSize - offsetX, point.y * cellSize - offsetY)
  ctx.rotate(angle)

  const image = door.imageId ? sprites?.elementImages[door.imageId] : undefined
  if (image) {
    ctx.drawImage(image, -length / 2, -thickness / 2, length, thickness)
  } else if (door.open) {
    const segment = length * 0.3
    ctx.fillStyle = DOOR_FILL_COLOR
    ctx.fillRect(-length / 2, -thickness / 2, segment, thickness)
    ctx.fillRect(length / 2 - segment, -thickness / 2, segment, thickness)
  } else {
    ctx.fillStyle = DOOR_FILL_COLOR
    ctx.fillRect(-length / 2, -thickness / 2, length, thickness)
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
