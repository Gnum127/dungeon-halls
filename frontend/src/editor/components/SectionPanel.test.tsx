import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SectionPanel } from './SectionPanel'

describe('SectionPanel', () => {
  it('renders the title, region and children', () => {
    render(
      <SectionPanel title="Light">
        <p>body</p>
      </SectionPanel>,
    )

    expect(screen.getByRole('region', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('has no toggle button when not collapsible', () => {
    render(<SectionPanel title="View">content</SectionPanel>)

    expect(screen.queryByRole('button', { name: 'Collapse' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Expand' })).not.toBeInTheDocument()
  })

  it('reports the expanded state and notifies collapse clicks', () => {
    const onToggle = vi.fn()
    render(
      <SectionPanel title="Elements" collapsible collapsed={false} onToggleCollapsed={onToggle}>
        body
      </SectionPanel>,
    )

    const collapse = screen.getByRole('button', { name: 'Collapse' })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(collapse)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('hides the body while collapsed and keeps the header accessible', () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <SectionPanel title="Elements" collapsible collapsed onToggleCollapsed={onToggle}>
        body
      </SectionPanel>,
    )

    expect(screen.queryByText('body')).not.toBeInTheDocument()
    const expand = screen.getByRole('button', { name: 'Expand' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')

    rerender(
      <SectionPanel title="Elements" collapsible collapsed={false} onToggleCollapsed={onToggle}>
        body
      </SectionPanel>,
    )
    expect(screen.getByText('body')).toBeInTheDocument()
  })
})