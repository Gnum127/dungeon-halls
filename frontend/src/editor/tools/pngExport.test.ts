import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { CANVAS_BACKGROUND_COLOR, TILE_COLORS } from '../render/colors'
import { mapPixelBounds } from '../render/gridGeometry'
import { makeFakeCtx } from '../render/testFakeCtx'
import { EXPORT_CELL_SIZE, exportMapToPng, renderToCanvas } from './pngExport'

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

  // Пункт 4.6: экспорт использует тот же режим отображения, что и холст.
  it('renders tiles and objects from the atlas when one is provided', async () => {
    const { calls, created } = stubCanvasRenderingContext()
    stubToBlobWithPng()

    const floorSprite = { width: 16 } as unknown as HTMLImageElement
    const doorSprite = { width: 16 } as unknown as HTMLImageElement
    const model = applyCommand(
      applyCommand(createEmptyMap(3, 3), { kind: 'setTile', x: 0, y: 0, tile: FLOOR }),
      { kind: 'addObject', x: 1, y: 1, kindId: 'door' },
    )

    await exportMapToPng(model, EXPORT_CELL_SIZE, {
      tiles: { floor: floorSprite },
      objects: { door: doorSprite },
    })

    const draws = calls.filter((c) => c.op === 'drawImage')
    expect(draws).toHaveLength(2)
    // Тайл (0,0) при 64px/клетку; объект рисуется в (0,0) после translate к центру клетки.
    expect(draws[0]?.args).toEqual([floorSprite, 0, 0, 64, 64])
    expect(draws[1]?.args).toEqual([doorSprite, -32, -32, 64, 64])
    expect(calls.some((c) => c.op === 'ellipse')).toBe(false)
    // Размеры холста считаются до рендера и от атласа не зависят.
    expect(created[0]?.width).toBe(192)
    expect(created[0]?.height).toBe(192)
  })

  function stubToBlobWithPng(): void {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: (b: Blob | null) => void,
    ) {
      callback(new Blob(['png'], { type: 'image/png' }))
    })
  }

  it('exports colors when the atlas is omitted', async () => {
    const { calls } = stubCanvasRenderingContext()
    const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
    stubToBlobWithPng()

    const model = applyCommand(createEmptyMap(3, 3), {
      kind: 'addObject',
      x: 1,
      y: 1,
      kindId: 'door',
    })
    await exportMapToPng(model)

    expect(toBlobSpy).toHaveBeenCalledTimes(1)
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
    expect(calls.filter((c) => c.op === 'ellipse')).toHaveLength(1)
  })

  it('falls back per item on a partial atlas', async () => {
    const { calls } = stubCanvasRenderingContext()
    stubToBlobWithPng()

    const floorSprite = { width: 16 } as unknown as HTMLImageElement
    // Тайл спрайтом, у двери записи нет → кружок.
    const model = applyCommand(
      applyCommand(createEmptyMap(3, 3), { kind: 'setTile', x: 2, y: 2, tile: FLOOR }),
      { kind: 'addObject', x: 1, y: 1, kindId: 'door' },
    )
    await exportMapToPng(model, EXPORT_CELL_SIZE, {
      tiles: { floor: floorSprite },
      objects: {},
    })

    const draws = calls.filter((c) => c.op === 'drawImage')
    expect(draws).toHaveLength(1)
    expect(draws[0]?.args[0]).toBe(floorSprite)
    expect(calls.filter((c) => c.op === 'ellipse')).toHaveLength(1)
  })
})

describe('renderToCanvas page rendering', () => {
  function stubCanvas() {
    return stubCanvasRenderingContext()
  }

  function lightModel(): ReturnType<typeof createEmptyMap> {
    return applyCommand(createEmptyMap(4, 4), {
      kind: 'addLight',
      x: 1,
      y: 1,
      radius: 2,
      color: '#ffd682',
    })
  }

  it('renders only the requested page with the matching offset', () => {
    const { calls, created } = stubCanvas()
    // Пол в клетке (2,2): однозначно связывает клетку карты с точкой страницы.
    const model = applyCommand(createEmptyMap(4, 4), { kind: 'setTile', x: 2, y: 2, tile: FLOOR })

    renderToCanvas(model, 64, undefined, {
      page: { col: 1, row: 1, cols: 2, rows: 2 },
    })

    // Холст размером страницы, не карты.
    expect(created[0]?.width).toBe(128)
    expect(created[0]?.height).toBe(128)
    const background = calls.find(
      (c) => c.op === 'fillRect' && c.fillStyle === CANVAS_BACKGROUND_COLOR,
    )
    expect(background?.args).toEqual([0, 0, 128, 128])

    // Клетка (2,2) карты рисуется в (64,64) страницы: смещение col/row × cellSize.
    // При нулевом смещении пол оказался бы за холстом (128,128).
    const floorFill = calls.find((c) => c.op === 'fillRect' && c.fillStyle === TILE_COLORS.floor)
    expect(floorFill?.args).toEqual([64, 64, 64, 64])
  })

  it('clips cells outside the page: only page cells intersect the canvas', () => {
    const { calls } = stubCanvas()
    const s = 64
    // Пол внутри страницы ((3,4)) и вне её ((0,0)): снаружи не рисуется.
    let model = applyCommand(createEmptyMap(6, 6), { kind: 'setTile', x: 3, y: 4, tile: FLOOR })
    model = applyCommand(model, { kind: 'setTile', x: 0, y: 0, tile: FLOOR })
    renderToCanvas(model, s, undefined, {
      page: { col: 2, row: 3, cols: 2, rows: 2 },
    })

    const floorFills = calls.filter((c) => c.op === 'fillRect' && c.fillStyle === TILE_COLORS.floor)
    // Ровно одна заливка пола, в позиции клетки (3,4) на странице: (64,64).
    expect(floorFills).toHaveLength(1)
    expect(floorFills[0]?.args).toEqual([s, s, s, s])
  })

  it('lets a small page render from a map that exceeds full-canvas limits', () => {
    stubCanvas()
    // Полная карта 200×200×64px превышает лимиты; страница 2×2 — нет.
    expect(() => renderToCanvas(createEmptyMap(200, 200))).toThrow(/exceeds canvas limits/)
    expect(() =>
      renderToCanvas(createEmptyMap(200, 200), 64, undefined, {
        page: { col: 100, row: 100, cols: 2, rows: 2 },
      }),
    ).not.toThrow()
  })

  it('skips lights when includeLight is false', () => {
    const { calls } = stubCanvas()
    renderToCanvas(lightModel(), 64, undefined, { includeLight: false })
    expect(calls.some((c) => c.op === 'arc')).toBe(false)
  })

  it('keeps lights by default', () => {
    const fullRender = stubCanvas()
    renderToCanvas(lightModel(), 64)
    expect(fullRender.calls.some((c) => c.op === 'arc')).toBe(true)
  })

  it('keeps lights on a page with includeLight true', () => {
    const pageRender = stubCanvas()
    renderToCanvas(lightModel(), 64, undefined, {
      page: { col: 0, row: 0, cols: 2, rows: 2 },
      includeLight: true,
    })
    expect(pageRender.calls.some((c) => c.op === 'arc')).toBe(true)
  })

  it('gives an incomplete last page full page size with margins', () => {
    const { calls, created } = stubCanvas()
    // Карта 5×3, страница 2×2: последняя колонка/ряд — поля, не уменьшение
    // холста (иначе страницы растянутся до разного масштаба при печати).
    renderToCanvas(createEmptyMap(5, 3), 64, undefined, {
      page: { col: 4, row: 2, cols: 1, rows: 1 },
      pageSize: { cols: 2, rows: 2 },
    })
    expect(created[0]?.width).toBe(128)
    expect(created[0]?.height).toBe(128)
    const background = calls.find(
      (c) => c.op === 'fillRect' && c.fillStyle === CANVAS_BACKGROUND_COLOR,
    )
    expect(background?.args).toEqual([0, 0, 128, 128])
    // Единственная клетка карты — в левом верхнем углу листа.
    const tileFill = calls.find((c) => c.op === 'fillRect' && c.fillStyle === TILE_COLORS.empty)
    expect(tileFill?.args[0]).toBe(0)
    expect(tileFill?.args[1]).toBe(0)
  })

  it('rejects invalid page windows', () => {
    stubCanvas()
    const model = createEmptyMap(4, 4)
    expect(() =>
      renderToCanvas(model, 64, undefined, { page: { col: -1, row: 0, cols: 2, rows: 2 } }),
    ).toThrow(RangeError)
    expect(() =>
      renderToCanvas(model, 64, undefined, { page: { col: 0, row: 0, cols: 0, rows: 2 } }),
    ).toThrow(RangeError)
  })

  it('rejects invalid or undersized pageSize', () => {
    stubCanvas()
    const model = createEmptyMap(4, 4)
    expect(() =>
      renderToCanvas(model, 64, undefined, {
        page: { col: 0, row: 0, cols: 2, rows: 2 },
        pageSize: { cols: -1, rows: 2 },
      }),
    ).toThrow(RangeError)
    // Страница меньше окна клеток молча обрезала бы контент.
    expect(() =>
      renderToCanvas(model, 64, undefined, {
        page: { col: 0, row: 0, cols: 3, rows: 3 },
        pageSize: { cols: 2, rows: 2 },
      }),
    ).toThrow(/smaller than the page window/)
  })

  it('rejects paged rendering of non-square grids', () => {
    stubCanvas()
    expect(() =>
      renderToCanvas(createEmptyMap(4, 4, 'hex-pointy'), 64, undefined, {
        page: { col: 0, row: 0, cols: 2, rows: 2 },
      }),
    ).toThrow(/square grids only/)
  })
})
