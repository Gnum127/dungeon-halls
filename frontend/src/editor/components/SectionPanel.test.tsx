import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SectionPanel } from './SectionPanel'

describe('SectionPanel', () => {
  it('renders the title and children for a plain panel', () => {
    render(
      <SectionPanel title="Light">
        <p>body</p>
      </SectionPanel>,
    )
    expect(screen.getByRole('region', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('hides the body when collapsed and reports the toggle', () => {
    const onToggle = vi.fn()
    render(
      <SectionPanel title="Landscape" collapsible collapsed onToggleCollapsed={onToggle}>
        <p>body</p>
      </SectionPanel>,
    )
    expect(screen.queryByText('body')).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Expand' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
