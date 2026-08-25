import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useCallback } from 'react'
import type { Command } from '../model/commands'
import { lightAt } from '../model/lights'
import type { MapModel } from '../model/types'
import { isInsideMap } from '../tools/brush'
import { useCellFromEvent } from './useCellFromEvent'
import type { Viewport } from '../render/viewport'

interface LightToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** false — инструмент неактивен, события игнорируются. */
  active: boolean
  model: MapModel
  radius: number
  color: string
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

const LEFT_BUTTON = 0

/**
 * Инструмент света: клик ставит источник с текущими свойствами панели,
 * повторный клик по источнику удаляет его.
 */
export function useLightTool(options: LightToolOptions): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, radius, color, viewportRef, onCommit } = options
  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef, model.gridType)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!active || event.button !== LEFT_BUTTON) return
      const cell = cellFromEvent(event)
      if (!isInsideMap(model, cell.x, cell.y)) return

      const existing = lightAt(model.lights, cell.x, cell.y)
      if (existing) {
        onCommit({ kind: 'removeLight', id: existing.id })
        return
      }
      onCommit({ kind: 'addLight', x: cell.x, y: cell.y, radius, color })
    },
    [active, cellFromEvent, model, radius, color, onCommit],
  )

  return { handlers: { onPointerDown } }
}
