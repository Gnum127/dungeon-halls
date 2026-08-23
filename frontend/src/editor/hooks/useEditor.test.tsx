import { act, render, screen } from '@testing-library/react'
import { createEmptyMap } from '../model/createEmptyMap'
import { TILE_TYPES } from '../model/types'
import type { MapModel } from '../model/types'
import { EditorStore } from '../store/EditorStore'
import { useEditor } from './useEditor'

const FLOOR = TILE_TYPES.indexOf('floor')

function Probe({ store }: { store: EditorStore }) {
  const model: MapModel = useEditor(store)
  return (
    <div>
      <span data-testid="first-tile">{String(model.tiles[0])}</span>
    </div>
  )
}

describe('useEditor', () => {
  it('rerenders the component when the store model changes', () => {
    const store = new EditorStore(createEmptyMap(3, 3))
    render(<Probe store={store} />)
    expect(screen.getByTestId('first-tile')).toHaveTextContent('0')

    act(() => {
      store.dispatch({ kind: 'setTile', x: 0, y: 0, tile: FLOOR })
    })
    expect(screen.getByTestId('first-tile')).toHaveTextContent(String(FLOOR))

    act(() => {
      store.undo()
    })
    expect(screen.getByTestId('first-tile')).toHaveTextContent('0')
  })
})
