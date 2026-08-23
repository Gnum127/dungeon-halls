import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { CANVAS_BACKGROUND_COLOR } from '../render/colors'
import { makeFakeCtx } from '../render/testFakeCtx'
import { exportMapToPng } from './pngExport'

const FLOOR = 1

function stubCanvasRenderingContext() {
  const { ctx, calls } = makeFakeCtx()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  return { calls }
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
