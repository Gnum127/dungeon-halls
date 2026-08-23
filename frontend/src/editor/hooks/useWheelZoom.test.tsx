import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCallback, useRef } from 'react'
import { useWheelZoom } from './useWheelZoom'

interface ProbeProps {
  onZoom: (x: number, y: number, factor: number) => void
}

function Probe({ onZoom }: ProbeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useWheelZoom(canvasRef, onZoom)
  return <canvas ref={canvasRef} data-testid="canvas" />
}

function StableProbe({ onZoom }: ProbeProps) {
  const stable = useCallback(
    (x: number, y: number, factor: number) => onZoom(x, y, factor),
    [onZoom],
  )
  return <StableInner onZoom={stable} />
}

function StableInner({ onZoom }: ProbeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useWheelZoom(canvasRef, onZoom)
  return <canvas ref={canvasRef} data-testid="stable-canvas" />
}

function fireWheel(canvas: HTMLElement, deltaY: number): void {
  fireEvent.wheel(canvas, { deltaY, clientX: 110, clientY: 70 })
}

describe('useWheelZoom', () => {
  it('intercepts wheel events while mounted and stops after unmount', () => {
    const onZoom = vi.fn()
    const { getByTestId, unmount } = render(<Probe onZoom={onZoom} />)
    const canvas = getByTestId('canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 300, height: 200 }) as DOMRect

    fireWheel(canvas, -100)
    expect(onZoom).toHaveBeenCalledTimes(1)
    // Позиция курсора относительно canvas и зум «вверх».
    expect(onZoom).toHaveBeenLastCalledWith(100, 50, expect.any(Number))
    expect(onZoom.mock.calls[0]![2]).toBeGreaterThan(1)

    unmount()
    expect(() => fireWheel(canvas, -100)).not.toThrow()
    expect(onZoom).toHaveBeenCalledTimes(1)
  })

  it('zoom out produces factor below one', () => {
    const onZoom = vi.fn()
    const { getByTestId } = render(<Probe onZoom={onZoom} />)
    const canvas = getByTestId('canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 200 }) as DOMRect

    fireWheel(canvas, 100)
    expect(onZoom.mock.calls[0]![2]).toBeLessThan(1)
  })

  it('does not resubscribe when the parent rerenders with a stable callback', () => {
    const onZoom = vi.fn()
    const { getByTestId, rerender, unmount } = render(<StableProbe onZoom={onZoom} />)
    const canvas = getByTestId('stable-canvas') as HTMLCanvasElement

    const addSpy = vi.spyOn(canvas, 'addEventListener')
    const removeSpy = vi.spyOn(canvas, 'removeEventListener')

    rerender(<StableProbe onZoom={onZoom} />)
    expect(addSpy.mock.calls.filter(([type]) => type === 'wheel')).toHaveLength(0)
    expect(removeSpy.mock.calls.filter(([type]) => type === 'wheel')).toHaveLength(0)

    unmount()
    expect(removeSpy.mock.calls.filter(([type]) => type === 'wheel')).toHaveLength(1)
  })

  it('registers the wheel listener as non-passive to allow preventDefault', () => {
    // Шпион на прототипе ловит регистрацию до того, как элемент появится.
    const protoSpy = vi.spyOn(HTMLCanvasElement.prototype, 'addEventListener')
    try {
      const { unmount } = render(<Probe onZoom={vi.fn()} />)

      const wheelCall = protoSpy.mock.calls.find(([type]) => type === 'wheel')
      expect(wheelCall).toBeDefined()
      expect(wheelCall?.[2]).toMatchObject({ passive: false })

      unmount()
    } finally {
      protoSpy.mockRestore()
    }
  })
})
