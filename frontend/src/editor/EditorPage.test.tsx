import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorPage } from './EditorPage'

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
  it('typing in the seed field does not trigger the brush hotkey', () => {
    render(<EditorPage />)

    const seedInput = screen.getByLabelText('Seed')
    // До нажатия: Floor ещё не выбран (дефолтный инструмент — Floor).
    const floorButton = screen.getByRole('button', { name: 'Floor' })
    expect(floorButton).toHaveAttribute('aria-pressed', 'true')

    // Переключаемся на другой тайл, затем жмём «B» с фокусом в поле сида.
    fireEvent.click(screen.getByRole('button', { name: 'Grass' }))
    expect(floorButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.keyDown(seedInput, { code: 'KeyB', key: 'b' })
    expect(floorButton).toHaveAttribute('aria-pressed', 'false')
  })

  function clickGenerate() {
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  }
})
