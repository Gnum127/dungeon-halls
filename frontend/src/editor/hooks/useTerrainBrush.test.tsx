import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { cellCenterAt } from '../render/gridGeometry'
import { createEmptyMap } from '../model/createEmptyMap'
import { TILE_TYPES } from '../model/types'
import type { Command } from '../model/commands'
import type { Viewport } from '../render/viewport'
import { useTerrainBrush } from './useTerrainBrush'

const FLOOR = TILE_TYPES.indexOf('floor')

function makeViewport(): Viewport {
  return { width: 320, height: 240, cellSize: 32, offsetX: 0, offsetY: 0 }
}

interface ProbeProps {
  onCommit: (command: Command | null) => void
  active?: boolean
  gridType?: 'square' | 'hex-pointy' | 'hex-flat'
}

function Probe({ onCommit, active = true, gridType = 'square' }: ProbeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<Viewport>(makeViewport())
  const model = createEmptyMap(8, 8, gridType)
  const { pendingCells, handlers } = useTerrainBrush({
    canvasRef,
    active,
    model,
    tile: FLOOR,
    viewportRef,
    onCommit,
  })
  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas"
      data-pending={String(pendingCells.length)}
      {...handlers}
    />
  )
}

type Phase = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'

function pointer(target: Element, phase: Phase, init: Record<string, unknown> = {}): boolean {
  const defaults = { pointerId: 1, button: 0, buttons: 1, clientX: 40, clientY: 80 }
  switch (phase) {
    case 'pointerdown':
      return fireEvent.pointerDown(target, { ...defaults, ...init })
    case 'pointermove':
      return fireEvent.pointerMove(target, { ...defaults, ...init })
    case 'pointerup':
      return fireEvent.pointerUp(target, { ...defaults, ...init })
    case 'pointercancel':
      // В RTL нет пресета pointercancel — собираем событие вручную.
      return fireEvent(
        target,
        Object.assign(new Event('pointercancel', { bubbles: true }), {
          ...defaults,
          ...init,
        }),
      )
  }
}

describe('useTerrainBrush', () => {
  it('collects cells during drag and commits one command on release', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', { clientX: 40, clientY: 80 })
    expect(getByTestId('canvas').dataset.pending).toBe('1')

    pointer(canvas, 'pointermove', { clientX: 72, clientY: 80 })
    pointer(canvas, 'pointermove', { clientX: 72, clientY: 112 })
    expect(getByTestId('canvas').dataset.pending).toBe('3')

    pointer(canvas, 'pointerup', { buttons: 0 })
    expect(onCommit).toHaveBeenCalledTimes(1)
    const command = onCommit.mock.calls[0][0] as Command
    expect(command.kind).toBe('setTiles')
    if (command.kind === 'setTiles') {
      expect(command.updates).toEqual([
        { x: 1, y: 2, tile: FLOOR },
        { x: 2, y: 2, tile: FLOOR },
        { x: 2, y: 3, tile: FLOOR },
      ])
    }
    expect(getByTestId('canvas').dataset.pending).toBe('0')
  })

  it('releasing the button outside the window finishes the stroke', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', {})
    pointer(canvas, 'pointermove', { buttons: 0 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(getByTestId('canvas').dataset.pending).toBe('0')
  })

  it('pointer cancel discards the stroke without committing', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', {})
    pointer(canvas, 'pointermove', { clientX: 100 })
    pointer(canvas, 'pointercancel', { buttons: 0 })

    expect(onCommit).not.toHaveBeenCalled()
    expect(getByTestId('canvas').dataset.pending).toBe('0')

    pointer(canvas, 'pointermove', { buttons: 1, clientX: 120 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('ignores non-left buttons and inactive state', () => {
    const onCommit = vi.fn()
    const { getByTestId, rerender } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', { button: 2, buttons: 2 })
    pointer(canvas, 'pointerdown', { button: 1, buttons: 4 })
    expect(onCommit).not.toHaveBeenCalled()

    rerender(<Probe onCommit={onCommit} active={false} />)
    pointer(canvas, 'pointerdown', { button: 0, buttons: 1 })
    pointer(canvas, 'pointermove', { buttons: 1 })
    expect(onCommit).not.toHaveBeenCalled()
    expect(getByTestId('canvas').dataset.pending).toBe('0')
  })

  it('empty stroke (outside the map) commits null', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    // Вне карты 8x8 при cellSize=32: клиентские координаты > 256px.
    pointer(canvas, 'pointerdown', { clientX: 500, clientY: 500 })
    pointer(canvas, 'pointerup', { buttons: 0 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit.mock.calls[0][0]).toBeNull()
  })

  it('ignores events from a foreign pointer during an active stroke', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', { pointerId: 1 })
    pointer(canvas, 'pointermove', { pointerId: 2, clientX: 100, clientY: 40 })
    expect(getByTestId('canvas').dataset.pending).toBe('1')

    pointer(canvas, 'pointerup', { pointerId: 2, buttons: 0 })
    expect(onCommit).not.toHaveBeenCalled()

    pointer(canvas, 'pointerup', { pointerId: 1, buttons: 0 })
    expect(onCommit).toHaveBeenCalledTimes(1)
    const command = onCommit.mock.calls[0][0] as Command
    if (command.kind === 'setTiles') {
      expect(command.updates).toEqual([{ x: 1, y: 2, tile: FLOOR }])
    }
  })

  it('deduplicates cells visited twice in one stroke', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', { clientX: 40, clientY: 80 })
    pointer(canvas, 'pointermove', { clientX: 72, clientY: 80 })
    pointer(canvas, 'pointermove', { clientX: 45, clientY: 85 })
    pointer(canvas, 'pointerup', { buttons: 0 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    const command = onCommit.mock.calls[0][0] as Command
    if (command.kind === 'setTiles') {
      expect(command.updates).toHaveLength(2)
    }
  })

  describe('hex grid', () => {
    const SIZE = 32

    function hexCenter(col: number, row: number): { x: number; y: number } {
      return cellCenterAt(col, row, 'hex-pointy', SIZE)
    }

    function flatCenter(col: number, row: number): { x: number; y: number } {
      return cellCenterAt(col, row, 'hex-flat', SIZE)
    }

    it.each(['hex-pointy', 'hex-flat'] as const)('%s: paints exactly the hex under the click', (gridType) => {
      const onCommit = vi.fn()
      const { getByTestId } = render(<Probe onCommit={onCommit} gridType={gridType} />)
      const canvas = getByTestId('canvas')

      const center =
        gridType === 'hex-pointy' ? hexCenter(3, 4) : flatCenter(3, 4)
      pointer(canvas, 'pointerdown', { clientX: center.x, clientY: center.y })
      pointer(canvas, 'pointerup', { buttons: 0 })

      expect(onCommit).toHaveBeenCalledTimes(1)
      const command = onCommit.mock.calls[0][0] as Command
      expect(command.kind).toBe('setTiles')
      if (command.kind === 'setTiles') {
        expect(command.updates).toEqual([{ x: 3, y: 4, tile: FLOOR }])
      }
    })

    it.each(['hex-pointy', 'hex-flat'] as const)(
      '%s: drag collects the hexes under the stroke path',
      (gridType) => {
        const onCommit = vi.fn()
        const { getByTestId } = render(<Probe onCommit={onCommit} gridType={gridType} />)
        const canvas = getByTestId('canvas')

        const from = gridType === 'hex-pointy' ? hexCenter(2, 2) : flatCenter(2, 2)
        const to = gridType === 'hex-pointy' ? hexCenter(3, 3) : flatCenter(3, 3)
        pointer(canvas, 'pointerdown', { clientX: from.x, clientY: from.y })
        pointer(canvas, 'pointermove', { clientX: to.x, clientY: to.y })
        pointer(canvas, 'pointerup', { buttons: 0 })

        expect(onCommit).toHaveBeenCalledTimes(1)
        const command = onCommit.mock.calls[0][0] as Command
        expect(command.kind).toBe('setTiles')
        if (command.kind === 'setTiles') {
          expect(command.updates).toEqual([
            { x: 2, y: 2, tile: FLOOR },
            { x: 3, y: 3, tile: FLOOR },
          ])
        }
        expect(getByTestId('canvas').dataset.pending).toBe('0')
      },
    )
  })
})
