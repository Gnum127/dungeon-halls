/**
 * Отображение `MapObject.imageId` в `<select>` изображения объекта (этап 28).
 * Три состояния модели: `undefined` — «по умолчанию» (текстура вида),
 * `null` — явно «без текстуры» (цветной свотч), строка — конкретный ассет.
 */
export const NO_IMAGE_SELECT_VALUE = '__none__'

/** imageId → значение опции select. */
export function imageIdToSelectValue(imageId: string | null | undefined): string {
  if (imageId === undefined) return ''
  if (imageId === null) return NO_IMAGE_SELECT_VALUE
  return imageId
}

/** Значение опции select → imageId. */
export function selectValueToImageId(value: string): string | null | undefined {
  if (value === '') return undefined
  if (value === NO_IMAGE_SELECT_VALUE) return null
  return value
}
