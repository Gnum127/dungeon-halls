import { useState } from 'react'
import { CanvasView } from './components/CanvasView'
import { createEmptyMap } from './model/createEmptyMap'
import { EditorStore } from './store/EditorStore'
import styles from './EditorPage.module.css'

const DEFAULT_MAP_WIDTH = 40
const DEFAULT_MAP_HEIGHT = 30

export function EditorPage() {
  const [store] = useState(
    () => new EditorStore(createEmptyMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT)),
  )

  return (
    <div className={styles.root}>
      <div className={styles.workspace}>
        <CanvasView store={store} />
      </div>
    </div>
  )
}
