import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

// EditorPage тянет хук атласа спрайтов; мок убирает асинхронный setState
// (шум act) и сетевые запросы из тестов оболочки.
vi.mock('@/editor/hooks/useSpriteAtlas', () => ({
  useSpriteAtlas: () => ({ atlas: null, status: 'unavailable' }),
}))

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders a language switcher', () => {
    render(<App />)
    // Языковой селектор различаем по подписи: в редакторе есть свои combobox.
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
  })
})
