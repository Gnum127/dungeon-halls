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
  vertexCount?: number
}

function Probe({ onCommit, active = true, tile = 1, vertexCount = 6 }: ProbeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<Viewport>(makeViewport())
  const model = createEmptyMap(8, 8)
  const { preview, handlers } = usePolygonRoomTool({
    canvasRef,
    active,
    model,
    tile,
    vertexCount,
    viewportRef,
    onCommit,
  })
  const label = preview
    ? `center=${preview.center.x},${preview.center.y};radial=${preview.radial ? `${preview.radial.x},${preview.radial.y}` : 'null'};verts=${preview.vertices.map((v) => `${v.x},${v.y}`).join('|')}`
    : ''
  return <canvas ref={canvasRef} data-testid="canvas" data-preview={label} {...handlers} />
}

const CELL = 32

function clickAt(target: Element, x: number, y: number): void {
  fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: x * CELL + 16, clientY: y * CELL + 16 })
  fireEvent.pointerUp(target, { pointerId: 1, button: 0, clientX: x * CELL + 16, clientY: y * CELL + 16 })
}

function moveTo(target: Element, x: number, y: number): void {
  fireEvent.pointerMove(target, { pointerId: 1, clientX: x * CELL + 16, clientY: y * CELL + 16 })
}

describe('usePolygonRoomTool', () => {
  it('the first click places the center without committing', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)

    expect(canvas.dataset.preview).toBe('center=4,4;radial=null;verts=')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('moving the cursor after the center previews the polygon live', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    moveTo(canvas, 7, 4)

    expect(canvas.dataset.preview).toContain('radial=7,4')
    expect(canvas.dataset.preview).toContain('verts=7,4|')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('the second click commits one addRoom and returns to idle', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    moveTo(canvas, 7, 4)
    clickAt(canvas, 7, 4)

    expect(onCommit).toHaveBeenCalledTimes(1)
    const command = onCommit.mock.calls[0][0] as Command
    expect(command.kind).toBe('addRoom')
    if (command.kind === 'addRoom') {
      expect(command.tiles.length).toBeGreaterThan(0)
      expect(command.walls.length).toBeGreaterThan(0)
    }
    expect(canvas.dataset.preview).toBe('')
  })

  it('builds a regular polygon with the requested vertex count', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} vertexCount={4} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    moveTo(canvas, 7, 4)

    // Квадрат: 4 вершины, первая — на радиальной точке.
    const verts = canvas.dataset.preview?.split(';').find((part) => part.startsWith('verts=')) ?? ''
    expect(verts).toBe('verts=7,4|4,7|1,4|3,1')
  })

  it('a second click on the center cell (zero radius) does not commit', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    clickAt(canvas, 4, 4)

    expect(onCommit).not.toHaveBeenCalled()
    expect(canvas.dataset.preview).toBe('center=4,4;radial=4,4;verts=')

    // Следующий клик в другую клетку всё ещё коммитит размещение.
    moveTo(canvas, 7, 4)
    clickAt(canvas, 7, 4)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('Esc cancels the pending polygon', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    moveTo(canvas, 7, 4)
    fireEvent.keyDown(window, { code: 'Escape' })

    expect(onCommit).not.toHaveBeenCalled()
    expect(canvas.dataset.preview).toBe('')
  })

  it('Enter no longer commits (the second click does)', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    fireEvent.keyDown(window, { code: 'Enter' })

    expect(onCommit).not.toHaveBeenCalled()
    expect(canvas.dataset.preview).toContain('center=4,4')
  })

  it('clicks outside the map do nothing', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 20, 20)
    expect(canvas.dataset.preview).toBe('')

    clickAt(canvas, 2, 2)
    clickAt(canvas, 30, 2)
    expect(onCommit).not.toHaveBeenCalled()
    expect(canvas.dataset.preview).toBe('center=2,2;radial=null;verts=')
  })

  it('moving outside the map hides the radial preview', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    moveTo(canvas, 30, 4)

    expect(canvas.dataset.preview).toBe('center=4,4;radial=null;verts=')
  })

  it('ignores events when inactive', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Probe onCommit={onCommit} active={false} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    moveTo(canvas, 7, 4)
    clickAt(canvas, 7, 4)
    fireEvent.keyDown(window, { code: 'Escape' })

    expect(canvas.dataset.preview).toBe('')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('deactivating mid-gesture clears the pending placement', () => {
    const onCommit = vi.fn()
    const { getByTestId, rerender } = render(<Probe onCommit={onCommit} />)
    const canvas = getByTestId('canvas')

    clickAt(canvas, 4, 4)
    expect(canvas.dataset.preview).toContain('center=4,4')

    rerender(<Probe onCommit={onCommit} active={false} />)
    expect(canvas.dataset.preview).toBe('')
  })
})