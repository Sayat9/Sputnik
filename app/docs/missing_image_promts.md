# missing_image_promts — промты для картинок, которых ещё нет

Единый перечень. Здесь лежат **только** промты тех картинок, которых в приложении пока нет. Нарисовали и положили файл — **удалите его промт из этого документа** (и добавьте путь в `RASTER` в `index.html`, если это `.webp`). Шаблоны и правила стиля — `docs/art-style.md`. Что уже нарисовано — смотрите в `assets/` (раньше был `docs/art-index.md`).

Файлы: предметы `assets/items/<id>.webp`, NPC `assets/npc/<имя>.webp`, расы `assets/races/<id>.webp`, монстры `assets/monsters/<id>-face.webp` и `<id>-full.webp`. Пока картинки нет, приложение показывает SVG-заглушку из `tools/gen_art.py` / кода.

## События на шаге (заставки)

### Раскопки — `events/dig` (экран действия «Копать», 03.11)

> `wide shot inside a dark dungeon corridor, a worn iron shovel stuck in a freshly dug pit of earth and stones, a few old coins and a cracked gem glinting in the dirt, torchlight from the side, hand-painted dark fantasy illustration, painterly, landscape 3:2, no characters, no text`

Все нарисованы (засада, монстры, ничего, путники, сокровище, вход в лабиринт, возвращение в город). Новая заставка — `assets/events/<имя>.webp`, 1536 × 1024.

## Монстры

Новый монстр без картинки: полный рост 1024 × 1536 (иконку лица вырезаю сам). Нужны монстры 3 этажа: Хранитель Тишины, мимик и 9 обитателей Лагеря орков.

### Пылающие земли (3 этаж, 03.11)

### Угольный жук — `monsters/coal-beetle-full`

> `full-body a dog-sized beetle with a cracked coal-black carapace glowing orange in the seams, mandibles dripping embers, scorched ash plain with lava cracks and drifting embers, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Огненная саламандра — `monsters/ember-salamander-full`

> `full-body a large lithe fire salamander lizard with glowing orange stripes along black scales, flames licking from its back, a burning trail behind its tail, scorched ash plain with lava cracks and drifting embers, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Пепельный палач — `monsters/ash-executioner-full`

> `full-body a tall executioner in a soot-blackened iron mask and burnt cuirass, holding a huge chipped two-handed sword with glowing ember edge, ash falling around him, scorched ash plain with lava cracks and drifting embers, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Жаровня-голем — `monsters/brazier-golem-full`

> `full-body a squat cast-iron golem whose chest is an open brazier full of burning coals, red-hot fists, scorched ash plain with lava cracks and drifting embers, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Жнец углей — `monsters/ember-reaper-full`

> `full-body a gaunt undead reaper in a burnt hooded robe, wielding a scythe with a glowing ember blade, ash falling from it, scorched ash plain with lava cracks and drifting embers, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Магмовый змей — `monsters/magma-wyrm-full`

> `full-body a huge serpent with a crust of cooling black magma scales split by glowing lava, jaws open, spitting molten rock, scorched ash plain with lava cracks and drifting embers, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Кузнец горнила — `monsters/forge-smith-full`

> `full-body a giant hulking blacksmith in a scorched leather apron and soot-black plate, a huge hammer and glowing tongs, a great forge and anvil behind him, scorched ash plain with lava cracks and drifting embers, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Охотничьи угодья и гоблины под Угрозу (03.11)

### Костяной егерь — `monsters/bone-ranger-full`

> `full-body a skeletal hunter in rotting leather with a bone longbow, arrow nocked, misty hunting grounds, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Шипастая гончая — `monsters/thorn-hound-full`

> `full-body a lean hound covered in thorny bone spikes along its back, snarling, dry grass of hunting grounds, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Сизый гриф — `monsters/grey-vulture-full`

> `full-body a large grey vulture with ragged wings perched on a dead tree, eyeing prey below, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Вожак гончих — `monsters/pack-leader-full`

> `full-body a big scarred hound leader with a torn ear, howling, other hounds in the mist behind, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Каменный лось — `monsters/stone-elk-full`

> `full-body a massive elk with hide like grey stone and granite antlers, standing firm in a misty glade, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Железная лиса — `monsters/iron-fox-full`

> `full-body a sly fox with fur like iron filings glinting, crouched to pounce, metallic dust in the air, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Рогатый страж лощин — `monsters/glen-warden-full`

> `full-body a huge horned forest guardian beast with antlers like gnarled branches, bark and stone hide, ancient glen, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Следопыт-охотник — `monsters/tracker-hunter-full`

> `full-body a weathered human tracker in hooded leathers with a longbow, kneeling by tracks, hunting grounds, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Зоркий ворон — `monsters/keen-raven-full`

> `full-body a huge black raven with piercing eyes on a high branch, sharp feather blades on its wings, overcast sky, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Тихий хищник — `monsters/silent-predator-full`

> `full-body a large sleek panther-like predator with dark mottled fur blending into shadows, glowing eyes, silent stalk in tall grass, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Противный гоблин — `monsters/nasty-goblin-full`

> `full-body a scrawny mocking goblin pulling a face and sticking out its tongue, crooked knife, goblin forest, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Гоблин-провокатор — `monsters/goblin-provoker-full`

> `full-body a cocky goblin in leather armour shouting with mouth wide open, short sword raised, goblin forest camp, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Монстры Звона и Храма изваяний (3 этаж, 03.11)

### Звонкий жучок — `monsters/toll-beetle-full`

> `full-body a small bronze-shelled beetle with bell-shaped ridged carapace, faint ripples of sound around it, cracked bell tower floor, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Эхо-шакал — `monsters/echo-jackal-full`

> `full-body a lean grey jackal with oversized ears, translucent afterimages trailing behind it like echoes, ruined bell hall, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Колокольная крыса — `monsters/toll-rat-full`

> `full-body a scrawny rat with a tiny cracked bell tied to its tail, long whiskers, crouching on a broken bell rope, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Гулкий страж — `monsters/toll-guard-full`

> `full-body an undead guard in rusted chainmail with a dented round shield that vibrates, heavy mace, hollow glowing eyes, bell tower stairs, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Визгун-голос — `monsters/shrieker-full`

> `full-body a gaunt pale creature with an enormous open mouth and stretched throat, screaming, sound waves distorting the air, dark belfry, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Бронзовый бык — `monsters/toll-bull-full`

> `full-body a massive bull with bronze metal hide like a cast bell, steaming nostrils, lowered horns, charging pose, stone courtyard, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Звонарь — `monsters/bell-ringer-full`

> `full-body an undead bell ringer in tattered robes holding a bell hammer, two ghostly translucent copies of himself beside him, huge bronze bell above, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Охотник за звоном — `monsters/toll-hunter-full`

> `full-body a silent hunter in muffled dark leathers with wrapped boots, glaive in hand, finger to lips, mist around the feet, dim bell hall, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Хор мёртвых — `monsters/choir-dead-full`

> `full-body four gaunt undead choristers in ragged choir robes standing shoulder to shoulder, mouths open in a mournful chant, pale light, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Каменный служка — `monsters/stone-acolyte-full`

> `full-body a small living statue of a hooded acolyte made of cracked grey stone, crumbling pebbles falling, temple of statues, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Пыльный херувим — `monsters/dust-cherub-full`

> `full-body a small flying stone cherub with chipped wings, trailing dust clouds, empty eyes, ruined marble temple, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Кариатида — `monsters/caryatid-full`

> `full-body a marble caryatid statue come alive, a woman holding a broken stone lintel on her head, cracks glowing faintly, temple columns, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Мраморный алебардист — `monsters/marble-halberdier-full`

> `full-body a living marble soldier statue with a long stone halberd lowered in a guard stance, temple steps, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Мраморный страж — `monsters/marble-guardian-full`

> `full-body a towering marble knight statue with a great stone sword and shield, standing protectively, cracked white marble, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Мраморная святая — `monsters/marble-saint-full`

> `full-body a serene marble saint statue with a halo of soft light, hands raised in blessing, holding a stone staff, temple altar, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Безликий скульптор — `monsters/faceless-sculptor-full`

> `full-body a huge faceless marble figure with a smooth blank face, holding a giant chisel and mallet, half-carved statues around it, dust in the air, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

## Предметы, оружие и броня

Стальное и более сильное снаряжение рисуется на лучшем фоне, чем обычное: «новое, блестящее» предмет (`new shiny steel …`), резная подставка (`decorated wooden display stand`), ниша-арсенал (`softly lit arsenal alcove`), знамёна и доспехи вдоль стен. Образец: `a new shiny steel warhammer with a squared head and a pointed back spike on a hardwood haft, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`.

## Оружие и броня (обычное и стальное)

Обычное — потёртое, на простом пьедестале; стальное — новое и блестящее, на резной подставке в арсенале (образец выше). Файлы `assets/items/<id>.webp`, стальные — `assets/items/steel-<id>.webp`. Остальное оружие и броня уже нарисованы.

### Стальные перчатки — `items/steel-gloves`

> `a pair of new shiny steel-plated fighting gauntlets with articulated knuckle plates and studded leather cuffs, lying crossed, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Стальной посох — `items/steel-staff`

> `a new shiny quarterstaff of dark hardwood with polished steel caps and steel bands along the shaft, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Стальной топор — `items/steel-axe`

> `a new shiny one-handed steel battle axe with a bearded blade and a hardwood haft wrapped in fresh leather, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Стальная секира — `items/steel-greataxe`

> `a new shiny two-handed steel greataxe with a broad double-bitted head on a long hardwood haft with steel langets, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

## Артефактное оружие и броня

Файлы `assets/items/art-<id>.webp` (приложение берёт их само, как только путь `items/art-<id>` добавлен в `RASTER`; пока картинки нет — показывается картинка обычного оружия). Фон — резной пьедестал с фиолетовым камнем в сокровищнице.

### Копьё-громоотвод — `items/art-thunder-spear`

> `an ornate steel spear with crackling blue lightning coiled around the blade and copper rings on the haft, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Магнитные перчатки — `items/art-magnet-gloves`

> `a pair of heavy steel gauntlets with horseshoe magnets on the knuckles and faint blue magnetic field lines between them, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Парные тени — `items/art-shadow-daggers`

> `a pair of black elegant daggers whose blades dissolve into smoky shadow at the edges, violet glow in the engravings, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Зеркальный щит — `items/art-mirror-shield`

> `a round polished mirror-faced shield with a dark iron rim and a bright streak of reflected light, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Меч полумесяца — `items/art-moon-sword`

> `a huge two-handed sword with a crescent-moon shaped crossguard and a pale silver blade with faint moon-phase engravings, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Топор бури — `items/art-storm-axe`

> `a compact throwing axe with wind swirls etched in the blade and a crackling pale-blue edge, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Булава «Метеор» — `items/art-meteor-mace`

> `a heavy mace whose head is a glowing cracked meteorite with orange fissures and trailing sparks, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Пика Заставы — `items/art-rampart-pike`

> `a long steel pike with a banner-like notch below the head and glowing runic rings on the shaft, sturdy knightly look, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Лук «Рикошет» — `items/art-ricochet-bow`

> `a short recurve bow with bright metal rings on the limbs and an arrow caught bouncing off a spark, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Теневой клык — `items/art-shadow-fang`

> `a curved black dagger shaped like a fang, its edge fading into shadow wisps, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Секира «Жатва» — `items/art-reaper-axe`

> `a broad crescent-bladed greataxe with a long dark haft and faint red harvest marks etched on the blade, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Рапира «Шквал» — `items/art-flurry-rapier`

> `a slender rapier with a swept silver hilt and a blade blurred into several afterimages as if moving very fast, thin wind streaks, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Молот «Разлом» — `items/art-rift-hammer`

> `a massive warhammer with a cracked stone head split by a glowing orange fissure, small rock shards floating around it, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Крепостной щит «Бастион» — `items/art-bastion-shield`

> `a huge rectangular tower shield shaped like a castle wall with crenellations on top, iron-banded, a carved gate emblem in the centre, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Доспех-мираж — `items/art-mirage-armor`

> `a light leather armor on a stand whose outline shimmers and splits into faint heat-haze copies, pale golden desert glow, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Магнитная кольчуга — `items/art-magnet-mail`

> `a heavy chainmail shirt on a stand with dark iron horseshoe-magnet plates on the shoulders and faint blue field lines pulling at small metal shards, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

## Сокровища и артефакты

### Амулет маны — `mana-charm`

> `a small silver amulet on a chain with a deep blue teardrop crystal, tiny sparkles of blue light drifting around it, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет усталости — `fatigue-charm`

> `a worn wooden-and-silver amulet shaped like a crescent moon with a closed eye engraved on it, faint violet glow, on a faded cord, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет голода — `hunger-charm`

> `a small rustic amulet on a cord: a carved wooden bead ring around a tiny golden wheat ear, warm amber glow, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

## Находки (после определения)

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

### Кладовщик — `npc-storage`

> `a broad bald warehouse keeper with a lantern on a hook-hand strap and a leather apron, tallying crates on a wooden board, stacked barrels and ropes behind him, warm lantern light, hand-painted fantasy RPG character art, stylized, painterly, dark fantasy tone, bust portrait, wide 16:9 composition with empty space at the bottom for text, no text`

## Здания города

Все 14 зданий нарисованы.
