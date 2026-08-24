/**
 * Hex-геометрия по формулам Red Blob Games (axial-координаты).
 * Параметризованная ориентация: одна формула через матрицу f²/b,
 * flat-top и pointy-top различаются только данными.
 *
 * Конвенция offset↔axial: odd-r для pointy, odd-q для flat.
 * cellSize интерпретируется как радиус описанной окружности.
 */

export type HexOrientation = 'flat' | 'pointy'

/** Матрица преобразований: f = axial→pixel, b = pixel→axial (Red Blob Games). */
const ORIENTATION: Record<
  HexOrientation,
  { f0: number; f1: number; f2: number; f3: number; b0: number; b1: number; b2: number; b3: number }
> = {
  flat: {
    f0: 3 / 2,
    f1: 0,
    f2: Math.sqrt(3) / 2,
    f3: Math.sqrt(3),
    b0: 2 / 3,
    b1: 0,
    b2: -1 / 3,
    b3: Math.sqrt(3) / 3,
  },
  pointy: {
    f0: Math.sqrt(3),
    f1: Math.sqrt(3) / 2,
    f2: 0,
    f3: 3 / 2,
    b0: Math.sqrt(3) / 3,
    b1: -1 / 3,
    b2: 0,
    b3: 2 / 3,
  },
}

export interface Axial {
  readonly q: number
  readonly r: number
}

/** Центр гекса в пикселях относительно начала координат сетки. */
export function cellCenter(
  q: number,
  r: number,
  orientation: HexOrientation,
  size: number,
): { x: number; y: number } {
  const o = ORIENTATION[orientation]
  return { x: size * (o.f0 * q + o.f1 * r), y: size * (o.f2 * q + o.f3 * r) }
}

/** Pixel → axial (дробные значения), затем cube-round до целого гекса. */
export function pixelToCell(
  px: number,
  py: number,
  orientation: HexOrientation,
  size: number,
): Axial {
  const o = ORIENTATION[orientation]
  const qf = (o.b0 * px + o.b1 * py) / size
  const rf = (o.b2 * px + o.b3 * py) / size
  return cubeRound(qf, rf)
}

function cubeRound(qf: number, rf: number): Axial {
  const sf = -qf - rf
  let q = Math.round(qf)
  let r = Math.round(rf)
  const s = Math.round(sf)
  const dq = Math.abs(q - qf)
  const dr = Math.abs(r - rf)
  const ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q, r }
}

/** Вершины гекса как полигона [x0,y0,…] относительно центра клетки. */
export function cellCorners(orientation: HexOrientation, size: number): Array<[number, number]> {
  const corners: Array<[number, number]> = []
  for (let i = 0; i < 6; i += 1) {
    const angleDeg = 60 * i - (orientation === 'pointy' ? 30 : 0)
    corners.push([
      size * Math.cos((Math.PI / 180) * angleDeg),
      size * Math.sin((Math.PI / 180) * angleDeg),
    ])
  }
  return corners
}

/** Offset → axial (odd-r для pointy, odd-q для flat). */
export function offsetToAxial(col: number, row: number, orientation: HexOrientation): Axial {
  if (orientation === 'pointy') {
    return { q: col - (row - (row & 1)) / 2, r: row }
  }
  return { q: col, r: row - (col - (col & 1)) / 2 }
}

/** Axial → offset (обратная конверсия). */
export function axialToOffset(
  q: number,
  r: number,
  orientation: HexOrientation,
): { col: number; row: number } {
  if (orientation === 'pointy') {
    return { col: q + (r - (r & 1)) / 2, row: r }
  }
  return { col: q, row: r + (q - (q & 1)) / 2 }
}
