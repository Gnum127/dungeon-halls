import { describe, expect, it, vi } from 'vitest'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { mergePointerHandlers } from './pointerHandlers'

function fakeEvent(): ReactPointerEvent<HTMLCanvasElement> {
  return {} as ReactPointerEvent<HTMLCanvasElement>
}

describe('mergePointerHandlers', () => {
  it('calls the same phase handler of every set', () => {
    const panDown = vi.fn()
    const brushDown = vi.fn()
    const merged = mergePointerHandlers({ onPointerDown: panDown }, { onPointerDown: brushDown })

    merged.onPointerDown(fakeEvent())

    expect(panDown).toHaveBeenCalledTimes(1)
    expect(brushDown).toHaveBeenCalledTimes(1)
  })

  it('skips missing handlers instead of throwing', () => {
    const move = vi.fn()
    const merged = mergePointerHandlers({}, { onPointerMove: move })

    expect(() => merged.onPointerMove(fakeEvent())).not.toThrow()
    expect(move).toHaveBeenCalledTimes(1)
    expect(() => merged.onPointerCancel(fakeEvent())).not.toThrow()
  })

  it('keeps pan alive next to the brush (regression: spread overwrote handlers)', () => {
    const panDown = vi.fn()
    const brushDown = vi.fn()
    const panMove = vi.fn()
    const brushMove = vi.fn()

    // Порядок как в CanvasView: пан первым, кисть вторым.
    const merged = mergePointerHandlers(
      { onPointerDown: panDown, onPointerMove: panMove },
      { onPointerDown: brushDown, onPointerMove: brushMove },
    )

    merged.onPointerDown(fakeEvent())
    merged.onPointerMove(fakeEvent())

    expect(panDown).toHaveBeenCalledTimes(1)
    expect(brushDown).toHaveBeenCalledTimes(1)
    expect(panMove).toHaveBeenCalledTimes(1)
    expect(brushMove).toHaveBeenCalledTimes(1)
  })
})
