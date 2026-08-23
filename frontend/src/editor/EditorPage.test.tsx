import i18n from '@/app/i18n'
import { render, screen } from '@testing-library/react'
import { EditorPage } from './EditorPage'

describe('EditorPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders an empty canvas state', () => {
    render(<EditorPage />)
    expect(screen.getByText('The map canvas will appear here')).toBeInTheDocument()
  })
})
