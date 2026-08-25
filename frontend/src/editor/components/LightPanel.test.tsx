import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LightPanel } from './LightPanel'

function setup(active = true) {
  const onToggle = vi.fn()
  const onRadiusChange = vi.fn()
  const onColorChange = vi.fn()
  render(
    <LightPanel
      active={active}
      radius={3}
      color="#ffd682"
      onToggle={onToggle}
      onRadiusChange={onRadiusChange}
      onColorChange={onColorChange}
    />,
  )
  return { onToggle, onRadiusChange, onColorChange }
}

describe('LightPanel', () => {
  it('toggles the tool with aria-pressed state', () => {
    const { onToggle } = setup()
    const toggle = screen.getByRole('button', { name: 'Light' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('reports a valid parsed radius', () => {
    const { onRadiusChange } = setup()
    fireEvent.change(screen.getByLabelText('Radius (cells)'), {
      target: { value: '12' },
    })
    expect(onRadiusChange).toHaveBeenCalledWith(12)
  })

  it('reports the clicked color preset with pressed state', () => {
    const { onColorChange } = setup()
    const activeSwatch = screen.getByTitle('#ffd682')
    expect(activeSwatch).toHaveAttribute('aria-pressed', 'true')
    const altSwatch = screen.getByTitle('#88aaff')
    expect(altSwatch).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(altSwatch)
    expect(onColorChange).toHaveBeenCalledWith('#88aaff')
  })

  it('hides properties while inactive', () => {
    setup(false)
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByLabelText('Radius (cells)')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Light color' })).toBeNull()
  })
})
