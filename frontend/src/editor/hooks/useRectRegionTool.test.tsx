import { createRef, useEffect, useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { Command } from '../model/commands'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { useRectRegionTool } from './useRectRegionTool'
import type { RectPreview } from './useRectRegionTool'

const CELL = 32
const COLS = 8
const ROWS = 8

interface HarnessProps {
  model: MapModel
  active: boolean
  cellSize?: number
  onCommit: (command: Command | null) => void
  onPreview: (preview: RectPreview | null) => void
}

function Harness({ model, active, cellSize = CELL, onCommit, onPreview }: HarnessProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const viewportRef = useRef<Viewport>({
    width: COLS * CELL,
    height: ROWS * CELL,
    cellSize,
    offsetX: 0,
    offsetY: 0,
  })
  const { handlers, preview } = useRectRegionTool({
    canvasRef,
    active,
    model,
    tileType: 'floor',
    autoWalls: false,
    viewportRef,
    onCommit,
  })
  useEffect(() => {
    onPreview(preview)
  }, [preview, onPreview])
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(model: MapModel, cellSize = CELL) {
  const onCommit = vi.fn<(command: Command | null) => void>()
  const onPreview = vi.fn<(preview: RectPreview | null) => void>()
  const renderTree = (active: boolean) => (
    <Harness
      model={model}
      active={active}
      cellSize={cellSize}
      onCommit={onCommit}
      onPreview={onPreview}
    />
  )
  const view = render(renderTree(true))
  const canvas = screen.getByTestId('canvas')
  canvas.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: ROWS * CELL,
      right: COLS * CELL,
      width: COLS * CELL,
      height: ROWS * CELL,
      toJSON: () => ({}),
    }) as DOMRect
  const down = (clientX: number, clientY: number) =>
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX, clientY })
  const move = (clientX: number, clientY: number) =>
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX, clientY })
  const up = () => fireEvent.pointerUp(canvas, { pointerId: 1, button: 0 })
  const cancel = () => fireEvent(canvas, new Event('pointercancel', { bubbles: true }))
  const deactivate = () => view.rerender(renderTree(false))
  return { onCommit, onPreview, down, move, up, cancel, deactivate }
}

function committedPolygon(command: Command | null): readonly Point[] {
  if (command?.kind !== 'addRegion' && command?.kind !== 'addRegionWithWalls') {
    throw new Error('expected a region command')
  }
  return command.region.polygon
}

describe('useRectRegionTool', () => {
  it('builds the rectangle from half-cell point to half-cell point', () => {
    const { down, move, up, onCommit } = setup(createEmptyMap(COLS, ROWS))
    // 0.6 → 0.5, 3.4 → 3.5: a 3×3 rectangle, not a 4×4 "inclusive cells" one.
    down(0.6 * CELL, 0.6 * CELL)
    move(3.4 * CELL, 3.4 * CELL)
    up()

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(committedPolygon(onCommit.mock.calls[0][0])).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 3.5, y: 0.5 },
      { x: 3.5, y: 3.5 },
      { x: 0.5, y: 3.5 },
    ])
  })

  it('commits a sub-cell rectangle (half-cell precision matters)', () => {
    const { down, move, up, onCommit } = setup(createEmptyMap(COLS, ROWS))
    down(1 * CELL, 1 * CELL)
    move(1.5 * CELL, 1.5 * CELL)
    up()

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(committedPolygon(onCommit.mock.calls[0][0])).toEqual([
      { x: 1, y: 1 },
      { x: 1.5, y: 1 },
      { x: 1.5, y: 1.5 },
      { x: 1, y: 1.5 },
    ])
  })

  it('does not commit a zero-area drag', () => {
    const { down, up, onCommit } = setup(createEmptyMap(COLS, ROWS))
    down(1.2 * CELL, 1.2 * CELL)
    up()

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not start a drag outside the map edge, even where snapping would land inside', () => {
    const { down, move, up, onPreview, onCommit } = setup(createEmptyMap(COLS, ROWS))
    // 8.2 snaps to 8 (inside), -0.2 snaps to 0 (inside): the bounds check must
    // happen before snapping, so both clicks are rejected outright.
    down(COLS * CELL + 0.2 * CELL, 1 * CELL)
    move((COLS - 1) * CELL, 1 * CELL)
    up()
    down(-0.2 * CELL, 1 * CELL)
    move(1 * CELL, 1 * CELL)
    up()

    expect(onCommit).not.toHaveBeenCalled()
    expect(onPreview.mock.calls.every(([preview]) => preview === null)).toBe(true)
  })

  it('drops the drag preview when the tool is deactivated', () => {
    const { down, move, onPreview, deactivate, onCommit } = setup(createEmptyMap(COLS, ROWS))
    down(0.6 * CELL, 0.6 * CELL)
    move(2.6 * CELL, 2.6 * CELL)
    expect(onPreview).toHaveBeenLastCalledWith({
      start: { x: 0.5, y: 0.5 },
      current: { x: 2.5, y: 2.5 },
    })

    deactivate()

    expect(onPreview).toHaveBeenLastCalledWith(null)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('cancels the drag without committing on pointercancel', () => {
    const { down, move, cancel, up, onPreview, onCommit } = setup(createEmptyMap(COLS, ROWS))
    down(0.6 * CELL, 0.6 * CELL)
    move(2.6 * CELL, 2.6 * CELL)

    cancel()

    expect(onPreview).toHaveBeenLastCalledWith(null)
    up()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('ignores pointers while the viewport is not ready (NaN cell size)', () => {
    const { down, move, up, onCommit } = setup(createEmptyMap(COLS, ROWS), Number.NaN)
    down(1 * CELL, 1 * CELL)
    move(2 * CELL, 2 * CELL)
    up()

    expect(onCommit).not.toHaveBeenCalled()
  })
})
