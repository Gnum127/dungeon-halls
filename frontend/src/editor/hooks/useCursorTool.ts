import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import { isEditableTarget } from '../dom/isEditableTarget'
import type { Command } from '../model/commands'
import { findObjectById, isFootprintFree, objectFootprint } from '../model/objects'
import { snapToHalfGrid } from '../model/snap'
import type { MapModel } from '../model/types'
import { topmostObjectAt } from '../tools/objects'
import type { Viewport } from '../render/viewport'
import { useWorldPointFromEvent } from './useCellFromEvent'

interface CursorToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  viewportRef: RefObject<Viewport>
  store: { dispatch: (command: Command) => void }
  model: MapModel
  active: boolean
  selectedId: number | null
  onSelect: (id: number | null) => void
}

interface DragState {
  pointerId: number
  objectId: number
  /** Мировая точка (клетки) курсора в начале перетаскивания. */
  pointerStartX: number
  pointerStartY: number
  /** Координата объекта (левый-верхний угол) в начале перетаскивания. */
  objectStartX: number
  objectStartY: number
  /** Размер footprint'а (клетки). */
  w: number
  h: number
  nextX: number
  nextY: number
}

const LEFT_BUTTON = 0

/**
 * Инструмент «Курсор»: клик выделяет объект (мимо — снимает выделение),
 * перетаскивание перемещает в float-координатах (одно перетаскивание = одна
 * команда), Shift снапит к полуклетке, Delete/Backspace удаляет выделенный.
 */
export function useCursorTool(options: CursorToolOptions): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: () => void
  }
} {
  const { canvasRef, viewportRef, store, model, active, selectedId, onSelect } = options
  const dragRef = useRef<DragState | null>(null)

  const worldPointFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)

  function capturePointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer уже неактивен; жест корректно завершится по up/cancel.
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON || dragRef.current !== null) return
    const world = worldPointFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return

    const target = topmostObjectAt(model, world.x, world.y)
    if (!target) {
      onSelect(null)
      return
    }
    event.preventDefault()
    onSelect(target.id)
    capturePointer(event)
    const { w, h } = objectFootprint(target)
    dragRef.current = {
      pointerId: event.pointerId,
      objectId: target.id,
      pointerStartX: world.x,
      pointerStartY: world.y,
      objectStartX: target.x,
      objectStartY: target.y,
      w,
      h,
      nextX: target.x,
      nextY: target.y,
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
    const world = worldPointFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return
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
    // Жест сорван — перемещение не применяется.
    dragRef.current = null
  }

  function finishDrag() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.nextX === drag.objectStartX && drag.nextY === drag.objectStartY) return
    // Объект могли удалить (Delete во время drag) или место занято —
    // невалидную команду не отправляем, чтобы не крэшить UI-поток.
    if (!findObjectById(model.objects, drag.objectId)) return
    // Origin должен оставаться в границах карты (как при размещении кликом):
    // свисание края разрешено, полный уход за поле — нет.
    const { width, height } = model.grid
    if (drag.nextX < 0 || drag.nextY < 0 || drag.nextX >= width || drag.nextY >= height) return
    const others = model.objects.filter((candidate) => candidate.id !== drag.objectId)
    if (!isFootprintFree(others, drag.nextX, drag.nextY, drag.w, drag.h)) return
    store.dispatch({ kind: 'moveObject', id: drag.objectId, x: drag.nextX, y: drag.nextY })
  }

  useEffect(() => {
    if (!active || selectedId === null) return
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
  }, [active, selectedId, store, onSelect])

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
