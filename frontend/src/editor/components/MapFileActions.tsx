import { useRef } from 'react'
import type { ChangeEvent as ReactChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { deserializeMap, serializeMap } from '../io'
import type { MapModel } from '../model/types'
import styles from './MapFileActions.module.css'

export type FileActionStatus = 'saved' | 'loaded' | 'invalid'

interface MapFileActionsProps {
  getModel: () => MapModel
  onLoaded: (model: MapModel) => void
  onResult: (status: FileActionStatus) => void
  /** Инъекция для тестов: перехватывает браузерное скачивание. */
  download?: (filename: string, content: string) => void
  /** Инъекция для тестов: перехватывает чтение файла. */
  readJsonFile?: (file: File, onDone: (json: string) => void, onError: () => void) => void
}

const MAP_FILENAME = 'dungeon-halls-map.json'

function browserDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function defaultReadJsonFile(
  file: File,
  onDone: (json: string) => void,
  onError: () => void,
): void {
  const reader = new FileReader()
  reader.onload = () => onDone(String(reader.result))
  reader.onerror = () => onError()
  reader.onabort = () => onError()
  reader.readAsText(file)
}

export function MapFileActions(props: MapFileActionsProps) {
  const { getModel, onLoaded, onResult } = props
  const download = props.download ?? browserDownload
  const readFile = props.readJsonFile ?? defaultReadJsonFile
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { t } = useTranslation()

  function handleSave() {
    download(MAP_FILENAME, serializeMap(getModel()))
    onResult('saved')
  }

  function handleLoadChange(event: ReactChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    readFile(
      file,
      (json) => {
        try {
          onLoaded(deserializeMap(json))
          onResult('loaded')
        } catch {
          onResult('invalid')
        }
      },
      () => onResult('invalid'),
    )
  }

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.button} onClick={handleSave}>
        {t('editor.files.save')}
      </button>
      <button type="button" className={styles.button} onClick={() => inputRef.current?.click()}>
        {t('editor.files.load')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        data-testid="map-file-input"
        onChange={handleLoadChange}
        hidden
      />
    </div>
  )
}
