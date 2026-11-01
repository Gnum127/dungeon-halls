import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { snapToHalfGrid } from '../model/snap'
import { isEditableTarget } from '../dom/isEditableTarget'
import { isValidStairsShape, stairsVertices } from '../tools/stairsPlacement'
import { stairsHitTest } from '../tools/stairsHitTest'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { useWorldPointFromEvent } from './useCellFromEvent'

interface StairsToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  active: boolean
  model: MapModel
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

export interface StairsPreview {
  /** Собранные вершины: 2 — база (линия), 4 — параллелограмм. */
  readonly points: readonly Point[]
}

const LEFT_BUTTON = 0
const RIGHT_BUTTON = 2

/**
 * Инструмент лестницы в 3 клика: `start` → `base` (ширина) → `end` (дальний
 * край); четвёртая вершина — зеркало относительно серединного перпендикуляра к
 * базе. Все клики привязаны к 0.5; живое превью. Клик по существующей лестнице
 * выделяет её, правый клик или Delete удаляет; Esc отменяет построение.
 */
export function useStairsTool(options: StairsToolOptions): {
  preview: StairsPreview | null
  selectedId: string | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: () => void
    onPointerLeave: () => void
  }
} {
  const { canvasRef, active, model, viewportRef, onCommit } = options
  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)
  const [clicks, setClicks] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Деактивация инструмента сбрасывает недостроенную лестницу и выделение;
  // удалённая лестница не остаётся выделенной (рендер-фаза, без эффектов).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) {
      setClicks([])
      setCursor(null)
      setSelectedId(null)
    }
  }
  if (selectedId && !model.stairs.some((stairs) => stairs.id === selectedId)) {
    setSelectedId(null)
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

  useEffect(() => {
    if (!active || !selectedId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' || isEditableTarget(event.target)) return
      onCommit({ kind: 'removeStairs', id: selectedId })
      setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, selectedId, onCommit])

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active) return
    if (event.button !== LEFT_BUTTON && event.button !== RIGHT_BUTTON) return
    const world = worldFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return

    if (event.button === RIGHT_BUTTON) {
      const hit = stairsHitTest(world, model.stairs)
      if (!hit) return
      event.preventDefault()
      setClicks([])
      setCursor(null)
      setSelectedId(null)
      onCommit({ kind: 'removeStairs', id: hit })
      return
    }

    event.preventDefault()
    if (clicks.length === 0) {
      const hit = stairsHitTest(world, model.stairs)
      if (hit) {
        setSelectedId(hit)
        return
      }
      setSelectedId(null)
      setClicks([snapToHalfGrid(world)])
      return
    }
    const snapped = snapToHalfGrid(world)
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
    selectedId,
    handlers: { onPointerDown, onPointerMove, onPointerCancel, onPointerLeave },
  }
}
