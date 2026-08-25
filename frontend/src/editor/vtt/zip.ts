import { zipSync, strFromU8 } from 'fflate'

/** Режим STORE: PNG уже сжат, контейнер нужен только для структуры архива. */
const ZIP_STORE_LEVEL = 0

export interface ZipEntry {
  readonly name: string
  readonly data: Uint8Array
}

/**
 * Собирает ZIP-архив (STORE) из записей. Возвращает байты готового файла.
 */
export function createZip(entries: readonly ZipEntry[]): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {}
  for (const entry of entries) {
    files[entry.name] = [entry.data, { level: ZIP_STORE_LEVEL }]
  }
  return zipSync(files)
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function fromUtf8(bytes: Uint8Array): string {
  return strFromU8(bytes)
}

/** Сигнатура локального заголовка записи PKZIP. */
export const ZIP_LOCAL_SIGNATURE = 0x04034b50

/** Читает имя и размер первой записи архива (для структурных тестов). */
export function readFirstEntry(bytes: Uint8Array): { name: string; size: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 30 || view.getUint32(0, true) !== ZIP_LOCAL_SIGNATURE) {
    return null
  }
  const nameLength = view.getUint16(26, true)
  const extraLength = view.getUint16(28, true)
  const size = view.getUint32(18, true)
  const name = fromUtf8(bytes.slice(30, 30 + nameLength + extraLength).slice(0, nameLength))
  return { name, size }
}
