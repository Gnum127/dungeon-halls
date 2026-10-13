import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import { isEditableTarget } from '../dom/isEditableTarget'
import type { Command } from '../model/commands'
import { findObjectById } from '../model/objects'
import type { MapModel } from '../model/types'
import { isInsideMap } from '../tools/isInsideMap'
import type { EditorTool } from '../tools/editorTool'
import { isCellFree, topmostObjectAt } from '../tools/objects'
import type { Viewport } from '../render/viewport'
import { useCellFromEvent } from './useCellFromEvent'

interface ObjectToolsOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  viewportRef: RefObject<Viewport>
  store: { dispatch: (command: Command) => void }
  model: MapModel
  tool: EditorTool
  selectedId: number | null
  onSelect: (id: number | null) => void
}

interface DragState {
  pointerId: number
  objectId: number
  fromX: number
  fromY: number
  lastX: number
  lastY: number
}

const LEFT_BUTTON = 0

/**
 * Инструменты объектов: размещение кликом, выбор и перемещение перетаскиванием
 * (одно перетаскивание = одна команда), удаление выделенного по Delete.
 */
export function useObjectTools(options: ObjectToolsOptions): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, viewportRef, store, model, tool, selectedId, onSelect } = options
  const dragRef = useRef<DragState | null>(null)

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef)

  function capturePointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer уже неактивен; жест корректно завершится по up/cancel.
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== LEFT_BUTTON || dragRef.current !== null) return
    if (tool.type !== 'object' && tool.type !== 'select') return

    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) return

    if (tool.type === 'object') {
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
      return
    }

    // select: пустая клетка снимает выделение, объект — выделяет и начинает drag.
    const target = topmostObjectAt(model, cell.x, cell.y)
    if (!target) {
      onSelect(null)
      return
    }
    event.preventDefault()
    onSelect(target.id)
    capturePointer(event)
    dragRef.current = {
      pointerId: event.pointerId,
      objectId: target.id,
      fromX: target.x,
      fromY: target.y,
      lastX: target.x,
      lastY: target.y,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    // Кнопку отпустили вне окна — завершаем жест применением перемещения.
    if ((event.buttons & 1) === 0) {
      finishDrag()
      return
    }
    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) return
    const backToOrigin = cell.x === drag.fromX && cell.y === drag.fromY
    if (!backToOrigin && !isCellFree(model, cell.x, cell.y)) return
    drag.lastX = cell.x
    drag.lastY = cell.y
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    finishDrag()
  }

  function onPointerCancel() {
    // Жест сорван — перемещение не применяется.
    dragRef.current = null
  }

  function finishDrag() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.lastX === drag.fromX && drag.lastY === drag.fromY) return
    // Объект могли удалить (Delete во время drag) или клетку занять —
    // невалидную команду не отправляем, чтобы не крэшить UI-поток.
    if (!findObjectById(model.objects, drag.objectId)) return
    if (!isCellFree(model, drag.lastX, drag.lastY)) return
    store.dispatch({ kind: 'moveObject', id: drag.objectId, x: drag.lastX, y: drag.lastY })
  }

  useEffect(() => {
    if (tool.type !== 'select' || selectedId === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      // Не перехватываем клавиши у полей ввода (единый guard с хоткеями).
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      store.dispatch({ kind: 'removeObject', id: selectedId })
      onSelect(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tool.type, selectedId, store, onSelect])

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
