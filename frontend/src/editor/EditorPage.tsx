import { useState } from 'react'
import { CanvasView } from './components/CanvasView'
import { createEmptyMap } from './model/createEmptyMap'
import { TILE_TYPES } from './model/types'
import type { TileValue } from './model/types'
import { EditorStore } from './store/EditorStore'
import styles from './EditorPage.module.css'

const DEFAULT_MAP_WIDTH = 40
const DEFAULT_MAP_HEIGHT = 30

export function EditorPage() {
  const [store] = useState(
    () => new EditorStore(createEmptyMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT)),
  )
  // Выбор плитки появится в палитре (пункт 1.7); пока кисть красит полом.
  const [brushTile] = useState<TileValue>(() => TILE_TYPES.indexOf('floor'))

  return (
    <div className={styles.root}>
      <div className={styles.workspace}>
        <CanvasView store={store} brushTile={brushTile} />
      </div>
    </div>
  )
}
