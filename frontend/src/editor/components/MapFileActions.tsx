import { useRef } from 'react'
import type { ChangeEvent as ReactChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { deserializeMap, serializeMap } from '../model/io'
import { EXPORT_CELL_SIZE, exportMapToPng } from '../tools/pngExport'
import type { SpriteRenderContext } from '../render/sprites/loader'
import type { MapModel } from '../model/types'
import styles from './MapFileActions.module.css'

export type FileActionStatus = 'saved' | 'loaded' | 'invalid' | 'exported' | 'exportFailed'

interface MapFileActionsProps {
  getModel: () => MapModel
  onLoaded: (model: MapModel) => void
  onResult: (status: FileActionStatus) => void
  /** Атлас спрайтов для PNG-экспорта; вызывающий пока его не передаёт —
      всегда цветной экспорт (текстуры — этап 24). */
  sprites?: SpriteRenderContext
  /** Инъекция для тестов: перехватывает браузерное скачивание. */
  download?: (filename: string, content: Blob | string, mime?: string) => void
  /** Инъекция для тестов: перехватывает чтение файла. */
  readJsonFile?: (file: File, onDone: (json: string) => void, onError: () => void) => void
  /** Инъекция для тестов: подменяет PNG-экспорт. */
  exportPng?: (model: MapModel, sprites?: SpriteRenderContext) => Promise<Blob>
}

const MAP_FILENAME = 'dungeon-halls-map.json'
const MAP_PNG_FILENAME = 'dungeon-halls-map.png'

function browserDownload(filename: string, content: Blob | string, mime?: string): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime ?? 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
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
  const { getModel, onLoaded, onResult, sprites } = props
  const download = props.download ?? browserDownload
  const readFile = props.readJsonFile ?? defaultReadJsonFile
  const exportPng =
    props.exportPng ?? ((model, sprites) => exportMapToPng(model, EXPORT_CELL_SIZE, sprites))
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { t } = useTranslation()

  function handleSave() {
    download(MAP_FILENAME, serializeMap(getModel()))
    onResult('saved')
  }

  function handleExportPng() {
    // Оборачиваем в Promise.resolve: инъекция может бросить синхронно.
    Promise.resolve()
      .then(() => exportPng(getModel(), sprites))
      .then((blob) => {
        download(MAP_PNG_FILENAME, blob, 'image/png')
        onResult('exported')
      })
      .catch(() => onResult('exportFailed'))
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
      <button type="button" className={styles.button} onClick={handleExportPng}>
        {t('editor.files.exportPng')}
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
