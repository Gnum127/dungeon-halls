import { render, screen } from '@testing-library/react'
import { EditorPage } from './EditorPage'

describe('EditorPage', () => {
  it('renders the map canvas', () => {
    render(<EditorPage />)
    expect(screen.getByTestId('editor-canvas')).toBeInTheDocument()
  })
})
