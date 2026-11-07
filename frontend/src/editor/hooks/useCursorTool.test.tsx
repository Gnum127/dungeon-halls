import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import { useCursorTool } from './useCursorTool'

const CELL = 32
const COLS = 8
const ROWS = 8

function withObject(x: number, y: number): MapModel {
  return {
    ...createEmptyMap(COLS, ROWS),
    objects: [{ id: 1, kindId: 'torch', x, y }],
  }
}

interface HarnessProps {
  model: MapModel
  selectedId: number | null
  active?: boolean
  onSelect: (id: number | null) => void
  dispatch: (command: unknown) => void
}

function Harness({ model, selectedId, active = true, onSelect, dispatch }: HarnessProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const viewportRef = {
    current: {
      width: COLS * CELL,
      height: ROWS * CELL,
      cellSize: CELL,
      offsetX: 0,
      offsetY: 0,
    },
  } as unknown as React.RefObject<Viewport>
  const { handlers } = useCursorTool({
    canvasRef,
    viewportRef,
    store: { dispatch: dispatch as never },
    model,
    active,
    selectedId,
    onSelect,
  })
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(model: MapModel, selectedId: number | null = null, active = true) {
  const onSelect = vi.fn()
  const dispatch = vi.fn()
  render(
    <Harness
      model={model}
      selectedId={selectedId}
      active={active}
      onSelect={onSelect}
      dispatch={dispatch}
    />,
  )
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
  return { canvas, onSelect, dispatch }
}

function cellX(col: number) {
  return col * CELL + CELL / 2
}

describe('useCursorTool', () => {
  it('clears the selection when clicking an empty cell', () => {
    const { canvas, onSelect, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(5), clientY: cellX(5) })

    expect(onSelect).toHaveBeenCalledWith(null)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('selects an object and moves it on drag (one command on release)', () => {
    const { canvas, onSelect, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    expect(onSelect).toHaveBeenCalledWith(1)
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: cellX(3),
      clientY: cellX(2),
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: cellX(3), clientY: cellX(2) })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 3, y: 2 })
  })

  it('does not dispatch when the drag returns to the origin cell', () => {
    const { canvas, dispatch } = setup(withObject(2, 2))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(2), clientY: cellX(2) })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: cellX(4),
      clientY: cellX(4),
    })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: cellX(2),
      clientY: cellX(2),
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: cellX(2), clientY: cellX(2) })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('removes the selected object on Delete', () => {
    const { dispatch } = setup(withObject(1, 1), 1)

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'removeObject', id: 1 })
  })

  it('removes the selected object on Backspace too', () => {
    const { dispatch } = setup(withObject(1, 1), 1)

    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'removeObject', id: 1 })
  })

  it('does not drag the object fully outside the grid', () => {
    const { canvas, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    // Целевой origin уходит за правый край (world x = 9 при ширине 8).
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: COLS * CELL + CELL,
      clientY: cellX(1),
    })
    fireEvent.pointerUp(canvas, {
      pointerId: 1,
      clientX: COLS * CELL + CELL,
      clientY: cellX(1),
    })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('clamps a left drag to a zero origin', () => {
    const { canvas, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    // Курсор уходит левее поля: origin зажимается до 0.
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX: -16, clientY: cellX(1) })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: -16, clientY: cellX(1) })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 0, y: 1 })
  })

  it('moves a footprint that overhangs the right edge (origin stays inside)', () => {
    const model: MapModel = {
      ...createEmptyMap(COLS, ROWS),
      objects: [{ id: 1, kindId: 'torch', x: 1, y: 1, scale: { w: 2, h: 1 } }],
    }
    const { canvas, dispatch } = setup(model)

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: 7.5 * CELL,
      clientY: cellX(1),
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 7.5 * CELL, clientY: cellX(1) })

    // origin = 7 (< ширины 8), правый край 2×1 footprint'а свисает за поле.
    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 7, y: 1 })
  })

  it('does not drop onto an occupied cell', () => {
    const model: MapModel = {
      ...createEmptyMap(COLS, ROWS),
      objects: [
        { id: 1, kindId: 'torch', x: 1, y: 1 },
        { id: 2, kindId: 'torch', x: 3, y: 2 },
      ],
    }
    const { canvas, dispatch } = setup(model)

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: cellX(3),
      clientY: cellX(2),
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: cellX(3), clientY: cellX(2) })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('applies the move when the button is released outside the window', () => {
    const { canvas, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: cellX(3),
      clientY: cellX(2),
    })
    // Left button released outside the window: buttons bit cleared.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 0,
      clientX: cellX(3),
      clientY: cellX(2),
    })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 3, y: 2 })
  })

  it('ignores pointercancel: the move is not applied', () => {
    const { canvas, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: cellX(3),
      clientY: cellX(2),
    })
    fireEvent(
      canvas,
      Object.assign(new Event('pointercancel', { bubbles: true }), { pointerId: 1 }),
    )
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: cellX(3), clientY: cellX(2) })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('is inert when another tool is active', () => {
    const { canvas, onSelect, dispatch } = setup(withObject(1, 1), null, false)

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })

    expect(onSelect).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('drags the object by a float delta without snapping', () => {
    const { canvas, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    // +8px = +0.25 клетки — попадает между линиями сетки.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: cellX(1) + 8,
      clientY: cellX(1) + 8,
    })
    fireEvent.pointerUp(canvas, {
      pointerId: 1,
      clientX: cellX(1) + 8,
      clientY: cellX(1) + 8,
    })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 1.25, y: 1.25 })
  })

  it('snaps to the half-cell step while Shift is held', () => {
    const { canvas, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    // +12px = +0.375 клетки → снап к ближайшим 0.5 → 1.5.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      shiftKey: true,
      clientX: cellX(1) + 12,
      clientY: cellX(1) + 12,
    })
    fireEvent.pointerUp(canvas, {
      pointerId: 1,
      clientX: cellX(1) + 12,
      clientY: cellX(1) + 12,
    })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 1.5, y: 1.5 })
  })

  it('returns to float coordinates when Shift is released between moves', () => {
    const { canvas, dispatch } = setup(withObject(1, 1))

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: cellX(1), clientY: cellX(1) })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      shiftKey: true,
      clientX: cellX(1) + 12,
      clientY: cellX(1),
    })
    // Тот же курсор, но без Shift: снап снимается → 1 + 0.375.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: cellX(1) + 12,
      clientY: cellX(1),
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: cellX(1) + 12, clientY: cellX(1) })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 1.375, y: 1 })
  })
})
