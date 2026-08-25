import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WallTools } from './WallTools'

describe('WallTools', () => {
  it('renders three tool buttons with pressed state', () => {
    render(
      <WallTools
        activeMode="wall"
        disabled={false}
        onSelectWall={vi.fn()}
        onSelectEraser={vi.fn()}
        onSelectDoor={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: 'Walls and doors' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wall' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Wall eraser' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Door' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the clicked tool', () => {
    const onSelectWall = vi.fn()
    const onSelectEraser = vi.fn()
    const onSelectDoor = vi.fn()
    render(
      <WallTools
        activeMode={null}
        disabled={false}
        onSelectWall={onSelectWall}
        onSelectEraser={onSelectEraser}
        onSelectDoor={onSelectDoor}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Door' }))
    expect(onSelectDoor).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Wall eraser' }))
    expect(onSelectEraser).toHaveBeenCalledTimes(1)
    expect(onSelectWall).not.toHaveBeenCalled()
  })

  // Пункт 5.4: на гексах инструменты задизейблены с подсказкой.
  it('disables all tools with a hint on non-square grids', () => {
    render(
      <WallTools
        activeMode={null}
        disabled
        onSelectWall={vi.fn()}
        onSelectEraser={vi.fn()}
        onSelectDoor={vi.fn()}
      />,
    )

    for (const name of ['Wall', 'Wall eraser', 'Door']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByRole('note')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Wall' }))
    expect(screen.getByRole('button', { name: 'Wall' })).toBeDisabled()
  })
})
