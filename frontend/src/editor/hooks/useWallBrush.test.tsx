import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import { EditorStore } from '../store/EditorStore'
import { useWallBrush } from './useWallBrush'

const CELL = 32

function Harness({
  model,
  present,
  onCommit,
}: {
  model: MapModel
  present: boolean
  onCommit: (command: unknown) => void
}) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const viewport: Viewport = {
    width: 96,
    height: 96,
    cellSize: CELL,
    offsetX: 0,
    offsetY: 0,
  }
  // Ref-заглушка: актуальный viewport доступен сразу.
  const viewportRef = {
    current: viewport,
  } as unknown as React.RefObject<Viewport>
  const { handlers } = useWallBrush({
    canvasRef,
    active: true,
    model,
    present,
    viewportRef,
    onCommit: onCommit as never,
  })

  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function rect() {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 96,
    right: 96,
    width: 96,
    height: 96,
    toJSON: () => ({}),
  } as DOMRect
}

function setup(present = true) {
  const model = createEmptyMap(3, 3)
  const onCommit = vi.fn()
  render(<Harness model={model} present={present} onCommit={onCommit} />)
  const canvas = screen.getByTestId('canvas')
  canvas.getBoundingClientRect = rect
  return { canvas, onCommit }
}

function drag(canvas: HTMLElement, points: Array<[number, number]>): void {
  fireEvent.pointerDown(canvas, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: points[0][0],
    clientY: points[0][1],
  })
  for (const [x, y] of points.slice(1)) {
    fireEvent.pointerMove(canvas, { buttons: 1, pointerId: 1, clientX: x, clientY: y })
  }
  fireEvent.pointerUp(canvas, { pointerId: 1, buttons: 0 })
}

describe('useWallBrush', () => {
  it('commits one setWalls per stroke; a single store undo reverts it', () => {
    const store = new EditorStore(createEmptyMap(3, 3))
    const onCommit = vi.fn((command: unknown) => store.dispatch(command as never))
    render(<Harness model={store.getModel()} present onCommit={onCommit} />)
    const canvas = screen.getByTestId('canvas')
    canvas.getBoundingClientRect = () => rect()

    drag(canvas, [
      [34, 16],
      [48, 35],
    ])

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(store.getModel().walls).toHaveLength(2)
    // Один undo возвращает ровно до нуля стен — одна запись истории.
    store.undo()
    expect(store.getModel().walls).toEqual([])
  })

  it('eraser stroke commits present:false', () => {
    const { canvas, onCommit } = setup(false)
    drag(canvas, [[16, 0]])

    expect(onCommit).toHaveBeenCalledTimes(1)
    const command = onCommit.mock.calls[0][0] as { updates: Array<{ present: boolean }> }
    expect(command.updates[0]?.present).toBe(false)
  })

  it('pointercancel discards the stroke without committing', () => {
    const { canvas, onCommit } = setup()
    fireEvent.pointerDown(canvas, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 34,
      clientY: 16,
    })
    // fireEvent.pointercancel в vitest отсутствует — см. SKILL.md.
    fireEvent(
      canvas,
      Object.assign(new Event('pointercancel', { bubbles: true }), { pointerId: 1 }),
    )
    expect(onCommit).not.toHaveBeenCalled()
    // Повторный штрих после cancel работает.
    drag(canvas, [[16, 0]])
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('ignores strokes outside the map bounds', () => {
    const { canvas, onCommit } = setup()
    drag(canvas, [
      [-40, -40],
      [200, 200],
    ])
    expect(onCommit).toHaveBeenCalledWith(null)
  })

  // Сценарий roadmap 5.2: генерация (replaceMap) во время активного штриха —
  // без исключений, и в команду не попадают рёбра вне новых границ.
  it('survives a model replacement mid-stroke', () => {
    const big = createEmptyMap(3, 3)
    const small = createEmptyMap(1, 1)
    const onCommit = vi.fn()
    const { rerender } = render(<Harness model={big} present onCommit={onCommit} />)
    const canvas = screen.getByTestId('canvas')
    canvas.getBoundingClientRect = rect

    fireEvent.pointerDown(canvas, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 80,
      clientY: 80,
    })
    rerender(<Harness model={small} present onCommit={onCommit} />)

    expect(() => fireEvent.pointerUp(canvas, { pointerId: 1, buttons: 0 })).not.toThrow()

    if (onCommit.mock.calls.length > 0) {
      const command = onCommit.mock.calls[0][0] as {
        kind: string
        updates: Array<{ edge: { x: number; y: number } }>
      } | null
      for (const { edge } of command?.updates ?? []) {
        expect(edge.x).toBeLessThan(small.width)
        expect(edge.y).toBeLessThan(small.height)
      }
    }
  })
})
