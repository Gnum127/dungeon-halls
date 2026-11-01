import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { createTerrainRegion } from '../model/regions'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { useWallTool } from './useWallTool'

const CELL = 32

const square = (x: number, y: number, size: number): Point[] => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

/** Пол 6×6 клеток в левом верхнем углу — внутри него привязка к полуклетке. */
function withCoverage(): MapModel {
  return applyCommand(createEmptyMap(12, 12), {
    kind: 'addRegion',
    region: createTerrainRegion('floor', square(0, 0, 6), 0, 'r'),
  })
}

interface HarnessProps {
  model: MapModel
  viewport?: Partial<Viewport>
  onCommit: (command: unknown) => void
}

function Harness({ model, viewport: vp, onCommit }: HarnessProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const viewportRef = {
    current: {
      width: 12 * CELL,
      height: 12 * CELL,
      cellSize: CELL,
      offsetX: 0,
      offsetY: 0,
      ...vp,
    },
  } as unknown as React.RefObject<Viewport>
  const { handlers } = useWallTool({
    canvasRef,
    active: true,
    model,
    viewportRef,
    onCommit: onCommit as never,
  })
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(model: MapModel) {
  const onCommit = vi.fn()
  render(<Harness model={model} onCommit={onCommit} />)
  const canvas = screen.getByTestId('canvas')
  canvas.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 12 * CELL,
      right: 12 * CELL,
      width: 12 * CELL,
      height: 12 * CELL,
      toJSON: () => ({}),
    }) as DOMRect
  return { canvas, onCommit }
}

function segmentPoints(command: unknown): Point[] {
  const updates = (command as { updates: { segment: { points: Point[] } }[] }).updates
  return updates[0].segment.points
}

describe('useWallTool', () => {
  it('snaps both ends to half-grid nodes inside a covered cell', () => {
    const { canvas, onCommit } = setup(withCoverage())
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 1.4 * CELL,
      clientY: 1.4 * CELL,
    })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: 2.6 * CELL,
      clientY: 1.4 * CELL,
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 2.6 * CELL, clientY: 1.4 * CELL })

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit.mock.calls[0][0]).toMatchObject({ kind: 'setWalls' })
    expect(segmentPoints(onCommit.mock.calls[0][0])).toEqual([
      { x: 1.5, y: 1.5 },
      { x: 2.5, y: 1.5 },
    ])
  })

  it('snaps to cell corners outside coverage', () => {
    const { canvas, onCommit } = setup(withCoverage())
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 8.4 * CELL,
      clientY: 8.4 * CELL,
    })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: 8.6 * CELL,
      clientY: 8.4 * CELL,
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 8.6 * CELL, clientY: 8.4 * CELL })

    expect(segmentPoints(onCommit.mock.calls[0][0])).toEqual([
      { x: 8, y: 8 },
      { x: 9, y: 8 },
    ])
  })

  it('does not commit a zero-length drag', () => {
    const { canvas, onCommit } = setup(withCoverage())
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 1.4 * CELL,
      clientY: 1.4 * CELL,
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 1.4 * CELL, clientY: 1.4 * CELL })

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit after pointercancel', () => {
    const { canvas, onCommit } = setup(withCoverage())
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 1.4 * CELL,
      clientY: 1.4 * CELL,
    })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: 3.4 * CELL,
      clientY: 1.4 * CELL,
    })
    fireEvent(
      canvas,
      Object.assign(new Event('pointercancel', { bubbles: true }), { pointerId: 1 }),
    )
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 3.4 * CELL, clientY: 1.4 * CELL })

    expect(onCommit).not.toHaveBeenCalled()
  })
})
