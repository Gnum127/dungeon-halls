import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../hooks/useEditor'
import { useCanvasSize } from '../hooks/useCanvasSize'
import { useDevicePixelRatio } from '../hooks/useDevicePixelRatio'
import { useMiddleButtonPan } from '../hooks/useMiddleButtonPan'
import { useWheelZoom } from '../hooks/useWheelZoom'
import { useTerrainBrush } from '../hooks/useTerrainBrush'
import type { EditorStore } from '../store/EditorStore'
import type { Command } from '../model/commands'
import { TILE_TYPES } from '../model/types'
import type { TileValue } from '../model/types'
import { TILE_COLORS } from '../render/colors'
import { renderMap } from '../render/renderMap'
import { BASE_CELL_SIZE, zoomAt } from '../render/viewport'
import type { PanZoomState, Viewport } from '../render/viewport'
import styles from './CanvasView.module.css'

interface CanvasViewProps {
  store: EditorStore
  brushTile: TileValue
}

export function CanvasView({ store, brushTile }: CanvasViewProps) {
  const model = useEditor(store)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const size = useCanvasSize(wrapRef)
  const dpr = useDevicePixelRatio()
  const [panZoom, setPanZoom] = useState<PanZoomState>({
    cellSize: BASE_CELL_SIZE,
    offsetX: 0,
    offsetY: 0,
  })

  const viewport = useMemo(
    () => ({
      ...panZoom,
      width: Math.floor(size.width),
      height: Math.floor(size.height),
    }),
    [panZoom, size],
  )

  // Зеркало для хуков, читающих вьюпорт внутри событий.
  const viewportRef = useRef<Viewport>(viewport)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const handleZoom = useCallback((screenX: number, screenY: number, factor: number) => {
    setPanZoom((current) => zoomAt(current, screenX, screenY, current.cellSize * factor))
  }, [])
  useWheelZoom(canvasRef, handleZoom)

  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    setPanZoom((current) => ({
      ...current,
      offsetX: current.offsetX - deltaX,
      offsetY: current.offsetY - deltaY,
    }))
  }, [])
  const { handlers: panHandlers } = useMiddleButtonPan(canvasRef, handlePan)

  const handleBrushCommit = useCallback(
    (command: Command | null) => {
      if (!command) return
      store.dispatch(command)
    },
    [store],
  )
  const { pendingCells, handlers: brushHandlers } = useTerrainBrush({
    canvasRef,
    active: true,
    model,
    tile: brushTile,
    viewportRef,
    onCommit: handleBrushCommit,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || viewport.width < 1 || viewport.height < 1) return

    const pixelWidth = Math.floor(viewport.width * dpr)
    const pixelHeight = Math.floor(viewport.height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderMap(ctx, model, viewport)

    // Превью незавершённого штриха поверх базового рендера.
    const typeName = TILE_TYPES[brushTile]
    if (pendingCells.length > 0 && typeName) {
      ctx.globalAlpha = 0.6
      ctx.fillStyle = TILE_COLORS[typeName]
      for (const cell of pendingCells) {
        ctx.fillRect(
          cell.x * viewport.cellSize - viewport.offsetX,
          cell.y * viewport.cellSize - viewport.offsetY,
          viewport.cellSize,
          viewport.cellSize,
        )
      }
      ctx.globalAlpha = 1
    }
  }, [model, viewport, dpr, pendingCells, brushTile])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-testid="editor-canvas"
        {...panHandlers}
        {...brushHandlers}
      />
    </div>
  )
}
