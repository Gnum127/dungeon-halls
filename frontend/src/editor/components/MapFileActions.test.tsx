import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import { EditorStore } from '../store/EditorStore'
import { serializeMap } from '../io'
import { MapFileActions } from './MapFileActions'

function makeModel(): MapModel {
  return applyCommand(createEmptyMap(4, 4), {
    kind: 'addObject',
    x: 1,
    y: 1,
    kindId: 'chest',
  })
}

function setFiles(input: HTMLElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

describe('MapFileActions', () => {
  it('save hands a valid serialized project to the downloader', () => {
    const store = new EditorStore(makeModel())
    const onResult = vi.fn()
    const download = vi.fn()
    const { getByText } = render(
      <MapFileActions
        getModel={() => store.getModel()}
        onLoaded={vi.fn()}
        onResult={onResult}
        download={download}
      />,
    )

    fireEvent.click(getByText('Save'))

    expect(download).toHaveBeenCalledTimes(1)
    const [filename, content] = download.mock.calls[0] as [string, string]
    expect(filename).toMatch(/\.json$/)
    const parsed = JSON.parse(content) as { version: number; objects: unknown[] }
    expect(parsed.version).toBe(4)
    expect(parsed.objects).toHaveLength(1)
    expect(onResult).toHaveBeenCalledWith('saved')
  })

  it('export PNG downloads a blob named after the map', async () => {
    const store = new EditorStore(makeModel())
    const download = vi.fn()
    const onResult = vi.fn()
    const fakeBlob = new Blob(['png'])
    const exportPng = vi.fn().mockResolvedValue(fakeBlob)
    const { getByText } = render(
      <MapFileActions
        getModel={() => store.getModel()}
        onLoaded={vi.fn()}
        onResult={onResult}
        download={download}
        exportPng={exportPng}
      />,
    )

    fireEvent.click(getByText('Export PNG'))

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(exportPng).toHaveBeenCalledTimes(1)
    // Без атласа вторым аргументом приходит undefined (экспорт цветами).
    expect(exportPng).toHaveBeenCalledWith(store.getModel(), undefined)
    const [filename, blob, mime] = download.mock.calls[0] as [string, Blob, string]
    expect(filename).toMatch(/\.png$/)
    expect(blob).toBe(fakeBlob)
    expect(mime).toBe('image/png')
    expect(onResult).toHaveBeenCalledWith('exported')
  })

  it('reports exportFailed when PNG encoding rejects', async () => {
    const onResult = vi.fn()
    const download = vi.fn()
    const exportPng = vi.fn().mockRejectedValue(new Error('no canvas'))
    const { getByText } = render(
      <MapFileActions
        getModel={() => createEmptyMap(2, 2)}
        onLoaded={vi.fn()}
        onResult={onResult}
        download={download}
        exportPng={exportPng}
      />,
    )

    fireEvent.click(getByText('Export PNG'))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith('exportFailed'))
    // Битый артефакт не скачивается.
    expect(download).not.toHaveBeenCalled()
  })

  it('loads a valid file into the app', async () => {
    const other = makeModel()
    const onLoaded = vi.fn()
    const onResult = vi.fn()
    const { getByTestId } = render(
      <MapFileActions
        getModel={() => createEmptyMap(2, 2)}
        onLoaded={onLoaded}
        onResult={onResult}
      />,
    )

    const json = serializeMap(other)
    const input = getByTestId('map-file-input')
    setFiles(input, new File([json], 'map.json', { type: 'application/json' }))

    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1))
    expect(onLoaded).toHaveBeenCalledWith(expect.objectContaining({ width: 4, height: 4 }))
    expect(onResult).toHaveBeenCalledWith('loaded')
  })

  it('reports invalid for a corrupt file without calling onLoaded', async () => {
    const onLoaded = vi.fn()
    const onResult = vi.fn()
    const { getByTestId } = render(
      <MapFileActions
        getModel={() => createEmptyMap(2, 2)}
        onLoaded={onLoaded}
        onResult={onResult}
      />,
    )

    const input = getByTestId('map-file-input')
    setFiles(input, new File(['{oops'], 'broken.json', { type: 'application/json' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith('invalid'))
    expect(onLoaded).not.toHaveBeenCalled()
  })

  it('reports invalid when the reader fails', () => {
    const onLoaded = vi.fn()
    const onResult = vi.fn()
    const failingReader = (_file: File, _done: (json: string) => void, onError: () => void) =>
      onError()
    const { getByTestId } = render(
      <MapFileActions
        getModel={() => createEmptyMap(2, 2)}
        onLoaded={onLoaded}
        onResult={onResult}
        readJsonFile={failingReader}
      />,
    )

    const input = getByTestId('map-file-input')
    setFiles(input, new File(['{}'], 'map.json', { type: 'application/json' }))

    expect(onResult).toHaveBeenCalledWith('invalid')
    expect(onLoaded).not.toHaveBeenCalled()
  })
})

describe('MapFileActions UVTT export', () => {
  it('downloads a .uvtt blob via the injected exporter', async () => {
    const onResult = vi.fn()
    const download = vi.fn()
    const fakeBlob = new Blob(['uvtt'], { type: 'application/octet-stream' })
    const exportUvtt = vi.fn().mockResolvedValue(fakeBlob)
    const { getByText } = render(
      <MapFileActions
        getModel={() => createEmptyMap(4, 4)}
        onLoaded={vi.fn()}
        onResult={onResult}
        download={download}
        exportUvtt={exportUvtt}
      />,
    )

    fireEvent.click(getByText('Export UVTT'))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))

    expect(exportUvtt).toHaveBeenCalledTimes(1)
    const [filename, blob, mime] = download.mock.calls[0] as [string, Blob, string]
    expect(filename).toMatch(/\.uvtt$/)
    expect(blob).toBe(fakeBlob)
    expect(mime).toBe('application/octet-stream')
    expect(onResult).toHaveBeenCalledWith('exportedUvtt')
  })

  it('reports a UVTT-specific failure when the exporter rejects', async () => {
    const onResult = vi.fn()
    const download = vi.fn()
    const exportUvtt = vi.fn().mockRejectedValue(new Error('export failed'))
    const { getByText } = render(
      <MapFileActions
        getModel={() => createEmptyMap(4, 4)}
        onLoaded={vi.fn()}
        onResult={onResult}
        download={download}
        exportUvtt={exportUvtt}
      />,
    )

    fireEvent.click(getByText('Export UVTT'))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('uvttExportFailed'))
    // Битый артефакт не скачивается.
    expect(download).not.toHaveBeenCalled()
  })

  it('disables the UVTT button with a hint on non-square grids', () => {
    const { getByText } = render(
      <MapFileActions
        getModel={() => createEmptyMap(4, 4, 'hex-pointy')}
        onLoaded={vi.fn()}
        onResult={vi.fn()}
        uvttDisabled
      />,
    )

    const button = getByText('Export UVTT')
    expect(button).toBeDisabled()
    expect(button.getAttribute('title')).toContain('square grids only')
  })
})

describe('MapFileActions SVG export', () => {
  type ExportSvg = (model: MapModel, includeLight: boolean) => Promise<Blob>

  function renderSvgActions(exportSvg: ExportSvg, download = vi.fn()) {
    const onResult = vi.fn()
    const { getByLabelText, getByText } = render(
      <MapFileActions
        getModel={makeModel}
        onLoaded={vi.fn()}
        onResult={onResult}
        download={download}
        exportSvg={exportSvg}
      />,
    )
    return { getByLabelText, getByText, onResult, download }
  }

  it('passes the light checkbox state to the exporter (default off)', async () => {
    const exportSvg = vi
      .fn<ExportSvg>()
      .mockResolvedValue(new Blob(['svg'], { type: 'image/svg+xml' }))
    const { getByLabelText, getByText, onResult, download } = renderSvgActions(exportSvg)
    const checkbox = getByLabelText('Print light sources') as HTMLInputElement
    expect(checkbox.checked).toBe(false)

    fireEvent.click(getByText('Export SVG'))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(exportSvg).toHaveBeenCalledWith(expect.anything(), false)

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)

    fireEvent.click(getByText('Export SVG'))
    await waitFor(() => expect(exportSvg).toHaveBeenCalledTimes(2))
    // Флаг чекбокса доходит до экспортёра — иначе свет молча пропадает из печати.
    expect(exportSvg).toHaveBeenLastCalledWith(expect.anything(), true)
    expect(onResult).toHaveBeenLastCalledWith('exportedSvg')
  })

  it('downloads an .svg blob with the svg mime type', async () => {
    const fakeBlob = new Blob(['<svg/>'], { type: 'image/svg+xml' })
    const exportSvg = vi.fn().mockResolvedValue(fakeBlob)
    const { getByText, download } = renderSvgActions(exportSvg)

    fireEvent.click(getByText('Export SVG'))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))

    const [filename, blob, mime] = download.mock.calls[0] as [string, Blob, string]
    expect(filename).toMatch(/\.svg$/)
    expect(blob).toBe(fakeBlob)
    expect(mime).toBe('image/svg+xml')
  })

  it('reports a dedicated failure and downloads nothing when the exporter rejects', async () => {
    const exportSvg = vi.fn().mockRejectedValue(new Error('export failed'))
    const { getByText, onResult, download } = renderSvgActions(exportSvg)

    fireEvent.click(getByText('Export SVG'))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('svgExportFailed'))
    expect(download).not.toHaveBeenCalled()
  })
})

describe('MapFileActions PDF export', () => {
  type ExportPdf = (model: MapModel, options: unknown) => Promise<Blob>

  function renderPdfActions(exportPdf: ExportPdf, model: MapModel, download = vi.fn()) {
    const onResult = vi.fn()
    const utils = render(
      <MapFileActions
        getModel={() => model}
        onLoaded={vi.fn()}
        onResult={onResult}
        download={download}
        exportPdf={exportPdf}
      />,
    )
    return { ...utils, onResult, download }
  }

  it('shows page count preview and recomputes it when parameters change', () => {
    // A4 1": страницы 8×11 клеток; карта 20×15 → 3×2 = 6 страниц.
    const { getByLabelText, getByText } = renderPdfActions(vi.fn(), createEmptyMap(20, 15))
    expect(getByText('Pages: 6')).toBeInTheDocument()

    // 0.5": страницы 16×23 → ceil(20/16)=2 колонки × ceil(15/23)=1 → 2 страницы.
    fireEvent.change(getByLabelText('Cell size'), { target: { value: '0.5' } })
    expect(getByText('Pages: 2')).toBeInTheDocument()

    fireEvent.change(getByLabelText('Paper'), { target: { value: 'a3' } })
    fireEvent.change(getByLabelText('Orientation'), { target: { value: 'landscape' } })
    // A3 landscape 1": 33×23 → 1 страница.
    expect(getByText('Pages: 1')).toBeInTheDocument()
  })

  it('warns when the printout exceeds fifty pages', () => {
    // 300×300 на A4 1": 38×28 = 1064 страницы.
    const many = renderPdfActions(vi.fn(), createEmptyMap(300, 300))
    expect(many.getByText(/large print, many pages/)).toBeInTheDocument()
    many.unmount()

    // 8×11 на A4 1" — ровно одна страница, без предупреждения.
    const few = renderPdfActions(vi.fn(), createEmptyMap(8, 11))
    expect(few.queryByText(/large print, many pages/)).toBeNull()
  })

  it('downloads a .pdf blob passing paper, orientation, scale and light flag', async () => {
    const exportPdf = vi
      .fn<ExportPdf>()
      .mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
    const download = vi.fn()
    const model = applyCommand(createEmptyMap(8, 11), {
      kind: 'addLight',
      x: 0,
      y: 0,
      radius: 3,
      color: '#ffd682',
    })
    const {
      getByLabelText,
      getByText,
      onResult,
      download: dl,
    } = renderPdfActions(exportPdf, model, download)

    fireEvent.click(getByLabelText('Print light sources'))
    fireEvent.click(getByText('Export PDF'))
    await waitFor(() => expect(dl).toHaveBeenCalledTimes(1))

    expect(exportPdf).toHaveBeenCalledWith(model, {
      paper: 'a4',
      orientation: 'portrait',
      cellInches: 1,
      includeLight: true,
    })
    const [filename, blob, mime] = dl.mock.calls[0] as [string, Blob, string]
    expect(filename).toMatch(/\.pdf$/)
    expect(blob.type).toBe('application/pdf')
    expect(mime).toBe('application/pdf')
    expect(onResult).toHaveBeenCalledWith('exportedPdf')
  })

  it('reports a dedicated failure and downloads nothing when the exporter rejects', async () => {
    const exportPdf = vi.fn<ExportPdf>().mockRejectedValue(new Error('export failed'))
    const { getByText, onResult, download } = renderPdfActions(exportPdf, createEmptyMap(4, 4))

    fireEvent.click(getByText('Export PDF'))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('pdfExportFailed'))
    expect(download).not.toHaveBeenCalled()
  })

  it('disables the PDF button with a hint on non-square grids', () => {
    const { getByText } = render(
      <MapFileActions
        getModel={() => createEmptyMap(4, 4, 'hex-pointy')}
        onLoaded={vi.fn()}
        onResult={vi.fn()}
        pdfDisabled
      />,
    )

    const button = getByText('Export PDF')
    expect(button).toBeDisabled()
    expect(button.getAttribute('title')).toContain('square grids only')
  })
})
