import { useEffect, useRef } from 'react'

export interface HotkeysOptions {
  onUndo: () => void
  onRedo: () => void
  onSelectBrush: () => void
  onSelectEraser: () => void
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && EDITABLE_TAGS.has(target.tagName)
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
      const ctrl = event.ctrlKey || event.metaKey
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
      if (!ctrl && !event.altKey && !event.metaKey) {
        if (event.code === 'KeyB') {
          event.preventDefault()
          handlers.onSelectBrush()
        } else if (event.code === 'KeyE') {
          event.preventDefault()
          handlers.onSelectEraser()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
