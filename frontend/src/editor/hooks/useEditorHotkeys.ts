import { useEffect, useRef } from 'react'
import { isEditableTarget } from '../dom/isEditableTarget'

export interface HotkeysOptions {
  onUndo: () => void
  onRedo: () => void
  onSelectBrush: () => void
  onSelectEraser: () => void
  onSelectWalls: () => void
}

/**
 * Глобальные клавиши редактора. Комбинации читаются по e.code, поэтому
 * работают в любой раскладке. В полях ввода хоткеи не действуют.
 */
export function useEditorHotkeys(options: HotkeysOptions): void {
  // Свежие колбэки без пересоздания слушателя на каждый рендер.
  const latestRef = useRef(options)
  useEffect(() => {
    latestRef.current = options
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      // AltGr на европейских раскладках выглядит как Ctrl+Alt — не считаем
      // такие нажатия Ctrl-комбинациями.
      const ctrl = (event.ctrlKey || event.metaKey) && !event.altKey
      const handlers = latestRef.current

      if (ctrl && event.code === 'KeyZ') {
        event.preventDefault()
        if (event.shiftKey) handlers.onRedo()
        else handlers.onUndo()
        return
      }
      if (ctrl && event.code === 'KeyY') {
        event.preventDefault()
        handlers.onRedo()
        return
      }
      if (!ctrl && !event.altKey && !event.metaKey && !event.shiftKey) {
        if (event.code === 'KeyB') {
          event.preventDefault()
          handlers.onSelectBrush()
        } else if (event.code === 'KeyE') {
          event.preventDefault()
          handlers.onSelectEraser()
        } else if (event.code === 'KeyW') {
          event.preventDefault()
          handlers.onSelectWalls()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
