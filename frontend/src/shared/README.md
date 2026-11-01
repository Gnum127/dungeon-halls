# Shared: общие утилиты

Модули без зависимостей от React и DOM; editor реэкспортирует нужные типы в
`editor/model/types.ts`.

## tiles.ts

Палитра покрытий `TILE_TYPES` (`empty`/`floor`/`grass`/`water`/`stone`/`sand`/
`wall`), типы `TileTypeName` / `TileGrid` (Uint8Array — только внутренняя сетка
генератора) и лимит `MAX_MAP_DIMENSION` для генераторов. Лестницы больше НЕ
покрытие: это отдельная сущность `StairsPolygon` в модели (`editor/model/stairs.ts`),
тайл `stairs` удалён (этап 15). Сетка карты только квадратная: гекс-типы и
`GridType` удалены (этап 14).

## point.ts — геометрия

Операции над точкой: расстояние, интерполяция (`lerpPoint`), проекция на
отрезок (`projectOnSegment`), проверка точки в полигоне (`pointInPolygon`),
валидность (`isFinitePoint`). Координаты — float в клетках.

## id.ts

`newId()` — генерация идентификаторов регионов/стен/дверей.

## random.ts

`hashFromCoords(x, y)` и `pickIndexFromCoords(x, y, len)` — детерминированный
целочисленный хеш для псевдослучайного выбора варианта текстуры при тайлинге
без хранения в модели (без зависимости от `generator/`).

## Публичный API

Импортировать только через модули `shared/*`; editor реэкспортирует типы в
`editor/model/types.ts`.
