import { isKnownKind, OBJECT_COLORS } from '../model/objects'
import { TILE_TYPES } from '../model/types'
import type { MapModel } from '../model/types'
import { cellCorners } from '@/shared/hex'
import type { SpriteRenderContext } from './sprites/loader'
import type { WallEdge } from '../model/walls'
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
} from './colors'
import { cellCenterAt, hexOrientationOf, traceCellPolygon, visibleCellRange } from './gridGeometry'
import type { Viewport } from './viewport'

export interface RenderMapOptions {
  /** false = не рисовать свет (печать по чекбоксу); по умолчанию свет есть. */
  readonly includeLight?: boolean
}

/**
 * Единственная точка рендера карты: чистая функция от модели и вьюпорта.
 * Спрайтовый режим включается опциональным атласом готовых картинок;
 * отсутствующий атлас или спрайт = fallback на цветную плитку.
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
  const { width, height, cellSize, offsetX, offsetY } = viewport

  ctx.fillStyle = CANVAS_BACKGROUND_COLOR
  ctx.fillRect(0, 0, width, height)

  // Пиксель-арт при зуме остаётся чётким; предыдущее значение возвращаем.
  const smoothingBefore = ctx.imageSmoothingEnabled
  if (sprites) ctx.imageSmoothingEnabled = false

  const orientation = hexOrientationOf(model.gridType)
  if (orientation === null) {
    // Квадратная ветка: заливка/линии зафиксированы тестами, менять нельзя.
    // Culling общий с hex через visibleCellRange (формулы идентичны прежним).
    const range = visibleCellRange(viewport, model.width, model.height, model.gridType)

    for (let row = range.firstRow; row <= range.lastRow; row += 1) {
      for (let col = range.firstCol; col <= range.lastCol; col += 1) {
        const tileIndex = model.tiles[row * model.width + col]
        // Fallback на случай битых значений из будущих загруженных файлов.
        const typeName = TILE_TYPES[tileIndex] ?? 'empty'
        const sprite = sprites?.tiles[typeName]
        if (sprite) {
          // Квадрат: спрайт точно в клетку, clip не нужен (бюджет производительности).
          ctx.drawImage(
            sprite,
            col * cellSize - offsetX,
            row * cellSize - offsetY,
            cellSize,
            cellSize,
          )
          continue
        }
        ctx.fillStyle = TILE_COLORS[typeName]
        ctx.fillRect(col * cellSize - offsetX, row * cellSize - offsetY, cellSize, cellSize)
      }
    }

    ctx.strokeStyle = GRID_LINE_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let col = range.firstCol; col <= range.lastCol + 1; col += 1) {
      const x = Math.floor(col * cellSize - offsetX) + 0.5
      ctx.moveTo(x, Math.max(0, -offsetY))
      ctx.lineTo(x, Math.min(height, model.height * cellSize - offsetY))
    }
    for (let row = range.firstRow; row <= range.lastRow + 1; row += 1) {
      const y = Math.floor(row * cellSize - offsetY) + 0.5
      ctx.moveTo(Math.max(0, -offsetX), y)
      ctx.lineTo(Math.min(width, model.width * cellSize - offsetX), y)
    }
    ctx.stroke()
  } else {
    const corners = cellCorners(orientation, cellSize)
    const range = visibleCellRange(viewport, model.width, model.height, model.gridType)

    for (let row = range.firstRow; row <= range.lastRow; row += 1) {
      for (let col = range.firstCol; col <= range.lastCol; col += 1) {
        const tileIndex = model.tiles[row * model.width + col]
        const typeName = TILE_TYPES[tileIndex] ?? 'empty'
        const center = cellCenterAt(col, row, model.gridType, cellSize)
        ctx.beginPath()
        traceCellPolygon(ctx, center.x - offsetX, center.y - offsetY, corners)
        const sprite = sprites?.tiles[typeName]
        if (sprite) {
          // Гекс: спрайт растягивается на bbox полигона и clip по нему —
          // края клетки не остаются пустыми.
          ctx.save()
          ctx.clip()
          ctx.drawImage(
            sprite,
            center.x - offsetX - cellSize,
            center.y - offsetY - cellSize,
            cellSize * 2,
            cellSize * 2,
          )
          ctx.restore()
          continue
        }
        ctx.fillStyle = TILE_COLORS[typeName]
        ctx.fill()
      }
    }

    ctx.strokeStyle = GRID_LINE_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let row = range.firstRow; row <= range.lastRow; row += 1) {
      for (let col = range.firstCol; col <= range.lastCol; col += 1) {
        const center = cellCenterAt(col, row, model.gridType, cellSize)
        traceCellPolygon(ctx, center.x - offsetX, center.y - offsetY, corners)
      }
    }
    ctx.stroke()
  }

  // Объекты рисуются в порядке массива: верхний — последним.
  for (const object of model.objects) {
    const center = cellCenterAt(object.x, object.y, model.gridType, cellSize)
    const cx = center.x - offsetX
    const cy = center.y - offsetY
    if (cx < -cellSize || cx > width + cellSize || cy < -cellSize || cy > height + cellSize) {
      continue
    }
    const sprite =
      sprites && isKnownKind(object.kindId) ? sprites.objects[object.kindId] : undefined
    if (sprite) {
      // Размер бокса клетки той же сетки, что у полигона тайла.
      const size = orientation === null ? cellSize : cellSize * 2
      ctx.drawImage(sprite, cx - size / 2, cy - size / 2, size, size)
      continue
    }
    const radius = Math.max(3, cellSize * 0.3)
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = isKnownKind(object.kindId)
      ? OBJECT_COLORS[object.kindId]
      : FALLBACK_OBJECT_COLOR
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = OBJECT_OUTLINE_COLOR
    ctx.stroke()
  }

  if (sprites) ctx.imageSmoothingEnabled = smoothingBefore

  // Defense-in-depth: рёбра определены только для квадратной сетки.
  if (model.gridType === 'square') {
    drawWalls(ctx, model, cellSize, offsetX, offsetY)
    drawDoors(ctx, model, cellSize, offsetX, offsetY)
  }
  if (options?.includeLight !== false) {
    drawLights(ctx, model, viewport)
  }
}

/** Свечение (полупрозрачный круг) + маркер источника; поверх остального. */
function drawLights(ctx: CanvasRenderingContext2D, model: MapModel, viewport: Viewport): void {
  if (model.lights.length === 0) return
  const { cellSize, offsetX, offsetY } = viewport
  const marker = Math.max(3, Math.round(cellSize * 0.12))
  for (const light of model.lights) {
    const center = cellCenterAt(light.x, light.y, model.gridType, cellSize)
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

/**
 * Сегмент стены в мировых координатах [x1, y1, x2, y2]; единственный источник
 * геометрии ребра для canvas-рендера и SVG-печати.
 */
export function wallSegment(edge: WallEdge, cellSize: number): [number, number, number, number] {
  const x = edge.x * cellSize
  const y = edge.y * cellSize
  switch (edge.side) {
    case 'N':
      return [x, y, x + cellSize, y]
    case 'S':
      return [x, y + cellSize, x + cellSize, y + cellSize]
    case 'W':
      return [x, y, x, y + cellSize]
    default:
      return [x + cellSize, y, x + cellSize, y + cellSize]
  }
}

/** Линии стен поверх тайлов и объектов; экранная геометрия ребра. */
function drawWalls(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  cellSize: number,
  offsetX: number,
  offsetY: number,
): void {
  if (model.walls.length === 0) return
  ctx.lineWidth = WALL_LINE_WIDTH
  ctx.strokeStyle = WALL_LINE_COLOR
  ctx.beginPath()
  for (const wall of model.walls) {
    const [x1, y1, x2, y2] = wallSegment(wall, cellSize)
    ctx.moveTo(x1 - offsetX, y1 - offsetY)
    ctx.lineTo(x2 - offsetX, y2 - offsetY)
  }
  ctx.stroke()
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Прямоугольники двери в мировых координатах. Закрытая — полотно по центру
 * ребра (60% длины); открытая — два коротких сегмента у концов (просвет).
 * Экспортирована для SVG-печати: единственный источник геометрии двери.
 */
export function doorRects(edge: WallEdge, open: boolean, cellSize: number): Array<Rect> {
  const horizontal = edge.side === 'N' || edge.side === 'S'
  const thickness = Math.max(4, Math.round(cellSize * 0.18))
  if (horizontal) {
    const x = edge.x * cellSize
    const y = edge.y * cellSize + (edge.side === 'N' ? -thickness / 2 : cellSize - thickness / 2)
    if (open) {
      return [
        { x, y, w: cellSize * 0.2, h: thickness },
        { x: x + cellSize * 0.8, y, w: cellSize * 0.2, h: thickness },
      ]
    }
    return [{ x: x + cellSize * 0.2, y, w: cellSize * 0.6, h: thickness }]
  }
  const x = edge.x * cellSize + (edge.side === 'W' ? -thickness / 2 : cellSize - thickness / 2)
  const y = edge.y * cellSize
  if (open) {
    return [
      { x, y, w: thickness, h: cellSize * 0.2 },
      { x, y: y + cellSize * 0.8, w: thickness, h: cellSize * 0.2 },
    ]
  }
  return [{ x, y: y + cellSize * 0.2, w: thickness, h: cellSize * 0.6 }]
}

function drawDoors(
  ctx: CanvasRenderingContext2D,
  model: MapModel,
  cellSize: number,
  offsetX: number,
  offsetY: number,
): void {
  if (model.doors.length === 0) return
  ctx.fillStyle = DOOR_FILL_COLOR
  for (const door of model.doors) {
    for (const rect of doorRects(door.edge, door.open, cellSize)) {
      ctx.fillRect(rect.x - offsetX, rect.y - offsetY, rect.w, rect.h)
    }
  }
}
