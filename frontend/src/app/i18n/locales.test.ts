import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ru from './locales/ru.json'
import { DOOR_CATALOG } from '../../editor/model/doorCatalog'
function leafKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  const keys: string[] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    keys.push(...leafKeys(child, path))
  }
  return keys
}

describe('i18n locales', () => {
  it('keeps ru and en key sets identical', () => {
    expect([...leafKeys(ru)].sort()).toEqual([...leafKeys(en)].sort())
  })

  it('has no leftover keys of removed features', () => {
    const keys = leafKeys(en).join('\n')
    expect(keys).not.toMatch(/uvtt|vtt|hex|gridType/i)
    expect(keys).not.toMatch(/editor\.(tools|rooms)\b/)
  })

  it('covers every door catalog label in both locales', () => {
    const enDoors = (en.editor as { doors: Record<string, string> }).doors
    const ruDoors = (ru.editor as { doors: Record<string, string> }).doors
    expect(enDoors.none).toBeTruthy()
    for (const entry of DOOR_CATALOG) {
      expect(enDoors[entry.labelKey]).toBeTruthy()
      expect(ruDoors[entry.labelKey]).toBeTruthy()
    }
  })
})
