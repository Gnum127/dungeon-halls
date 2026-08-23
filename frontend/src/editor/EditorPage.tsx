import { useState } from 'react'
import { CanvasView } from './components/CanvasView'
import { TerrainPalette } from './components/TerrainPalette'
import { createEmptyMap } from './model/createEmptyMap'
import { EMPTY_TILE, TILE_TYPES } from './model/types'
import type { TileValue } from './model/types'
import { EditorStore } from './store/EditorStore'
import styles from './EditorPage.module.css'

const DEFAULT_MAP_WIDTH = 40
const DEFAULT_MAP_HEIGHT = 30

function defaultBrushTile(): TileValue {
  const floor = TILE_TYPES.indexOf('floor')
  return floor >= 0 ? floor : EMPTY_TILE
}

export function EditorPage() {
  const [store] = useState(
    () => new EditorStore(createEmptyMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT)),
  )
  const [brushTile, setBrushTile] = useState<TileValue>(defaultBrushTile)

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <TerrainPalette selected={brushTile} onSelect={setBrushTile} />
      </aside>
      <div className={styles.workspace}>
        <CanvasView store={store} brushTile={brushTile} />
      </div>
    </div>
  )
}
