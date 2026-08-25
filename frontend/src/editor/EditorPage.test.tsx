import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditorPage } from './EditorPage'
import { RENDER_MODE_STORAGE_KEY } from './render/renderMode'

// Атлас не относится к тестируемым сценариям: мок убирает асинхронный
// setState (шум act) и сетевые запросы из RTL-тестов.
vi.mock('./hooks/useSpriteAtlas', () => ({
  useSpriteAtlas: () => ({ atlas: null, status: 'unavailable' }),
}))

describe('EditorPage', () => {
  it('renders the map canvas', () => {
    render(<EditorPage />)
    expect(screen.getByTestId('editor-canvas')).toBeInTheDocument()
  })

  // Интеграционная связка roadmap 2.7: генерация через панель → replaceMap,
  // выделение сброшено → Delete после генерации не бросает исключений.
  it('generates a cave map and Delete stays safe afterwards', () => {
    render(<EditorPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Caves' }))
    clickGenerate()

    // Переключаемся в режим выбора (кнопка в панели объектов) и жмём Delete:
    // выделения нет — обработчик не должен ничего делать и тем более падать.
    fireEvent.click(screen.getByRole('button', { name: 'Select (Del to remove)' }))
    expect(() => fireEvent.keyDown(window, { key: 'Delete' })).not.toThrow()
  })

  // Guard isEditableTarget: ввод сида не должен триггерить хоткей B.
  // Сценарий различает наличие guard'а: выбран Eraser, а lastBrushTileRef
  // указывает на Floor — без guard'а нажатие B вернуло бы Floor.
  it('typing in the seed field does not trigger the brush hotkey', () => {
    render(<EditorPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }))
    const eraserButton = screen.getByRole('button', { name: 'Eraser' })
    expect(eraserButton).toHaveAttribute('aria-pressed', 'true')

    const seedInput = screen.getByLabelText('Seed')
    fireEvent.keyDown(seedInput, { code: 'KeyB', key: 'b' })

    // Guard сработал: инструмент остался ластиком, а не вернулся на Floor.
    expect(eraserButton).toHaveAttribute('aria-pressed', 'true')
  })

  // Пункт 3.5: смена типа сетки уровня документа дизейблит генератор
  // (генераторы отдают только square), обратная смена возвращает кнопку.
  it('switching the document grid type disables and re-enables generation', () => {
    render(<EditorPage />)
    const gridSelect = screen.getByLabelText('Grid type')
    expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled()

    fireEvent.change(gridSelect, { target: { value: 'hex-pointy' } })
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
    expect(screen.getByRole('note')).toBeInTheDocument()

    fireEvent.change(gridSelect, { target: { value: 'square' } })
    expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled()
    expect(screen.queryByRole('note')).toBeNull()
  })

  // Генерация была на square → переключились на гекс: «Ещё раз» тоже
  // обязан задизейблиться (иначе повтор заменит гекс-документ квадратом).
  it('regenerate button is disabled on hex grids after a square generation', () => {
    render(<EditorPage />)

    clickGenerate()
    expect(screen.getByRole('button', { name: 'Regenerate same seed' })).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Grid type'), { target: { value: 'hex-flat' } })
    expect(screen.getByRole('button', { name: 'Regenerate same seed' })).toBeDisabled()
  })

  // Регрессия roadmap 2.7: stale id после генерации → removeObject бросал
  // RangeError внутри keydown. Теперь выделение сбрасывается при генерации.
  it('generate clears stale object selection: Delete does not throw', () => {
    render(<EditorPage />)
    const canvas = screen.getByTestId('editor-canvas')

    // Ставим дверь (инструмент Door уже активен в палитре объектов).
    fireEvent.click(screen.getByRole('button', { name: 'Door' }))
    fireEvent.pointerDown(canvas, { button: 0, buttons: 1, pointerId: 1, clientX: 48, clientY: 48 })
    fireEvent.pointerUp(canvas, { pointerId: 1, buttons: 0 })

    // Выделяем её инструментом выбора.
    fireEvent.click(screen.getByRole('button', { name: 'Select (Del to remove)' }))
    fireEvent.pointerDown(canvas, { button: 0, buttons: 1, pointerId: 2, clientX: 48, clientY: 48 })
    fireEvent.pointerUp(canvas, { pointerId: 2, buttons: 0 })

    // Генерируем пещеры: объекты очищены, выделение сброшено.
    fireEvent.click(screen.getByRole('button', { name: 'Caves' }))
    clickGenerate()

    expect(() => fireEvent.keyDown(window, { key: 'Delete' })).not.toThrow()
  })

  // Пункт 4.5: выбор режима графики персистится в localStorage.
  it('persists the graphics mode choice to localStorage', () => {
    localStorage.removeItem(RENDER_MODE_STORAGE_KEY)
    render(<EditorPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Sprites' }))
    expect(localStorage.getItem(RENDER_MODE_STORAGE_KEY)).toBe('sprites')
    expect(screen.getByRole('button', { name: 'Color tiles' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Color tiles' }))
    expect(localStorage.getItem(RENDER_MODE_STORAGE_KEY)).toBe('colors')
  })

  function clickGenerate() {
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  }
})
