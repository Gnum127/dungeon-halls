import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import type { Command } from '../model/commands'
import type { MapModel } from '../model/types'
import { snapToHalfGrid } from '../model/snap'
import type { EditorTool } from '../tools/editorTool'
import { isFootprintFreeAt } from '../tools/objects'
import type { Viewport } from '../render/viewport'
import { useWorldPointFromEvent } from './useCellFromEvent'

interface ObjectToolsOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  viewportRef: RefObject<Viewport>
  store: { dispatch: (command: Command) => void }
  model: MapModel
  tool: EditorTool
}

const LEFT_BUTTON = 0

/**
 * Инструмент объекта: размещение кликом в произвольной точке (float-мировые
 * клетки, левый-верхний угол — под курсором), без привязки к сетке; Shift
 * снапит точку к полуклетке. Выделение, перемещение и удаление выделенного —
 * задача инструмента «Курсор» (`useCursorTool`).
 */
export function useObjectTools(options: ObjectToolsOptions): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, viewportRef, store, model, tool } = options
  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== LEFT_BUTTON) return
    if (tool.type !== 'object') return

    const world = worldFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return
    const anchor = event.shiftKey ? snapToHalfGrid(world) : world
    const { width, height } = model.grid
    if (anchor.x < 0 || anchor.y < 0 || anchor.x >= width || anchor.y >= height) return

    event.preventDefault()
    if (!isFootprintFreeAt(model, anchor.x, anchor.y, tool.scale.w, tool.scale.h)) return
    store.dispatch({
      kind: 'addObject',
      x: anchor.x,
      y: anchor.y,
      kindId: tool.kindId,
      rotation: tool.rotation,
      scale: tool.scale,
    })
  }

  return { handlers: { onPointerDown } }
}
