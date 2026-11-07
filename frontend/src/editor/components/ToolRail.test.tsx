import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolRail } from './ToolRail'

describe('ToolRail', () => {
  it('renders the three remaining editor sections', () => {
    render(<ToolRail active={null} onSelect={vi.fn()} />)

    expect(screen.getByRole('navigation', { name: 'Toolbar' })).toBeInTheDocument()
    for (const name of ['Landscape', 'Objects', 'File & export']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    // Removed panels and the legacy rooms tab must not come back.
    expect(
      screen.queryByRole('button', { name: /light|view|generation|rooms|walls|elements/i }),
    ).toBeNull()
  })

  it('marks the active section and reports clicks', () => {
    const onSelect = vi.fn()
    render(<ToolRail active="file" onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: 'File & export' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Objects' }))
    expect(onSelect).toHaveBeenCalledWith('objects')
  })
})
