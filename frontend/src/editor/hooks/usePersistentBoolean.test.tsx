import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadBoolean, saveBoolean, usePersistentBoolean } from './usePersistentBoolean'

const KEY = 'test.usePersistentBoolean'

function Probe({ initial }: { initial: boolean }) {
  const [value, toggle] = usePersistentBoolean(KEY, initial)
  return (
    <div>
      <output>{value ? 'on' : 'off'}</output>
      <button type="button" onClick={toggle}>
        toggle
      </button>
    </div>
  )
}

describe('usePersistentBoolean', () => {
  it('starts with the stored value when present', () => {
    saveBoolean(KEY, true, localStorage)
    render(<Probe initial={false} />)
    expect(screen.getByText('on')).toBeInTheDocument()
    localStorage.clear()
  })

  it('starts with the fallback when nothing is stored', () => {
    localStorage.removeItem(KEY)
    render(<Probe initial={false} />)
    expect(screen.getByText('off')).toBeInTheDocument()
  })

  it('persists toggles to storage', () => {
    localStorage.removeItem(KEY)
    render(<Probe initial={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(loadBoolean(KEY, false, localStorage)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(loadBoolean(KEY, false, localStorage)).toBe(false)
  })

  it('rejects unknown stored values as fallback', () => {
    localStorage.setItem(KEY, 'bogus')
    render(<Probe initial={true} />)
    expect(screen.getByText('on')).toBeInTheDocument()
    localStorage.clear()
  })

  it('falls back when storage access throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(loadBoolean(KEY, true, broken)).toBe(true)
    expect(() => saveBoolean(KEY, false, broken)).not.toThrow()
  })
})