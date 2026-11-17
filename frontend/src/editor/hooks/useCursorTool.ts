import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import { isEditableTarget } from '../dom/isEditableTarget'
import type { Command } from '../model/commands'
import { findObjectById } from '../model/objects'
import { resizeHandleAt, resizedFootprint } from '../model/selection'
import type { ObjectBounds, ResizeHandle, SelectedEntity } from '../model/selection'
import { snapToHalfGrid } from '../model/snap'
import type { MapModel } from '../model/types'
import { doorHitTest } from '../tools/doorHitTest'
import { topmostObjectAt } from '../tools/objects'
import type { Viewport } from '../render/viewport'
import { useWorldPointFromEvent } from './useCellFromEvent'

interface CursorToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  viewportRef: RefObject<Viewport>
  store: { dispatch: (command: Command) => void }
  model: MapModel
  active: boolean
  selected: SelectedEntity
  onSelect: (entity: SelectedEntity) => void
}

interface MoveState {
  readonly mode: 'move'
  pointerId: number
  objectId: number
  /** Мировая точка (клетки) курсора в начале перетаскивания. */
  pointerStartX: number
  pointerStartY: number
  objectStartX: number
  objectStartY: number
  nextX: number
  nextY: number
}

interface ResizeState {
  readonly mode: 'resize'
  pointerId: number
  objectId: number
  handle: ResizeHandle
  bounds: ObjectBounds
}

type DragState = MoveState | ResizeState

const LEFT_BUTTON = 0
/** Радиус попадания по двери в мировых клетках (примерно половина полотна). */
const DOOR_HIT_RADIUS = 0.15

/**
 * Инструмент «Курсор» (этап 28): клик выделяет объект/дверь (мимо — снимает
 * выделение), перетаскивание перемещает объект в float-координатах (одно
 * перетаскивание = одна команда), Shift снапит к полуклетке; за угловой хендл
 * выделенного объекта — ресайз с живым превью (`setObjectBounds` на отпускании);
 * Delete/Backspace удаляет выделенное (объект или дверь).
 */
export function useCursorTool(options: CursorToolOptions): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: () => void
  }
  /** Превью ресайза: рамка рисуется по этим bounds до отпускания кнопки. */
  resizePreview: ObjectBounds | null
} {
  const { canvasRef, viewportRef, store, model, active, selected, onSelect } = options
  const dragRef = useRef<DragState | null>(null)
  const [resizePreview, setResizePreview] = useState<ObjectBounds | null>(null)

  const worldPointFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)

  function capturePointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer уже неактивен; жест корректно завершится по up/cancel.
    }
  }

  const selectedObject =
    selected?.type === 'object' ? findObjectById(model.objects, selected.id) : undefined

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON || dragRef.current !== null) return
    const world = worldPointFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return

    // Чистим возможное превью ресайза, оставшееся от прошлого инструмента.
    if (resizePreview !== null) setResizePreview(null)

    // Ресайз выделенного объекта — приоритетнее перемещения и выбора.
    const cellSize = viewportRef.current?.cellSize ?? 0
    if (selectedObject && cellSize > 0) {
      const handle = resizeHandleAt(selectedObject, world, cellSize)
      if (handle) {
        event.preventDefault()
        capturePointer(event)
        const bounds: ObjectBounds = {
          x: selectedObject.x,
          y: selectedObject.y,
          scale: { w: selectedObject.scale?.w ?? 1, h: selectedObject.scale?.h ?? 1 },
        }
        dragRef.current = {
          mode: 'resize',
          pointerId: event.pointerId,
          objectId: selectedObject.id,
          handle,
          bounds,
        }
        setResizePreview(bounds)
        return
      }
    }

    const target = topmostObjectAt(model, world.x, world.y)
    if (target) {
      event.preventDefault()
      onSelect({ type: 'object', id: target.id })
      capturePointer(event)
      dragRef.current = {
        mode: 'move',
        pointerId: event.pointerId,
        objectId: target.id,
        pointerStartX: world.x,
        pointerStartY: world.y,
        objectStartX: target.x,
        objectStartY: target.y,
        nextX: target.x,
        nextY: target.y,
      }
      return
    }

    const doorId = doorHitTest(world, model.doors, DOOR_HIT_RADIUS)
    if (doorId) {
      event.preventDefault()
      onSelect({ type: 'door', id: doorId })
      return
    }

    onSelect(null)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    // Кнопку отпустили вне окна — завершаем жест применением изменения.
    if ((event.buttons & 1) === 0) {
      finishDrag()
      return
    }
    const world = worldPointFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return

    if (drag.mode === 'resize') {
      const object = findObjectById(model.objects, drag.objectId)
      if (!object) return
      drag.bounds = resizedFootprint(object, drag.handle, world, model.grid)
      setResizePreview(drag.bounds)
      return
    }

    let nextX = drag.objectStartX + (world.x - drag.pointerStartX)
    let nextY = drag.objectStartY + (world.y - drag.pointerStartY)
    if (event.shiftKey) {
      const snapped = snapToHalfGrid({ x: nextX, y: nextY })
      nextX = snapped.x
      nextY = snapped.y
    }
    drag.nextX = Math.max(0, nextX)
    drag.nextY = Math.max(0, nextY)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    finishDrag()
  }

  function onPointerCancel() {
    // Жест сорван — изменение не применяется.
    dragRef.current = null
    setResizePreview(null)
  }

  function finishDrag() {
    const drag = dragRef.current
    dragRef.current = null
    setResizePreview(null)
    if (!drag) return
    // Объект могли удалить во время drag — невалидную команду не отправляем.
    if (!findObjectById(model.objects, drag.objectId)) return

    if (drag.mode === 'resize') {
      store.dispatch({
        kind: 'setObjectBounds',
        id: drag.objectId,
        x: drag.bounds.x,
        y: drag.bounds.y,
        scale: { ...drag.bounds.scale },
      })
      return
    }

    if (drag.nextX === drag.objectStartX && drag.nextY === drag.objectStartY) return
    // Origin должен оставаться в границах карты (как при размещении кликом):
    // свисание края разрешено, полный уход за поле — нет.
    const { width, height } = model.grid
    if (drag.nextX < 0 || drag.nextY < 0 || drag.nextX >= width || drag.nextY >= height) return
    store.dispatch({ kind: 'moveObject', id: drag.objectId, x: drag.nextX, y: drag.nextY })
  }

  useEffect(() => {
    if (!active || selected === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      // Не перехватываем клавиши у полей ввода (единый guard с хоткеями).
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      if (selected.type === 'object') store.dispatch({ kind: 'removeObject', id: selected.id })
      else if (selected.type === 'door') store.dispatch({ kind: 'removeDoor', id: selected.id })
      onSelect(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, selected, store, onSelect])

  // Переключили инструмент во время жеста — жест отменяется (без коммита).
  useEffect(() => {
    if (!active) dragRef.current = null
  }, [active])

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    // Превью ресайза имеет смысл только для активного «Курсора».
    resizePreview: active ? resizePreview : null,
  }
}
