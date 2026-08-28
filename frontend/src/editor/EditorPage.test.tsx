import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditorPage } from './EditorPage'

// Хук атласа тянет асинхронный setState и есть сети — выключаем в тестах страницы.
vi.mock('./hooks/useSpriteAtlas', () => ({
  useSpriteAtlas: () => ({ atlas: null, status: 'unavailable' }),
}))

describe('EditorPage section navigation', () => {
  it('shows the landscape panel by default', () => {
    render(<EditorPage />)
    expect(screen.getByText('Landscape')).toBeInTheDocument()
    expect(screen.getByTitle('Floor')).toBeInTheDocument()
  })

  it('switches to the elements section on demand', () => {
    render(<EditorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Elements' }))
    expect(screen.getByText('Elements')).toBeInTheDocument()
    // Палитра объектов видна, террейн — нет.
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    expect(screen.queryByTitle('Floor')).not.toBeInTheDocument()
  })

  it('hides the panel when the active section is clicked again', () => {
    render(<EditorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Landscape' }))
    expect(screen.queryByTitle('Floor')).not.toBeInTheDocument()
  })

  it('keeps generation and file actions in their own sections', () => {
    const { rerender } = render(<EditorPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Generation' }))
    expect(screen.getByText('Generation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument()
    expect(screen.queryByTitle('Floor')).not.toBeInTheDocument()

    rerender(<EditorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'File & export' }))
    expect(screen.getByText('File & export')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument()
    // В разделе файлов генератор не виден — разделы не смешиваются.
    expect(screen.queryByRole('button', { name: 'Generate' })).not.toBeInTheDocument()
  })

  it('collapses and expands the landscape panel', () => {
    render(<EditorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(screen.queryByTitle('Floor')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(screen.getByTitle('Floor')).toBeInTheDocument()
  })

  it('persists the collapsed state across remounts', () => {
    const first = render(<EditorPage />)
    fireEvent.click(first.getByRole('button', { name: 'Collapse' }))
    expect(screen.queryByTitle('Floor')).not.toBeInTheDocument()

    first.unmount()
    render(<EditorPage />)
    // Состояние прочитано из localStorage при старте — панель остаётся свёрнутой.
    expect(screen.queryByTitle('Floor')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
  })
})