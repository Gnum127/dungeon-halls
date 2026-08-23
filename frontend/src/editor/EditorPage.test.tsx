import { render, screen } from '@testing-library/react'
import { EditorPage } from './EditorPage'

describe('EditorPage', () => {
  it('renders an empty canvas state', () => {
    render(<EditorPage />)
    expect(screen.getByTestId('editor-canvas-empty')).toBeInTheDocument()
  })
})
