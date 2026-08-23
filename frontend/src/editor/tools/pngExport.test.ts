import { describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { CANVAS_BACKGROUND_COLOR } from '../render/colors'
import { makeFakeCtx } from '../render/testFakeCtx'
import { exportMapToPng } from './pngExport'

const FLOOR = 1

function stubCanvasRenderingContext() {
  const { ctx, calls } = makeFakeCtx()
  const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  return { getContextSpy, calls }
}

function stubToBlob(blob: Blob | null): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: (blob: Blob | null) => void,
  ) {
    callback(blob)
  })
}

describe('exportMapToPng', () => {
  it('rejects maps wider than the canvas side limit', async () => {
    await expect(exportMapToPng(createEmptyMap(300, 10), 100)).rejects.toThrow(
      /exceeds canvas limits/,
    )
  })

  it('rejects maps whose pixel area exceeds the area limit', async () => {
    // 300×300 клеток × 64px = 368 Мпикс > лимита 128 Мпикс.
    await expect(exportMapToPng(createEmptyMap(300, 300))).rejects.toThrow(/exceeds canvas limits/)
  })

  it('renders the full map and resolves with a PNG blob', async () => {
    const { ctx, calls, getContextSpy } = stubCanvasRenderingContext()
    const toBlobSpy = stubToBlob(new Blob(['png-bytes'], { type: 'image/png' }))
    try {
      const model = applyCommand(createEmptyMap(3, 3), {
        kind: 'setTile',
        x: 0,
        y: 0,
        tile: FLOOR,
      })

      const blob = await exportMapToPng(model)

      expect(blob.type).toBe('image/png')
      expect(toBlobSpy).toHaveBeenCalledTimes(1)
      // renderMap отрисовал фон в полном размере 3×64 без зума и смещения.
      const background = calls.find(
        (c) => c.op === 'fillRect' && c.fillStyle === CANVAS_BACKGROUND_COLOR,
      )
      expect(background).toMatchObject({ args: [0, 0, 192, 192] })
      void ctx
    } finally {
      getContextSpy.mockRestore()
      toBlobSpy.mockRestore()
    }
  })

  it('rejects when a 2D context is unavailable', async () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    try {
      await expect(exportMapToPng(createEmptyMap(2, 2))).rejects.toThrow(
        '2D context is unavailable',
      )
    } finally {
      getContextSpy.mockRestore()
    }
  })
})
