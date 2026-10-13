/** Генерация уникального идентификатора сущности (регион, стена, дверь). */
export function newId(): string {
  const cryptoRef = globalThis.crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }
  // Резервный путь для окружений без Web Crypto (нестабильные идентификаторы).
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}
