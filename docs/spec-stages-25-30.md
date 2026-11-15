# Спецификация: Этапы 25–30 — Чертоги подземелий

> **Контекст:** этапы 19–24 завершены. Светлая тема, нижний тулбар, режим
> курсора, float-координаты объектов, текстурный пайплайн (тайлы + объекты).
> ToolRail: Ландшафт / Объекты / Файл.

> **Цель этапов 25–30:** доработка построений с полуклеточной точностью,
> переработка дверей (свободное размещение, разрыв стен, текстуры),
> улучшение режима курсора (выделение с параметрами, per-instance настройки),
> линии сетки поверх текстур, багфиксы.

---

## Этап 25. Полуклеточная точность регионов + Esc + курсор без подсветки

Пункты пользователя: 1, 8, 2 (частично).

### 25.1 Прямоугольник и многогранник — привязка к 0.5

**Проблема:** `useRectRegionTool` и `usePolygonRegionTool` используют
`useCellFromEvent` → целые клетки. Подсветка квадранта 0.5×0.5 есть,
но построение идёт по целым.

**Решение:**
- `useRectRegionTool`: заменить `useCellFromEvent` на `useWorldPointFromEvent`,
  снапить старт и текущую точку через `snapToHalfGrid`.
- `rectPolygon(ax, ay, bx, by, cols, rows)`: убрать `+1` к maxX/maxY
  (добавка нужна была только для целых клеток «включительно»). С float-вершинами
  полигон строится «от точки до точки» без +1.
- `usePolygonRegionTool`: убрать `+0.5` к `centerPoint` и `radialPoint`
  (сейчас: `center.x + 0.5` — это костыль перехода от целой клетки к её
  центру). С переходом на world-координаты снап к 0.5 делается в момент
  клика, центр и радиальная точка — уже float.

**Файлы:**
- `editor/hooks/useRectRegionTool.ts`
- `editor/hooks/usePolygonRegionTool.ts`
- `editor/tools/regions.ts` — `rectPolygon`
- `editor/components/CanvasView.tsx` — превью (убрать `+0.5` в строках 251-252)

**Поведение:**
- Старт в точке (0.5, 0.5), конец в (3.5, 3.5) → прямоугольник от (0.5, 0.5)
  до (3.5, 3.5), покрывает 3×3 клетки.
- Многогранник: центр в (2.0, 2.0), радиусная точка в (4.5, 2.0) — вершины
  на окружности, снап к 0.5.

### 25.2 Esc — отмена построения + переход в «Курсор»

**Проблема:** `useEditorHotkeys` уже мапит Escape → `selectCursor`, но
инструменты (прямоугольник в drag, многогранник с активным центром, лестница
с частичным построением) не сбрасывают своё состояние. Получается: инструмент
сменился на «Курсор», но драг/превью «зависли».

**Решение:**
- При нажатии Escape ВСЕ инструменты должны сбрасывать своё состояние:
  - `useRectRegionTool`: `dragRef.current = null`, `setPreview(null)`
  - `usePolygonRegionTool`: `setCenter(null)`, `setCurrent(null)`
  - `useDoorTool`: `setPending(null)`
  - `useStairsTool`: `setClicks([])`, `setCursor(null)`, `setSelectedId(null)`
- Общий механизм: в `useEditorHotkeys` при Escape сначала дёрнуть
  `onSelectCursor()` (уже есть), но хуки должны слушать смену `active=false`
  и сбрасываться. Сейчас у `usePolygonRegionTool` и `useStairsTool` есть
  `wasActive`-гейт, у `useRectRegionTool` — нет (dragRef не сбрасывается).
- Добавить `useEffect` в `useRectRegionTool`: при `active === false` →
  `dragRef.current = null`, `setPreview(null)`.
- Проверить `useDoorTool`: там уже есть `wasActive`-гейт, должен работать.

### 25.3 Режим «Курсор» — убрать подсветку клеток

**Проблема:** `drawHoverHighlight` всегда рисует либо квадрант, либо целую
клетку. В режиме «Курсор» этого быть не должно.

**Решение:**
- В `drawHoverHighlight` добавить проверку: если `tool.type === 'cursor'`
  или `tool.type === 'pan'` — ничего не рисовать (early return).
- Или: в `CanvasView` эффекте рендера обернуть вызов `drawHoverHighlight`
  в условие `tool.type !== 'cursor' && tool.type !== 'pan'`.

**Файл:** `editor/render/hoverHighlight.ts` или `editor/components/CanvasView.tsx`.

### 25.4 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci`
- [ ] `npm run build`
- [ ] Ручная: прямоугольник (0.5,0.5)–(3.5,3.5) строится
- [ ] Ручная: многогранник с полуклеточным центром
- [ ] Ручная: Esc отменяет drag-прямоугольник
- [ ] Ручная: Esc отменяет недостроенный многогранник
- [ ] Ручная: в режиме «Курсор» клетки не подсвечиваются

---

## Этап 26. Переработка дверей

Пункты пользователя: 4, 6.

Ключевые решения:
- **Свободное размещение:** дверь строится по двум выбранным точкам БЕЗ
  привязки к стене. `doorEndpoints` больше не вызывает `nearestWallSegment`
  и `alignToWall`.
- **Угол открытия убрать:** `Door.openAngle` всегда 0, поле `openAngle`
  удалить из модели, панели и EditorTool. Тип `EditorTool` для двери:
  `{ type: 'door'; imageId: string | null }`.
- **Разрыв стены:** если отрезок двери пересекает стену — стена
  геометрически разрывается (механизм `splitWallByDoorGaps` уже есть
  в `wallRuns`).
- **Текстура двери:** рендер через `drawImage` с текстурой из манифеста
  (как объекты), fallback — жирная линия `DOOR_FILL_COLOR`.
- **При построении:** не подсвечивать клетку/квадрант. Подсвечивать только
  точки-кандидаты снапа (9/4 characteristic points).

### 26.1 Удаление openAngle

**Файлы:**
- `editor/model/doors.ts`: удалить `openAngle` из `Door`, удалить
  `isValidDoorOpenAngle`, `MAX_DOOR_OPEN_ANGLE`, `DEFAULT_DOOR_OPEN_ANGLE`,
  `cycleDoorOpenAngle`.
- `editor/model/types.ts`: убрать `openAngle` из Door.
- `editor/model/commands.ts`: убрать `openAngle` из `addDoor`, удалить
  команду `setDoorAngle`.
- `editor/model/io.ts`: убрать `openAngle` из сериализации.
- `editor/tools/editorTool.ts`: `door` без `openAngle`:
  `{ type: 'door'; imageId: string | null }`.
- `editor/components/ToolParams.tsx`: удалить поле «Угол створки».
- `editor/components/EditorPage.tsx`: удалить `doorOpenAngle` state,
  `changeDoorOpenAngle`, проброс в ToolParams/CanvasView.
- `editor/components/CanvasView.tsx`: удалить `openAngle` из doorHandlers.
- `editor/hooks/useDoorTool.ts`: удалить `openAngle` из опций и коммита,
  убрать `cycleDoorOpenAngle` из хит-теста (клик по двери больше не
  переключает угол).
- `editor/render/renderMap.ts`: `drawDoor` — створка всегда закрыта
  (лежит на отрезке a–b).
- i18n: удалить ключи `doorAngle`, `doorTexture` из ru.json/en.json
  (параметры двери теперь в ToolParams).

### 26.2 Свободное размещение (без привязки к стене)

**Файл:** `editor/tools/doorPlacement.ts`

- `doorEndpoints(model, startWorld, endWorld)`: удалить вызов
  `nearestWallSegment` и `alignToWall`. Всегда возвращать:
  ```ts
  return {
    a: snapToCellCharacteristics(model, startWorld),
    b: snapToCellCharacteristics(model, endWorld),
  }
  ```
- Удалить функции `alignToWall`, константу `DOOR_WALL_DISTANCE`.

**Файл:** `editor/hooks/useDoorTool.ts`

- Убрать `openAngle` из опций.
- `onPointerDown`: при клике по существующей двери (hitDoorId) —
  **только удаление** по правому клику. Левый клик по двери в режиме
  «Дверь» ничего не делает (или выделяет — на будущее).

### 26.3 Подсветка точек (не клеток) при построении двери

**Файлы:** `editor/render/hoverHighlight.ts`, `editor/render/snapPreview.ts`

- `toolPaintsTexture`: убрать `'door'` из проверки (дверь не «красит»
  текстуру ландшафта, квадрант не нужен).
- `drawHoverHighlight`: для `tool.type === 'door'` — НЕ рисовать
  ни клетку, ни квадрант.
- Для двери оставить только `drawSnapCandidates` — точки снапа.

### 26.4 Текстура двери (изображение)

**Проблема:** сейчас дверь рисуется жирной линией `DOOR_FILL_COLOR`.

**Решение:**
- Загрузить текстуры дверей в `public/sprites/objects/` (например,
  `door_wooden.png`). Или использовать существующие `element-images/doors/`.
- В `renderMap.ts` → `drawDoor`: приоритет: текстура из манифеста
  (`textures?.objectTextures['door']`) → `drawImage` вдоль отрезка a–b;
  fallback — жирная линия.
- Дверь — прямоугольник: длина = `distance(a, b) * cellSize`, ширина =
  `cellSize * DOOR_THICKNESS_FRACTION`. Центр — середина a–b.
  Поворот — угол отрезка a–b.
- Изображение растягивается на этот прямоугольник.

**Файлы:**
- `editor/render/renderMap.ts` → `drawDoor`
- `public/sprites/manifest.json` → добавить `"door"` в `objectTextures`

### 26.5 Разрыв стены дверью

Уже реализовано: `wallRuns` в `geometry.ts` + `splitWallByDoorGaps`.
Дверь не привязана к стене, но `wallRuns` проверяет ВСЕ двери
и вырезает их из стены с зазором `DOOR_GAP_CLEARANCE`. Работает
для любых дверей, независимо от привязки. **Код не менять.**

### 26.6 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci`
- [ ] `npm run build`
- [ ] Ручная: дверь строится по двум произвольным точкам
- [ ] Ручная: дверь НЕ магнитится к стене
- [ ] Ручная: дверь разрывает стену (визуально)
- [ ] Ручная: дверь рисуется текстурой (если загружена)
- [ ] Ручная: при построении двери подсвечиваются только точки снапа
- [ ] Ручная: панель «Угол створки» отсутствует

---

## Этап 27. Улучшение лестниц

Пункты пользователя: 5, 7.

### 27.1 Первый клик — любая из 9 точек (не только центр)

**Проблема:** `useStairsTool` делает `snapToHalfGrid(world)` для первого
клика. Но `characteristicPoints` дают 9 точек (0.5×0.5 сетка), а
`snapToHalfGrid` — только полуклеточный снап (0.0, 0.5, 1.0, ...).

**Решение:**
- Заменить `snapToHalfGrid(world)` → `snapToCellCharacteristics(model, world)`
  для ВСЕХ трёх кликов лестницы.
- Импортировать `snapToCellCharacteristics` из `model/snap.ts`.

**Файл:** `editor/hooks/useStairsTool.ts`

### 27.2 Убрать подсветку целой клетки

**Проблема:** `drawHoverHighlight` для `stairs` рисует целую клетку
(потому что `toolPaintsTexture` возвращает false, идёт в else-ветку
`drawCellHighlight`).

**Решение:**
- В `drawHoverHighlight`: для `tool.type === 'stairs'` — НЕ рисовать
  клетку. Оставить только `drawSnapCandidates`.

**Файл:** `editor/render/hoverHighlight.ts`

### 27.3 Контрастность лестниц

**Проблема:** лестницы недостаточно контрастны.

**Решение:**
- Увеличить контраст `STAIRS_OUTLINE_COLOR` (сейчас `#6b5a3c` → например
  `#3a2a15`) и `STAIRS_STEP_COLOR` (сейчас `#2c2519` → `#1a1008`).
- Добавить «заливку» лестницы полупрозрачным цветом (например,
  `rgba(107, 90, 60, 0.15)`), чтобы область лестницы визуально отличалась
  от покрытия под ней.
- Опционально: загрузить текстуру лестницы (дерево/камень) из манифеста
  и тайлить внутри полигона — аналогично тайлингу регионов.

**Файлы:**
- `editor/render/colors.ts` — `STAIRS_OUTLINE_COLOR`, `STAIRS_STEP_COLOR`,
  новый `STAIRS_FILL_COLOR`
- `editor/render/renderMap.ts` → `drawStairs` — добавить заливку

### 27.4 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci`
- [ ] `npm run build`
- [ ] Ручная: первый клик лестницы — любая из 9 точек клетки
- [ ] Ручная: при построении лестницы клетка не подсвечивается (только точки)
- [ ] Ручная: лестница визуально контрастна на любом покрытии

---

## Этап 28. Объекты: per-instance, выделение, растягивание, без коллизий

Пункты пользователя: 2 (частично), 9, 12, 13, 15, 11.

Ключевые решения:
- **Изображение хранится в экземпляре объекта** (`MapObject.imageId`),
  а не в глобальном `elementImageOverrides`. Смена изображения меняет
  только выделенный объект (или настройку для будущих размещений).
- **В режиме «Курсор» выделенный объект** визуально подсвечивается
  (рамка/обводка). В боковой панели «Ландшафт» (ToolParams) показываются
  параметры выделенного объекта: текстура, размер, поворот.
- **Растягивание и поворот** выделенного объекта в режиме «Курсор»:
  ресайз-хендлы по углам, поворот — хоткей R или хендл.
- **Коллизии убрать:** `isFootprintFree` больше не вызывается при
  размещении и перемещении.
- **Добавить объект «Лестница» (ladder)** — вид сверху, деревянная.

### 28.1 Модель: `imageId` в MapObject

**Файл:** `editor/model/types.ts`

Добавить поле:
```ts
export interface MapObject {
  readonly id: number
  readonly kindId: string
  readonly x: number
  readonly y: number
  readonly rotation?: ObjectRotation
  readonly scale?: ObjectScale
  readonly imageId?: string | null  // NEW: выбранное изображение экземпляра
}
```

- `null` = явно выбрано «без текстуры» (цветная заливка).
- `undefined`/отсутствует = «по умолчанию» (defaultImage из реестра).

**Файлы для миграции:**
- `editor/model/io.ts` — `serializeMap`: писать `imageId` (undefined → не писать)
- `editor/model/io.ts` — `deserializeMap`: читать, по умолчанию undefined
- `editor/model/commands.ts` — `addObject`: добавить `imageId?` в аргументы
- `editor/model/commands.ts` — новая команда `setObjectImage: { kind, id, imageId }`
  (или обновить существующую)
- `editor/hooks/useCursorTool.ts` — при удалении не меняется
- `editor/hooks/useObjectTools.ts` — размещение: передавать выбранный imageId

### 28.2 Убрать глобальный `elementImageOverrides`

**Файлы:**
- `editor/components/EditorPage.tsx`:
  - Удалить `elementImageOverrides` state.
  - Удалить `loadElementImage`/`saveElementImage`.
  - `textures` useMemo — убрать `imageOverrides`.
  - `selectElementImage` — удалить или переделать на обновление
    текущего `tool.imageId` (для будущих размещений).
- `editor/components/ObjectPalette.tsx`:
  - Убрать `elementImageOverrides` и `onSelectElementImage` из пропсов.
  - Пикер изображения: менять `tool.imageId` (для следующего размещения)
    ИЛИ менять `imageId` выделенного объекта через команду.
- `editor/render/sprites/loader.ts`:
  - Убрать `imageOverrides` из `TextureRenderContext`.
- `editor/render/renderMap.ts`:
  - `resolveObjectImage`: брать `imageId` из `object.imageId`,
    а не из глобального `elementImageOverrides`.

**Удалить:**
- `editor/render/elementImage.ts` (loadElementImage, saveElementImage)

### 28.3 Выделение объектов в режиме «Курсор» — визуальная рамка

**Проблема:** выделенный объект визуально не отличается.

**Решение:**
- В `renderMap.ts` после `drawObject` для ВСЕХ объектов: если объект
  выделен — нарисовать поверх рамку.
- Или: в `CanvasView` (как `drawStairsSelection` для лестниц) добавить
  вызов `drawObjectSelection(ctx, object, viewport)`.

**Рамка:**
- Прямоугольник по footprint'у (x, y, w, h в пикселях).
- Цвет: `HIGHLIGHT_COLOR` (`#6c47c8`), толщина 2–3px.
- Пунктир или сплошная — на выбор. Лучше сплошная + полупрозрачная заливка
  для ясности.

**Файлы:**
- `editor/render/renderMap.ts` — новый `drawObjectSelection`
- `editor/components/CanvasView.tsx` — вызов для `selectedObjectId`

**Аналогично для дверей и лестниц:**
- Выделенная дверь — рамка/подсветка отрезка a–b.
- Выделенная лестница — уже есть `drawStairsSelection`.

**Важно:** унифицировать `selectedObjectId`. Сейчас это только `number`
(MapObject). Нужно уметь выделять и двери (string id), и лестницы
(string id). Варианты:
- `selectedEntity: { type, id }` или
- Оставить `selectedObjectId` только для MapObject, а для дверей/лестниц —
  отдельные стейты (как `stairsSelectedId` уже есть).

**Решение:** ввести общий тип `SelectedEntity`:
```ts
type SelectedEntity =
  | { type: 'object'; id: number }
  | { type: 'door'; id: string }
  | { type: 'stairs'; id: string }
  | null
```
Заменить `selectedObjectId` и `stairsSelectedId`.

### 28.4 Панель параметров выделенного объекта

**Файл:** `editor/components/ToolParams.tsx`

При активном `selectedEntity` и `tool.type === 'cursor'`:
- Показать тип сущности (Объект / Дверь / Лестница).
- **Для MapObject:** пикер текстуры (imageId), размер (w×h), поворот (0/90/180/270).
- **Для Door:** пикер текстуры.
- **Для Stairs:** (пока ничего, можно показать «Лестница выделена»).

Изменения применяются через новые команды:
- `setObjectImage(id, imageId)`
- `setObjectScale(id, scale)`
- `setObjectRotation(id, rotation)`
- `setDoorImage(id, imageId)`

**Файлы:**
- `editor/model/commands.ts` — новые команды
- `editor/components/ToolParams.tsx` — UI параметров
- `editor/components/EditorPage.tsx` — обработчики + dispatch

### 28.5 Растягивание и поворот в режиме «Курсор»

**Ресайз:**
- У выделенного объекта показать 4 угловых хендла (маленькие квадраты).
- Зажать хендл + тянуть → менять `w`/`h` объекта (с шагом 0.5 или 1).
- Отпустить → коммит `setObjectScale`.

**Поворот:**
- Хоткей R (уже работает) — вращает tool (для будущих размещений).
  Если объект выделен — вращать выделенный объект.

**Файлы:**
- `editor/hooks/useCursorTool.ts` — добавить логику ресайза
- `editor/render/` — отрисовка хендлов

### 28.6 Убрать коллизии объектов

**Файлы:**
- `editor/hooks/useCursorTool.ts` → `finishDrag`: убрать вызов
  `isFootprintFree`. После удаления проверки — всегда коммитить
  `moveObject`.
- `editor/hooks/useObjectTools.ts` → размещение: убрать вызов
  `isFootprintFree`.
- `editor/model/objects.ts` → `isFootprintFree` — оставить функцию
  (может пригодиться), но не вызывать.

### 28.7 Добавить объект «Лестница» (ladder)

**Файл:** `editor/model/objects.ts`

```ts
ladder: {
  labelKey: 'editor.objects.ladder',
  color: '#8a6e4b',
  category: 'dungeon',
  defaultScale: { w: 1, h: 1 },
  defaultImage: 'ladder-wooden',
  imagePool: ['ladder-wooden'],
  scales: [{ w: 1, h: 1 }],
},
```

**i18n:** `ru.json` → `"ladder": "Лестница"`, `en.json` → `"ladder": "Ladder"`

**Текстура:** добавить в `public/sprites/objects/ladder_wooden.png` и
в манифест (`objectTextures.ladder`).

### 28.8 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci`
- [ ] `npm run build`
- [ ] Ручная: выделенный объект имеет визуальную рамку
- [ ] Ручная: смена текстуры меняет только выделенный объект
- [ ] Ручная: объекты не конфликтуют (можно ставить вплотную)
- [ ] Ручная: объект «Лестница» есть в разделе «Подземелье»
- [ ] Ручная: панель параметров показывает свойства выделенного объекта

---

## Этап 29. Линии сетки поверх текстур + переименование пола

Пункты пользователя: 3, 3.1, 3.2.

Ключевые решения:
- **Точечная сетка остаётся** (как fallback/дополнение), но добавляются
  **ЛИНИИ сетки** — горизонтальные и вертикальные, с белой окантовкой
  для контраста на любом фоне.
- **Белая окантовка 1px + чёрная/тёмная линия 1px** — белая линия
  не должна пересекать чёрную (белая рисуется ПОД чёрной, чёрная
  перекрывает стыки).
- **Линии сетки — поверх текстур ландшафта, под объектами.**
  Порядок слоёв: регионы → лестницы → **линии сетки** → точки сетки →
  объекты → стены → двери.
- **Переименовать «Пол» → «Деревянный пол»** в i18n.
- **Перегенерировать текстуру пола:** деревянный пол, бесшовный тайлинг,
  256×256 или 512×512 px. Старый `floor_stone.png` удалить.

### 29.1 Отрисовка линий сетки

**Файл:** `editor/render/renderMap.ts` — новая функция `drawGridLines`

```ts
function drawGridLines(ctx, model, viewport) {
  const { cellSize, offsetX, offsetY, width, height } = viewport
  const { width: cols, height: rows } = model.grid

  const startCol = Math.max(0, Math.floor(offsetX / cellSize))
  const endCol = Math.min(cols, Math.ceil((offsetX + width) / cellSize))
  const startRow = Math.max(0, Math.floor(offsetY / cellSize))
  const endRow = Math.min(rows, Math.ceil((offsetY + height) / cellSize))

  // Белая подложка (2px), чтобы линия была видна на любом фоне
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.lineWidth = 2

  // Вертикальные
  for (let col = startCol; col <= endCol; col++) {
    const x = col * cellSize - offsetX
    ctx.beginPath()
    ctx.moveTo(x, startRow * cellSize - offsetY)
    ctx.lineTo(x, endRow * cellSize - offsetY)
    ctx.stroke()
  }
  // Горизонтальные
  for (let row = startRow; row <= endRow; row++) {
    const y = row * cellSize - offsetY
    ctx.beginPath()
    ctx.moveTo(startCol * cellSize - offsetX, y)
    ctx.lineTo(endCol * cellSize - offsetX, y)
    ctx.stroke()
  }

  // Тёмная линия (1px) поверх белой — стыки белых линий перекрыты
  ctx.strokeStyle = 'rgba(30, 30, 40, 0.5)'
  ctx.lineWidth = 1

  for (let col = startCol; col <= endCol; col++) {
    const x = col * cellSize - offsetX
    ctx.beginPath()
    ctx.moveTo(x, startRow * cellSize - offsetY)
    ctx.lineTo(x, endRow * cellSize - offsetY)
    ctx.stroke()
  }
  for (let row = startRow; row <= endRow; row++) {
    const y = row * cellSize - offsetY
    ctx.beginPath()
    ctx.moveTo(startCol * cellSize - offsetX, y)
    ctx.lineTo(endCol * cellSize - offsetX, y)
    ctx.stroke()
  }
}
```

**Важно:** белая линия рисуется первой (2px), тёмная — второй (1px).
Тёмная перекрывает центр белой, стыки белых линий закрыты тёмной.

### 29.2 Порядок слоёв

**Файл:** `editor/render/renderMap.ts` → `renderMap`

Текущий:
```
регионы → лестницы → точки сетки → объекты → стены → двери → свет
```

Новый:
```
регионы → лестницы → ЛИНИИ СЕТКИ → точки сетки → объекты → стены → двери → свет
```

Вызов `drawGridLines(ctx, model, viewport)` добавить между `drawStairs`
и `drawGridPoints`.

### 29.3 Переименование «Пол» → «Деревянный пол» + новая текстура

**i18n:**
- `ru.json`: `"floor": "Деревянный пол"`
- `en.json`: `"floor": "Wooden Floor"`

**Текстура:**
- Удалить `public/sprites/tiles/floor_stone.png`
- Сгенерировать `public/sprites/tiles/floor_wood.png` — деревянный пол,
  бесшовный тайлинг, 256×256 px (или 512×512).
- Запустить агента с `gemini-3.1-flash-image` и инструкцией:
  «Бесшовная текстура деревянного пола (тёмное дерево, доски), вид сверху,
  dark fantasy стиль, 512×512 px, сохранить в public/sprites/tiles/floor_wood.png»

**Манифест:**
- `public/sprites/manifest.json`:
  ```json
  "tileTextures": {
    "floor": { "path": "sprites/tiles/floor_wood.png", "size": 512 },
    ...
  }
  ```

### 29.4 SVG-паритет

**Файл:** `editor/print/svg.ts` — `buildSvg`

Добавить отрисовку линий сетки в SVG (элементы `<line>` с белой и тёмной
обводкой). Формат:
```xml
<line x1="..." y1="..." x2="..." y2="..." stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
<line x1="..." y1="..." x2="..." y2="..." stroke="rgba(30,30,40,0.5)" stroke-width="1"/>
```

### 29.5 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci`
- [ ] `npm run build`
- [ ] Ручная: линии сетки видны на всех покрытиях
- [ ] Ручная: белая окантовка делает сетку контрастной
- [ ] Ручная: линии сетки ПОД объектами, НАД текстурами
- [ ] Ручная: «Пол» переименован в «Деревянный пол»
- [ ] Ручная: текстура пола — дерево

---

## Этап 30. Багфиксы и полировка

Пункты пользователя: 10, 12, 14.

### 30.1 Починить экспорт PNG

**Проблема:** `exportMapToPng` → «Ошибка экспорта PNG».

**Диагностика:**
- `exportMapToPng` вызывает `renderToCanvas` → `mapPixelBounds` → ошибка?
- `mapPixelBounds` в `editor/render/geometry.ts` — принимает
  `cols, rows, cellSize`? Нужно проверить.
- Или `MapFileActions` передаёт `textures` undefined и экспорт падает
  на текстурах?
- Или `canvas.toBlob` reject'ит (например, canvas слишком большой)?

**Проверка:** запустить проект, нажать «Экспорт PNG», посмотреть консоль.

**Вероятная причина:**
- В `exportMapToPng` вызывается `exportMapToPng(model, EXPORT_CELL_SIZE, textures)`.
  Если `textures` — undefined (не загрузились), `renderMap` должен работать
  с цветным fallback. Но если в `renderMap` есть обращение к полям
  `textures.tileTextures` без проверки на undefined — будет исключение.
- Проверить: ВСЕ места в `renderMap.ts`, где `textures` используется,
  должны иметь guard `if (!textures)` или optional chaining.

**Исправление:**
- Пройти по `renderMap.ts` и убедиться, что все обращения к `textures`
  защищены: `textures?.tileTextures`, `textures?.objectTextures`.
- В `drawRegion`: есть `const texture = textures?.tileTextures[region.tileType]`
  и `if (!texture) return` — ок.
- В `drawObject`: `resolveObjectImage(textures, object.kindId)` — внутри
  проверка `if (!textures || !isKnownKind(kindId)) return undefined` — ок.
- Проверить `mapPixelBounds` — что она принимает `cols, rows` правильно.

### 30.2 Отрисовка объектов по умолчанию

**Проблема:** у объектов есть `defaultImage`, но некоторые отображаются
цветными прямоугольниками вместо картинки. Либо картинка не грузится,
либо не тот путь.

**Диагностика:**
- `resolveObjectImage` ищет: override → objectTextures[kindId] → defaultImage
  из element-images. Если `objectTextures` манифеста содержит путь к файлу,
  но файл не загрузился — `objectTextures[kindId]` будет undefined (загрузчик
  пропускает битые файлы).
- Проверить консоль на 404 для файлов из `public/sprites/objects/`.
- Убедиться, что манифест указывает правильные пути относительно public.

**Исправление:**
- Проверить `TEXTURE_MANIFEST_PATH` и `loadTextureManifest` — правильно ли
  резолвятся пути к `public/sprites/manifest.json`.
- В манифесте пути: `"sprites/objects/table_wooden.png"` — относительно
  public, должен быть `/sprites/objects/table_wooden.png` или
  `sprites/objects/table_wooden.png` (Vite резолвит из public).

### 30.3 Почистить PNG-артефакты у «Дерева»

**Проблема:** у `tree_oak.png` видна сетка PNG (полупрозрачные пиксели
по краям или артефакты компрессии).

**Решение:**
- Перегенерировать `tree_oak.png` через `gemini-3.1-flash-image`
  с инструкцией: «Крона дерева, вид сверху, тёмно-зелёная листва,
  прозрачный фон БЕЗ артефактов по краям, 128×128 px, тень под деревом.»
- Или: открыть в редакторе и вручную очистить края.

### 30.4 Проверки

- [ ] `npm run lint`
- [ ] `npm run test:ci`
- [ ] `npm run build`
- [ ] Ручная: PNG экспорт работает без ошибок
- [ ] Ручная: все объекты отображаются с картинками (где есть)
- [ ] Ручная: дерево без артефактов по краям