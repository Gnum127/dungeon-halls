import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolRail } from './ToolRail'

describe('ToolRail', () => {
  it('renders the six editor sections and no legacy rooms tab', () => {
    render(<ToolRail active={null} onSelect={vi.fn()} />)

    expect(screen.getByRole('navigation', { name: 'Toolbar' })).toBeInTheDocument()
    for (const name of ['Landscape', 'Elements', 'Light', 'View', 'Generation', 'File & export']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /rooms|walls/i })).toBeNull()
  })

  it('marks the active section and reports clicks', () => {
    const onSelect = vi.fn()
    render(<ToolRail active="file" onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: 'File & export' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(onSelect).toHaveBeenCalledWith('light')
  })
})
