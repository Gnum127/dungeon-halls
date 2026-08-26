# Спрайтовый ассет-пайплайн

Спрайтовый режим отображения («Графика → Спрайты» в панели редактора)
рисует карту картинками вместо цветных плиток. Режим — настройка просмотра:
модель карты и файлы проектов его не знают.

## Состав модуля

| Файл                            | Назначение                                                                 |
| ------------------------------- | -------------------------------------------------------------------------- |
| `manifest.ts`                   | тип `SpriteManifest`, `validateManifest`, константы пути и версии          |
| `loader.ts`                     | `loadManifest` / `loadSprites` / `resolveSpriteUrl`, кэш и таймауты        |
| `../renderMode.ts`              | выбор «цвета / спрайты» + localStorage (`dungeon-halls.editor.renderMode`) |
| `../../hooks/useSpriteAtlas.ts` | React-состояние атласа для EditorPage                                      |

## Ассеты

- Каталог: `frontend/public/sprites/`, раздаётся Vite как статика.
- Манифест: `frontend/public/sprites/manifest.json`.
- **Пути в манифесте отсчитываются от корня статики** (base URL), а не от
  каталога `sprites/`: запись `"sprites/tiles/floor.png"` → `/sprites/tiles/floor.png`.
  Префикс `sprites/` в путях — часть конвенции именования.

Текущий набор (этап 8):
- Тайлы: floor, grass, water, stone, sand, wall (6 шт.)
- Объекты: door, stairs, table, chair, chest, barrel, torch, bush, rock (9 шт.)

Для генерации placeholder-спрайтов: `node scripts/gen-sprites.mjs`
(создаёт 64×64 PNG solid-color файлы).

## Именование файлов

```
public/sprites/
  manifest.json
  tiles/<tile-name>.png        # floor.png, grass.png, … (имя = ключ TILE_TYPES)
  objects/<kind-id>.png        # door.png, chest.png, … (имя = id OBJECT_KIND_REGISTRY)
```

- Имена файлов — в точности id из кода (`TILE_TYPES` / реестр объектов),
  нижний регистр, латиница, без пробелов: путь воспроизводится из ключа
  манифеста механически.
- Формат PNG; квадратная картинка желательна (спрайт растягивается в клетку).

## Схема манифеста

```json
{
  "version": 1,
  "tiles": { "floor": "sprites/tiles/floor.png", "wall": "sprites/tiles/wall.png" },
  "objects": { "door": "sprites/objects/door.png" }
}
```

- Ключи `tiles` — имена из `TILE_TYPES` (shared/tiles.ts); ключи `objects`
  — id из `OBJECT_KIND_REGISTRY` (editor/model/objects.ts).
- Записи опциональны: нет записи — рендер этой клетки/вида уходит в fallback
  на цветную плитку или кружок. Пустые секции валидны («пустой атлас»).
- Любая ошибка валидации (битый JSON, неизвестный ключ, чужая `version`)
  ⇒ манифест отбрасывается целиком, приложение работает в цветном режиме.
- Отсутствие файла манифеста (404) — нормальный путь: пустой атлас,
  без ошибок в консоли.
- Таймаут одной картинки — `SPRITE_LOAD_TIMEOUT_MS`; провал не кэшируется,
  повторная загрузка возможна.

## Как добавить новый вид объекта

1. Добавьте запись в `OBJECT_KIND_REGISTRY` (editor/model/objects.ts):
   `{ labelKey, color, category }` — палитра UI построится сама.
   Опционально: `defaultScale` ({ w, h }) для многоклеточных,
   `gridRestriction: 'square'` для несовместимых с гексами.
2. Добавьте ключи i18n `<labelKey>` в `ru.json` И `en.json`
   (тест `model/objects.test.ts` упадёт без этого).
3. Положите картинку в `public/sprites/objects/<id>.png` и добавьте запись
   в `objects` манифеста. Логику менять не нужно.
4. Перегенерируйте placeholder-спрайты: `node scripts/gen-sprites.mjs`

## Ограничения

- Генераторы локаций работают только с квадратной сеткой (см.
  `frontend/src/generator/README.md`) — ограничение не спрайтовое,
  но проявляется рядом.
- Спрайт гекса рисуется в bbox описанной окружности (2×cellSize) и clip по
  полигону клетки; масштаб спрайта в гексе отличается от квадратной ветки.
- PNG-экспорт идёт в том же режиме, что холст; при недоступном атласе —
  цветами, без ожидания загрузки.
