import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolRail, type EditorSectionId } from './ToolRail'

describe('ToolRail', () => {
  it('renders a button for every section', () => {
    render(<ToolRail active={null} onSelect={vi.fn()} />)

    expect(screen.getAllByRole('button')).toHaveLength(7)
    expect(screen.getByRole('navigation', { name: 'Toolbar' })).toBeInTheDocument()
    // Каждый раздел доступен и подписан.
    for (const label of [
      'Landscape',
      'Elements',
      'Rooms & walls',
      'Light',
      'View',
      'Generation',
      'File & export',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('marks the active section with aria-pressed', () => {
    render(<ToolRail active="light" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the clicked section id', () => {
    const onSelect = vi.fn()
    render(<ToolRail active={null} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Generation' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('generation' satisfies EditorSectionId)
  })
})