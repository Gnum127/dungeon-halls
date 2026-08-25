# Shared: тайлы и гекс-геометрия

## tiles.ts

Палитра `TILE_TYPES`, типы `TileValue` / `TileGrid` (Uint8Array), лимит
`MAX_MAP_DIMENSION` и типы сетки документа:

- `'square'` — квадратная сетка, координаты offset `x`/`y`;
- `'hex-pointy'` — pointy-top гексы, конверсия **odd-r**;
- `'hex-flat'` — flat-top гексы, конверсия **odd-q**.

Канонические координаты модели — всегда offset (`y * width + x`);
axial используется только внутри hex-математики.

## hex.ts — формулы Red Blob Games

Ориентация параметризована матрицей (Red Blob Games «Axial coordinates»):
`f*` — axial→pixel, `b*` — pixel→axial; flat и pointy различаются только
данными матрицы, иерархии классов нет.

| Функция | Формула |
|---|---|
| `cellCenter(q, r)` | `x = size·(f0·q + f1·r)`, `y = size·(f2·q + f3·r)` |
| `pixelToCell(px, py)` | обратная матрица `b*`, затем cube-round |
| `cellCorners()` | 6 вершин, угол `60°·i − (pointy ? 30° : 0°)` |

`size` = радиус описанной окружности гекса (не сторона!).

Cube-round: третий кубический axis `s = −q − r`; округляются все три,
наибольшее отклонение округлённой координаты корректируется так, чтобы
`q + r + s = 0` — это даёт ближайший гекс без ветвлений по треугольникам.

## Конверсии offset ↔ axial

Зафиксированы для нечётных вариантов (odd-r / odd-q):

```
pointy (odd-r):  q = col − (row − (row&1)) / 2   r = row
flat   (odd-q):  q = col                          r = row − (col − (col&1)) / 2
```

Обратные формулы — `axialToOffset`. Инвариант согласованности констант
между `mapPixelBounds`, `cellCenterAt` и `screenToCell` охраняется
round-trip тестом по всем клеткам (`gridGeometry.test.ts`,
`shared/hex.test.ts`).

## Публичный API

Импортировать только через модули `tiles.ts` / `hex.ts`; editor
реэкспортирует нужное в `editor/model/types.ts`.
