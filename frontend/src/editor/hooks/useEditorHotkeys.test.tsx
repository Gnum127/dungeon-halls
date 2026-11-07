import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorHotkeys } from './useEditorHotkeys'
import type { HotkeysOptions } from './useEditorHotkeys'

function makeHandlers(): HotkeysOptions {
  return {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSelectCursor: vi.fn(),
    onSelectRegionRect: vi.fn(),
    onSelectRegionPolygon: vi.fn(),
    onSelectEraser: vi.fn(),
    onSelectDoors: vi.fn(),
    onSelectObjectKind: vi.fn(),
    onRotateObject: vi.fn(),
  }
}

describe('useEditorHotkeys', () => {
  it('Escape and V select the cursor tool', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditorHotkeys(handlers))

    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' })
    expect(handlers.onSelectCursor).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { code: 'KeyV', key: 'v' })
    expect(handlers.onSelectCursor).toHaveBeenCalledTimes(2)
  })

  it('maps B/P/E/D to build tools and ignores the removed wall hotkey', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditorHotkeys(handlers))

    fireEvent.keyDown(window, { code: 'KeyB' })
    fireEvent.keyDown(window, { code: 'KeyP' })
    fireEvent.keyDown(window, { code: 'KeyE' })
    fireEvent.keyDown(window, { code: 'KeyD' })
    expect(handlers.onSelectRegionRect).toHaveBeenCalledTimes(1)
    expect(handlers.onSelectRegionPolygon).toHaveBeenCalledTimes(1)
    expect(handlers.onSelectEraser).toHaveBeenCalledTimes(1)
    expect(handlers.onSelectDoors).toHaveBeenCalledTimes(1)

    // W (manual wall) is gone: it must not act as a digit/object or rect shortcut.
    fireEvent.keyDown(window, { code: 'KeyW' })
    expect(handlers.onSelectRegionRect).toHaveBeenCalledTimes(1)
    expect(handlers.onSelectObjectKind).not.toHaveBeenCalled()
  })

  it('does not fire from editable fields', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditorHotkeys(handlers))

    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { code: 'KeyB' })
    expect(handlers.onSelectRegionRect).not.toHaveBeenCalled()
    input.remove()
  })
})
