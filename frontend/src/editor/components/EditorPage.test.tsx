import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { EditorPage } from '../EditorPage'
import { makeFakeCtx } from '../render/testFakeCtx'

beforeAll(() => {
  // jsdom не реализует 2D-контекст: отдаём записывающий фейк, чтобы рендер
  // прошёл без «Not implemented» и тест проверял именно поведение редактора.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => makeFakeCtx().ctx as unknown as CanvasRenderingContext2D,
  )
})

async function renderPage() {
  await act(async () => {
    render(<EditorPage />)
  })
  return { bar: screen.getByRole('toolbar', { name: 'Tools' }) }
}

describe('EditorPage', () => {
  it('starts in cursor mode and shows its hint', async () => {
    const { bar } = await renderPage()

    expect(within(bar).getByRole('button', { name: 'Cursor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Click — select, drag — move, Delete — remove')).toBeInTheDocument()
  })

  it('eraser toggle switches the fill to erasing (regression: it did nothing)', async () => {
    const { bar } = await renderPage()
    fireEvent.click(within(bar).getByRole('button', { name: 'Rectangle' }))

    const params = screen.getByRole('group', { name: 'Tool settings' })
    fireEvent.click(within(params).getByRole('button', { name: 'Erase area' }))

    expect(within(params).getByText('clears the area')).toBeInTheDocument()
  })

  it('opens and closes editor sections from the rail', async () => {
    const { bar } = await renderPage()
    fireEvent.click(within(bar).getByRole('button', { name: 'Rectangle' }))

    expect(screen.getByRole('group', { name: 'Tool settings' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'File & export' }))
    expect(screen.queryByRole('group', { name: 'Tool settings' })).not.toBeInTheDocument()
  })

  it('keeps the chosen door texture across tool switches and drops the angle field', async () => {
    const { bar } = await renderPage()
    fireEvent.click(within(bar).getByRole('button', { name: 'Door' }))

    const select = screen.getByRole('combobox', { name: 'Door texture' })
    expect(select).toHaveValue('')
    // The leaf-angle field is gone for good.
    expect(screen.queryByRole('spinbutton', { name: 'Leaf angle' })).toBeNull()

    fireEvent.change(select, { target: { value: 'door-wooden' } })
    expect(select).toHaveValue('door-wooden')

    fireEvent.click(within(bar).getByRole('button', { name: 'Stairs' }))
    expect(screen.queryByRole('combobox', { name: 'Door texture' })).toBeNull()

    fireEvent.click(within(bar).getByRole('button', { name: 'Door' }))
    expect(screen.getByRole('combobox', { name: 'Door texture' })).toHaveValue('door-wooden')
  })

  it('does not carry an object texture over to another kind', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Objects' }))

    fireEvent.click(screen.getByRole('button', { name: /^Table/ }))
    const tableSelect = screen.getByRole('combobox', { name: 'Image' })
    fireEvent.change(tableSelect, { target: { value: 'table-round' } })
    expect(tableSelect).toHaveValue('table-round')

    // Другой вид: текстуру стола не переносим — селект на «По умолчанию».
    fireEvent.click(screen.getByRole('button', { name: /^Tree/ }))
    const treeSelect = screen.getByRole('combobox', { name: 'Image' })
    const selectedOption = (within(treeSelect).getAllByRole('option') as HTMLOptionElement[]).find(
      (option) => option.selected,
    )
    expect(selectedOption?.value).toBe('')

    // Возврат к столу помнит выбранную ранее текстуру.
    fireEvent.click(screen.getByRole('button', { name: /^Table/ }))
    expect(screen.getByRole('combobox', { name: 'Image' })).toHaveValue('table-round')
  })

  it('switches to the stairs tool from the bottom bar', async () => {
    const { bar } = await renderPage()
    fireEvent.click(within(bar).getByRole('button', { name: 'Stairs' }))

    expect(within(bar).getByRole('button', { name: 'Stairs' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Door-only field disappears with the non-door tool.
    expect(screen.queryByRole('combobox', { name: 'Door texture' })).toBeNull()
  })

  it('drops the removed rail sections and trims the file panel to save/load/png', async () => {
    await renderPage()

    // Removed panels must not be reachable from the rail anymore.
    for (const name of ['Light', 'View', 'Generation', 'Elements']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }

    // The renamed "Objects" section renders the object palette: the tree kind is
    // available, and the removed search box / "Select" button are gone.
    fireEvent.click(screen.getByRole('button', { name: 'Objects' }))
    expect(screen.getByRole('button', { name: /Tree/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Select/ })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()

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
