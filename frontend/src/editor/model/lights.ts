/** Источник света: точка в клетке, радиус в клетках, цвет свечения hex. */
export interface MapLight {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly color: string
}

export const MIN_LIGHT_RADIUS = 1
export const MAX_LIGHT_RADIUS = 30

export function isValidLightRadius(radius: unknown): radius is number {
  return (
    typeof radius === 'number' &&
    Number.isInteger(radius) &&
    radius >= MIN_LIGHT_RADIUS &&
    radius <= MAX_LIGHT_RADIUS
  )
}

export function isValidLightColor(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
}

export function findLightById(lights: readonly MapLight[], id: number): MapLight | undefined {
  return lights.find((light) => light.id === id)
}

export function lightAt(lights: readonly MapLight[], x: number, y: number): MapLight | undefined {
  return lights.find((light) => light.x === x && light.y === y)
}

export function nextLightId(lights: readonly MapLight[]): number {
  return lights.reduce((max, light) => Math.max(max, light.id), 0) + 1
}
