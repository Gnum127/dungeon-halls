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
    expect(parsed.version).toBe(1)
    expect(parsed.objects).toHaveLength(1)
    expect(onResult).toHaveBeenCalledWith('saved')
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
