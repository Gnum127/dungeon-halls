import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GenerationParams } from '@/generator'
import { createRng, generateCaves, generateDungeon } from '@/generator'
import { CanvasView } from './components/CanvasView'
import { LightPanel } from './components/LightPanel'
import { MapFileActions } from './components/MapFileActions'
import type { FileActionStatus } from './components/MapFileActions'
import { GeneratorPanel } from './components/GeneratorPanel'
import { ObjectPalette } from './components/ObjectPalette'
import { RenderModePicker } from './components/RenderModePicker'
import { RegionTools } from './components/RegionTools'
import { SectionPanel } from './components/SectionPanel'
import { TerrainPalette } from './components/TerrainPalette'
import { ToolRail } from './components/ToolRail'
import type { EditorSectionId } from './components/ToolRail'
import { usePersistentBoolean } from './hooks/usePersistentBoolean'
import { useSpriteAtlas } from './hooks/useSpriteAtlas'
import { createEmptyMap } from './model/createEmptyMap'
import { OBJECT_KIND_ENTRIES, cycleScale } from './model/objects'
import type { ObjectKindId } from './model/objects'
import type { ObjectRotation, ObjectScale, TileTypeName } from './model/types'
import type { RenderMode } from './render/renderMode'
import { loadRenderMode, saveRenderMode } from './render/renderMode'
import { loadElementImage, saveElementImage } from './render/elementImage'
import { loadDoorImageId, saveDoorImageId } from './render/doorTexture'
import { DEFAULT_DOOR_OPEN_ANGLE } from './model/doors'
import { EditorStore } from './store/EditorStore'
import type { EditorTool } from './tools/editorTool'
import { useEditorHotkeys } from './hooks/useEditorHotkeys'
import { generatorResultToSnapshot } from './tools/generatorAdapter'
import styles from './EditorPage.module.css'

const AUTO_WALLS_STORAGE_KEY = 'dungeon-halls.editor.autoWalls'

function defaultScaleForKind(kindId: ObjectKindId): ObjectScale {
  const entry = OBJECT_KIND_ENTRIES.find((e) => e.id === kindId)
  return entry?.defaultScale ?? { w: 1, h: 1 }
}

export function EditorPage() {
  const { t } = useTranslation()
  const [store] = useState(() => new EditorStore(createEmptyMap()))
  const [tileType, setTileType] = useState<TileTypeName>('floor')
  const [tool, setTool] = useState<EditorTool>(() => ({ type: 'region-rect', tileType: 'floor' }))
  const [doorImageId, setDoorImageId] = useState<string | null>(() => loadDoorImageId())
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null)
  const [fileStatus, setFileStatus] = useState<FileActionStatus | null>(null)
  const [polygonVertexCount, setPolygonVertexCount] = useState(6)
  const [activeSection, setActiveSection] = useState<EditorSectionId | null>('landscape')
  const [landscapeCollapsed, toggleLandscapeCollapsed] = usePersistentBoolean(
    'dungeon-halls.editor.panels.collapsed.v1.landscape',
    false,
  )
  const [elementsCollapsed, toggleElementsCollapsed] = usePersistentBoolean(
    'dungeon-halls.editor.panels.collapsed.v1.elements',
    false,
  )
  const [autoWalls, toggleAutoWalls] = usePersistentBoolean(AUTO_WALLS_STORAGE_KEY, true)

  const { atlas, status: atlasStatus } = useSpriteAtlas()
  const [renderMode, setRenderMode] = useState<RenderMode>(loadRenderMode)
  const [lightRadius, setLightRadius] = useState(3)
  const [lightColor, setLightColor] = useState('#ffd682')
  const [objectRotation, setObjectRotation] = useState<ObjectRotation>(0)
  const [objectScale, setObjectScale] = useState<ObjectScale>({ w: 1, h: 1 })

  const [elementImageOverrides, setElementImageOverrides] = useState<
    Partial<Record<ObjectKindId, string | null>>
  >(() => {
    const initial: Partial<Record<ObjectKindId, string | null>> = {}
    for (const entry of OBJECT_KIND_ENTRIES) initial[entry.id] = loadElementImage(entry.id)
    return initial
  })

  const spriteContext =
    renderMode === 'sprites' && atlas
      ? { ...atlas, imageOverrides: elementImageOverrides }
      : undefined

  function selectTile(next: TileTypeName) {
    setSelectedObjectId(null)
    setTileType(next)
    setTool((current) =>
      current.type === 'region-polygon'
        ? { type: 'region-polygon', tileType: next, vertices: polygonVertexCount }
        : { type: 'region-rect', tileType: next },
    )
  }

  function selectRect() {
    setSelectedObjectId(null)
    setTool({ type: 'region-rect', tileType })
  }

  function selectPolygon() {
    setSelectedObjectId(null)
    setTool({ type: 'region-polygon', tileType, vertices: polygonVertexCount })
  }

  function selectEraser() {
    setSelectedObjectId(null)
    setTileType('empty')
    setTool({ type: 'region-rect', tileType: 'empty' })
  }

  function selectWall() {
    setSelectedObjectId(null)
    setTool({ type: 'wall' })
  }

  function selectDoor() {
    setSelectedObjectId(null)
    setTool({ type: 'door', imageId: doorImageId, openAngle: DEFAULT_DOOR_OPEN_ANGLE })
  }

  function changeDoorImage(imageId: string | null) {
    saveDoorImageId(imageId)
    setDoorImageId(imageId)
    if (tool.type === 'door') setTool({ ...tool, imageId })
  }

  function changeVertexCount(count: number) {
    setPolygonVertexCount(count)
    if (tool.type === 'region-polygon') setTool({ ...tool, vertices: count })
  }

  function selectObjectKind(kindId: ObjectKindId) {
    setSelectedObjectId(null)
    const scale = defaultScaleForKind(kindId)
    setObjectScale(scale)
    setTool({ type: 'object', kindId, rotation: objectRotation, scale })
  }

  function selectMoveTool() {
    setSelectedObjectId(null)
    setTool({ type: 'select' })
  }

  function rotateObject() {
    const next: ObjectRotation = ((objectRotation + 90) % 360) as ObjectRotation
    setObjectRotation(next)
    if (tool.type === 'object') {
      setTool({ ...tool, rotation: next })
    }
  }

  function resizeObject() {
    if (tool.type !== 'object') return
    const next = cycleScale(tool.kindId, objectScale)
    setObjectScale(next)
    setTool({ ...tool, scale: next })
  }

  function selectElementImage(kindId: ObjectKindId, imageId: string | null) {
    saveElementImage(kindId, imageId)
    setElementImageOverrides((prev) => ({ ...prev, [kindId]: imageId }))
  }

  function changeRenderMode(mode: RenderMode) {
    setRenderMode(mode)
    saveRenderMode(mode)
  }

  function toggleSection(id: EditorSectionId) {
    setActiveSection((current) => (current === id ? null : id))
  }

  function handleGenerate(params: GenerationParams) {
    setSelectedObjectId(null)
    const rng = createRng(params.seed)
    const result =
      params.type === 'dungeon' ? generateDungeon(params, rng) : generateCaves(params, rng)
    store.dispatch({ kind: 'replaceMap', snapshot: generatorResultToSnapshot(result) })
  }

  function renderSection() {
    switch (activeSection) {
      case 'landscape':
        return (
          <SectionPanel
            title={t('editor.sections.landscape')}
            collapsible
            collapsed={landscapeCollapsed}
            onToggleCollapsed={toggleLandscapeCollapsed}
          >
            <TerrainPalette selected={tileType} onSelect={selectTile} />
            <RegionTools
              activeTool={tool}
              tileType={tileType}
              vertexCount={polygonVertexCount}
              autoWalls={autoWalls}
              doorImageId={doorImageId}
              onSelectRect={selectRect}
              onSelectPolygon={selectPolygon}
              onSelectEraser={selectEraser}
              onSelectWall={selectWall}
              onSelectDoor={selectDoor}
              onVertexCountChange={changeVertexCount}
              onAutoWallsChange={toggleAutoWalls}
              onDoorImageChange={changeDoorImage}
            />
          </SectionPanel>
        )
      case 'elements':
        return (
          <SectionPanel
            title={t('editor.sections.elements')}
            collapsible
            collapsed={elementsCollapsed}
            onToggleCollapsed={toggleElementsCollapsed}
          >
            <ObjectPalette
              activeKindId={tool.type === 'object' ? tool.kindId : null}
              selectActive={tool.type === 'select'}
              onSelectKind={selectObjectKind}
              onSelectSelectTool={selectMoveTool}
              objectRotation={objectRotation}
              objectScale={objectScale}
              onRotate={rotateObject}
              onResize={resizeObject}
              elementImageOverrides={elementImageOverrides}
              onSelectElementImage={selectElementImage}
            />
          </SectionPanel>
        )
      case 'light':
        return (
          <SectionPanel title={t('editor.sections.light')}>
            <LightPanel
              active={tool.type === 'light'}
              radius={lightRadius}
              color={lightColor}
              onToggle={() => {
                setSelectedObjectId(null)
                setTool((current) =>
                  current.type === 'light' ? { type: 'select' } : { type: 'light' },
                )
              }}
              onRadiusChange={(radius) => {
                if (radius >= 1 && radius <= 30) setLightRadius(radius)
              }}
              onColorChange={setLightColor}
            />
          </SectionPanel>
        )
      case 'view':
        return (
          <SectionPanel title={t('editor.sections.view')}>
            <RenderModePicker
              mode={renderMode}
              atlasStatus={atlasStatus}
              onChange={changeRenderMode}
            />
          </SectionPanel>
        )
      case 'generation':
        return (
          <SectionPanel title={t('editor.sections.generation')}>
            <GeneratorPanel onGenerate={handleGenerate} />
          </SectionPanel>
        )
      case 'file':
        return (
          <SectionPanel title={t('editor.sections.file')}>
            <MapFileActions
              getModel={() => store.getModel()}
              sprites={spriteContext}
              onLoaded={(loaded) => store.reset(loaded)}
              onResult={setFileStatus}
            />
            {fileStatus !== null && (
              <p className={styles.fileStatus} role="status">
                {t(`editor.files.${fileStatus}`)}
              </p>
            )}
          </SectionPanel>
        )
      default:
        return null
    }
  }

  useEditorHotkeys({
    onUndo: () => store.undo(),
    onRedo: () => store.redo(),
    onSelectSelect: selectMoveTool,
    onSelectRegionRect: selectRect,
    onSelectRegionPolygon: selectPolygon,
    onSelectEraser: selectEraser,
    onSelectWalls: selectWall,
    onSelectDoors: selectDoor,
    onSelectLights: () => {
      setSelectedObjectId(null)
      setTool({ type: 'light' })
    },
    onSelectObjectKind: (kindId) => selectObjectKind(kindId),
    onRotateObject: rotateObject,
  })

  return (
    <div className={styles.root}>
      <ToolRail active={activeSection} onSelect={toggleSection} />
      {activeSection !== null && <aside className={styles.sidebar}>{renderSection()}</aside>}
      <div className={styles.workspace}>
        <CanvasView
          store={store}
          tool={tool}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          sprites={spriteContext}
          tileType={tileType}
          autoWalls={autoWalls}
          lightRadius={lightRadius}
          lightColor={lightColor}
        />
      </div>
    </div>
  )
}
