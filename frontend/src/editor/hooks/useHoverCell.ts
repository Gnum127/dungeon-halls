import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import { isInsideMap } from '../tools/isInsideMap'
import type { Viewport } from '../render/viewport'
import { useCellFromEvent, useWorldPointFromEvent } from './useCellFromEvent'

interface HoverCellOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  viewportRef: RefObject<Viewport>
  /** Включён в зависимости пересчёта: пан/зум меняют клетку под курсором. */
  viewport: Viewport
  model: MapModel
}

interface HoverState {
  readonly cell: { x: number; y: number }
  readonly world: Point
  /** Был ли зажат Shift на последнем движении (для снапа превью). */
  readonly shiftKey: boolean
}

/**
 * Клетка и мировая точка под курсором для подсветки и статусбара. Пересчёт —
 * и при движении мыши, и при смене вьюпорта/модели под неподвижным курсором.
 */
export function useHoverCell(options: HoverCellOptions): {
  hoverCell: { x: number; y: number } | null
  hoverWorld: Point | null
  hoverShift: boolean
  recompute: () => void
  handlers: {
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerLeave: () => void
  }
} {
  const { canvasRef, viewportRef, viewport, model } = options
  const clientPointRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean } | null>(
    null,
  )
  const [hover, setHover] = useState<HoverState | null>(null)

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef)
  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)

  const recompute = useCallback(() => {
    const point = clientPointRef.current
    if (!point) return
    const cell = cellFromEvent(point)
    if (!isInsideMap(model, cell.x, cell.y)) {
      setHover(null)
      return
    }
    const world = worldFromEvent(point)
    setHover((previous) =>
      previous &&
      previous.cell.x === cell.x &&
      previous.cell.y === cell.y &&
      previous.world.x === world.x &&
      previous.world.y === world.y &&
      previous.shiftKey === point.shiftKey
        ? previous
        : { cell, world, shiftKey: point.shiftKey },
    )
  }, [cellFromEvent, worldFromEvent, model])

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      clientPointRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: event.shiftKey,
      }
      recompute()
    },
    [recompute],
  )

  const onPointerLeave = useCallback(() => {
    clientPointRef.current = null
    setHover(null)
  }, [])

  // Пан/зум под неподвижным курсором меняют клетку — пересчитываем.
  useEffect(() => {
    recompute()
  }, [viewport, recompute])

  return {
    hoverCell: hover?.cell ?? null,
    hoverWorld: hover?.world ?? null,
    hoverShift: hover?.shiftKey ?? false,
    recompute,
    handlers: { onPointerMove, onPointerLeave },
  }
}
