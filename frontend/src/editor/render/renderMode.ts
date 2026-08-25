export type RenderMode = 'colors' | 'sprites'

/** Настройка просмотра, а не данные карты: ключ по конвенции проекта. */
export const RENDER_MODE_STORAGE_KEY = 'dungeon-halls.editor.renderMode'

const RENDER_MODES: readonly RenderMode[] = ['colors', 'sprites']

export function isRenderMode(value: unknown): value is RenderMode {
  return typeof value === 'string' && (RENDER_MODES as readonly string[]).includes(value)
}

export function loadRenderMode(storage: Storage | null = safeStorage()): RenderMode {
  try {
    const stored = storage?.getItem(RENDER_MODE_STORAGE_KEY)
    return isRenderMode(stored) ? stored : 'colors'
  } catch {
    return 'colors'
  }
}

export function saveRenderMode(
  mode: RenderMode,
  storage: Storage | null = safeStorage(),
): void {
  try {
    storage?.setItem(RENDER_MODE_STORAGE_KEY, mode)
  } catch {
    // Приватный режим/переполнение квоты — настройка просто не персистится.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
