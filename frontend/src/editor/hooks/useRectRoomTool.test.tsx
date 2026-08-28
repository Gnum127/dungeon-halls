import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { createEmptyMap } from '../model/createEmptyMap'
import type { Command } from '../model/commands'
import type { Viewport } from '../render/viewport'
import { useRectRoomTool } from './useRectRoomTool'

function makeViewport(): Viewport {
  return { width: 320, height: 240, cellSize: 32, offsetX: 0, offsetY: 0 }
}

interface ProbeProps {
  onCommit: (command: Command | null) => void
  active?: boolean
}

function Probe({ onCommit, active = true }: ProbeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<Viewport>(makeViewport())
  const model = createEmptyMap(8, 8)
  const { preview, handlers } = useRectRoomTool({
    canvasRef,
    active,
    model,
    viewportRef,
    onCommit,
  })
  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas"
      data-preview={preview ? 'yes' : 'no'}
      {...handlers}
    />
  )
}

type Phase = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'

function pointer(target: Element, phase: Phase, init: Record<string, unknown> = {}): void {
  const defaults = { pointerId: 1, button: 0, buttons: 1, clientX: 16, clientY: 16 }
  switch (phase) {
    case 'pointerdown':
      fireEvent.pointerDown(target, { ...defaults, ...init })
      return
    case 'pointermove':
      fireEvent.pointerMove(target, { ...defaults, ...init })
      return
    case 'pointerup':
      fireEvent.pointerUp(target, { ...defaults, ...init })
      return
    case 'pointercancel':
      fireEvent(
        target,
        Object.assign(new Event('pointercancel', { bubbles: true }), {
          ...defaults,
          ...init,
        }),
      )
  }
}

const CELL = 32

describe('useRectRoomTool', () => {
  it('shows preview during the drag and commits one addRoom on release', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', { clientX: 1 * CELL + 16, clientY: 2 * CELL + 16 })
    expect(getByTestId('canvas').dataset.preview).toBe('yes')

    pointer(canvas, 'pointermove', { clientX: 4 * CELL + 16, clientY: 5 * CELL + 16 })
    pointer(canvas, 'pointerup', { buttons: 0 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    const command = onCommit.mock.calls[0][0] as Command
    expect(command.kind).toBe('addRoom')
    if (command.kind === 'addRoom') {
      expect(command.tiles).toHaveLength(4 * 4)
      expect(command.walls).toHaveLength(4 + 4 + 4 + 4)
    }
    expect(getByTestId('canvas').dataset.preview).toBe('no')
  })

  it('a plain click without dragging creates a single-cell room', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', { clientX: 3 * CELL + 16, clientY: 2 * CELL + 16 })
    pointer(canvas, 'pointerup', { buttons: 0 })

    const command = onCommit.mock.calls[0][0] as Command
    expect(command.kind).toBe('addRoom')
    if (command.kind === 'addRoom') {
      expect(command.tiles).toEqual([{ x: 3, y: 2, tile: 1 }])
      expect(command.walls).toHaveLength(4)
    }
  })

  it('clips the room to map bounds when dragging beyond the edge', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', { clientX: 2 * CELL + 16, clientY: 2 * CELL + 16 })
    pointer(canvas, 'pointermove', { clientX: 20 * CELL, clientY: 30 * CELL })
    pointer(canvas, 'pointerup', { buttons: 0 })

    const command = onCommit.mock.calls[0][0] as Command
    expect(command.kind).toBe('addRoom')
    if (command.kind === 'addRoom') {
      // Выделение 2..7 по обеим осям — 6×6 клеток.
      expect(command.tiles).toHaveLength(36)
      const uniqueTiles = new Set(command.tiles.map(({ x, y }) => `${x},${y}`))
      expect(uniqueTiles.has('7,7')).toBe(true)
      expect(uniqueTiles.has('2,2')).toBe(true)
    }
  })

  it('ignores events when the tool is inactive', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} active={false} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', {})
    pointer(canvas, 'pointerup', { buttons: 0 })

    expect(onCommit).not.toHaveBeenCalled()
    expect(getByTestId('canvas').dataset.preview).toBe('no')
  })

  it('does not start a drag outside the map', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', { clientX: -50, clientY: -50 })
    pointer(canvas, 'pointerup', { buttons: 0 })

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('pointer cancel discards the pending room', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    pointer(canvas, 'pointerdown', {})
    pointer(canvas, 'pointermove', { clientX: 4 * CELL + 16 })
    pointer(canvas, 'pointercancel', { buttons: 0 })

    expect(onCommit).not.toHaveBeenCalled()
    expect(getByTestId('canvas').dataset.preview).toBe('no')
  })
})