import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../hooks/useEditor'
import { useCanvasSize } from '../hooks/useCanvasSize'
import { useDevicePixelRatio } from '../hooks/useDevicePixelRatio'
import { useMiddleButtonPan } from '../hooks/useMiddleButtonPan'
import { useWheelZoom } from '../hooks/useWheelZoom'
import { useObjectTools } from '../hooks/useObjectTools'
import { useHoverCell } from '../hooks/useHoverCell'
import { useLightTool } from '../hooks/useLightTool'
import { useDoorTool } from '../hooks/useDoorTool'
import { useStairsTool } from '../hooks/useStairsTool'
import { DEFAULT_DOOR_OPEN_ANGLE, doorLeafEnd } from '../model/doors'
import { DOOR_FILL_COLOR, DOOR_THICKNESS_FRACTION, STAIRS_OUTLINE_COLOR } from '../render/colors'
import { drawStairsSelection } from '../render/stairsHighlight'
import { useRectRegionTool } from '../hooks/useRectRegionTool'
import { usePolygonRegionTool } from '../hooks/usePolygonRegionTool'
import { useWallTool } from '../hooks/useWallTool'
import type { EditorStore } from '../store/EditorStore'
import type { Command } from '../model/commands'
import { renderMap } from '../render/renderMap'
import type { SpriteRenderContext } from '../render/sprites/loader'
import { drawHoverHighlight } from '../render/hoverHighlight'
import { drawSnapCandidates, toolUsesHoverSnap } from '../render/snapPreview'
import { drawGhostPreview } from '../render/ghostPreview'
import { rectPolygon, regularPolygonPoints } from '../tools/regions'
import { drawRegionWithWalls } from '../tools/regionPreview'
import { BASE_CELL_SIZE, zoomAt } from '../render/viewport'
import type { PanZoomState, Viewport } from '../render/viewport'
import type { TileTypeName } from '../model/types'
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
  /** Текущее покрытие для инструментов регионов (кисть заливки). */
  tileType: TileTypeName
  /** Авто-стены: пересчитывать контур при построении регионов. */
  autoWalls: boolean
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
  tileType,
  autoWalls,
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

  const onCommit = useCallback(
    (command: Command | null) => {
      if (!command) return
      store.dispatch(command)
    },
    [store],
  )

  const { handlers: rectRegionHandlers, preview: rectPreview } = useRectRegionTool({
    canvasRef,
    active: tool.type === 'region-rect',
    model,
    tileType,
    autoWalls,
    viewportRef,
    onCommit,
  })

  const { handlers: polygonRegionHandlers, preview: polygonPreview } = usePolygonRegionTool({
    canvasRef,
    active: tool.type === 'region-polygon',
    model,
    tileType,
    vertices: tool.type === 'region-polygon' ? tool.vertices : 6,
    autoWalls,
    viewportRef,
    onCommit,
  })

  const { handlers: wallHandlers, preview: wallPreview } = useWallTool({
    canvasRef,
    active: tool.type === 'wall',
    model,
    viewportRef,
    onCommit,
  })

  const { handlers: doorHandlers, preview: doorPreview } = useDoorTool({
    canvasRef,
    active: tool.type === 'door',
    model,
    imageId: tool.type === 'door' ? tool.imageId : null,
    openAngle: tool.type === 'door' ? tool.openAngle : DEFAULT_DOOR_OPEN_ANGLE,
    viewportRef,
    onCommit,
  })

  const { handlers: lightHandlers } = useLightTool({
    canvasRef,
    active: tool.type === 'light',
    model,
    radius: lightRadius,
    color: lightColor,
    viewportRef,
    onCommit,
  })

  const {
    handlers: stairsHandlers,
    preview: stairsPreview,
    selectedId: stairsSelectedId,
  } = useStairsTool({
    canvasRef,
    active: tool.type === 'stairs',
    model,
    viewportRef,
    onCommit,
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

  const {
    hoverCell,
    hoverWorld,
    handlers: hoverHandlers,
  } = useHoverCell({
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

    if (tool.type === 'stairs' && stairsSelectedId) {
      const selected = model.stairs.find((stairs) => stairs.id === stairsSelectedId)
      if (selected) drawStairsSelection(ctx, selected.polygon, viewport)
    }

    if (hoverCell && hoverWorld) {
      drawHoverHighlight(ctx, tool, hoverCell, hoverWorld, viewport)
    }
    if (hoverCell && hoverWorld && toolUsesHoverSnap(tool)) {
      drawSnapCandidates(ctx, model, hoverCell, hoverWorld, viewport)
    }
    if (hoverCell && tool.type === 'object') {
      drawGhostPreview(ctx, hoverCell, viewport, tool)
    }

    if (tool.type === 'region-rect' && rectPreview) {
      const polygon = rectPolygon(
        rectPreview.start.x,
        rectPreview.start.y,
        rectPreview.current.x,
        rectPreview.current.y,
        model.grid.width,
        model.grid.height,
      )
      drawRegionWithWalls(ctx, model, viewport, tileType, polygon, autoWalls)
    }

    if (tool.type === 'region-polygon' && polygonPreview) {
      const centerPoint = { x: polygonPreview.center.x + 0.5, y: polygonPreview.center.y + 0.5 }
      const radialPoint = { x: polygonPreview.current.x + 0.5, y: polygonPreview.current.y + 0.5 }
      const points = regularPolygonPoints(centerPoint, radialPoint, tool.vertices)
      if (points.length >= 3) {
        drawRegionWithWalls(ctx, model, viewport, tileType, points, autoWalls)
      }
    }

    if (tool.type === 'wall' && wallPreview) {
      ctx.strokeStyle = '#e0b050'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(
        wallPreview.a.x * viewport.cellSize - viewport.offsetX,
        wallPreview.a.y * viewport.cellSize - viewport.offsetY,
      )
      ctx.lineTo(
        wallPreview.b.x * viewport.cellSize - viewport.offsetX,
        wallPreview.b.y * viewport.cellSize - viewport.offsetY,
      )
      ctx.stroke()
    }

    if (tool.type === 'door' && doorPreview) {
      const leaf = doorLeafEnd({
        id: 'preview',
        a: doorPreview.a,
        b: doorPreview.b,
        openAngle: tool.openAngle,
        imageId: null,
      })
      ctx.strokeStyle = DOOR_FILL_COLOR
      ctx.lineWidth = Math.max(4, viewport.cellSize * DOOR_THICKNESS_FRACTION)
      ctx.lineCap = 'butt'
      const ax = doorPreview.a.x * viewport.cellSize - viewport.offsetX
      const ay = doorPreview.a.y * viewport.cellSize - viewport.offsetY
      // Линия проёма — подсказка о месте двери (на финальном рендере проём
      // вырезается в стене); створка — под углом панели.
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(
        doorPreview.b.x * viewport.cellSize - viewport.offsetX,
        doorPreview.b.y * viewport.cellSize - viewport.offsetY,
      )
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(
        leaf.x * viewport.cellSize - viewport.offsetX,
        leaf.y * viewport.cellSize - viewport.offsetY,
      )
      ctx.stroke()
    }

    if (tool.type === 'stairs' && stairsPreview) {
      const previewPoints = stairsPreview.points
      ctx.strokeStyle = STAIRS_OUTLINE_COLOR
      ctx.lineWidth = Math.max(2, viewport.cellSize * 0.06)
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(
        previewPoints[0].x * viewport.cellSize - viewport.offsetX,
        previewPoints[0].y * viewport.cellSize - viewport.offsetY,
      )
      for (let i = 1; i < previewPoints.length; i += 1) {
        ctx.lineTo(
          previewPoints[i].x * viewport.cellSize - viewport.offsetX,
          previewPoints[i].y * viewport.cellSize - viewport.offsetY,
        )
      }
      if (previewPoints.length === 4) ctx.closePath()
      ctx.stroke()
    }
  }, [
    model,
    viewport,
    dpr,
    hoverCell,
    hoverWorld,
    sprites,
    tool,
    rectPreview,
    polygonPreview,
    wallPreview,
    doorPreview,
    stairsPreview,
    stairsSelectedId,
    tileType,
    autoWalls,
  ])

  const pointerHandlers = useMemo(
    () =>
      mergePointerHandlers(
        panHandlers,
        objectHandlers,
        hoverHandlers,
        lightHandlers,
        doorHandlers,
        stairsHandlers,
        rectRegionHandlers,
        polygonRegionHandlers,
        wallHandlers,
      ),
    [
      panHandlers,
      objectHandlers,
      hoverHandlers,
      lightHandlers,
      doorHandlers,
      stairsHandlers,
      rectRegionHandlers,
      polygonRegionHandlers,
      wallHandlers,
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
      <div className={styles.status} data-testid="editor-coords">
        {hoverCell ? formatCoords(hoverCell) : '—'}
      </div>
    </div>
  )
}
