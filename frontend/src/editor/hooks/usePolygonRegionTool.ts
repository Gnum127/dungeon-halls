import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { snapToHalfGrid } from '../model/snap'
import type { MapModel, TileTypeName } from '../model/types'
import type { Viewport } from '../render/viewport'
import { isEditableTarget } from '../dom/isEditableTarget'
import { isWorldPointInsideMap } from '../tools/isInsideMap'
import { buildRegionCommand } from '../tools/regionCommit'
import { isCommittablePolygon, regularPolygonPoints } from '../tools/regions'
import { useWorldPointFromEvent } from './useCellFromEvent'

interface PolygonRegionToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  active: boolean
  model: MapModel
  tileType: TileTypeName
  vertices: number
  autoWalls: boolean
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

export interface PolygonPreview {
  readonly center: { x: number; y: number }
  readonly current: { x: number; y: number }
}

const LEFT_BUTTON = 0

/**
 * Инструмент «Регион-многогранник»: первый клик — центр, курсор тянет
 * радиусную точку (задаёт поворот и размер), второй клик фиксирует правильный
 * N-угольник. Точки — мировые float, привязанные к 0.5 в момент клика. Esc
 * отменяет.
 */
export function usePolygonRegionTool(options: PolygonRegionToolOptions): {
  preview: PolygonPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerLeave: () => void
  }
} {
  const { canvasRef, active, model, tileType, vertices, autoWalls, viewportRef, onCommit } = options
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null)
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null)
  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)
  // При деактивации инструмента сбрасываем недостроенный полигон во время
  // рендера (не в эффекте — иначе лишний каскадный рендер React).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) {
      setCenter(null)
      setCurrent(null)
    }
  }

  /** Мировая точка события: границы карты проверяются до снапа, затем — 0.5. */
  function pointFromEvent(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } | null {
    const world = worldFromEvent(event)
    if (!isWorldPointInsideMap(model, world.x, world.y)) return null
    return snapToHalfGrid(world)
  }

  function commit(radialPoint: { x: number; y: number }) {
    if (!center) return
    const points = regularPolygonPoints(center, radialPoint, vertices, {
      cols: model.grid.width,
      rows: model.grid.height,
    })
    // Кламп к границам карты мог схлопнуть полигон (радиус целиком за краем) —
    // тогда не коммитим, чтобы не создавать вырожденный/битый регион.
    if (!isCommittablePolygon(points)) return
    setCenter(null)
    setCurrent(null)
    onCommit(buildRegionCommand(model, tileType, points, autoWalls))
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON) return
    const point = pointFromEvent(event)
    if (!point) return
    event.preventDefault()
    if (!center) {
      setCenter(point)
      setCurrent(point)
      return
    }
    commit(point)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || !center) return
    const point = pointFromEvent(event)
    if (point) setCurrent(point)
  }

  function onPointerLeave() {
    // Курсор ушёл — превью радиуса скрываем, центр оставляем.
    if (center) setCurrent(center)
  }

  useEffect(() => {
    if (!active || !center) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isEditableTarget(event.target)) return
      setCenter(null)
      setCurrent(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, center])

  const preview = center ? { center, current: current ?? center } : null

  return { preview, handlers: { onPointerDown, onPointerMove, onPointerLeave } }
}
