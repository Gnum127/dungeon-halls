import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RenderModePicker } from './RenderModePicker'

function renderPicker(
  mode: 'colors' | 'sprites',
  atlasStatus: 'loading' | 'ready' | 'unavailable',
  onChange = vi.fn(),
) {
  render(<RenderModePicker mode={mode} atlasStatus={atlasStatus} onChange={onChange} />)
  return onChange
}

describe('RenderModePicker', () => {
  it('renders both modes as a labelled group with pressed state', () => {
    renderPicker('sprites', 'ready')

    expect(screen.getByRole('group', { name: 'Graphics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Color tiles' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Sprites' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reports the clicked mode', () => {
    const onChange = vi.fn()
    renderPicker('colors', 'ready', onChange)

    fireEvent.click(screen.getByRole('button', { name: 'Sprites' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('sprites')
  })

  it('shows a note while sprites are loading and when unavailable', () => {
    const { unmount } = render(
      <RenderModePicker mode="sprites" atlasStatus="loading" onChange={vi.fn()} />,
    )
    expect(screen.getByRole('note')).toHaveTextContent(/Loading sprites/)

    unmount()
    render(<RenderModePicker mode="sprites" atlasStatus="unavailable" onChange={vi.fn()} />)
    expect(screen.getByRole('note')).toHaveTextContent(/unavailable/)
  })

  it('hides the note in colors mode and when the atlas is ready', () => {
    const { unmount } = render(
      <RenderModePicker mode="colors" atlasStatus="loading" onChange={vi.fn()} />,
    )
    expect(screen.queryByRole('note')).not.toBeInTheDocument()

    unmount()
    render(<RenderModePicker mode="sprites" atlasStatus="ready" onChange={vi.fn()} />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
