# missing_image_promts — промты для картинок, которых ещё нет

Единый перечень. Здесь лежат **только** промты тех картинок, которых в приложении пока нет. Нарисовали и положили файл — **удалите его промт из этого документа** (и добавьте путь в `RASTER` в `index.html`, если это `.webp`). Шаблоны и правила стиля — `docs/art-style.md`. Что уже нарисовано — смотрите в `assets/` (раньше был `docs/art-index.md`).

Файлы: предметы `assets/items/<id>.webp`, NPC `assets/npc/<имя>.webp`, расы `assets/races/<id>.webp`, монстры `assets/monsters/<id>-face.webp` и `<id>-full.webp`. Пока картинки нет, приложение показывает SVG-заглушку из `tools/gen_art.py` / кода.

## Монстры

Все монстры нарисованы — промптов нет. Новый монстр без картинки: промпт сюда (полный рост 1024 × 1536, 2:3; лицо вырезается из него).

## Предметы, оружие и броня

Стальное и более сильное снаряжение рисуется на лучшем фоне, чем обычное: «новое, блестящее» предмет (`new shiny steel …`), резная подставка (`decorated wooden display stand`), ниша-арсенал (`softly lit arsenal alcove`), знамёна и доспехи вдоль стен. Образец: `a new shiny steel warhammer with a squared head and a pointed back spike on a hardwood haft, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`.

## Сокровища и артефакты

### Флейта успокоения — `calm-flute`

> `a refined bone-and-silver flute with delicate silver inlay, a pale blue silk ribbon and faint soothing glow around its finger holes, new and polished, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Огонь, указывающий путь — `flame`

> `a small worn bronze oil lamp with a calm flame bending to one side as if pulled by a breeze, soot marks on the metal, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Вечный очаг — `hearth`

> `a small worn cast-iron hearth brazier with a never-dying gentle orange flame and warm embers, soot-blackened edges, little legs scratched and dented, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Игральные кубики — `dice`

> `a pair of worn bone dice with chipped corners and faded pips, one showing a tiny glint of amber inside, resting on a small leather pouch, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Серебряный колокольчик — `bell`

> `a small tarnished silver bell with a leather strap, dents and green patina in the grooves, a tiny crack, hanging from a short wooden stand, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Фляга странника — `flask`

> `a worn leather-wrapped traveler's flask with a brass stopper on a chain, scuffs and stains on the leather, a faint warm glow around the cork, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Монокль Амона — `monocle`

> `an ornate brass monocle with a thick round lens that shows a faint glowing eye-like iris, thin engraved rune ring around the rim and a short chain with a clasp, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Сапоги скороходы — `boots`

> `a pair of sturdy travel boots of supple brown leather with small silver wing motifs along the ankles and a faint pale-blue gust swirling around the soles, scuffed toes and worn laces, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Экстракт попутного ветра — `wind`

> `a small corked glass vial filled with swirling pale-blue and white mist like a tiny captive breeze, a worn leather cord and a hand-written paper tag around the neck, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

## Находки (после определения)

### Целебная трава — `herb-heal`

> `узколистая светло-зелёная трава с блестящими капельками на листьях, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Серебрянка — `herb-mana`

> `пучок серебристых листьев с тонкой голубой жилкой, светится слабым серебристым светом, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Горький корень — `herb-poison`

> `тёмный фиолетовый узловатый корень с тонкими усиками, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Сытный лист — `herb-food`

> `широкие жёлто-зелёные плотные листья, сложенные пучком, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Бодрящий пучок — `herb-rest`

> `пучок розово-красных стеблей с ароматными цветками, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Живой гриб — `mush-heal`

> `красный гриб с белыми крапинками, мягко светится, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Синяя шляпка — `mush-mana`

> `синий гриб с голубоватым свечением по краю шляпки, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Бледная поганка — `mush-poison`

> `бледный болезненный гриб с юбочкой на ножке, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Сытный боровик — `mush-food`

> `крепкий бурый гриб-боровик с толстой ножкой, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Бодрый груздь — `mush-rest`

> `жёлтый плотный гриб с влажной воронковидной шляпкой, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Светляк — `mush-light`

> `зеленоватый гриб, излучающий мягкий мятный свет, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Пороховик — `mush-boom`

> `серый шарообразный гриб с трещинками, из которых сочится дымок, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Вспыхивающий камень — `sstone-boom`

> `рыжий неровный камень, внутри тлеет огонь, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Оцепеняющий камень — `sstone-para`

> `фиолетовый гладкий камень с тусклым узором паутинки, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Морозный камень — `sstone-freeze`

> `голубой камень, покрытый инеем и ледяными иглами, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

## NPC и интерфейсы

### Библиотекарь — `npc-librarian`

> `an elderly dwarf librarian with round spectacles, a long grey beard and ink-stained fingers, holding an open dusty tome, tall bookshelves and a ladder behind him, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

### Регистратор гильдии — `npc-guild`

> `a scarred veteran adventurer in a guild tabard sitting at a desk with a ledger and a quill, a map of the labyrinth and mounted trophies on the wall behind him, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

### Маг башни — `npc-mage`

> `a lean elven mage in dark blue robes with a high collar, glowing pale-blue eyes and a crystal-tipped staff, floating arcane runes and bubbling alchemy glass around him, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

### Священник — `npc-priest`

> `a calm middle-aged priest in white and gold vestments with a small sunburst pendant, hands folded, candles and stained glass glowing behind him, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

### Лавочник — `npc-shopkeeper`

> `a cunning goblin merchant with green skin, a sly knowing grin showing small teeth, narrow amber eyes, a small gold crown-shaped hat and a red scarf, leaning over a wooden counter piled with gold coins, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

### Банкир — `npc-banker`

> `a thin precise human banker in a dark velvet coat with a monocle and ink-stained gloves, a heavy ring of keys at his belt, behind a counter with coin stacks and a vault door, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

### Староста ратуши — `npc-mayor`

> `a stern middle-aged town clerk in a tall hat and a heavy chain of office, holding a scroll with a wax seal, a town ledger and a stone hall banner behind him, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

### Кладовщик — `npc-storage`

> `a broad bald warehouse keeper with a lantern on a hook-hand strap and a leather apron, tallying crates on a wooden board, stacked barrels and ropes behind him, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

### NPC: наставник Академии — `npc-academy`

> `an elderly human scholar-master in a dark green academy robe with a stitched book emblem, spectacles on a chain, ink-stained fingers holding a thick tome, a chalkboard with diagrams behind him, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

## Здания города

### Доска объявлений — `bld-board`

> `a large wooden notice board on two thick posts, covered with pinned parchment notices, wanted posters and a small roof of planks above it, dark fantasy city at dusk, warm window glow, hand-painted fantasy RPG building icon, stylized, painterly, clean readable silhouette, centered on a dark stone square, square 1:1, no text`

### Ратуша — `bld-hall`

> `a stately stone town hall with a clock tower, a banner of the city and a broad stair to a double door, a notice stand with a tax ledger, dark fantasy city at dusk, warm window glow, hand-painted fantasy RPG building icon, stylized, painterly, clean readable silhouette, centered on a dark stone square, square 1:1, no text`

### Банк — `bld-bank`

> `a solid stone bank with thick columns, iron-barred windows, a heavy vault door and a carved gold coin emblem above the entrance, dark fantasy city at dusk, warm window glow, hand-painted fantasy RPG building icon, stylized, painterly, clean readable silhouette, centered on a dark stone square, square 1:1, no text`

### Склад — `bld-storage`

> `a large wooden warehouse with wide double doors, stacked crates and barrels outside, a hoist beam with a rope and a small guard lantern, dark fantasy city at dusk, warm window glow, hand-painted fantasy RPG building icon, stylized, painterly, clean readable silhouette, centered on a dark stone square, square 1:1, no text`

### Арена — `bld-arena`

> `a large round stone arena with arched gates, iron-barred entrances, banners with crossed swords and a sand-colored interior glimpsed over the walls, dark fantasy city at dusk, warm window glow, hand-painted fantasy RPG building icon, stylized, painterly, clean readable silhouette, centered on a dark stone square, square 1:1, no text`

### Здание: Академия — `bld-academy`

> `a stately stone academy building with a small copper dome, a tall arched door, carved columns, open book emblem above the entrance and lit windows, dark fantasy city at dusk, warm window glow, hand-painted fantasy RPG building icon, stylized, painterly, clean readable silhouette, centered on a dark stone square, square 1:1, no text`

## Портреты рас

### human (женский) — `races/human-f`

> `bust portrait of a middle-aged human woman adventurer with a braided dark-brown hair, a scar over one eyebrow, a worn leather collar and a calm determined gaze, fantasy, dark background with a warm rim light, realistic painterly style, looking at viewer, 4:5, no text`

### barbarian (женский) — `races/barbarian-f`

> `bust portrait of a tall powerful barbarian woman with long braided red hair, war paint on her cheeks, fur pauldrons and a stern proud look, fantasy, dark background with a warm rim light, realistic painterly style, looking at viewer, 4:5, no text`

### dwarf (женский) — `races/dwarf-f`

> `bust portrait of a sturdy dwarf woman with thick braided auburn hair decorated with small metal rings, soot on her cheek, a leather smith's collar and a confident half-smile, fantasy, dark background with a warm rim light, realistic painterly style, looking at viewer, 4:5, no text`

### beastkin (женский) — `races/beastkin-f`

> `bust portrait of a lithe beastkin woman with a sleek fox-like face, tall pointed ears, amber eyes, short russet fur and a wary alert expression, fantasy, dark background with a warm rim light, realistic painterly style, looking at viewer, 4:5, no text`

### fairy (женский) — `races/fairy-f`

> `bust portrait of a slender fairy woman with long pointed ears, pale luminous skin, silver-green hair with leaves woven in and sharp curious eyes, fantasy, dark background with a warm rim light, realistic painterly style, looking at viewer, 4:5, no text`

### dragon (женский) — `races/dragon-f`

> `bust portrait of a proud dragonborn woman with fine copper scales, a crest of small horns, golden slit eyes and a regal composed face, fantasy, dark background with a warm rim light, realistic painterly style, looking at viewer, 4:5, no text`

### Портреты новых рас (гном и тёмная фея, мужской и женский)

Шаблон рас: погрудный, 4:5, тёмный фон.

- `races/gnome` — `bust portrait of a short stocky gnome man with a huge round nose, bushy grey-brown beard braided with brass cogs, round goggles pushed up on his forehead, leather workshop apron straps and a mischievous clever look, fantasy, dark background with a warm rim light, realistic painterly style, looking at viewer, 4:5, no text`
- `races/gnome-f` — `bust portrait of a short gnome woman with a round freckled face, curly auburn hair tied with a bright scarf and small brass tools tucked in it, ink-stained fingers, clever smile, leather apron straps, fantasy, dark background with a warm rim light, realistic painterly style, looking at viewer, 4:5, no text`
- `races/darkfairy` — `bust portrait of a slender dark fairy man with slate-grey violet skin, long pointed ears, silver-white hair, glowing pale violet eyes and a thin shadowy cloak with faint dusky wings behind his shoulders, fantasy, dark background with a cold violet rim light, realistic painterly style, looking at viewer, 4:5, no text`
- `races/darkfairy-f` — `bust portrait of a slender dark fairy woman with slate-grey violet skin, long pointed ears, midnight-blue hair with small glowing moth-like motes, luminous pale violet eyes and delicate dusky wings behind her shoulders, fantasy, dark background with a cold violet rim light, realistic painterly style, looking at viewer, 4:5, no text`
- `treasures/tollbell` — `small silver hand bell with a dark ribbon, faint cold glow along the rim, engraved wave pattern, resting on dark velvet, painted fantasy item icon, plain dark background`
- `monsters/silence-keeper` — `full-body tall hooded spirit in a grey silver-trimmed robe, face hidden in shadow, one finger pressed to where the lips would be, heavy silver mace, ghostly mist at the feet, painted dark fantasy character, 1024x1536`
- `items/silver-salt` — `small linen pouch of coarse glittering silver salt spilling a little onto dark wood, painted fantasy item icon, plain dark background`
- `treasures/bell` — `small silver warning handbell with a short ribbon (renamed: Bubenets-predvestnik)`
