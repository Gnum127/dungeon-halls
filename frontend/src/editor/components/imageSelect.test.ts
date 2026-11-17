import { describe, expect, it } from 'vitest'
import { NO_IMAGE_SELECT_VALUE, imageIdToSelectValue, selectValueToImageId } from './imageSelect'

describe('imageIdToSelectValue', () => {
  it('maps the three image states to select values', () => {
    expect(imageIdToSelectValue(undefined)).toBe('')
    expect(imageIdToSelectValue(null)).toBe(NO_IMAGE_SELECT_VALUE)
    expect(imageIdToSelectValue('table-round')).toBe('table-round')
  })
})

describe('selectValueToImageId', () => {
  it('maps select values back to image states', () => {
    expect(selectValueToImageId('')).toBeUndefined()
    expect(selectValueToImageId(NO_IMAGE_SELECT_VALUE)).toBeNull()
    expect(selectValueToImageId('table-round')).toBe('table-round')
  })

  it('round-trips every state', () => {
    for (const imageId of [undefined, null, 'table-round'] as const) {
      expect(selectValueToImageId(imageIdToSelectValue(imageId))).toBe(imageId)
    }
  })
})
