import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { useMiddleButtonPan } from './useMiddleButtonPan'

function Probe({ onPan }: { onPan: (dx: number, dy: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { handlers } = useMiddleButtonPan(canvasRef, onPan)
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

type Phase = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'

function fire(target: Element, phase: Phase, init: Record<string, unknown> = {}): boolean {
  const defaults = { pointerId: 7, button: 1, buttons: 4, clientX: 100, clientY: 100 }
  switch (phase) {
    case 'pointerdown':
      return fireEvent.pointerDown(target, { ...defaults, ...init })
    case 'pointermove':
      return fireEvent.pointerMove(target, { ...defaults, ...init })
    case 'pointerup':
      return fireEvent.pointerUp(target, { ...defaults, ...init })
    case 'pointercancel':
      // В RTL нет пресета pointercancel — собираем событие вручную.
      return fireEvent(
        target,
        Object.assign(new Event('pointercancel', { bubbles: true }), {
          ...defaults,
          ...init,
        }),
      )
  }
}

describe('useMiddleButtonPan', () => {
  it('pans by pointer delta while the middle button is held', () => {
    const onPan = vi.fn()
    const { getByTestId } = render(<Probe onPan={onPan} />)
    const canvas = getByTestId('canvas')

    fire(canvas, 'pointerdown', { clientX: 100, clientY: 100 })
    fire(canvas, 'pointermove', { clientX: 80, clientY: 130 })
    expect(onPan).toHaveBeenCalledWith(-20, 30)

    fire(canvas, 'pointermove', { clientX: 60, clientY: 130 })
    expect(onPan).toHaveBeenLastCalledWith(-20, 0)
  })

  it('stops panning when the button is released outside the window', () => {
    const onPan = vi.fn()
    const { getByTestId } = render(<Probe onPan={onPan} />)
    const canvas = getByTestId('canvas')

    fire(canvas, 'pointerdown')
    fire(canvas, 'pointermove', { buttons: 0, clientX: 50, clientY: 50 })
    expect(onPan).not.toHaveBeenCalled()

    // Залипания нет: жест завершён, новое движение его не продолжает.
    fire(canvas, 'pointermove', { buttons: 4, clientX: 10, clientY: 10 })
    expect(onPan).not.toHaveBeenCalled()
  })

  it('pointer cancel resets the gesture', () => {
    const onPan = vi.fn()
    const { getByTestId } = render(<Probe onPan={onPan} />)
    const canvas = getByTestId('canvas')

    fire(canvas, 'pointerdown')
    fire(canvas, 'pointercancel', { buttons: 0 })
    fire(canvas, 'pointermove', { clientX: 40, clientY: 40 })

    expect(onPan).not.toHaveBeenCalled()
  })

  it('ignores other pointers and non-middle buttons', () => {
    const onPan = vi.fn()
    const { getByTestId } = render(<Probe onPan={onPan} />)
    const canvas = getByTestId('canvas')

    // Чужой pointerId и не-средняя кнопка жест не начинают.
    fire(canvas, 'pointerdown', { pointerId: 8, button: 0, buttons: 1 })
    fire(canvas, 'pointermove', { pointerId: 8, button: 0, buttons: 1, clientX: 1, clientY: 1 })
    fire(canvas, 'pointerdown', { button: 0, buttons: 1 })
    fire(canvas, 'pointermove', { button: 0, buttons: 1, clientX: 2, clientY: 2 })

    expect(onPan).not.toHaveBeenCalled()
  })
})
