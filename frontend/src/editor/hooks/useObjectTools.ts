import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import type { Command } from '../model/commands'
import type { MapModel } from '../model/types'
import { isInsideMap } from '../tools/isInsideMap'
import type { EditorTool } from '../tools/editorTool'
import { isCellFree } from '../tools/objects'
import type { Viewport } from '../render/viewport'
import { useCellFromEvent } from './useCellFromEvent'

interface ObjectToolsOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  viewportRef: RefObject<Viewport>
  store: { dispatch: (command: Command) => void }
  model: MapModel
  tool: EditorTool
}

const LEFT_BUTTON = 0

/**
 * Инструмент объекта: размещение кликом по свободной клетке. Выделение,
 * перемещение и удаление выделенного — задача инструмента «Курсор»
 * (`useCursorTool`).
 */
export function useObjectTools(options: ObjectToolsOptions): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, viewportRef, store, model, tool } = options
  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef)

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== LEFT_BUTTON) return
    if (tool.type !== 'object') return

    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) return

    event.preventDefault()
    if (!isCellFree(model, cell.x, cell.y)) return
    store.dispatch({
      kind: 'addObject',
      x: cell.x,
      y: cell.y,
      kindId: tool.kindId,
      rotation: tool.rotation,
      scale: tool.scale,
    })
  }

  return { handlers: { onPointerDown } }
}
