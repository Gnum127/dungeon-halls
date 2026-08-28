import { useCallback, useState } from 'react'

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadBoolean(
  key: string,
  fallback: boolean,
  storage: Storage | null = safeStorage(),
): boolean {
  try {
    const stored = storage?.getItem(key)
    if (stored === '1') return true
    if (stored === '0') return false
    return fallback
  } catch {
    return fallback
  }
}

export function saveBoolean(
  key: string,
  value: boolean,
  storage: Storage | null = safeStorage(),
): void {
  try {
    storage?.setItem(key, value ? '1' : '0')
  } catch {
    // Приватный режим/квота — настройка просто не персистится.
  }
}

/**
 * Булева настройка UI с персистом: значение читается один раз при монтировании,
 * переключение сохраняет новое значение (`1`/`0`). Отказы storage-обращений
 * молча игнорируются — панель продолжает работать как обычный state.
 */
export function usePersistentBoolean(key: string, initial: boolean): [boolean, () => void] {
  const [value, setValue] = useState(() => loadBoolean(key, initial))

  const toggle = useCallback(() => {
    const next = !value
    saveBoolean(key, next)
    setValue(next)
  }, [key, value])

  return [value, toggle]
}