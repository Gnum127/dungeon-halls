# Спецификация: Этапы 19–24 — Чертоги подземелий

> **Контекст:** этапы 1–18 завершены. Модель карты — v6 (векторная).
> Текущий UI: ToolRail (боковой рейл) с разделами Ландшафт / Элементы / Свет /
> Вид / Генерация / Файл. Инструменты построения в панели «Ландшафт» (RegionTools).

> **Цель этапов 19–24:** светлая тема, доработка сетки, новый нижний тулбар
> с режимом курсора, реорганизация панелей, float-координаты объектов,
> текстурный пайплайн.

> **Порядок:** 19 и 20 независимы и могут идти параллельно. 21 → 22 → 23
> строго последовательно. 24 можно начинать параллельно с 21 (генерация
> картинок), но код текстурного рендера — после 23.

---

## Этап 19. Светлая тема

Перевод всего UI на светлую цветовую схему. Только CSS — логика не меняется.

Ключевое решение: **править только те CSS-файлы, чьи компоненты останутся**
после этапов 21–22. Удаляемые компоненты (LightPanel, GeneratorPanel,
RenderModePicker, RegionTools) не трогать.

### 19.1 Переменные `:root`

**Файл:** `frontend/src/index.css`

```css
:root {
  color-scheme: light;
  --bg: #f5f3f0;
  --surface: #ffffff;
  --border: #c4bfb8;
  --text: #24221f;
  --text-muted: #6b6560;
  --accent: #6c47c8;
  --rail-width: 3rem;
}
```

### 19.2 Стили остающихся компонентов

Пройди по каждому `.module.css`, обеспечь:

1. **Кнопки:** светлый фон (`--surface`), тёмный текст (`--text`),
   border: 1px solid `--border`.
2. **Активные/выбранные:** фон `--accent`, текст белый (`#fff`).
3. **Canvas:** рамка `--border`, фон `--surface`.
4. **Рейл:** фон `--surface`, иконки `--text-muted` (активная — `--accent`).
5. **Панели/сайдбар:** фон `--surface`, граница `--border`.

**Файлы к правке (7 шт):**
- `ToolRail.module.css`
- `TerrainPalette.module.css` — остаётся в панели параметров (этап 22)
- `SectionPanel.module.css`
- `ObjectPalette.module.css`
- `MapFileActions.module.css`
- `CanvasView.module.css`
- `EditorPage.module.css`

### 19.3 Проверки

- [ ] `npm run lint` — 0 ошибок
- [ ] `npm run test:ci` — все тесты зелёные (RTL-тесты могут сломаться из-за смены
  токенов цвета — адаптировать ассерты)
- [ ] `npm run build` — сборка без ошибок
- [ ] Ручная проверка: все границы панелей видны, текст читаем, контраст достаточен

---

## Этап 20. Сетка + баг многогранника

Два независимых исправления в рендере и инструментах. Порядок: сетка (20.1) →
баг (20.2) → тесты (20.3).

### 20.1 Точечная сетка на свободном поле

**Проблема:** `coverageGridPoints` (в `render/`) генерирует точки только
для углов покрытых клеток. Пустое поле — чистый лист.

**Решение:**
- Расширить `coverageGridPoints` или добавить отдельную функцию
  `allGridPoints(grid)` — возвращает Set строк вида `"x,y"` для ВСЕХ
  углов клеток в границах карты.
- В `renderMap`: после отрисовки покрытых точек (существующий вызов)
  дорисовать непокрытые — более тусклым цветом (например, `#d0d0d0`
  вместо `GRID_POINT_COLOR`).
- Пустые точки — меньше радиусом (например, 0.6× от `GRID_POINT_RADIUS`).

**Файлы:**
- `editor/render/` — сетка (модуль gridPoints)
- `editor/render/renderMap.ts` — вызов отрисовки
- `editor/render/colors.ts` — новая константа `EMPTY_GRID_POINT_COLOR`
- `editor/print/svg.ts` — паритет для SVG

**Тесты (fakeCtx):**
- Пустая карта → точки по ВСЕМ углам клеток
- Частично покрытая карта → точки покрытых (яркие) + точки пустых (тусклые)

### 20.2 Баг: многогранник за границей поля

**Проблема:** старт (0,0) → радиусная точка (10,10) → полигон выходит за
пределы карты вместе со стенами.

**Решение:**
- В функции, строящей вершины полигона (`tools/regions.ts` или
  `usePolygonRegionTool`), clamp каждой координаты вершины:
  `clamp(x, 0, grid.width)`, `clamp(y, 0, grid.height)`.
- Clamp применять ДО передачи вершин в `addRegion` / `addRegionWithWalls`.
- Аналогично проверить `useRectRegionTool` — прямоугольник тоже должен
  обрезаться по границам.
- Если после клампа все вершины совпали (полигон схлопнулся) → no-op,
  не коммитить.

**Файлы:**
- `editor/tools/regions.ts` — чистые функции построения вершин
- `editor/hooks/useRectRegionTool.ts`
- `editor/hooks/usePolygonRegionTool.ts`

**Тесты:**
- Прямоугольник, выходящий за правый край → обрезан по границе
- Многогранник (центр у края, радиус за границу) → все вершины в bounds
- Полный выход за границу → no-op

### 20.3 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci`
- [ ] `npm run build`

---

## Этап 21. Реорганизация панелей (удаление и переименование)

**Зависимости:** этап 19 (светлая тема) желателен, но не обязателен.

Удаляем три панели + урезаем четвёртую + переименовываем пятую.
Код удаляемых компонентов НЕ удаляем — только убираем из UI.

### 21.1 Удалить панель «Генерация»

- Из `ToolRail.tsx`: удалить `'generation'` из `EditorSectionId` и `SECTION_ORDER`,
  удалить `DiceIcon`.
- Из `EditorPage.tsx`: удалить case `'generation'` из `renderSection()`,
  удалить импорт `GeneratorPanel`, удалить `handleGenerate`.
- Хоткеи генератора не трогать (их нет).
- Код `generator/` не трогать.

### 21.2 Удалить панель «Свет»

- Из `ToolRail.tsx`: удалить `'light'` из `EditorSectionId` и `SECTION_ORDER`,
  удалить `BulbIcon`.
- Из `EditorPage.tsx`: удалить case `'light'`, импорт `LightPanel`,
  стейт `lightRadius`/`lightColor`, функцию `onSelectLights` из хоткеев.
- Из `CanvasView.tsx`: удалить пропсы `lightRadius`/`lightColor` если они
  передавались.
- Код `model/lights.ts`, `components/LightPanel.tsx`, рендер света
  (`render/renderMap.ts` — renderLights) не трогать.

### 21.3 Удалить панель «Вид»

- Из `ToolRail.tsx`: удалить `'view'` из `EditorSectionId` и `SECTION_ORDER`,
  удалить `EyeIcon`.
- Из `EditorPage.tsx`: удалить case `'view'`, импорт `RenderModePicker`,
  стейт `renderMode`, `spriteContext`, хук `useSpriteAtlas`.
- Из `CanvasView.tsx`: удалить пропс `sprites`.
- Код `render/renderMode.ts`, `render/sprites/`, `RenderModePicker.tsx`
  не трогать.

### 21.4 Урезать панель «Файл/Экспорт»

**MapFileActions.tsx — оставить только:**
- Кнопка «Сохранить» (JSON)
- Кнопка «Загрузить» (JSON)
- Кнопка «Экспорт PNG»

**Удалить из MapFileActions:**
- Чекбокс «Печатать источники света» (`printLight`)
- Кнопку «Export SVG»
- Кнопку «Export PDF» + все настройки PDF (paper, orientation, cellInches, pageCount)
- Инъекции `exportSvg`, `exportPdf`
- Импорты из `print/svg`, `print/pdf`, `print/pages`

**Удалить из FileActionStatus:**
- `'exportedSvg'`, `'exportedPdf'`, `'svgExportFailed'`, `'pdfExportFailed'`

### 21.5 Переименовать «Элементы» → «Объекты»

- В `ToolRail.tsx`: `'elements'` → `'objects'`, обновить `EditorSectionId` и
  `SECTION_ORDER`.
- В `EditorPage.tsx`: case `'elements'` → `'objects'`.
- i18n ключи: `editor.sections.elements` → `editor.sections.objects` (ru.json + en.json).

### 21.6 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci` — поправить тесты ToolRail/EditorPage
- [ ] `npm run build`
- [ ] Ручная: в рейле только 3 иконки (Ландшафт, Объекты, Файл)
- [ ] Ручная: MapFileActions содержит только Save/Load/Export PNG

---

## Этап 22. Нижний тулбар + режим курсора

**Зависимости:** этап 21 (панели «Свет», «Вид», «Генерация» уже удалены;
«Элементы» → «Объекты»).

Ключевые решения:
- **Нижняя плашка (BottomBar):** новый компонент `components/BottomBar.tsx`,
  закреплён внизу рабочей области. Содержит 6 пиктограмм-кнопок для
  переключения инструментов построения.
- **Боковая панель** (та, что рядом с ToolRail) — показывает параметры
  активного инструмента. Если активен инструмент из BottomBar — параметры
  этого инструмента. Если «Объекты» — ObjectPalette. Если «Файл» —
  MapFileActions.
- **Режим «Курсор»** — новый тип `EditorTool`: `{ type: 'cursor' }`. В этом
  режиме: клик по объекту — выделение, Delete — удаление, ЛКМ-драг по
  объекту — перемещение (пока клеточное, float — в этапе 23).
- **Режим «Перетаскивание» (пан):** `{ type: 'pan' }`. Зажать ЛКМ и тянуть
  карту (уже есть зум/пан, нужно выделить в отдельный режим).
- **Инструменты построения** (прямоугольник, многогранник, лестница, дверь)
  переносятся из боковой панели «Ландшафт» на нижнюю плашку.
- **Параметры** активного инструмента (число граней, угол двери, текстура
  двери, выбор ландшафта, авто-стены, ластик) — в боковой панели.

### 22.1 Тип EditorTool: добавить `cursor` и `pan`

**Файл:** `editor/tools/editorTool.ts`

Добавить в union:
```ts
| { readonly type: 'cursor' }
| { readonly type: 'pan' }
```

### 22.2 Компонент BottomBar

**Новый файл:** `editor/components/BottomBar.tsx` + `BottomBar.module.css` +
`BottomBar.test.tsx`

**Пиктограммы (inline-SVG 24×24, currentColor):**

| Инструмент | Клавиша | SVG-иконка |
|-----------|---------|------------|
| Курсор | (нет, или Esc) | Стрелка-указатель |
| Перетаскивание | (пробел?) | Рука (grab) |
| Прямоугольник | B | ▭ незакрашенный |
| Многогранник | P | ⬠ пятиугольник |
| Лестница | (нет) | 🪜 три параллельные линии |
| Дверь | D | 🚪 арка/проём |

**Пропсы:**
```ts
interface BottomBarProps {
  activeTool: EditorTool
  onSelectCursor: () => void
  onSelectPan: () => void
  onSelectRect: () => void
  onSelectPolygon: () => void
  onSelectStairs: () => void
  onSelectDoor: () => void
}
```

**Поведение:**
- `aria-pressed` на активной кнопке
- `title` / `aria-label` с названием инструмента (i18n)
- Горизонтальный ряд кнопок, фон `--surface`, border-top: 1px solid `--border`

### 22.3 Боковая панель параметров (переработка EditorPage.renderSection)

**Логика:** если `activeSection === 'landscape'` — показывать НЕ RegionTools
(он удаляется), а панель параметров, зависящую от текущего `tool.type`.

**Новый компонент:** `ToolParams.tsx` (или прямо в EditorPage switch).

Параметры по инструменту:

**Когда `tool.type === 'cursor'`:**
- Ничего (или краткая подсказка: «Клик — выделить, Delete — удалить»)

**Когда `tool.type === 'pan'`:**
- Ничего (или подсказка: «Зажать и тянуть»)

**Когда `tool.type === 'region-rect'` или `'region-polygon'`:**
- Палитра ландшафта (TerrainPalette) — выбор типа покрытия
- Переключатель «Построение / Удаление» (ластик) — меняет `tileType` между
  выбранным и `'empty'`, или отдельная кнопка «Ластик»
- Для многогранника: поле «Число вершин» (3–12)
- Чекбокс «Авто-стены»

**Когда `tool.type === 'door'`:**
- Поле «Угол открытия» (0–150°)
- Выпадающий список текстуры двери (из DOOR_CATALOG)

**Когда `tool.type === 'stairs'`:**
- Ничего (или базовая подсказка)

### 22.4 Удаление старого RegionTools

- Удалить импорт `RegionTools` из `EditorPage.tsx`.
- Удалить case `'landscape'` в `renderSection()` (заменено на панель
  параметров из 22.3).
- Сам файл `RegionTools.tsx` и его `.module.css` — удалить.
- Тесты `RegionTools.test.tsx` — удалить.

### 22.5 Интеграция BottomBar в EditorPage

- Добавить состояние `tool` с начальным значением `{ type: 'cursor' }`.
- BottomBar рендерится внизу `.workspace` (под CanvasView).
- Хоткеи: Esc → `cursor`, B → `region-rect`, P → `region-polygon`,
  D → `door`, W → удалён или переехал? (стена как отдельный инструмент
  убирается — авто-стены через чекбокс, ручная стена пока не нужна?).
  Уточнение: инструмент «Стена» (`'wall'`) — убрать с BottomBar,
  оставить только авто-стены. Хоткей W удалить.

### 22.6 Режим курсора: выделение, перемещение, удаление

**Файл:** `editor/hooks/useCursorTool.ts` (новый)

**Выделение объекта:**
- Клик по объекту (hit-test: `topmostObjectAt`) → `setSelectedObjectId`.
- Клик мимо → сброс `selectedObjectId`.

**Перемещение объекта (клеточное, float — в этапе 23):**
- Зажать ЛКМ на выделенном объекте → drag → `moveObject` на новую клетку.
- Отпустить → коммит команды.
- Одна drag-сессия = одна запись в истории (coalescing).

**Удаление:**
- `Delete` при активном `selectedObjectId` → `removeObject`.

### 22.7 Режим «Перетаскивание» (пан)

**Файл:** расширить существующий пан (сейчас на среднюю кнопку/колесо).

В режиме `'pan'`: зажать ЛКМ = пан, отпустить = стоп.
В других режимах построения пан остаётся на средней кнопке.

### 22.8 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci` — новые тесты BottomBar + обновлённые EditorPage
- [ ] `npm run build`
- [ ] Ручная: BottomBar виден внизу, 6 кнопок
- [ ] Ручная: переключение инструментов работает
- [ ] Ручная: параметры в боковой панели меняются при смене инструмента
- [ ] Ручная: курсор выделяет/перемещает/удаляет объекты
- [ ] Ручная: пан работает в режиме перетаскивания

---

## Этап 23. Float-координаты объектов

**Зависимости:** этап 22 (режим курсора готов, `ObjectPalette` переименован).

**Ключевое решение:** обратную совместимость НЕ поддерживаем. `MapObject.x/y`
меняются с `number` (целые клетки) на `number` (float, мировые единицы).
`MAP_VERSION` — в рамках v6 менять не нужно (JSON хранит числа, float
сериализуется как есть). Все потребители `MapObject.x/y` переписываются.

### 23.1 Модель: MapObject float

**Файл:** `editor/model/types.ts`

```ts
interface MapObject {
  id: number
  kindId: ObjectKindId
  x: number   // было целое (клетка), стало float (мировые единицы = клетки)
  y: number   // было целое, стало float
  rotation: ObjectRotation
  scale: ObjectScale
}
```

**Файл:** `editor/model/objects.ts`

- `objectFootprint`: `w = (obj.scale?.w ?? 1) * cellSize`, `h = ...`
  (раньше было в клетках, теперь возвращает мировые размеры в пикселях/единицах).
  Или оставить в «клеточных единицах» но с float: `x..x+w, y..y+h`.
- `footprintCells` — больше не нужна (объект не привязан к клеткам).
  Удалить или пометить deprecated.
- `rectsOverlap` — адаптировать под float.
- `footprintInBounds` — проверять `x >= 0 && y >= 0 && x + w <= grid.width`.
- `isCellOccupied` — удалить (завязана на клетки).
- `isFootprintFree` — оставить, проверка пересечения float-прямоугольников.
- `topmostObjectAt(px, py)` — координаты теперь мировые float.
- `findObjectById` — без изменений.

### 23.2 Команды: addObject / moveObject

**Файл:** `editor/model/commands.ts`

- `addObject`: `x, y` — теперь float. Валидация: проверять `x >= 0 && y >= 0`
  (левая-верхняя граница), нижняя-правая может выходить за границы карты
  (объект может частично свисать).
- `moveObject(id, x, y)`: новые координаты — float, без снапа.
- `removeObject` — без изменений.

### 23.3 Рендер объектов

**Файл:** `editor/render/renderMap.ts`

- `renderObjects`: `obj.x * cellSize`, `obj.y * cellSize` — мировые координаты.
  Размер: `obj.scale.w * cellSize`, `obj.scale.h * cellSize`.
  Поворот вокруг центра (как сейчас).
- Объекты рисуются **ПОВЕРХ сетки** (после `renderGrid`).
- Hit-test курсора: `topmostObjectAt(worldX / cellSize, worldY / cellSize)`.

### 23.4 Инструмент «Курсор» — float drag

**Файл:** `editor/hooks/useCursorTool.ts`

- При drag: пересчитывать новые координаты в мировых единицах:
  `newX = startObjX + deltaX / cellSize`, `newY = startObjY + deltaY / cellSize`.
- Снап к сетке — опциональный (можно зажать Shift для снапа к ближайшему
  целому/половинному делению).
- Коммит `moveObject(id, newX, newY)` одной командой на drag-сессию.

### 23.5 Реестр объектов: удалить stairs, добавить tree

**Файл:** `editor/model/objects.ts`

- Удалить запись `stairs` из `OBJECT_KIND_REGISTRY`.
- Добавить запись `tree`:
  ```ts
  tree: {
    labelKey: 'editor.objects.tree',
    color: '#2d5a1e',
    category: 'dungeon',
    defaultScale: { w: 2, h: 2 },
    defaultImage: 'tree-oak',
    imagePool: ['tree-oak'],
    scales: [{ w: 1, h: 1 }, { w: 2, h: 2 }],
  }
  ```
- Удалить `gridRestriction: 'square'` у `torch` (гексов больше нет,
  ограничение бессмысленно) — или оставить на будущее.
- i18n: добавить ключи `editor.objects.tree` в ru.json/en.json.

### 23.6 ObjectPalette: удалить поиск

**Файл:** `editor/components/ObjectPalette.tsx`

- Удалить `search`, `setSearch`, `<input className={styles.search}>`.
- Удалить `useMemo` с фильтрацией — показывать все категории сразу.
- Удалить кнопку «Выбор» (selectActive / onSelectSelectTool) — заменена
  режимом «Курсор» из BottomBar.
- Упростить пропсы: убрать `selectActive`, `onSelectSelectTool`.

### 23.7 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci` — обновить тесты objects, commands, renderMap, ObjectPalette
- [ ] `npm run build`
- [ ] Ручная: объект можно поставить в произвольное место (не по сетке)
- [ ] Ручная: объект можно перетащить (drag) в режиме курсора
- [ ] Ручная: Delete удаляет выделенный объект
- [ ] Ручная: stairs нет в палитре объектов, tree есть
- [ ] Ручная: поле поиска и кнопка «Выбор» отсутствуют в палитре объектов

---

## Этап 24. Текстурный пайплайн

**Зависимости:** этап 21 (панель «Вид» удалена). Этап 23 желателен
(рендер объектов адаптирован), но текстурный рендер можно начать
параллельно с этапом 23.

**Ключевое решение:**
- Изображения уже сгенерированы и лежат в `public/sprites/tiles/` и
  `public/sprites/objects/` (см. `docs/texture-generation-guide.md`).
  Генерация выполняется моделью `gemini-3.1-flash-image` (только
  изображения, с кодом не работает).
- Режим отображения теперь ЕДИНСТВЕННЫЙ — спрайтовый с fallback на цвет.
  Переключатель «цвета / спрайты» удалён.
- **Текстуры ландшафта рисуются ПОД сеткой** в порядке слоёв рендера.
- **Текстуры объектов рисуются ПОВЕРХ сетки.**
- Fallback: если текстура не загружена — цветная заливка (как сейчас
  в режиме `'colors'`).

### 24.1 Порядок слоёв рендера (финальный)

```
1. Фон (background)
2. Регионы покрытия (TerrainRegion[]) — тайлинг текстур ландшафта
3. Лестницы (StairsPolygon[]) — контур + ступени
4. Точечная сетка (grid points)           ← граница: всё что выше — поверх сетки
5. Объекты (MapObject[]) — текстуры объектов
6. Стены (WallSegment[]) — с телом
7. Двери (Door[]) — створка/проём
8. Свет (MapLight[]) — полупрозрачные круги (код есть, UI скрыт)
```

### 24.2 Текстурный рендер ландшафта (под сеткой)

**Файлы:** `editor/render/renderMap.ts`, `editor/render/sprites/`

- Удалить ветку `if (renderMode === 'sprites')` — рендер теперь всегда
  текстурный с fallback.
- Для каждого `TerrainRegion`:
  1. Сначала заливка цветом (`TILE_COLORS[tileType]`) — fallback.
  2. Поверх — тайлинг текстурой, если загружена.
- Тайлинг: изображение `256×256` (или `512×512`) повторяется с шагом,
  равным размеру изображения. Координаты: `worldX = tileX * cellSize`,
  но wrap с шагом `textureSize`, не `cellSize` (одна картинка = много клеток).
- Clip по полигону региона.
- Детерминизм не меняется: hash от координат текстурной плитки, выбор
  варианта из пула.

**Новый манифест (или расширение существующего):**
- `public/sprites/manifest.json` — секция `tileTextures`:
  ```json
  {
    "tileTextures": {
      "floor": { "path": "tiles/floor_stone.png", "size": 256 },
      "grass": { "path": "tiles/grass.png", "size": 256 },
      ...
    }
  }
  ```
- `size` — размер текстурной плитки в пикселях.
- Валидация как у существующего манифеста.

### 24.3 Текстурный рендер объектов (поверх сетки)

**Файлы:** `editor/render/renderMap.ts`, `editor/render/sprites/loader.ts`

- Для каждого `MapObject`:
  1. Сначала цветной свотч (ellipse/rect) — fallback.
  2. Поверх — `drawImage` с текстурой объекта, растянутой на footprint.
- Размер footprint в пикселях: `w = obj.scale.w * cellSize`,
  `h = obj.scale.h * cellSize`.
- Поворот вокруг центра.
- Текстура выбирается: override (localStorage) → `defaultImage` → манифест.

**Манифест объектов:**
- `public/sprites/manifest.json` — секция `objectTextures`:
  ```json
  {
    "objectTextures": {
      "table": { "path": "objects/table_wooden.png" },
      "chair": { "path": "objects/chair_wooden.png" },
      ...
    }
  }
  ```

### 24.4 Загрузка и fallback

- Загрузчик из `render/sprites/loader.ts` расширяется: +2 группы
  (`tileTextures`, `objectTextures`).
- Если манифест отсутствует или текстура не загрузилась — fallback на цвет.
- Без ошибок в консоли, без блокировки UI.
- PNG-экспорт использует тот же рендер → текстуры попадают в экспорт.

### 24.5 Удаление RenderModePicker и связанного кода

**Удалить:**
- `components/RenderModePicker.tsx` + `.module.css` + `.test.tsx`
- `render/renderMode.ts`
- Логику `useSpriteAtlas` — заменить на единый хук `useTextureAtlas`,
  который грузит ВСЕ текстуры (тайлы + объекты) и не имеет режима
  «цвета/спрайты».
- Пропс `sprites` из `CanvasView` и `MapFileActions` — заменить на
  `textures` (новый тип).

### 24.6 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci`
- [ ] `npm run build`
- [ ] Ручная: регионы рисуются текстурами, бесшовный тайлинг
- [ ] Ручная: объекты рисуются текстурами
- [ ] Ручная: сетка видна ПОВЕРХ текстур ландшафта
- [ ] Ручная: сетка видна ПОД текстурами объектов
- [ ] Ручная: при отсутствии текстур — цветной fallback
- [ ] Ручная: PNG-экспорт включает текстуры