import type { ObjectKindId } from '../model/objects'

/**
 * Персист выбора изображения вида (настройка просмотра, не данные карты).
 * Префиксная конвенция ключей: dungeon-halls.editor.elementImages.<kindId>.
 * null = «по умолчанию» (defaultImage вида).
 */
export const ELEMENT_IMAGE_STORAGE_KEY_PREFIX = 'dungeon-halls.editor.elementImages.'

export function loadElementImage(
  kindId: ObjectKindId,
  storage: Storage | null = safeStorage(),
): string | null {
  try {
    const stored = storage?.getItem(ELEMENT_IMAGE_STORAGE_KEY_PREFIX + kindId)
    return typeof stored === 'string' && stored.length > 0 ? stored : null
  } catch {
    return null
  }
}

export function saveElementImage(
  kindId: ObjectKindId,
  imageId: string | null,
  storage: Storage | null = safeStorage(),
): void {
  try {
    if (imageId) {
      storage?.setItem(ELEMENT_IMAGE_STORAGE_KEY_PREFIX + kindId, imageId)
    } else {
      // «По умолчанию» — отсутствие записи, а не мусорное значение.
      storage?.removeItem(ELEMENT_IMAGE_STORAGE_KEY_PREFIX + kindId)
    }
  } catch {
    // Приватный режим/переполнение квоты — выбор просто не персистится.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}