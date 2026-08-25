import { useRef } from 'react'
import type { ChangeEvent as ReactChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { deserializeMap, serializeMap } from '../io'
import { EXPORT_CELL_SIZE, exportMapToPng } from '../tools/pngExport'
import { exportMapToUvtt } from '../vtt/uvtt'
import type { SpriteRenderContext } from '../render/sprites/loader'
import type { MapModel } from '../model/types'
import styles from './MapFileActions.module.css'

export type FileActionStatus =
  'saved' | 'loaded' | 'invalid' | 'exported' | 'exportedUvtt' | 'exportFailed' | 'uvttExportFailed'

interface MapFileActionsProps {
  getModel: () => MapModel
  onLoaded: (model: MapModel) => void
  onResult: (status: FileActionStatus) => void
  /** Атлас текущего режима; undefined/частичный = экспорт цветами. */
  sprites?: SpriteRenderContext
  /** UVTT только для square-сеток (формат прямоугольных клеток). */
  uvttDisabled?: boolean
  /** Инъекция для тестов: перехватывает браузерное скачивание. */
  download?: (filename: string, content: Blob | string, mime?: string) => void
  /** Инъекция для тестов: перехватывает чтение файла. */
  readJsonFile?: (file: File, onDone: (json: string) => void, onError: () => void) => void
  /** Инъекция для тестов: подменяет PNG-экспорт. */
  exportPng?: (model: MapModel, sprites?: SpriteRenderContext) => Promise<Blob>
  /** Инъекция для тестов: подменяет UVTT-экспорт. */
  exportUvtt?: (model: MapModel, sprites?: SpriteRenderContext) => Promise<Blob>
}

const MAP_FILENAME = 'dungeon-halls-map.json'
const MAP_PNG_FILENAME = 'dungeon-halls-map.png'
const UVTT_FILENAME = 'dungeon-halls-map'

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
  const { getModel, onLoaded, onResult, sprites, uvttDisabled } = props
  const download = props.download ?? browserDownload
  const readFile = props.readJsonFile ?? defaultReadJsonFile
  const exportPng =
    props.exportPng ?? ((model, sprites) => exportMapToPng(model, EXPORT_CELL_SIZE, sprites))
  const exportUvtt = props.exportUvtt ?? ((model, sprites) => exportMapToUvtt(model, sprites))
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

  function handleExportUvtt() {
    Promise.resolve()
      .then(() => exportUvtt(getModel(), sprites))
      .then((blob) => {
        download(`${UVTT_FILENAME}.uvtt`, blob, 'application/octet-stream')
        onResult('exportedUvtt')
      })
      .catch(() => onResult('uvttExportFailed'))
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
      <button
        type="button"
        className={styles.button}
        disabled={uvttDisabled}
        title={uvttDisabled ? t('editor.files.uvttSquareOnly') : undefined}
        onClick={handleExportUvtt}
      >
        {t('editor.files.exportUvtt')}
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
