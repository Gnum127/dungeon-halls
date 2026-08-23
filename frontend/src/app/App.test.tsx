import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders a language switcher', () => {
    render(<App />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
