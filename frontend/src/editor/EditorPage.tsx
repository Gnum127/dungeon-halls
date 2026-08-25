import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GenerationParams } from '@/generator'
import { createRng, generateCaves, generateDungeon } from '@/generator'
import { CanvasView } from './components/CanvasView'
import { GridTypePicker } from './components/GridTypePicker'
import { MapFileActions } from './components/MapFileActions'
import type { FileActionStatus } from './components/MapFileActions'
import { GeneratorPanel } from './components/GeneratorPanel'
import { ObjectPalette } from './components/ObjectPalette'
import { RenderModePicker } from './components/RenderModePicker'
import { TerrainPalette } from './components/TerrainPalette'
import { useEditor } from './hooks/useEditor'
import { useSpriteAtlas } from './hooks/useSpriteAtlas'
import { createEmptyMap } from './model/createEmptyMap'
import { EMPTY_TILE, TILE_TYPES } from './model/types'
import type { TileValue } from './model/types'
import type { ObjectKindId } from './model/objects'
import type { RenderMode } from './render/renderMode'
import { loadRenderMode, saveRenderMode } from './render/renderMode'
import { EditorStore } from './store/EditorStore'
import type { EditorTool } from './tools/editorTool'
import { useEditorHotkeys } from './hooks/useEditorHotkeys'
import styles from './EditorPage.module.css'

const DEFAULT_MAP_WIDTH = 40
const DEFAULT_MAP_HEIGHT = 30

function defaultBrushTile(): TileValue {
  const floor = TILE_TYPES.indexOf('floor')
  return floor >= 0 ? floor : EMPTY_TILE
}

export function EditorPage() {
  const { t } = useTranslation()
  const [store] = useState(
    () => new EditorStore(createEmptyMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT)),
  )
  const [tool, setTool] = useState<EditorTool>(() => ({
    type: 'terrain',
    tile: defaultBrushTile(),
  }))
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null)
  const [fileStatus, setFileStatus] = useState<FileActionStatus | null>(null)
  // Реактивная модель: выбор типа сетки и дизейбл генератора живут в UI страницы.
  const model = useEditor(store)

  // Режим отображения и атлас — настройка просмотра, не данные карты.
  const { atlas, status: atlasStatus } = useSpriteAtlas()
  const [renderMode, setRenderMode] = useState<RenderMode>(loadRenderMode)

  // Последний непустой тайл кисти — куда возвращает клавиша B.
  const lastBrushTileRef = useRef<TileValue>(defaultBrushTile())

  function selectTerrain(tile: TileValue) {
    setSelectedObjectId(null)
    if (tile !== EMPTY_TILE) lastBrushTileRef.current = tile
    setTool({ type: 'terrain', tile })
  }

  function selectObjectKind(kindId: ObjectKindId) {
    setSelectedObjectId(null)
    setTool({ type: 'object', kindId })
  }

  function selectMoveTool() {
    setSelectedObjectId(null)
    setTool({ type: 'select' })
  }

  function changeRenderMode(mode: RenderMode) {
    setRenderMode(mode)
    saveRenderMode(mode)
  }

  function handleGenerate(params: GenerationParams) {
    // Выделение сбрасываем: id объектов не переживают replaceMap,
    // иначе Delete по несуществующему объекту бросит RangeError.
    setSelectedObjectId(null)
    const rng = createRng(params.seed)
    const result =
      params.type === 'dungeon' ? generateDungeon(params, rng) : generateCaves(params, rng)
    store.dispatch({
      kind: 'replaceMap',
      width: result.width,
      height: result.height,
      tiles: result.tiles,
    })
  }

  useEditorHotkeys({
    onUndo: () => store.undo(),
    onRedo: () => store.redo(),
    onSelectBrush: () => selectTerrain(lastBrushTileRef.current),
    onSelectEraser: () => selectTerrain(EMPTY_TILE),
  })

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <RenderModePicker mode={renderMode} atlasStatus={atlasStatus} onChange={changeRenderMode} />
        <GridTypePicker
          gridType={model.gridType}
          onChange={(gridType) => store.dispatch({ kind: 'setGridType', gridType })}
        />
        <GeneratorPanel onGenerate={handleGenerate} gridDisabled={model.gridType !== 'square'} />
        <MapFileActions
          getModel={() => store.getModel()}
          onLoaded={(model) => store.reset(model)}
          onResult={setFileStatus}
        />
        {fileStatus !== null && (
          <p className={styles.fileStatus} role="status">
            {t(`editor.files.${fileStatus}`)}
          </p>
        )}
        <TerrainPalette
          selected={tool.type === 'terrain' ? tool.tile : -1}
          onSelect={selectTerrain}
        />
        <ObjectPalette
          activeKindId={tool.type === 'object' ? tool.kindId : null}
          selectActive={tool.type === 'select'}
          onSelectKind={selectObjectKind}
          onSelectSelectTool={selectMoveTool}
        />
      </aside>
      <div className={styles.workspace}>
        <CanvasView
          store={store}
          tool={tool}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          sprites={renderMode === 'sprites' && atlas ? atlas : undefined}
        />
      </div>
    </div>
  )
}
