import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasView } from './components/CanvasView'
import { MapFileActions } from './components/MapFileActions'
import type { FileActionStatus } from './components/MapFileActions'
import { ObjectPalette } from './components/ObjectPalette'
import { TerrainPalette } from './components/TerrainPalette'
import { createEmptyMap } from './model/createEmptyMap'
import { EMPTY_TILE, TILE_TYPES } from './model/types'
import type { TileValue } from './model/types'
import type { ObjectKindId } from './model/objects'
import { EditorStore } from './store/EditorStore'
import type { EditorTool } from './tools/editorTool'
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

  function selectTerrain(tile: TileValue) {
    setSelectedObjectId(null)
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

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
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
        />
      </div>
    </div>
  )
}
