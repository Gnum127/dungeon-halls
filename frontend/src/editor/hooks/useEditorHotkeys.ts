import { useEffect, useRef } from 'react'
import { OBJECT_KINDS } from '../model/objects'
import type { ObjectKindId } from '../model/objects'
import { isEditableTarget } from '../dom/isEditableTarget'

export interface HotkeysOptions {
  onUndo: () => void
  onRedo: () => void
  onSelectBrush: () => void
  onSelectEraser: () => void
  onSelectWalls: () => void
  onSelectDoors: () => void
  onSelectLights: () => void
  onSelectObjectKind: (kindId: ObjectKindId) => void
  onRotateObject: () => void
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
        } else if (event.code === 'KeyD') {
          event.preventDefault()
          handlers.onSelectDoors()
        } else if (event.code === 'KeyL') {
          event.preventDefault()
          handlers.onSelectLights()
        } else if (event.code === 'KeyR') {
          event.preventDefault()
          handlers.onRotateObject()
        } else {
          // 1-9: выбор объекта из каталога
          const digit = parseInt(event.code.replace('Digit', ''), 10)
          if (digit >= 1 && digit <= OBJECT_KINDS.length) {
            event.preventDefault()
            handlers.onSelectObjectKind(OBJECT_KINDS[digit - 1])
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
