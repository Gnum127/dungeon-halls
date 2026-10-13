/**
 * Каталог текстур дверей: id вида → ключ i18n → запись в пуле element-images
 * (`defaultImageId` ссылается на `element-images/manifest.json`). Дверь хранит
 * только `imageId`; картинку резолвит спрайтовый атлас при рендере.
 */
export interface DoorCatalogEntry {
  readonly doorKindId: string
  readonly labelKey: string
  readonly defaultImageId: string
}

export const DOOR_CATALOG: readonly DoorCatalogEntry[] = [
  { doorKindId: 'door-wooden', labelKey: 'wooden', defaultImageId: 'door-wooden' },
  { doorKindId: 'door-iron', labelKey: 'iron', defaultImageId: 'door-iron' },
  { doorKindId: 'door-stone', labelKey: 'stone', defaultImageId: 'door-stone' },
]

export function isKnownDoorImage(imageId: string | null): boolean {
  return imageId !== null && DOOR_CATALOG.some((entry) => entry.defaultImageId === imageId)
}
