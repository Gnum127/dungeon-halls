import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { EditorPage } from '../EditorPage'
import { makeFakeCtx } from '../render/testFakeCtx'

beforeAll(() => {
  // jsdom не реализует 2D-контекст: отдаём записывающий фейк, чтобы рендер
  // прошёл без «Not implemented» и тест проверял именно поведение редактора.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => makeFakeCtx().ctx as never,
  )
})

describe('EditorPage', () => {
  it('eraser button switches the active fill to erasing (regression: it did nothing)', async () => {
    await act(async () => {
      render(<EditorPage />)
    })

    const tools = screen.getByRole('group', { name: 'Build tools' })
    expect(within(tools).getByText('Floor')).toBeInTheDocument()

    fireEvent.click(within(tools).getByRole('button', { name: 'Eraser' }))

    expect(within(tools).getByText('clears the area')).toBeInTheDocument()
    expect(within(tools).queryByText('Floor')).toBeNull()
  })

  it('opens and closes editor sections from the rail', async () => {
    await act(async () => {
      render(<EditorPage />)
    })

    expect(screen.getByRole('group', { name: 'Build tools' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'File & export' }))
    expect(screen.queryByRole('group', { name: 'Build tools' })).not.toBeInTheDocument()
  })

  it('keeps the chosen door leaf angle across tool switches', async () => {
    await act(async () => {
      render(<EditorPage />)
    })

    const tools = screen.getByRole('group', { name: 'Build tools' })
    fireEvent.click(within(tools).getByRole('button', { name: 'Door' }))
    const angle = screen.getByRole('spinbutton', { name: 'Leaf angle' })
    expect(angle).toHaveValue(30)

    fireEvent.change(angle, { target: { value: '45' } })
    expect(angle).toHaveValue(45)

    fireEvent.click(within(tools).getByRole('button', { name: 'Wall' }))
    fireEvent.click(within(tools).getByRole('button', { name: 'Door' }))
    expect(screen.getByRole('spinbutton', { name: 'Leaf angle' })).toHaveValue(45)
  })

  it('switches to the stairs tool from the build tools', async () => {
    await act(async () => {
      render(<EditorPage />)
    })

    const tools = screen.getByRole('group', { name: 'Build tools' })
    fireEvent.click(within(tools).getByRole('button', { name: 'Stairs' }))

    expect(within(tools).getByRole('button', { name: 'Stairs' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Door-only field disappears with the non-door tool.
    expect(screen.queryByRole('spinbutton', { name: 'Leaf angle' })).toBeNull()
  })

  it('drops the removed rail sections and trims the file panel to save/load/png', async () => {
    await act(async () => {
      render(<EditorPage />)
    })

    // Removed panels must not be reachable from the rail anymore.
    for (const name of ['Light', 'View', 'Generation', 'Elements']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }

    // The renamed "Objects" section renders the object palette.
    fireEvent.click(screen.getByRole('button', { name: 'Objects' }))
    expect(screen.getByRole('button', { name: 'Select (Del to remove)' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'File & export' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export SVG' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Export PDF' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Print light sources' })).toBeNull()
    // PDF settings (paper/orientation/cell scale) are gone with the panel.
    expect(screen.queryByRole('combobox', { name: 'Paper' })).toBeNull()
  })
})
