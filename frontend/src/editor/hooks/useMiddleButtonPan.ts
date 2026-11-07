import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'

interface PanState {
  pointerId: number
  lastX: number
  lastY: number
  /** Бит нажатой кнопки для проверки `event.buttons` во время движения. */
  buttonBit: number
}

interface PanOptions {
  /** Пан левой кнопкой (режим «Перетаскивание»); по умолчанию — средней. */
  readonly leftButton?: boolean
}

const LEFT_BUTTON_BIT = 1
const MIDDLE_BUTTON_BIT = 4

/**
 * Пан кнопкой мыши с pointer capture. По умолчанию — средняя кнопка; в режиме
 * «Перетаскивание» (`leftButton`) — левая.
 */
export function useMiddleButtonPan(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onPan: (deltaX: number, deltaY: number) => void,
  options: PanOptions = {},
): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const stateRef = useRef<PanState | null>(null)

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const isMiddle = event.button === 1
    const isLeft = event.button === 0 && options.leftButton === true
    if (!isMiddle && !isLeft) return
    event.preventDefault()
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer уже неактивен: пан корректно завершится проверкой buttons.
    }
    stateRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      buttonBit: isLeft ? LEFT_BUTTON_BIT : MIDDLE_BUTTON_BIT,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const state = stateRef.current
    if (!state || state.pointerId !== event.pointerId) return
    // Кнопку отпустили вне окна — завершаем пан, чтобы вьюпорт не «залипал».
    if ((event.buttons & state.buttonBit) === 0) {
      stateRef.current = null
      return
    }
    onPan(event.clientX - state.lastX, event.clientY - state.lastY)
    state.lastX = event.clientX
    state.lastY = event.clientY
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (stateRef.current?.pointerId === event.pointerId) {
      stateRef.current = null
    }
  }

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  }
}
