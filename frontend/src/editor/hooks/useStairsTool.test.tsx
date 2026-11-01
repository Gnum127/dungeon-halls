import { createRef, useEffect } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import { useStairsTool } from './useStairsTool'
import type { StairsPreview } from './useStairsTool'

const CELL = 32

interface HarnessProps {
  model: MapModel
  active?: boolean
  onCommit: (command: unknown) => void
  onPreview: (preview: StairsPreview | null) => void
  onSelect: (id: string | null) => void
}

function Harness({ model, active = true, onCommit, onPreview, onSelect }: HarnessProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const viewportRef = {
    current: { width: 12 * CELL, height: 12 * CELL, cellSize: CELL, offsetX: 0, offsetY: 0 },
  } as unknown as React.RefObject<Viewport>
  const { handlers, preview, selectedId } = useStairsTool({
    canvasRef,
    active,
    model,
    viewportRef,
    onCommit: onCommit as never,
  })
  useEffect(() => {
    onPreview(preview)
  }, [preview, onPreview])
  useEffect(() => {
    onSelect(selectedId)
  }, [selectedId, onSelect])
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(model: MapModel = createEmptyMap(12, 12)) {
  const onCommit = vi.fn()
  const onPreview = vi.fn()
  const onSelect = vi.fn()
  const renderTree = (active: boolean) => (
    <Harness
      model={model}
      active={active}
      onCommit={onCommit}
      onPreview={onPreview}
      onSelect={onSelect}
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
      bottom: 12 * CELL,
      right: 12 * CELL,
      width: 12 * CELL,
      height: 12 * CELL,
      toJSON: () => ({}),
    }) as DOMRect
  const click = (clientX: number, clientY: number, button = 0) =>
    fireEvent.pointerDown(canvas, { button, pointerId: 1, clientX, clientY })
  const move = (clientX: number, clientY: number) =>
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX, clientY })
  const cancel = () =>
    fireEvent(
      canvas,
      Object.assign(new Event('pointercancel', { bubbles: true }), { pointerId: 1 }),
    )
  const deactivate = () => view.rerender(renderTree(false))
  return { canvas, onCommit, onPreview, onSelect, click, move, cancel, deactivate }
}

function withStairs(): MapModel {
  return applyCommand(createEmptyMap(12, 12), {
    kind: 'addStairs',
    polygon: [
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 6, y: 5 },
      { x: 2, y: 5 },
    ],
  })
}

describe('useStairsTool', () => {
  it('places stairs after three snapped clicks', () => {
    const { click, onCommit } = setup()
    click(0.2 * CELL, 0.3 * CELL)
    click(2.4 * CELL, 0.4 * CELL)
    click(2.1 * CELL, 3.3 * CELL)

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith({
      kind: 'addStairs',
      polygon: [
        { x: 0, y: 0.5 },
        { x: 2.5, y: 0.5 },
        { x: 2, y: 3.5 },
        { x: 0.5, y: 3.5 },
      ],
    })
  })

  it('previews a line then a parallelogram', () => {
    const { click, move, onPreview } = setup()
    click(0, 0)
    move(2 * CELL, 0)
    expect(onPreview).toHaveBeenLastCalledWith({
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    })

    click(2 * CELL, 0)
    move(2 * CELL, 3 * CELL)
    expect(onPreview).toHaveBeenLastCalledWith({
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 3 },
        { x: 0, y: 3 },
      ],
    })
  })

  it('does not commit a degenerate shape', () => {
    const { click, onCommit } = setup()
    click(0, 0)
    click(2 * CELL, 0)
    click(1 * CELL, 0)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit a third click collinear past the base end', () => {
    const { click, onCommit } = setup()
    click(0, 0)
    click(2 * CELL, 0)
    click(4 * CELL, 0)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('starts a new stairs after committing', () => {
    const { click, onPreview } = setup()
    click(0, 0)
    click(2 * CELL, 0)
    click(2 * CELL, 3 * CELL)
    click(4 * CELL, 4 * CELL)
    expect(onPreview).toHaveBeenLastCalledWith({
      points: [
        { x: 4, y: 4 },
        { x: 4, y: 4 },
      ],
    })
  })

  it('selects an existing stairs on click instead of starting a build', () => {
    const model = withStairs()
    const { click, onCommit, onSelect } = setup(model)
    const id = model.stairs[0].id
    click(4 * CELL, 3 * CELL)

    expect(onCommit).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenLastCalledWith(id)
  })

  it('deletes the selected stairs with Delete', () => {
    const model = withStairs()
    const id = model.stairs[0].id
    const { click, onCommit } = setup(model)
    click(4 * CELL, 3 * CELL)
    fireEvent.keyDown(window, { key: 'Delete' })

    expect(onCommit).toHaveBeenCalledWith({ kind: 'removeStairs', id })
  })

  it('removes a stairs on right click and ignores a right click elsewhere', () => {
    const model = withStairs()
    const id = model.stairs[0].id
    const { click, onCommit } = setup(model)
    click(4 * CELL, 3 * CELL, 2)
    expect(onCommit).toHaveBeenCalledWith({ kind: 'removeStairs', id })

    onCommit.mockClear()
    click(10 * CELL, 10 * CELL, 2)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('cancels the pending build on Escape', () => {
    const { click, onPreview } = setup()
    click(0, 0)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onPreview).toHaveBeenLastCalledWith(null)
  })

  it('clears the pending build on pointercancel and on deactivation', () => {
    const { click, cancel, deactivate, onPreview } = setup()
    click(0, 0)
    cancel()
    expect(onPreview).toHaveBeenLastCalledWith(null)

    click(0, 0)
    onPreview.mockClear()
    deactivate()
    expect(onPreview).toHaveBeenLastCalledWith(null)
  })
})
