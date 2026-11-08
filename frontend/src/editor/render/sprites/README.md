# Текстурный ассет-пайплайн

Карта рисуется текстурами: ландшафт — тайлингом бесшовных текстур под сеткой,
объекты — текстурами, растянутыми на footprint поверх сетки. Режим «цвета /
спрайты» удалён (этап 24): режим отображения единственный, при отсутствии
текстуры — цветной fallback. Текстуры — настройка просмотра, модель карты и
файлы проектов их не знают.

## Состав модуля

| Файл                            | Назначение                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `manifest.ts`                   | типы `TextureManifest`/`ElementImageManifest`, валидаторы, константы пути/версии |
| `loader.ts`                     | `loadTextureManifest` / `loadElementManifest` / `loadTextures` / `resolveSpriteUrl`, кэш и таймауты |
| `../../hooks/useTextureAtlas.ts` | React-состояние атласа текстур для EditorPage                                 |

## Ассеты

- Каталог: `frontend/public/sprites/`, раздаётся Vite как статика.
- Манифест текстур: `frontend/public/sprites/manifest.json`.
- Готовые изображения элементов (иконки объектов, двери):
  `frontend/public/element-images/manifest.json` — отдельный пул по `imageId`.
- **Пути в манифесте отсчитываются от корня статики** (base URL), а не от
  каталога `sprites/`: запись `"sprites/tiles/floor_stone.png"` →
  `/sprites/tiles/floor_stone.png`. Префикс `sprites/` — часть конвенции.

Текущий набор:
- Текстуры ландшафта (`tileTextures`): floor, grass, stone, water, sand.
- Текстуры объектов (`objectTextures`): table, chair, chest, barrel, bush, rock, tree.

Файлы картинок генерируются по `docs/texture-generation-guide.md`.

## Именование файлов

```
public/sprites/
  manifest.json
  tiles/<name>.png      # floor_stone.png, grass.png, … (не привязаны к ключам TILE_TYPES)
  objects/<name>.png    # table_wooden.png, tree_oak.png, …
```

- Формат PNG; тайлы — квадратные бесшовные (поставлены 1024×1024), объекты —
  квадратные с прозрачным фоном (поставлены 1024×1024).

## Схема манифеста

```json
{
  "version": 2,
  "tileTextures": {
    "floor": { "path": "sprites/tiles/floor_stone.png", "size": 1024 },
    "grass": { "path": "sprites/tiles/grass.png", "size": 1024 }
  },
  "objectTextures": {
    "table": { "path": "sprites/objects/table_wooden.png" }
  }
}
```

- Ключи `tileTextures` — имена из `TILE_TYPES` (`shared/tiles.ts`), значения —
  `{ path, size, pool? }`, где `size` — сторона ассета в пикселях. Ассет
  соответствует `size / DEFAULT_CELL_SIZE` клеткам (ref 64px), поэтому плитка
  привязана к миру и масштабируется вместе с картой при зуме; фаза тайлинга
  выровнена по мировому нулю (не зависит от вьюпорта).
- Опциональный `pool` — массив путей к вариантам той же текстуры: при тайлинге
  вариант выбирается детерминированно по индексу текстурной плитки (`col`, `row`;
  `shared/random.ts`, `hashFromCoords`/`pickIndexFromCoords`). Если пул задан,
  он предпочитается одиночному `path`; отказ одного варианта не убирает пул, а
  отказ базового `path` берёт первый живой вариант пула.
- Ключи `objectTextures` — id из `OBJECT_KIND_REGISTRY`
  (`editor/model/objects.ts`), значения — `{ path }`. Текстура растягивается на
  footprint объекта и поворачивается вокруг центра вместе с ним.
- Записи опциональны: нет записи — рендер уходит в fallback на цветную плитку
  или кружок. Пустые секции валидны («пустой атлас»).
- Любая ошибка валидации (битый JSON, неизвестный ключ, неположительный `size`,
  чужая `version`) ⇒ манифест отбрасывается целиком, приложение работает в
  цветном режиме. Отсутствие файла манифеста (404) — нормальный путь: пустой
  атлас, без ошибок в консоли.
- Таймаут одной картинки — `TEXTURE_LOAD_TIMEOUT_MS`; провал не кэшируется,
  повторная загрузка возможна.

## Приоритет текстуры объекта

1. Явный выбор пользователя (element-image override из палитры объектов).
2. Текстурный ассет вида (`objectTextures`) — основная графика.
3. `defaultImage` вида из element-images — фолбэк, если текстуры нет.
4. Цветной свотч (`OBJECT_COLORS`).

Двери рисуются element-images (`Door.imageId`); свет — векторный.

## Как добавить новый вид объекта

1. Добавьте запись в `OBJECT_KIND_REGISTRY` (editor/model/objects.ts):
   `{ labelKey, color, category }` — палитра UI построится сама.
   Опционально: `defaultScale` ({ w, h }) и `scales` (список размеров) для
   многоклеточных, `defaultImage`/`imagePool` — картинки вида.
2. Добавьте ключи i18n `<labelKey>` в `ru.json` И `en.json`
   (тест `model/objects.test.ts` упадёт без этого).
3. Сгенерируйте текстуру в `public/sprites/objects/` и добавьте запись в
   `objectTextures` манифеста текстур. Логику менять не нужно.

## Ограничения

- Генераторы локаций работают только с квадратной сеткой (см.
  `frontend/src/generator/README.md`) — ограничение не текстурное, но рядом.
- PNG-экспорт идёт в том же режиме, что холст; при недоступном атласе — цветами,
  без ожидания загрузки.
