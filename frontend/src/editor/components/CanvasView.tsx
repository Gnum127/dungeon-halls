import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../hooks/useEditor'
import { useCanvasSize } from '../hooks/useCanvasSize'
import { useDevicePixelRatio } from '../hooks/useDevicePixelRatio'
import { useMiddleButtonPan } from '../hooks/useMiddleButtonPan'
import { useWheelZoom } from '../hooks/useWheelZoom'
import { useTerrainBrush } from '../hooks/useTerrainBrush'
import { useObjectTools } from '../hooks/useObjectTools'
import { useHoverCell } from '../hooks/useHoverCell'
import type { EditorStore } from '../store/EditorStore'
import type { Command } from '../model/commands'
import { renderMap } from '../render/renderMap'
import type { SpriteRenderContext } from '../render/sprites/loader'
import { drawStrokePreview } from '../render/strokePreview'
import { drawCellHighlight } from '../render/cellHighlight'
import { drawEdgeHighlight } from '../render/edgeHighlight'
import { BASE_CELL_SIZE, zoomAt } from '../render/viewport'
import type { PanZoomState, Viewport } from '../render/viewport'
import { useWallBrush } from '../hooks/useWallBrush'
import { useDoorTool } from '../hooks/useDoorTool'
import { useLightTool } from '../hooks/useLightTool'
import type { EditorTool } from '../tools/editorTool'
import { mergePointerHandlers } from './pointerHandlers'
import { formatCoords } from './formatCoords'
import styles from './CanvasView.module.css'

interface CanvasViewProps {
  store: EditorStore
  tool: EditorTool
  selectedObjectId: number | null
  onSelectObject: (id: number | null) => void
  /** Атлас спрайтов; undefined = цветной режим (fallback на плитки). */
  sprites?: SpriteRenderContext
  /** Свойства инструмента света. */
  lightRadius: number
  lightColor: string
}

export function CanvasView({
  store,
  tool,
  selectedObjectId,
  onSelectObject,
  sprites,
  lightRadius,
  lightColor,
}: CanvasViewProps) {
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
  const brushTile = tool.type === 'terrain' ? tool.tile : -1
  const { pendingCells, handlers: brushHandlers } = useTerrainBrush({
    canvasRef,
    active: tool.type === 'terrain',
    model,
    tile: brushTile,
    viewportRef,
    onCommit: handleBrushCommit,
  })

  const { handlers: wallHandlers } = useWallBrush({
    canvasRef,
    active: tool.type === 'wall' || tool.type === 'wall-eraser',
    model,
    present: tool.type === 'wall',
    viewportRef,
    onCommit: handleBrushCommit,
  })

  const { hoverEdge, handlers: doorHandlers } = useDoorTool({
    canvasRef,
    active: tool.type === 'door',
    model,
    viewportRef,
    onCommit: handleBrushCommit,
  })

  const { handlers: lightHandlers } = useLightTool({
    canvasRef,
    active: tool.type === 'light',
    model,
    radius: lightRadius,
    color: lightColor,
    viewportRef,
    onCommit: handleBrushCommit,
  })

  const handleSelect = useCallback((id: number | null) => onSelectObject(id), [onSelectObject])
  const { handlers: objectHandlers } = useObjectTools({
    canvasRef,
    viewportRef,
    store,
    model,
    tool,
    selectedId: selectedObjectId,
    onSelect: handleSelect,
  })

  const { hoverCell, handlers: hoverHandlers } = useHoverCell({
    canvasRef,
    viewportRef,
    viewport,
    model,
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
    renderMap(ctx, model, viewport, sprites)
    drawStrokePreview(ctx, pendingCells, viewport, brushTile, model.gridType)
    if (hoverCell) drawCellHighlight(ctx, hoverCell, viewport, model.gridType)
    if (hoverEdge && tool.type === 'door') drawEdgeHighlight(ctx, hoverEdge, viewport)
  }, [model, viewport, dpr, pendingCells, brushTile, hoverCell, sprites, hoverEdge, tool.type])

  const pointerHandlers = useMemo(
    () =>
      mergePointerHandlers(
        panHandlers,
        brushHandlers,
        objectHandlers,
        hoverHandlers,
        wallHandlers,
        doorHandlers,
        lightHandlers,
      ),
    [
      panHandlers,
      brushHandlers,
      objectHandlers,
      hoverHandlers,
      wallHandlers,
      doorHandlers,
      lightHandlers,
    ],
  )

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-testid="editor-canvas"
        onContextMenu={(event) => event.preventDefault()}
        {...pointerHandlers}
      />
      {/* Не live-регион: координаты меняются на каждый шаг курсора. */}
      <div className={styles.status} data-testid="editor-coords">
        {hoverCell ? formatCoords(hoverCell, model.gridType) : '—'}
      </div>
    </div>
  )
}
