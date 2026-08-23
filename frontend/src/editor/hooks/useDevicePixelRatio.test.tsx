import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDevicePixelRatio } from './useDevicePixelRatio'

interface QueryRecord {
  media: string
  listeners: Array<() => void>
}

let queries: QueryRecord[] = []
const matchMediaMock = vi.fn((media: string) => {
  const record: QueryRecord = { media, listeners: [] }
  queries.push(record)
  return {
    matches: false,
    media,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => record.listeners.push(listener),
    removeEventListener: (_type: string, listener: () => void) => {
      const index = record.listeners.indexOf(listener)
      if (index >= 0) record.listeners.splice(index, 1)
    },
  }
})

function Probe() {
  const dpr = useDevicePixelRatio()
  return <span data-testid="dpr">{String(dpr)}</span>
}

function setDevicePixelRatio(value: number) {
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value,
  })
}

describe('useDevicePixelRatio', () => {
  beforeEach(() => {
    queries = []
    vi.stubGlobal('matchMedia', matchMediaMock)
    matchMediaMock.mockClear()
    setDevicePixelRatio(1)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setDevicePixelRatio(1)
  })

  it('returns current devicePixelRatio and subscribes to its change', () => {
    const { getByTestId } = render(<Probe />)

    expect(getByTestId('dpr').textContent).toBe('1')
    expect(matchMediaMock).toHaveBeenCalledWith('(resolution: 1dppx)')
    expect(queries[0]?.listeners).toHaveLength(1)
  })

  it('updates and re-subscribes when devicePixelRatio changes', () => {
    const { getByTestId } = render(<Probe />)
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 1dppx)'])

    setDevicePixelRatio(2)
    act(() => {
      queries[0]!.listeners[0]!()
    })

    expect(getByTestId('dpr').textContent).toBe('2')
    // Старая подписка снята, новая создана под новое разрешение.
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 1dppx)', '(resolution: 2dppx)'])
    expect(queries[0]?.listeners).toHaveLength(0)
    expect(queries[1]?.listeners).toHaveLength(1)
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = render(<Probe />)
    unmount()

    expect(queries[0]?.listeners).toHaveLength(0)
  })
})
