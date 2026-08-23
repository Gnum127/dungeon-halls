import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorHotkeys } from './useEditorHotkeys'
import type { HotkeysOptions } from './useEditorHotkeys'

function Probe({ options }: { options: HotkeysOptions }) {
  useEditorHotkeys(options)
  return (
    <div>
      <input data-testid="input" />
      <textarea data-testid="textarea" />
    </div>
  )
}

function makeOptions() {
  return {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSelectBrush: vi.fn(),
    onSelectEraser: vi.fn(),
  }
}

function press(target: Element | Window, init: Record<string, unknown>): boolean {
  return fireEvent.keyDown(target, {
    key: '',
    code: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...init,
  })
}

describe('useEditorHotkeys', () => {
  it('Ctrl+Z undoes and Ctrl+Shift+Z / Ctrl+Y redo', () => {
    const h = makeOptions()
    render(<Probe options={h} />)

    press(window, { code: 'KeyZ', key: 'z', ctrlKey: true })
    expect(h.onUndo).toHaveBeenCalledTimes(1)

    press(window, { code: 'KeyZ', key: 'Z', ctrlKey: true, shiftKey: true })
    expect(h.onRedo).toHaveBeenCalledTimes(1)

    press(window, { code: 'KeyY', key: 'y', ctrlKey: true })
    expect(h.onRedo).toHaveBeenCalledTimes(2)
  })

  it('B selects brush, E selects eraser (layout-independent via e.code)', () => {
    const h = makeOptions()
    render(<Probe options={h} />)

    press(window, { code: 'KeyB', key: 'и' })
    expect(h.onSelectBrush).toHaveBeenCalledTimes(1)

    press(window, { code: 'KeyE', key: 'у' })
    expect(h.onSelectEraser).toHaveBeenCalledTimes(1)
  })

  it('ignores hotkeys while focus is in an editable element', () => {
    const h = makeOptions()
    const { getByTestId } = render(<Probe options={h} />)

    press(getByTestId('input'), { code: 'KeyZ', key: 'z', ctrlKey: true })
    press(getByTestId('textarea'), { code: 'KeyB', key: 'b' })

    expect(h.onUndo).not.toHaveBeenCalled()
    expect(h.onSelectBrush).not.toHaveBeenCalled()
  })

  it('plain keys with Ctrl other than Z/Y do nothing; listener survives rerenders', () => {
    const h = makeOptions()
    const { rerender } = render(<Probe options={h} />)
    rerender(<Probe options={h} />)
    rerender(<Probe options={h} />)

    press(window, { code: 'KeyC', key: 'c', ctrlKey: true })
    press(window, { code: 'KeyZ', key: 'z', ctrlKey: true })

    expect(h.onUndo).toHaveBeenCalledTimes(1)
  })

  it('stops listening after unmount', () => {
    const h = makeOptions()
    const { unmount } = render(<Probe options={h} />)
    unmount()

    expect(() => press(window, { code: 'KeyZ', key: 'z', ctrlKey: true })).not.toThrow()
    expect(h.onUndo).not.toHaveBeenCalled()
  })
})
