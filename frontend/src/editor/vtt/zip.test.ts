import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createZip, fromUtf8, readFirstEntry, utf8, ZIP_LOCAL_SIGNATURE } from './zip'

describe('createZip', () => {
  it('builds a readable archive with all entries', () => {
    const bytes = createZip([
      { name: 'map.json', data: utf8('{"format":"0.3"}') },
      { name: 'map.png', data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) },
    ])

    // Обратное чтение штатным распаковщиком.
    const unzipped = unzipSync(bytes)
    expect(fromUtf8(unzipped['map.json']!)).toBe('{"format":"0.3"}')
    expect([...unzipped['map.png']!]).toEqual([137, 80, 78, 71, 1, 2, 3])
  })

  it('stores entries uncompressed (STORE method)', () => {
    const payload = new TextEncoder().encode('A'.repeat(1000))
    const bytes = createZip([{ name: 'blob.bin', data: payload }])

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect(view.getUint32(0, true)).toBe(ZIP_LOCAL_SIGNATURE)
    // Метод сжатия: 0 = STORE.
    expect(view.getUint16(8, true)).toBe(0)
    // Несжатый размер совпадает с исходным.
    expect(view.getUint32(18, true)).toBe(payload.length)
    // Размер архива больше суммы данных — есть заголовки и central directory.
    expect(bytes.length).toBeGreaterThan(payload.length)
  })

  it('exposes the first entry through the raw header reader', () => {
    const bytes = createZip([
      { name: 'map.json', data: utf8('{}') },
      { name: 'map.png', data: new Uint8Array([1]) },
    ])
    expect(readFirstEntry(bytes)).toEqual({ name: 'map.json', size: 2 })
    // Не-ZIP данные не читаются.
    expect(readFirstEntry(new Uint8Array([0, 1, 2]))).toBeNull()
  })

  it('handles unicode names and empty payloads', () => {
    const bytes = createZip([
      { name: 'карта.json', data: utf8('{"ok":true}') },
      { name: 'empty.png', data: new Uint8Array([]) },
    ])
    const unzipped = unzipSync(bytes)
    expect(fromUtf8(unzipped['карта.json']!)).toBe('{"ok":true}')
    expect(unzipped['empty.png']).toHaveLength(0)
  })
})
