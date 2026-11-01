import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { snapToHalfGrid } from '../model/snap'
import { isEditableTarget } from '../dom/isEditableTarget'
import { isValidStairsShape, stairsVertices } from '../tools/stairsPlacement'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { useWorldPointFromEvent } from './useCellFromEvent'

interface StairsToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  active: boolean
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

export interface StairsPreview {
  /** Собранные вершины: 2 — база (линия), 4 — параллелограмм. */
  readonly points: readonly Point[]
}

const LEFT_BUTTON = 0

/**
 * Инструмент лестницы в 3 клика: `start` → `base` (ширина) → `end` (дальний
 * край); четвёртая вершина — зеркало относительно серединного перпендикуляра к
 * базе. Все клики привязаны к 0.5; живое превью. Esc отменяет построение.
 */
export function useStairsTool(options: StairsToolOptions): {
  preview: StairsPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: () => void
    onPointerLeave: () => void
  }
} {
  const { canvasRef, active, viewportRef, onCommit } = options
  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)
  const [clicks, setClicks] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)

  // Деактивация инструмента сбрасывает недостроенную лестницу (рендер-фаза).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) {
      setClicks([])
      setCursor(null)
    }
  }

  useEffect(() => {
    if (!active || clicks.length === 0) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isEditableTarget(event.target)) return
      setClicks([])
      setCursor(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, clicks.length])

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON) return
    const world = worldFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return
    event.preventDefault()
    const snapped = snapToHalfGrid(world)

    if (clicks.length === 0) {
      setClicks([snapped])
      return
    }
    if (clicks.length === 1) {
      setClicks([clicks[0], snapped])
      return
    }
    const vertices = stairsVertices(clicks[0], clicks[1], snapped)
    setClicks([])
    setCursor(null)
    if (!isValidStairsShape(vertices)) return
    onCommit({ kind: 'addStairs', polygon: vertices })
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || clicks.length === 0) return
    const world = worldFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return
    setCursor(snapToHalfGrid(world))
  }

  function onPointerCancel() {
    setClicks([])
    setCursor(null)
  }

  function onPointerLeave() {
    if (clicks.length > 0) setCursor(null)
  }

  let preview: StairsPreview | null = null
  if (clicks.length === 1 && cursor) preview = { points: [clicks[0], cursor] }
  if (clicks.length === 1 && !cursor) preview = { points: [clicks[0], clicks[0]] }
  if (clicks.length === 2) {
    const [p0, p1] = clicks
    preview = cursor ? { points: stairsVertices(p0, p1, cursor) } : { points: [p0, p1] }
  }

  return {
    preview,
    handlers: { onPointerDown, onPointerMove, onPointerCancel, onPointerLeave },
  }
}
