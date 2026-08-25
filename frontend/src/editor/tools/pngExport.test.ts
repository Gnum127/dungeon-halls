import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { CANVAS_BACKGROUND_COLOR } from '../render/colors'
import { mapPixelBounds } from '../render/gridGeometry'
import { makeFakeCtx } from '../render/testFakeCtx'
import { exportMapToPng } from './pngExport'

const FLOOR = 1

function stubCanvasRenderingContext() {
  const { ctx, calls } = makeFakeCtx()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  const created: HTMLCanvasElement[] = []
  const originalCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = originalCreate(tag)
    if (tag === 'canvas') created.push(element as HTMLCanvasElement)
    return element
  }) as typeof document.createElement)
  return { calls, created }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exportMapToPng', () => {
  it('rejects maps wider than the canvas side limit', async () => {
    await expect(exportMapToPng(createEmptyMap(300, 10), 100)).rejects.toThrow(
      /exceeds canvas limits/,
    )
  })

  it('rejects maps taller than the canvas side limit', async () => {
    await expect(exportMapToPng(createEmptyMap(10, 300), 100)).rejects.toThrow(
      /exceeds canvas limits/,
    )
  })

  it('rejects maps whose pixel area exceeds the area limit', async () => {
    // 200×200 клеток × 64px = 163 Мпикс: стороны проходят (12800 ≤ 16384),
    // площадь нет — единственная ветка, ловимая только этим тестом.
    await expect(exportMapToPng(createEmptyMap(200, 200))).rejects.toThrow(/exceeds canvas limits/)
  })

  it('rejects hex maps whose geometry exceeds the side limit', async () => {
    // Квадратная формула дала бы 10200×640 и прошла бы оба лимита;
    // геометрия pointy-гексов даёт ≈17802 > 16384 — только она ловится.
    await expect(exportMapToPng(createEmptyMap(160, 10, 'hex-pointy'))).rejects.toThrow(
      /exceeds canvas limits/,
    )
  })

  it('rejects hex-flat maps via the area limit while both sides pass', async () => {
    // Квадратная формула: 10800×9408 ≈ 101 Мпикс — прошла бы;
    // flat-геометрия: 16352×16351 ≈ 267 Мпикс > 134 Мпикс при сторонах < 16384.
    await expect(exportMapToPng(createEmptyMap(170, 147, 'hex-flat'))).rejects.toThrow(
      /exceeds canvas limits/,
    )
  })

  it('sizes the hex canvas from geometry bounds so edge cells fit', async () => {
    const { calls, created } = stubCanvasRenderingContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: (b: Blob | null) => void,
    ) {
      callback(new Blob(['png'], { type: 'image/png' }))
    })

    const gridType = 'hex-pointy'
    const model = createEmptyMap(3, 2, gridType)
    const bounds = mapPixelBounds(3, 2, gridType, 64)
    expect(bounds.width).toBeGreaterThan(3 * 64)

    await exportMapToPng(model)

    // canvas.width/height — целые: дробная часть геометрии округлена вверх.
    expect(created[0]?.width).toBe(Math.ceil(bounds.width))
    expect(created[0]?.height).toBe(Math.ceil(bounds.height))

    // Холст (фон) ровно по geometry-bounds — крайние клетки не обрезаны.
    const background = calls.find(
      (c) => c.op === 'fillRect' && c.fillStyle === CANVAS_BACKGROUND_COLOR,
    )
    expect(background?.args[0]).toBe(0)
    expect(background?.args[1]).toBe(0)
    expect(background?.args[2]).toBeCloseTo(Math.ceil(bounds.width), 6)
    expect(background?.args[3]).toBeCloseTo(Math.ceil(bounds.height), 6)

    // Все вершины полигонов внутри холста.
    for (const call of calls.filter((c) => c.op === 'moveTo' || c.op === 'lineTo')) {
      const [x, y] = call.args as [number, number]
      expect(x).toBeGreaterThanOrEqual(-1e-9)
      expect(y).toBeGreaterThanOrEqual(-1e-9)
      expect(x).toBeLessThanOrEqual(bounds.width + 1e-9)
      expect(y).toBeLessThanOrEqual(bounds.height + 1e-9)
    }
  })

  it('uses the flat orientation formula for hex-flat canvas size', async () => {
    const { calls } = stubCanvasRenderingContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: (b: Blob | null) => void,
    ) {
      callback(new Blob(['png'], { type: 'image/png' }))
    })

    const gridType = 'hex-flat'
    await exportMapToPng(createEmptyMap(3, 2, gridType))

    // Формула flat (1.5·cols+0.5 / √3·rows+0.5), не pointy и не квадратная;
    // холст целочисленный, поэтому дробная высота округлена вверх.
    const width = 64 * (1.5 * 3 + 0.5)
    const height = Math.sqrt(3) * 64 * (2 + 0.5)
    const background = calls.find(
      (c) => c.op === 'fillRect' && c.fillStyle === CANVAS_BACKGROUND_COLOR,
    )
    expect(background?.args[2]).toBeCloseTo(width, 6)
    expect(background?.args[3]).toBe(Math.ceil(height))
  })

  it('renders the full map and resolves with a PNG blob', async () => {
    const { calls } = stubCanvasRenderingContext()
    const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: (b: Blob | null) => void,
    ) {
      callback(new Blob(['png-bytes'], { type: 'image/png' }))
    })

    const model = applyCommand(createEmptyMap(3, 3), {
      kind: 'setTile',
      x: 0,
      y: 0,
      tile: FLOOR,
    })

    const blob = await exportMapToPng(model)

    expect(blob.type).toBe('image/png')
    expect(toBlobSpy).toHaveBeenCalledTimes(1)
    // renderMap работает в identity-трансформе и рисует фон полного размера.
    expect(calls[0]).toMatchObject({ op: 'setTransform', args: [1, 0, 0, 1, 0, 0] })
    const background = calls.find(
      (c) => c.op === 'fillRect' && c.fillStyle === CANVAS_BACKGROUND_COLOR,
    )
    expect(background).toMatchObject({ args: [0, 0, 192, 192] })
  })

  it('rejects when PNG encoding returns no blob', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(makeFakeCtx().ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: (blob: Blob | null) => void,
    ) {
      callback(null)
    })

    await expect(exportMapToPng(createEmptyMap(2, 2))).rejects.toThrow('PNG encoding failed')
  })

  it('rejects when a 2D context is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    await expect(exportMapToPng(createEmptyMap(2, 2))).rejects.toThrow('2D context is unavailable')
  })
})
