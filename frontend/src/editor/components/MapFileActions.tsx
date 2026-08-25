import { useRef, useState } from 'react'
import type { ChangeEvent as ReactChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { deserializeMap, serializeMap } from '../io'
import { EXPORT_CELL_SIZE, exportMapToPng } from '../tools/pngExport'
import { exportMapToUvtt } from '../vtt/uvtt'
import { buildSvg } from '../print/svg'
import {
  computePrintLayout,
  exportMapToPdf,
  type BuildPdfOptions,
  type PaperSize,
  type PrintOrientation,
} from '../print/pdf'
import { paginateMap } from '../print/pages'
import type { SpriteRenderContext } from '../render/sprites/loader'
import type { MapModel } from '../model/types'
import styles from './MapFileActions.module.css'

export type FileActionStatus =
  | 'saved'
  | 'loaded'
  | 'invalid'
  | 'exported'
  | 'exportedSvg'
  | 'exportedUvtt'
  | 'exportedPdf'
  | 'exportFailed'
  | 'pdfExportFailed'
  | 'svgExportFailed'
  | 'uvttExportFailed'

/** Порог предупреждения о большой печати, страниц. */
const PDF_MANY_PAGES = 50

interface MapFileActionsProps {
  getModel: () => MapModel
  onLoaded: (model: MapModel) => void
  onResult: (status: FileActionStatus) => void
  /** Атлас текущего режима; undefined/частичный = экспорт цветами. */
  sprites?: SpriteRenderContext
  /** UVTT только для square-сеток (формат прямоугольных клеток). */
  uvttDisabled?: boolean
  /** Печать в PDF только для square-сеток (разбивка по клеткам). */
  pdfDisabled?: boolean
  /** Инъекция для тестов: перехватывает браузерное скачивание. */
  download?: (filename: string, content: Blob | string, mime?: string) => void
  /** Инъекция для тестов: перехватывает чтение файла. */
  readJsonFile?: (file: File, onDone: (json: string) => void, onError: () => void) => void
  /** Инъекция для тестов: подменяет PNG-экспорт. */
  exportPng?: (model: MapModel, sprites?: SpriteRenderContext) => Promise<Blob>
  /** Инъекция для тестов: подменяет UVTT-экспорт. */
  exportUvtt?: (model: MapModel, sprites?: SpriteRenderContext) => Promise<Blob>
  /** Инъекция для тестов: подменяет SVG-экспорт. */
  exportSvg?: (model: MapModel, includeLight: boolean) => Promise<Blob>
  /** Инъекция для тестов: подменяет PDF-экспорт. */
  exportPdf?: (model: MapModel, options: BuildPdfOptions) => Promise<Blob>
}

const MAP_FILENAME = 'dungeon-halls-map.json'
const MAP_PNG_FILENAME = 'dungeon-halls-map.png'
const UVTT_FILENAME = 'dungeon-halls-map'
const MAP_SVG_FILENAME = 'dungeon-halls-map.svg'
const MAP_PDF_FILENAME = 'dungeon-halls-map.pdf'

const PAPER_CHOICES: ReadonlyArray<PaperSize> = ['a4', 'a3', 'letter']
const ORIENTATIONS: ReadonlyArray<PrintOrientation> = ['portrait', 'landscape']

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
  const { getModel, onLoaded, onResult, sprites, uvttDisabled, pdfDisabled } = props
  const download = props.download ?? browserDownload
  const readFile = props.readJsonFile ?? defaultReadJsonFile
  const exportPng =
    props.exportPng ?? ((model, sprites) => exportMapToPng(model, EXPORT_CELL_SIZE, sprites))
  const exportUvtt = props.exportUvtt ?? ((model, sprites) => exportMapToUvtt(model, sprites))
  const exportSvg =
    props.exportSvg ??
    ((model, includeLight) =>
      Promise.resolve(new Blob([buildSvg(model, { includeLight })], { type: 'image/svg+xml' })))
  const exportPdf =
    props.exportPdf ?? ((model, options) => Promise.resolve(exportMapToPdf(model, options)))
  // Один контрол на все печатные форматы (SVG и PDF).
  const [printLight, setPrintLight] = useState(false)
  const [paper, setPaper] = useState<PaperSize>('a4')
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait')
  const [cellInches, setCellInches] = useState(1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { t } = useTranslation()

  // Предпросмотр числа страниц ДО экспорта: layout + разбивка на клетки.
  const layout = computePrintLayout(paper, orientation, cellInches)
  const pageCount = paginateMap(
    getModel().width,
    getModel().height,
    layout.pageCols,
    layout.pageRows,
  ).length

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

  function handleExportSvg() {
    Promise.resolve()
      .then(() => exportSvg(getModel(), printLight))
      .then((blob) => {
        download(MAP_SVG_FILENAME, blob, 'image/svg+xml')
        onResult('exportedSvg')
      })
      .catch(() => onResult('svgExportFailed'))
  }

  function handleExportPdf() {
    Promise.resolve()
      .then(() =>
        exportPdf(getModel(), { paper, orientation, cellInches, includeLight: printLight }),
      )
      .then((blob) => {
        download(MAP_PDF_FILENAME, blob, 'application/pdf')
        onResult('exportedPdf')
      })
      .catch(() => onResult('pdfExportFailed'))
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
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={printLight}
          onChange={(event) => setPrintLight(event.target.checked)}
        />
        {t('editor.files.printLight')}
      </label>
      <button type="button" className={styles.button} onClick={handleExportSvg}>
        {t('editor.files.exportSvg')}
      </button>
      <select
        className={styles.select}
        aria-label={t('editor.files.pdfPaper')}
        value={paper}
        onChange={(event) => setPaper(event.target.value as PaperSize)}
      >
        {PAPER_CHOICES.map((choice) => (
          <option key={choice} value={choice}>
            {t(`editor.files.paper_${choice}`)}
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        aria-label={t('editor.files.pdfOrientation')}
        value={orientation}
        onChange={(event) => setOrientation(event.target.value as PrintOrientation)}
      >
        {ORIENTATIONS.map((choice) => (
          <option key={choice} value={choice}>
            {t(`editor.files.orientation_${choice}`)}
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        aria-label={t('editor.files.pdfCellScale')}
        value={cellInches}
        onChange={(event) => setCellInches(Number(event.target.value))}
      >
        <option value={1}>{t('editor.files.cell_1in')}</option>
        <option value={0.5}>{t('editor.files.cell_halfIn')}</option>
      </select>
      <span className={styles.option} role="status">
        {t('editor.files.pdfPages', { count: pageCount })}
        {pageCount > PDF_MANY_PAGES && ` — ${t('editor.files.pdfManyPages')}`}
      </span>
      <button
        type="button"
        className={styles.button}
        disabled={pdfDisabled}
        title={pdfDisabled ? t('editor.files.pdfSquareOnly') : undefined}
        onClick={handleExportPdf}
      >
        {t('editor.files.exportPdf')}
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
