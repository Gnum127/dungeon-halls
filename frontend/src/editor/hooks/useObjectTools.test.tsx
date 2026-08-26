import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import { cellCenterAt } from '../render/gridGeometry'
import { createEmptyMap } from '../model/createEmptyMap'
import { EditorStore } from '../store/EditorStore'
import type { Viewport } from '../render/viewport'
import type { EditorTool } from '../tools/editorTool'
import { useObjectTools } from './useObjectTools'

function makeViewport(): Viewport {
  return { width: 320, height: 240, cellSize: 32, offsetX: 0, offsetY: 0 }
}

interface ProbeProps {
  store: EditorStore
  tool: EditorTool
  selectedId: number | null
  onSelect: (id: number | null) => void
}

function Probe({ store, tool, selectedId, onSelect }: ProbeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<Viewport>(makeViewport())
  const model = store.getModel()
  const { handlers } = useObjectTools({
    canvasRef,
    viewportRef,
    store,
    model,
    tool,
    selectedId,
    onSelect,
  })
  return (
    <div>
      <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
      <input data-testid="input" />
    </div>
  )
}

const TERRAIN_TOOL: EditorTool = { type: 'terrain', tile: 1 }
const SELECT_TOOL: EditorTool = { type: 'select' }
const DOOR_TOOL: EditorTool = { type: 'object', kindId: 'door', rotation: 0, scale: { w: 1, h: 1 } }

function leftPointer(
  target: Element,
  phase: 'pointerdown' | 'pointermove' | 'pointerup',
  init: Record<string, unknown> = {},
): boolean {
  const defaults = { pointerId: 1, button: 0, buttons: 1, clientX: 16, clientY: 16 }
  switch (phase) {
    case 'pointerdown':
      return fireEvent.pointerDown(target, { ...defaults, ...init })
    case 'pointermove':
      return fireEvent.pointerMove(target, { ...defaults, ...init })
    case 'pointerup':
      return fireEvent.pointerUp(target, { ...defaults, ...init })
  }
}

describe('useObjectTools', () => {
  it('places an object of the active kind on click', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    const { getByTestId } = render(
      <Probe store={store} tool={DOOR_TOOL} selectedId={null} onSelect={vi.fn()} />,
    )
    // clientX/Y (16,16) → клетка (0,0).
    leftPointer(getByTestId('canvas'), 'pointerdown')

    const objects = store.getModel().objects
    expect(objects).toHaveLength(1)
    expect(objects[0]).toMatchObject({ x: 0, y: 0, kindId: 'door' })
  })

  it('does not place onto an occupied cell', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 0, y: 0, kindId: 'chest' })
    const { getByTestId } = render(
      <Probe store={store} tool={DOOR_TOOL} selectedId={null} onSelect={vi.fn()} />,
    )

    leftPointer(getByTestId('canvas'), 'pointerdown')
    expect(store.getModel().objects).toHaveLength(1)
  })

  it('selects on click and drags with a single move command', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={null} onSelect={onSelect} />,
    )
    const canvas = getByTestId('canvas')

    // Клик по объекту в клетке (1,1): clientX=48 → внутри клетки (1,1).
    leftPointer(canvas, 'pointerdown', { clientX: 48, clientY: 48 })
    expect(onSelect).toHaveBeenCalledWith(1)

    // Несколько промежуточных клеток внутри одного жеста…
    leftPointer(canvas, 'pointermove', { clientX: 80, clientY: 48 })
    leftPointer(canvas, 'pointermove', { clientX: 112, clientY: 80 })
    leftPointer(canvas, 'pointermove', { clientX: 144, clientY: 112 })
    // …и ровно одна команда на отпускание.
    leftPointer(canvas, 'pointerup', { buttons: 0, clientX: 144, clientY: 112 })

    const moved = store.getModel().objects[0]!
    expect(moved).toMatchObject({ id: 1, x: 4, y: 3 })

    // «Один drag = одна команда в истории»: один undo возвращает исходную клетку,
    // второй undo — момент до добавления объекта.
    expect(store.undo()).toBe(true)
    expect(store.getModel().objects[0]).toMatchObject({ x: 1, y: 1 })
    store.undo()
    expect(store.getModel().objects).toHaveLength(0)
    expect(store.canUndo()).toBe(false)
  })

  it('dragging back to the origin cell writes no history entry', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const modelBeforeDrag = store.getModel()

    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={null} onSelect={vi.fn()} />,
    )
    const canvas = getByTestId('canvas')

    leftPointer(canvas, 'pointerdown', { clientX: 48, clientY: 48 })
    leftPointer(canvas, 'pointermove', { clientX: 112, clientY: 80 })
    leftPointer(canvas, 'pointermove', { clientX: 48, clientY: 48 })
    leftPointer(canvas, 'pointerup', { buttons: 0, clientX: 48, clientY: 48 })

    expect(store.getModel()).toBe(modelBeforeDrag)
  })

  it('pointer cancel aborts the drag without any command', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const modelBeforeDrag = store.getModel()

    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={null} onSelect={vi.fn()} />,
    )
    const canvas = getByTestId('canvas')

    leftPointer(canvas, 'pointerdown', { clientX: 48, clientY: 48 })
    leftPointer(canvas, 'pointermove', { clientX: 112, clientY: 80 })
    fireEvent(
      canvas,
      Object.assign(new Event('pointercancel', { bubbles: true }), {
        pointerId: 1,
        buttons: 0,
      }),
    )

    // Зомби-drag: события после cancel не применяют отменённый перенос.
    expect(store.getModel()).toBe(modelBeforeDrag)
    leftPointer(canvas, 'pointermove', { buttons: 0, clientX: 144, clientY: 112 })
    leftPointer(canvas, 'pointerup', { buttons: 0, clientX: 144, clientY: 112 })
    expect(store.getModel()).toBe(modelBeforeDrag)
  })

  it('drag onto an occupied target cell is ignored at hook level', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    store.dispatch({ kind: 'addObject', x: 3, y: 1, kindId: 'chest' })
    const modelBeforeDrag = store.getModel()

    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={null} onSelect={vi.fn()} />,
    )
    const canvas = getByTestId('canvas')

    leftPointer(canvas, 'pointerdown', { clientX: 48, clientY: 48 })
    leftPointer(canvas, 'pointermove', { clientX: 112, clientY: 48 })
    leftPointer(canvas, 'pointerup', { buttons: 0, clientX: 112, clientY: 48 })

    expect(store.getModel()).toBe(modelBeforeDrag)
  })

  it('clicking an empty cell deselects', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={1} onSelect={onSelect} />,
    )

    leftPointer(getByTestId('canvas'), 'pointerdown', { clientX: 250, clientY: 250 })
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('right button never starts object interactions', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={null} onSelect={onSelect} />,
    )
    const canvas = getByTestId('canvas')

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      button: 2,
      buttons: 2,
      clientX: 48,
      clientY: 48,
    })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Backspace removes the selected object too', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })

    function StatefulProbe({ tool }: { tool: EditorTool }) {
      const [selectedId, setSelectedId] = useState<number | null>(null)
      return <Probe store={store} tool={tool} selectedId={selectedId} onSelect={setSelectedId} />
    }

    const { getByTestId } = render(<StatefulProbe tool={SELECT_TOOL} />)
    const canvas = getByTestId('canvas')
    leftPointer(canvas, 'pointerdown', { clientX: 48, clientY: 48 })
    leftPointer(canvas, 'pointerup', { buttons: 0, clientX: 48, clientY: 48 })

    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(store.getModel().objects).toHaveLength(0)
  })

  it('Delete removes the selected object while the select tool is active', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    function StatefulProbe({ tool }: { tool: EditorTool }) {
      const [selectedId, setSelectedId] = useState<number | null>(null)
      return <Probe store={store} tool={tool} selectedId={selectedId} onSelect={setSelectedId} />
    }

    const { getByTestId } = render(<StatefulProbe tool={SELECT_TOOL} />)
    const canvas = getByTestId('canvas')

    // Клик выделяет объект в клетке (1,1).
    leftPointer(canvas, 'pointerdown', { clientX: 48, clientY: 48 })
    leftPointer(canvas, 'pointerup', { buttons: 0, clientX: 48, clientY: 48 })

    fireEvent.keyDown(window, { key: 'Delete' })
    expect(store.getModel().objects).toHaveLength(0)

    // Выделение снято: повторный Delete безопасен.
    expect(() => fireEvent.keyDown(window, { key: 'Delete' })).not.toThrow()
  })

  it('terrain tool ignores Delete even with a stale selection id', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    render(<Probe store={store} tool={TERRAIN_TOOL} selectedId={1} onSelect={vi.fn()} />)

    expect(() => fireEvent.keyDown(window, { key: 'Delete' })).not.toThrow()
    expect(store.getModel().objects).toHaveLength(1)
  })

  it('Delete from an editable target does not remove the selected object', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    store.dispatch({ kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={1} onSelect={vi.fn()} />,
    )
    // Событие от input: цель — редактируемый элемент, хоткей не действует.
    fireEvent.keyDown(getByTestId('input'), { key: 'Delete' })

    expect(store.getModel().objects).toHaveLength(1)
  })

  it('terrain tool ignores object interactions', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <Probe store={store} tool={TERRAIN_TOOL} selectedId={null} onSelect={onSelect} />,
    )

    leftPointer(getByTestId('canvas'), 'pointerdown')
    expect(store.getModel().objects).toHaveLength(0)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('useObjectTools (hex grid)', () => {
  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: places an object into the hex under the click',
    (gridType) => {
      const store = new EditorStore(createEmptyMap(8, 8, gridType))
      const { getByTestId } = render(
        <Probe store={store} tool={DOOR_TOOL} selectedId={null} onSelect={vi.fn()} />,
      )
      const canvas = getByTestId('canvas')

      // Клик в центр гекса (3,4) — не в центр «квадратной» клетки.
      const center = cellCenterAt(3, 4, gridType, 32)
      leftPointer(canvas, 'pointerdown', { clientX: center.x, clientY: center.y })

      const objects = store.getModel().objects
      expect(objects).toHaveLength(1)
      expect(objects[0]).toMatchObject({ x: 3, y: 4, kindId: 'door' })
    },
  )

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: drags an object to another hex with a single move command',
    (gridType) => {
      const store = new EditorStore(createEmptyMap(8, 8, gridType))
      store.dispatch({ kind: 'addObject', x: 2, y: 2, kindId: 'chair' })
      const { getByTestId } = render(
        <Probe store={store} tool={SELECT_TOOL} selectedId={null} onSelect={vi.fn()} />,
      )
      const canvas = getByTestId('canvas')

      const from = cellCenterAt(2, 2, gridType, 32)
      const to = cellCenterAt(3, 3, gridType, 32)
      leftPointer(canvas, 'pointerdown', { clientX: from.x, clientY: from.y })
      leftPointer(canvas, 'pointermove', { clientX: to.x, clientY: to.y })
      leftPointer(canvas, 'pointerup', { buttons: 0 })

      const moved = store.getModel().objects[0]!
      expect(moved).toMatchObject({ x: 3, y: 3 })
      expect(store.undo()).toBe(true)
      expect(store.getModel().objects[0]).toMatchObject({ x: 2, y: 2 })
    },
  )
})
