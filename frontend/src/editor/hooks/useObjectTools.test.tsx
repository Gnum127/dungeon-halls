import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import { createEmptyMap } from '../model/createEmptyMap'
import { EditorStore } from '../store/EditorStore'
import type { Command } from '../model/commands'
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
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

const TERRAIN_TOOL: EditorTool = { type: 'terrain', tile: 1 }
const SELECT_TOOL: EditorTool = { type: 'select' }
const DOOR_TOOL: EditorTool = { type: 'object', kindId: 'door' }

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
    let store = new EditorStore(createEmptyMap(8, 8))
    store = applyCommandStore(store, { kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={null} onSelect={onSelect} />,
    )
    const canvas = getByTestId('canvas')

    // Клик по объекту в клетке (1,1): clientX=48 → внутри клетки (1,1).
    leftPointer(canvas, 'pointerdown', { clientX: 48, clientY: 48 })
    expect(onSelect).toHaveBeenCalledWith(1)

    // Перетаскивание в клетку (3,2).
    leftPointer(canvas, 'pointermove', { clientX: 112, clientY: 80 })
    leftPointer(canvas, 'pointerup', { buttons: 0, clientX: 112, clientY: 80 })

    const moved = store.getModel().objects[0]!
    expect(moved).toMatchObject({ id: 1, x: 3, y: 2 })
    expect(onSelect.mock.calls.filter(([id]) => id === null)).toHaveLength(0)
  })

  it('clicking an empty cell deselects', () => {
    let store = new EditorStore(createEmptyMap(8, 8))
    store = applyCommandStore(store, { kind: 'addObject', x: 1, y: 1, kindId: 'chair' })
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <Probe store={store} tool={SELECT_TOOL} selectedId={1} onSelect={onSelect} />,
    )

    leftPointer(getByTestId('canvas'), 'pointerdown', { clientX: 250, clientY: 250 })
    expect(onSelect).toHaveBeenCalledWith(null)
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

  function applyCommandStore(target: EditorStore, command: Command): EditorStore {
    target.dispatch(command)
    return target
  }
})
