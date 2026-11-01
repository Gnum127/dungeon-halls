import { createRef, useEffect } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { createWallSegment } from '../model/wallSegments'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import { useDoorTool } from './useDoorTool'
import type { DoorPreview } from './useDoorTool'

const CELL = 32

function withWall(): MapModel {
  return applyCommand(createEmptyMap(12, 4), {
    kind: 'setWalls',
    updates: [
      {
        segment: createWallSegment(
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
          { id: 'w1' },
        ),
        present: true,
      },
    ],
  })
}

function withDoor(): MapModel {
  return applyCommand(withWall(), {
    kind: 'addDoor',
    a: { x: 4.5, y: 0 },
    b: { x: 5.5, y: 0 },
    imageId: null,
  })
}

interface HarnessProps {
  model: MapModel
  active?: boolean
  imageId?: string | null
  openAngle?: number
  viewport?: Partial<Viewport>
  onCommit: (command: unknown) => void
  onPreview: (preview: DoorPreview | null) => void
}

function Harness({
  model,
  active = true,
  imageId = null,
  openAngle = 30,
  viewport: vp,
  onCommit,
  onPreview,
}: HarnessProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const fullViewport: Viewport = {
    width: 12 * CELL,
    height: 4 * CELL,
    cellSize: CELL,
    offsetX: 0,
    offsetY: 0,
    ...vp,
  }
  const viewportRef = { current: fullViewport } as unknown as React.RefObject<Viewport>
  const { handlers, preview } = useDoorTool({
    canvasRef,
    active,
    model,
    imageId,
    openAngle,
    viewportRef,
    onCommit: onCommit as never,
  })
  useEffect(() => {
    onPreview(preview)
  }, [preview, onPreview])
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(
  model: MapModel,
  opts: { imageId?: string | null; openAngle?: number; viewport?: Partial<Viewport> } = {},
) {
  const onCommit = vi.fn()
  const onPreview = vi.fn()
  const renderTree = (active: boolean) => (
    <Harness
      model={model}
      active={active}
      imageId={opts.imageId ?? null}
      openAngle={opts.openAngle ?? 30}
      viewport={opts.viewport}
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
      bottom: 4 * CELL,
      right: 12 * CELL,
      width: 12 * CELL,
      height: 4 * CELL,
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
  return { canvas, onCommit, onPreview, click, move, cancel, deactivate }
}

describe('useDoorTool', () => {
  it('places a free door over two clicks, snapped to the half grid', () => {
    const { click, onCommit } = setup(createEmptyMap(12, 4), {
      imageId: 'door-iron',
      openAngle: 30,
    })
    click(1.2 * CELL, 1.2 * CELL)
    click(3.7 * CELL, 1.2 * CELL)

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'addDoor',
        a: { x: 1, y: 1 },
        b: { x: 4, y: 1 },
        openAngle: 30,
        imageId: 'door-iron',
      }),
    )
  })

  it('runs the door along a wall when the first click lands on it', () => {
    const { click, onCommit } = setup(withWall())
    click(4 * CELL, 0)
    click(6.2 * CELL, 0)

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'addDoor',
        a: { x: 4, y: 0 },
        b: { x: 6, y: 0 },
      }),
    )
  })

  it('shows a live preview between the two clicks', () => {
    const { click, move, onPreview } = setup(createEmptyMap(12, 4))
    click(1.2 * CELL, 1.2 * CELL)
    onPreview.mockClear()
    move(3.7 * CELL, 1.2 * CELL)

    expect(onPreview).toHaveBeenLastCalledWith({ a: { x: 1, y: 1 }, b: { x: 4, y: 1 } })
  })

  it('does not commit a door when both clicks coincide', () => {
    const { click, onCommit } = setup(createEmptyMap(12, 4))
    click(1.2 * CELL, 1.2 * CELL)
    click(1.2 * CELL, 1.2 * CELL)

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit a phantom door for an off-lattice double click', () => {
    const { click, onCommit } = setup(createEmptyMap(12, 4))
    click(1.3 * CELL, 1.3 * CELL)
    click(1.3 * CELL, 1.3 * CELL)

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('clears the pending opening on pointercancel', () => {
    const { click, cancel, onPreview } = setup(createEmptyMap(12, 4))
    click(1.2 * CELL, 1.2 * CELL)
    expect(onPreview).toHaveBeenLastCalledWith({ a: { x: 1, y: 1 }, b: { x: 1, y: 1 } })

    cancel()
    expect(onPreview).toHaveBeenLastCalledWith(null)
  })

  it('clears the pending opening when the tool is deactivated', () => {
    const { click, deactivate, onPreview } = setup(createEmptyMap(12, 4))
    click(1.2 * CELL, 1.2 * CELL)
    onPreview.mockClear()

    deactivate()
    expect(onPreview).toHaveBeenLastCalledWith(null)
  })

  it('starts a new opening after committing one', () => {
    const { click, onPreview } = setup(createEmptyMap(12, 4))
    click(1.2 * CELL, 1.2 * CELL)
    click(3.7 * CELL, 1.2 * CELL)
    expect(onPreview).toHaveBeenLastCalledWith(null)

    click(2.2 * CELL, 2.2 * CELL)
    expect(onPreview).toHaveBeenLastCalledWith({ a: { x: 2, y: 2 }, b: { x: 2, y: 2 } })
  })

  it('cycles the leaf angle on a left click at a door', () => {
    const model = withDoor()
    const { click, onCommit } = setup(model, { openAngle: 30 })
    click(5 * CELL, 0)

    expect(onCommit).toHaveBeenCalledWith({
      kind: 'setDoorAngle',
      id: model.doors[0].id,
      openAngle: 30,
    })
  })

  it('removes an existing door on a right click', () => {
    const model = withDoor()
    const { click, onCommit } = setup(model)
    click(5 * CELL, 0, 2)

    expect(onCommit).toHaveBeenCalledWith({ kind: 'removeDoor', id: model.doors[0].id })
  })

  it('ignores a right click away from any door', () => {
    const { click, onCommit } = setup(withWall())
    click(5 * CELL, 3 * CELL, 2)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
