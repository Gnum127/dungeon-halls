import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { createWallSegment } from '../model/wallSegments'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import { useDoorTool } from './useDoorTool'

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

function withDoor(position = 0.5): MapModel {
  return applyCommand(withWall(), { kind: 'addDoor', wallSegmentId: 'w1', position, imageId: null })
}

interface HarnessProps {
  model: MapModel
  imageId?: string | null
  viewport?: Partial<Viewport>
  onCommit: (command: unknown) => void
}

function Harness({ model, imageId = null, viewport: vp, onCommit }: HarnessProps) {
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
  const { handlers } = useDoorTool({
    canvasRef,
    active: true,
    model,
    imageId,
    viewportRef,
    onCommit: onCommit as never,
  })
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(model: MapModel, imageId: string | null = null, viewport?: Partial<Viewport>) {
  const onCommit = vi.fn()
  render(<Harness model={model} imageId={imageId} viewport={viewport} onCommit={onCommit} />)
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
  return { canvas, onCommit }
}

describe('useDoorTool', () => {
  it('places a door on the nearest wall with the chosen texture', () => {
    const { canvas, onCommit } = setup(withWall(), 'door-iron')
    // Мир (5, 0) — середина стены.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 5 * CELL, clientY: 0 })

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'addDoor',
        wallSegmentId: 'w1',
        imageId: 'door-iron',
        position: 0.5,
      }),
    )
  })

  it('toggles an existing door open on a left click at its centre', () => {
    const model = withDoor()
    const { canvas, onCommit } = setup(model)
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 5 * CELL, clientY: 0 })

    expect(onCommit).toHaveBeenCalledWith({
      kind: 'setDoorOpen',
      id: model.doors[0].id,
      open: true,
    })
  })

  it('removes an existing door on a right click', () => {
    const model = withDoor()
    const { canvas, onCommit } = setup(model)
    fireEvent.pointerDown(canvas, { button: 2, pointerId: 1, clientX: 5 * CELL, clientY: 0 })

    expect(onCommit).toHaveBeenCalledWith({ kind: 'removeDoor', id: model.doors[0].id })
  })

  it('does not treat a click one cell away as a door hit (radius is in cells, not pixels)', () => {
    const model = withDoor()
    const { canvas, onCommit } = setup(model)
    // Мир (5, 1): в 1 клетке от двери — вне радиуса, и дальше MAX_WALL_DISTANCE.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 5 * CELL, clientY: 1 * CELL })

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('ignores clicks far from any wall', () => {
    const { canvas, onCommit } = setup(withWall())
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 5 * CELL, clientY: 3 * CELL })
    expect(onCommit).not.toHaveBeenCalled()
  })
})
