/**
 * Прямоугольник карты в клетках, попадающий на одну страницу печати.
 * Клетки не режутся: страница меньше полного размера — остаток идёт в поля,
 * контент прижат к левому верхнему углу страницы.
 */
export interface PageRect {
  readonly col: number
  readonly row: number
  readonly cols: number
  readonly rows: number
}

function requirePositive(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`)
  }
}

/**
 * Разбивка карты на печатные страницы: слева направо, сверху вниз;
 * неполные колонка/ряд — последними справа и снизу.
 */
export function paginateMap(
  mapCols: number,
  mapRows: number,
  pageCols: number,
  pageRows: number,
): PageRect[] {
  requirePositive(mapCols, 'mapCols')
  requirePositive(mapRows, 'mapRows')
  requirePositive(pageCols, 'pageCols')
  requirePositive(pageRows, 'pageRows')

  const pages: PageRect[] = []
  for (let row = 0; row < mapRows; row += pageRows) {
    for (let col = 0; col < mapCols; col += pageCols) {
      pages.push({
        col,
        row,
        cols: Math.min(pageCols, mapCols - col),
        rows: Math.min(pageRows, mapRows - row),
      })
    }
  }
  return pages
}
