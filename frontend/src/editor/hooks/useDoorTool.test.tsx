import { useState } from 'react'
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import { useDoorTool } from './useDoorTool'

const CELL = 32

function walledModel(): MapModel {
  return applyCommand(createEmptyMap(3, 3), {
    kind: 'toggleWall',
    edge: { x: 1, y: 0, side: 'W' },
  })
}

function Harness({
  model,
  onCommit,
}: {
  model: MapModel
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
  const viewportRef = {
    current: viewport,
  } as unknown as React.RefObject<Viewport>
  const { hoverEdge, handlers } = useDoorTool({
    canvasRef,
    active: true,
    model,
    viewportRef,
    onCommit: onCommit as never,
  })

  return (
    <>
      <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
      <span data-testid="hover">{hoverEdge ? `${hoverEdge.x},${hoverEdge.y},${hoverEdge.side}` : ''}</span>
    </>
  )
}

function setup(model: MapModel) {
  const onCommit = vi.fn()
  render(<Harness model={model} onCommit={onCommit} />)
  const canvas = screen.getByTestId('canvas')
  canvas.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 96,
    right: 96,
    width: 96,
    height: 96,
    toJSON: () => ({}),
  }) as DOMRect
  return { onCommit }
}

describe('useDoorTool', () => {
  it('places a door with a left click near a wall', () => {
    const model = walledModel()
    const { onCommit } = setup(model)
    // Точка у вертикальной линии x=32 → W клетки (1,0), где стоит стена.
    fireEvent.pointerDown(screen.getByTestId('canvas'), {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 34,
      clientY: 16,
    })

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith({ kind: 'addDoor', edge: { x: 1, y: 0, side: 'W' } })
  })

  it('toggles open state and removes with the right button', () => {
    const commands: Array<Record<string, unknown>> = []

    function Live() {
      const [model, setModel] = useState<MapModel>(walledModel)
      const handle = (command: unknown) => {
        commands.push(command as Record<string, unknown>)
        setModel((prev) => applyCommand(prev, command as never))
      }
      return <Harness model={model} onCommit={handle} />
    }

    render(<Live />)
    const canvas = screen.getByTestId('canvas')

    const clickAt = (button: number, pointerId: number) =>
      fireEvent.pointerDown(canvas, {
        button,
        buttons: button === 2 ? 2 : 1,
        pointerId,
        clientX: 34,
        clientY: 16,
      })

    clickAt(0, 1) // addDoor
    clickAt(0, 2) // setDoorOpen → true
    clickAt(2, 3) // removeDoor

    expect(commands.map((command) => command.kind)).toEqual([
      'addDoor',
      'setDoorOpen',
      'removeDoor',
    ])
    // Открытие и удаление адресуют одну и ту же дверь.
    expect(commands[1]).toMatchObject({ id: 1, open: true })
    expect(commands[2]).toEqual({ kind: 'removeDoor', id: 1 })
  })

  it('does nothing where there is no wall', () => {
    const { onCommit } = setup(createEmptyMap(3, 3))
    fireEvent.pointerDown(screen.getByTestId('canvas'), {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 48,
      clientY: 48,
    })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('tracks the hovered edge for the highlight', () => {
    setup(walledModel())
    fireEvent.pointerMove(screen.getByTestId('canvas'), {
      pointerId: 1,
      clientX: 34,
      clientY: 16,
    })
    expect(screen.getByTestId('hover')).toHaveTextContent('1,0,W')

    fireEvent.pointerLeave(screen.getByTestId('canvas'), { pointerId: 1 })
    expect(screen.getByTestId('hover')).toHaveTextContent('')
  })
})
