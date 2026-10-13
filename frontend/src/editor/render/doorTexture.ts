import { isKnownDoorImage } from '../model/doorCatalog'

/**
 * Персист выбранной текстуры двери (настройка инструмента, не данные карты).
 * Ключ хранения: dungeon-halls.editor.doorImageId. Хранится только известный
 * imageId каталога; отсутствие записи = текстура по умолчанию (null = линия).
 */
export const DOOR_IMAGE_STORAGE_KEY = 'dungeon-halls.editor.doorImageId'

export function loadDoorImageId(storage: Storage | null = safeStorage()): string | null {
  try {
    const stored = storage?.getItem(DOOR_IMAGE_STORAGE_KEY)
    return typeof stored === 'string' && isKnownDoorImage(stored) ? stored : null
  } catch {
    return null
  }
}

export function saveDoorImageId(
  imageId: string | null,
  storage: Storage | null = safeStorage(),
): void {
  try {
    if (imageId && isKnownDoorImage(imageId)) {
      storage?.setItem(DOOR_IMAGE_STORAGE_KEY, imageId)
    } else {
      storage?.removeItem(DOOR_IMAGE_STORAGE_KEY)
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
