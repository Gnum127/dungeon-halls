import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import type { Viewport } from '../render/viewport'
import { screenToCell } from '../render/viewport'

/** Минимум, нужный для перевода точки в клетку карты. */
export type ClientPoint = Pick<ReactPointerEvent<HTMLCanvasElement>, 'clientX' | 'clientY'>

/**
 * Общий для инструментов перевод клиентских координат события в клетку.
 * Возвращает NaN-клетку, если canvas/viewport ещё не готовы.
 */
export function useCellFromEvent(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  viewportRef: RefObject<Viewport>,
): (point: ClientPoint) => { x: number; y: number } {
  return useCallback(
    (point: ClientPoint) => {
      const canvas = canvasRef.current
      const viewport = viewportRef.current
      if (!canvas || !viewport) return { x: Number.NaN, y: Number.NaN }
      const rect = canvas.getBoundingClientRect()
      return screenToCell(viewport, point.clientX - rect.left, point.clientY - rect.top)
    },
    [canvasRef, viewportRef],
  )
}
