import { describe, expect, it } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { OBJECT_COLORS } from '../model/objects'
import { TILE_TYPES } from '../model/types'
import type { MapModel } from '../model/types'
import {
  CANVAS_BACKGROUND_COLOR,
  FALLBACK_OBJECT_COLOR,
  GRID_LINE_COLOR,
  TILE_COLORS,
} from './colors'
import { renderMap } from './renderMap'
import { cellCenterAt, mapPixelBounds, visibleCellRange } from './gridGeometry'
import { cellCorners } from '@/shared/hex'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

const FLOOR = TILE_TYPES.indexOf('floor')

function makeModel(): MapModel {
  return applyCommand(createEmptyMap(3, 3), { kind: 'setTile', x: 1, y: 1, tile: FLOOR })
}

function baseViewport(): Viewport {
  return { width: 96, height: 96, cellSize: 32, offsetX: 0, offsetY: 0 }
}

describe('renderMap', () => {
  it('paints the background first', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, createEmptyMap(3, 3), baseViewport())

    expect(calls[0]).toMatchObject({
      op: 'fillRect',
      args: [0, 0, 96, 96],
      fillStyle: CANVAS_BACKGROUND_COLOR,
    })
  })

  it('draws exactly one rect per visible map cell', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, createEmptyMap(3, 3), baseViewport())

    const fills = calls.filter((c) => c.op === 'fillRect')
    expect(fills).toHaveLength(10)
  })

  it('uses the palette color for the painted tile', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, makeModel(), baseViewport())

    const centerTile = calls.find(
      (c) => c.op === 'fillRect' && c.args[0] === 32 && c.args[1] === 32,
    )
    expect(centerTile).toBeDefined()
    expect(centerTile?.fillStyle).toBe(TILE_COLORS.floor)
    expect(
      calls.filter((c) => c.op === 'fillRect' && c.fillStyle === TILE_COLORS.floor),
    ).toHaveLength(1)
  })

  it('shifts cells opposite to viewport offset', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, makeModel(), { ...baseViewport(), offsetX: 16, offsetY: 16 })

    const centerTile = calls.find(
      (c) => c.op === 'fillRect' && c.args[0] === 16 && c.args[1] === 16,
    )
    expect(centerTile?.fillStyle).toBe(TILE_COLORS.floor)
  })

  it('strokes grid lines over the map extent only', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, createEmptyMap(2, 2), { ...baseViewport(), width: 200, height: 200 })

    const stroke = calls.find((c) => c.op === 'stroke')
    expect(stroke).toBeDefined()
    expect(stroke?.fillStyle).toBe(GRID_LINE_COLOR)

    // Карта 2x2 по 32px: вертикали на x=0,32,64 (+0.5) и ничего дальше 64.
    const verticalXs = calls.filter((c) => c.op === 'moveTo').map((c) => c.args[0])
    expect(verticalXs.every((x) => (x as number) <= 64.5)).toBe(true)
  })

  it('draws each map object as a circle at its cell center', () => {
    const { ctx, calls } = makeFakeCtx()
    const withDoor = applyCommand(createEmptyMap(3, 3), {
      kind: 'addObject',
      x: 1,
      y: 1,
      kindId: 'door',
    })

    renderMap(ctx, withDoor, baseViewport())

    const arcs = calls.filter((c) => c.op === 'arc')
    expect(arcs).toHaveLength(1)
    expect(arcs[0]?.args[0]).toBe(48)
    expect(arcs[0]?.args[1]).toBe(48)

    const arcIndex = calls.indexOf(arcs[0]!)
    const fillAfterArc = calls.slice(arcIndex).find((c) => c.op === 'fill')
    expect(fillAfterArc?.fillStyle).toBe(OBJECT_COLORS.door)
  })

  it('draws objects in array order so the later one lands on top', () => {
    const { ctx, calls } = makeFakeCtx()
    let model = applyCommand(createEmptyMap(3, 3), {
      kind: 'addObject',
      x: 0,
      y: 0,
      kindId: 'door',
    })
    model = applyCommand(model, { kind: 'addObject', x: 2, y: 2, kindId: 'chest' })

    renderMap(ctx, model, baseViewport())

    const fills = calls.filter((c) => c.op === 'fill')
    expect(fills).toHaveLength(2)
    expect(fills[0]?.fillStyle).toBe(OBJECT_COLORS.door)
    expect(fills[1]?.fillStyle).toBe(OBJECT_COLORS.chest)
  })

  it('culls objects outside the viewport', () => {
    const { ctx, calls } = makeFakeCtx()
    const model = applyCommand(createEmptyMap(20, 20), {
      kind: 'addObject',
      x: 15,
      y: 15,
      kindId: 'door',
    })

    renderMap(ctx, model, baseViewport()) // видно 3×3 клетки

    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(0)
  })

  it('falls back to a neutral color for an unknown object kind', () => {
    const { ctx, calls } = makeFakeCtx()
    const model: MapModel = {
      ...createEmptyMap(3, 3),
      objects: [{ id: 1, kindId: 'dragon', x: 1, y: 1 }],
    }

    renderMap(ctx, model, baseViewport())

    const arcIndex = calls.findIndex((c) => c.op === 'arc')
    expect(arcIndex).toBeGreaterThanOrEqual(0)
    const fillAfterArc = calls.slice(arcIndex).find((c) => c.op === 'fill')
    expect(fillAfterArc?.fillStyle).toBe(FALLBACK_OBJECT_COLOR)
  })
})

describe('renderMap (hex)', () => {
  const SIZE = 32

  function hexViewport(gridType: 'hex-pointy' | 'hex-flat', cols: number, rows: number): Viewport {
    const bounds = mapPixelBounds(cols, rows, gridType, SIZE)
    return { width: bounds.width, height: bounds.height, cellSize: SIZE, offsetX: 0, offsetY: 0 }
  }

  function makeHexModel(gridType: 'hex-pointy' | 'hex-flat'): MapModel {
    return applyCommand(createEmptyMap(3, 3, gridType), {
      kind: 'setTile',
      x: 1,
      y: 1,
      tile: FLOOR,
    })
  }

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: fills one polygon per cell and strokes edges in one path',
    (gridType) => {
      const { ctx, calls } = makeFakeCtx()
      renderMap(ctx, makeHexModel(gridType), hexViewport(gridType, 3, 3))

      const fills = calls.filter((c) => c.op === 'fill')
      expect(fills).toHaveLength(9)
      // 9 клеток заливки + один общий путь рёбер сетки.
      expect(calls.filter((c) => c.op === 'beginPath')).toHaveLength(10)
      const edgeStroke = calls.filter((c) => c.op === 'stroke')
      expect(edgeStroke.length).toBeGreaterThanOrEqual(1)
      expect(edgeStroke[0]?.fillStyle).toBe(GRID_LINE_COLOR)
    },
  )

  it('paints the painted hex with the palette color', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, makeHexModel('hex-pointy'), hexViewport('hex-pointy', 3, 3))

    const floorFills = calls.filter((c) => c.op === 'fill' && c.fillStyle === TILE_COLORS.floor)
    expect(floorFills).toHaveLength(1)
  })

  it('draws an object at the hex center of its cell', () => {
    const { ctx, calls } = makeFakeCtx()
    let model = createEmptyMap(3, 3, 'hex-pointy')
    model = applyCommand(model, { kind: 'addObject', x: 1, y: 1, kindId: 'door' })

    const viewport = hexViewport('hex-pointy', 3, 3)
    renderMap(ctx, model, viewport)

    const arcs = calls.filter((c) => c.op === 'arc')
    expect(arcs).toHaveLength(1)
    const center = cellCenterAt(1, 1, 'hex-pointy', SIZE)
    expect(arcs[0]?.args[0]).toBeCloseTo(center.x, 6)
    expect(arcs[0]?.args[1]).toBeCloseTo(center.y, 6)
  })

  it.each([
    ['hex-pointy', 32],
    ['hex-flat', 64],
  ] as const)('%s @%ipx: culls hex cells fully outside the viewport', (gridType, size) => {
    const { ctx, calls } = makeFakeCtx()
    const far: Viewport = {
      width: 96,
      height: 96,
      cellSize: size,
      offsetX: 100000,
      offsetY: 100000,
    }
    renderMap(ctx, createEmptyMap(20, 20, gridType), far)

    expect(calls.filter((c) => c.op === 'fill')).toHaveLength(0)
    // Рёбра тоже не рисуются: путь остаётся пустым.
    expect(calls.filter((c) => c.op === 'moveTo')).toHaveLength(0)
  })

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: empty when the viewport is fully before the map',
    (gridType) => {
      const { ctx, calls } = makeFakeCtx()
      renderMap(ctx, createEmptyMap(10, 10, gridType), {
        width: 96,
        height: 96,
        cellSize: SIZE,
        offsetX: -50000,
        offsetY: -50000,
      })

      expect(calls.filter((c) => c.op === 'fill')).toHaveLength(0)
      expect(calls.filter((c) => c.op === 'moveTo')).toHaveLength(0)
    },
  )

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: renders only the visible window of a large hex map',
    (gridType) => {
      const { ctx, calls } = makeFakeCtx()
      const viewport: Viewport = {
        width: 320,
        height: 240,
        cellSize: SIZE,
        offsetX: 100,
        offsetY: 60,
      }
      renderMap(ctx, createEmptyMap(40, 40, gridType), viewport)

      // Независимый брутфорс: клетка видима, если её полигон пересекает
      // вьюпорт (пересечение по ограничивающему прямоугольнику клетки).
      const orientation = gridType === 'hex-pointy' ? 'pointy' : 'flat'
      const corners = cellCorners(orientation, SIZE)
      let bruteForce = 0
      for (let row = 0; row < 40; row += 1) {
        for (let col = 0; col < 40; col += 1) {
          const center = cellCenterAt(col, row, gridType, SIZE)
          const xs = corners.map(([cx]) => center.x - viewport.offsetX + cx)
          const ys = corners.map(([, cy]) => center.y - viewport.offsetY + cy)
          if (
            Math.max(...xs) >= 0 &&
            Math.min(...xs) <= viewport.width &&
            Math.max(...ys) >= 0 &&
            Math.min(...ys) <= viewport.height
          ) {
            bruteForce += 1
          }
        }
      }

      // Culling дискриминируем в обе стороны: не рисуем меньше видимых клеток
      // (нижняя граница — брутфорс пересечений) и не рисуем карту целиком
      // (верхняя граница — площадь консервативного диапазона).
      const fills = calls.filter((c) => c.op === 'fill')
      const range = visibleCellRange(viewport, 40, 40, gridType)
      const maxDraw = (range.lastCol - range.firstCol + 1) * (range.lastRow - range.firstRow + 1)
      expect(fills.length).toBeGreaterThanOrEqual(bruteForce)
      expect(fills.length).toBeLessThanOrEqual(maxDraw)
      expect(maxDraw).toBeLessThan(200)
    },
  )

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: keeps every corner of visible cells inside export-sized canvas',
    (gridType) => {
      const { ctx, calls } = makeFakeCtx()
      const cols = 5
      const rows = 4
      const bounds = mapPixelBounds(cols, rows, gridType, SIZE)
      const viewport = hexViewport(gridType, cols, rows)
      renderMap(ctx, createEmptyMap(cols, rows, gridType), viewport)

      for (const call of calls.filter((c) => c.op === 'moveTo' || c.op === 'lineTo')) {
        const [x, y] = call.args as [number, number]
        expect(x).toBeGreaterThanOrEqual(-1e-9)
        expect(y).toBeGreaterThanOrEqual(-1e-9)
        expect(x).toBeLessThanOrEqual(bounds.width + 1e-9)
        expect(y).toBeLessThanOrEqual(bounds.height + 1e-9)
      }
    },
  )
})

describe('renderMap (sprites)', () => {
  const SIZE = 32
  const floorSprite = { width: 16 } as unknown as HTMLImageElement
  const atlas = { tiles: { floor: floorSprite }, objects: {} }

  function hexViewport(gridType: 'hex-pointy' | 'hex-flat', cols: number, rows: number): Viewport {
    const bounds = mapPixelBounds(cols, rows, gridType, SIZE)
    return { width: bounds.width, height: bounds.height, cellSize: SIZE, offsetX: 0, offsetY: 0 }
  }

  function makeHexModel(gridType: 'hex-pointy' | 'hex-flat'): MapModel {
    return applyCommand(createEmptyMap(3, 3, gridType), {
      kind: 'setTile',
      x: 1,
      y: 1,
      tile: FLOOR,
    })
  }

  it('square: draws a sprite exactly into its cell without clip', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    renderMap(ctx, makeModel(), baseViewport(), atlas)

    const draws = calls.filter((c) => c.op === 'drawImage')
    expect(draws).toHaveLength(1)
    expect(draws[0]?.args).toEqual([floorSprite, 32, 32, 32, 32])
    // Квадратная ветка обходится без save/clip — бюджет производительности.
    expect(calls.some((c) => c.op === 'save')).toBe(false)
    expect(calls.some((c) => c.op === 'clip')).toBe(false)
    // Сглаживание выключено на время рендера и возвращено после.
    expect(raw.imageSmoothingEnabled).toBe(true)
  })

  it('square: falls back to color fill when the tile has no sprite', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, makeModel(), baseViewport(), { tiles: {}, objects: {} })

    // Ни одного drawImage: у 'empty' и 'floor' нет записей в атласе.
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
    const floorFill = calls.find((c) => c.op === 'fillRect' && c.args[0] === 32 && c.args[1] === 32)
    expect(floorFill?.fillStyle).toBe(TILE_COLORS.floor)
  })

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: clips the polygon and stretches the sprite over the cell bbox',
    (gridType) => {
      const { ctx, calls } = makeFakeCtx()
      renderMap(ctx, makeHexModel(gridType), hexViewport(gridType, 3, 3), atlas)

      const center = cellCenterAt(1, 1, gridType, SIZE)
      const drawIndex = calls.findIndex((c) => c.op === 'drawImage')
      expect(drawIndex).toBeGreaterThanOrEqual(0)
      expect(calls[drawIndex]?.args).toEqual([
        floorSprite,
        center.x - SIZE,
        center.y - SIZE,
        SIZE * 2,
        SIZE * 2,
      ])
      // Порядок на клетку со спрайтом: beginPath → trace → save → clip → draw → restore.
      expect(calls[drawIndex - 1]?.op).toBe('clip')
      expect(calls[drawIndex - 2]?.op).toBe('save')
      expect(calls[drawIndex + 1]?.op).toBe('restore')
      // Clip ровно один на весь кадр — только клетка со спрайтом.
      expect(calls.filter((c) => c.op === 'clip')).toHaveLength(1)
      // Путь перед clip — полигон клетки: moveTo + 5 lineTo + closePath,
      // стартующий в первой вершине гекса относительно центра.
      const saveIndex = drawIndex - 2
      let start = saveIndex
      while (start > 0 && calls[start]?.op !== 'beginPath') start -= 1
      const pathOps = calls.slice(start + 1, saveIndex)
      const corners = cellCorners(gridType === 'hex-pointy' ? 'pointy' : 'flat', SIZE)
      expect(pathOps[0]?.op).toBe('moveTo')
      expect(pathOps[0]?.args).toEqual([center.x + corners[0][0], center.y + corners[0][1]])
      expect(pathOps.filter((c) => c.op === 'lineTo')).toHaveLength(5)
      expect(pathOps.at(-1)?.op).toBe('closePath')
    },
  )

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: fills hexes without sprites with palette color',
    (gridType) => {
      const { ctx, calls } = makeFakeCtx()
      renderMap(ctx, makeHexModel(gridType), hexViewport(gridType, 3, 3), {
        tiles: {},
        objects: {},
      })

      // 9 клеток цветом, ни одного drawImage/save.
      expect(calls.filter((c) => c.op === 'fill')).toHaveLength(9)
      expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
      expect(calls.some((c) => c.op === 'save')).toBe(false)
    },
  )
})

describe('renderMap (object sprites)', () => {
  const SIZE = 32

  function hexViewport(gridType: 'hex-pointy' | 'hex-flat', cols: number, rows: number): Viewport {
    const bounds = mapPixelBounds(cols, rows, gridType, SIZE)
    return { width: bounds.width, height: bounds.height, cellSize: SIZE, offsetX: 0, offsetY: 0 }
  }

  function makeModelWithDoor(gridType: 'square' | 'hex-pointy' | 'hex-flat'): MapModel {
    return applyCommand(createEmptyMap(3, 3, gridType), {
      kind: 'addObject',
      x: 1,
      y: 1,
      kindId: 'door',
    })
  }

  it('square: draws an object sprite over the cell instead of a circle', () => {
    const doorSprite = { width: 16 } as unknown as HTMLImageElement
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, makeModelWithDoor('square'), baseViewport(), {
      tiles: {},
      objects: { door: doorSprite },
    })

    const draws = calls.filter((c) => c.op === 'drawImage')
    expect(draws).toHaveLength(1)
    // Центр клетки (48, 48), сторона = cellSize.
    expect(draws[0]?.args).toEqual([doorSprite, 32, 32, 32, 32])
    expect(calls.some((c) => c.op === 'arc')).toBe(false)
  })

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: an object sprite covers the hex bbox',
    (gridType) => {
      const doorSprite = { width: 16 } as unknown as HTMLImageElement
      const { ctx, calls } = makeFakeCtx()
      renderMap(ctx, makeModelWithDoor(gridType), hexViewport(gridType, 3, 3), {
        tiles: {},
        objects: { door: doorSprite },
      })

      const center = cellCenterAt(1, 1, gridType, SIZE)
      const draws = calls.filter((c) => c.op === 'drawImage')
      expect(draws).toHaveLength(1)
      expect(draws[0]?.args).toEqual([
        doorSprite,
        center.x - SIZE,
        center.y - SIZE,
        SIZE * 2,
        SIZE * 2,
      ])
      expect(calls.some((c) => c.op === 'arc')).toBe(false)
    },
  )

  it('falls back to the color circle when the kind has no sprite', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, makeModelWithDoor('square'), baseViewport(), {
      tiles: {},
      objects: {},
    })

    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
    expect(calls.some((c) => c.op === 'arc')).toBe(true)
  })
})
