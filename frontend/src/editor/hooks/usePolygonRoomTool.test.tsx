import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { createEmptyMap } from '../model/createEmptyMap'
import type { Command } from '../model/commands'
import type { Viewport } from '../render/viewport'
import { usePolygonRoomTool } from './usePolygonRoomTool'

function makeViewport(): Viewport {
  return { width: 320, height: 240, cellSize: 32, offsetX: 0, offsetY: 0 }
}

interface ProbeProps {
  onCommit: (command: Command | null) => void
  active?: boolean
  tile?: number
}

function Probe({ onCommit, active = true, tile = 1 }: ProbeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<Viewport>(makeViewport())
  const model = createEmptyMap(8, 8)
  const { vertices, handlers } = usePolygonRoomTool({
    canvasRef,
    active,
    model,
    tile,
    viewportRef,
    onCommit,
  })
  const label = (vertices ?? []).map((v) => `${v.x},${v.y}`).join(';')
  return <canvas ref={canvasRef} data-testid="canvas" data-verts={label} {...handlers} />
}

const CELL = 32

function clickAt(target: Element, x: number, y: number): void {
  fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: x * CELL + 16, clientY: y * CELL + 16 })
  fireEvent.pointerUp(target, { pointerId: 1, button: 0, clientX: x * CELL + 16, clientY: y * CELL + 16 })
}

describe('usePolygonRoomTool', () => {
  it('places vertices on clicks', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 1, 1)
    clickAt(canvas, 3, 1)
    expect(getByTestId('canvas').dataset.verts).toBe('1,1;3,1')

    clickAt(canvas, 3, 3)
    expect(getByTestId('canvas').dataset.verts).toBe('1,1;3,1;3,3')
  })

  it('Enter completes the polygon into one addRoom command and clears vertices', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 1, 1)
    clickAt(canvas, 3, 1)
    clickAt(canvas, 3, 3)
    clickAt(canvas, 1, 3)
    fireEvent.keyDown(window, { code: 'Enter' })

    expect(onCommit).toHaveBeenCalledTimes(1)
    const command = onCommit.mock.calls[0][0] as Command
    expect(command.kind).toBe('addRoom')
    if (command.kind === 'addRoom') {
      // Блок 3×3 между кликнутыми углами (1,1)..(3,3).
      expect(command.tiles).toHaveLength(9)
    }
    expect(getByTestId('canvas').dataset.verts).toBe('')
  })

  it('Enter with fewer than three vertices does not commit', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 1, 1)
    clickAt(canvas, 3, 1)
    fireEvent.keyDown(window, { code: 'Enter' })

    expect(onCommit).not.toHaveBeenCalled()
    expect(getByTestId('canvas').dataset.verts).toBe('1,1;3,1')
  })

  it('Esc cancels the pending polygon', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 1, 1)
    clickAt(canvas, 3, 1)
    fireEvent.keyDown(window, { code: 'Escape' })

    expect(onCommit).not.toHaveBeenCalled()
    expect(getByTestId('canvas').dataset.verts).toBe('')
  })

  it('a double click completes the polygon', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 1, 1)
    clickAt(canvas, 3, 1)
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 3 * CELL + 16, clientY: 3 * CELL + 16 })
    fireEvent.dblClick(canvas, { clientX: 3 * CELL + 16, clientY: 3 * CELL + 16 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    const command = onCommit.mock.calls[0][0] as Command
    expect(command.kind).toBe('addRoom')
    expect(getByTestId('canvas').dataset.verts).toBe('')
  })

  it('ignores duplicate consecutive clicks in the same cell', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 2, 2)
    clickAt(canvas, 2, 2)
    clickAt(canvas, 4, 4)

    expect(getByTestId('canvas').dataset.verts).toBe('2,2;4,4')
  })

  it('a click outside the map does not add a vertex', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 20, 20)
    expect(getByTestId('canvas').dataset.verts).toBe('')

    clickAt(canvas, 2, 2)
    clickAt(canvas, 30, 2)
    expect(getByTestId('canvas').dataset.verts).toBe('2,2')
  })

  it('ignores events when inactive and without a pending polygon', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} active={false} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 1, 1)
    clickAt(canvas, 2, 2)
    clickAt(canvas, 3, 3)
    fireEvent.keyDown(window, { code: 'Enter' })

    expect(getByTestId('canvas').dataset.verts).toBe('')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Enter without a polygon in progress does nothing', () => {
    const onCommit = vi.fn()
    render(<Probe onCommit={onCommit} />)

    fireEvent.keyDown(window, { code: 'Enter' })
    expect(onCommit).not.toHaveBeenCalled()
  })
})