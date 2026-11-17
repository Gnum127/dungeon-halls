import { createRef, useEffect, useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { Command } from '../model/commands'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import type { SelectedEntity } from '../model/selection'
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

function withDoor(): MapModel {
  return {
    ...createEmptyMap(COLS, ROWS),
    doors: [{ id: 'door-1', a: { x: 2, y: 2 }, b: { x: 3, y: 2 }, imageId: null }],
  }
}

interface HarnessProps {
  model: MapModel
  selected: SelectedEntity
  active?: boolean
  onSelect: (entity: SelectedEntity) => void
  dispatch: (command: Command) => void
  onPreview?: (preview: unknown) => void
}

function Harness({ model, selected, active = true, onSelect, dispatch, onPreview }: HarnessProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const viewportRef = useRef<Viewport>({
    width: COLS * CELL,
    height: ROWS * CELL,
    cellSize: CELL,
    offsetX: 0,
    offsetY: 0,
  })
  const { handlers, resizePreview } = useCursorTool({
    canvasRef,
    viewportRef,
    store: { dispatch },
    model,
    active,
    selected,
    onSelect,
  })
  useEffect(() => {
    onPreview?.(resizePreview)
  }, [resizePreview, onPreview])
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(
  model: MapModel,
  selected: SelectedEntity = null,
  active = true,
  onPreview?: (preview: unknown) => void,
) {
  const onSelect = vi.fn<(entity: SelectedEntity) => void>()
  const dispatch = vi.fn<(command: Command) => void>()
  render(
    <Harness
      model={model}
      selected={selected}
      active={active}
      onSelect={onSelect}
      dispatch={dispatch}
      onPreview={onPreview}
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
    expect(onSelect).toHaveBeenCalledWith({ type: 'object', id: 1 })
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

  it('selects a door on click', () => {
    const { canvas, onSelect, dispatch } = setup(withDoor())

    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 2.5 * CELL,
      clientY: 2 * CELL,
    })

    expect(onSelect).toHaveBeenCalledWith({ type: 'door', id: 'door-1' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('removes the selected door with Delete', () => {
    const { dispatch } = setup(withDoor(), { type: 'door', id: 'door-1' })

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'removeDoor', id: 'door-1' })
  })

  it('resizes the selected object by dragging a corner handle', () => {
    const model: MapModel = {
      ...createEmptyMap(COLS, ROWS),
      objects: [{ id: 1, kindId: 'torch', x: 1, y: 1 }],
    }
    const { canvas, dispatch } = setup(model, { type: 'object', id: 1 })

    // Угол (2,2) footprint'а 1×1: тянем к (3,4) → origin (1,1), размер 2×3.
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 2 * CELL,
      clientY: 2 * CELL,
    })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: 3 * CELL,
      clientY: 4 * CELL,
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 3 * CELL, clientY: 4 * CELL })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      kind: 'setObjectBounds',
      id: 1,
      x: 1,
      y: 1,
      scale: { w: 2, h: 3 },
    })
  })

  it('moves (not resizes) a selected 1×1 object dragged from its centre', () => {
    const model: MapModel = {
      ...createEmptyMap(COLS, ROWS),
      objects: [{ id: 1, kindId: 'chair', x: 1, y: 1 }],
    }
    const { canvas, dispatch } = setup(model, { type: 'object', id: 1 })

    // Центр клетки (1.5,1.5) — вне хит-зоны угловых хендлов.
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 1.5 * CELL,
      clientY: 1.5 * CELL,
    })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: 3.5 * CELL,
      clientY: 2.5 * CELL,
    })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 3.5 * CELL, clientY: 2.5 * CELL })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 3, y: 2 })
  })

  it('shows a live resize preview without dispatching until release', () => {
    const previews: unknown[] = []
    const model: MapModel = {
      ...createEmptyMap(COLS, ROWS),
      objects: [{ id: 1, kindId: 'torch', x: 1, y: 1 }],
    }
    const { canvas, dispatch } = setup(model, { type: 'object', id: 1 }, true, (preview) =>
      previews.push(preview),
    )

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 2 * CELL, clientY: 2 * CELL })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      buttons: 1,
      clientX: 3 * CELL,
      clientY: 4 * CELL,
    })

    expect(previews.at(-1)).toEqual({ x: 1, y: 1, scale: { w: 2, h: 3 } })
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 3 * CELL, clientY: 4 * CELL })

    expect(previews.at(-1)).toBeNull()
    expect(dispatch).toHaveBeenCalledTimes(1)
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
    const { dispatch } = setup(withObject(1, 1), { type: 'object', id: 1 })

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(dispatch).toHaveBeenCalledWith({ kind: 'removeObject', id: 1 })
  })

  it('removes the selected object on Backspace too', () => {
    const { dispatch } = setup(withObject(1, 1), { type: 'object', id: 1 })

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

  it('allows dropping onto another object (collisions removed, этап 28)', () => {
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

    expect(dispatch).toHaveBeenCalledWith({ kind: 'moveObject', id: 1, x: 3, y: 2 })
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
