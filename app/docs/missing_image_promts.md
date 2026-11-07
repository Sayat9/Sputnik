# missing_image_promts — промты для картинок, которых ещё нет

Единый перечень. Здесь лежат **только** промты тех картинок, которых в приложении пока нет. Нарисовали и положили файл — **удалите его промт из этого документа** (и добавьте путь в `RASTER` в `index.html`, если это `.webp`). Шаблоны и правила стиля — `docs/art-style.md`. Что уже нарисовано — смотрите в `assets/` (раньше был `docs/art-index.md`).

Файлы: предметы `assets/items/<id>.webp`, NPC `assets/npc/<имя>.webp`, расы `assets/races/<id>.webp`, монстры `assets/monsters/<id>-face.webp` и `<id>-full.webp`. Пока картинки нет, приложение показывает SVG-заглушку из `tools/gen_art.py` / кода.

## События на шаге (заставки)

### Разломы открылись — `events/rift-open` (оповещение, 07.11)

> `wide shot of a dark dungeon floor where several violet glowing rifts tear open in the air like cracks in reality, swirling purple light, debris floating, hand-painted dark fantasy illustration, painterly, landscape 3:2, no characters, no text`

### Вход в разлом — `events/rift-enter` (07.11)

> `first-person view stepping into a swirling crimson and violet portal rift, a distorted different dungeon visible beyond, sparks and floating stones, hand-painted dark fantasy illustration, painterly, landscape 3:2, no characters, no text`

### Переход между этажами — `events/floor-change` (07.11)

> `an ancient spiral stone staircase descending through a glowing golden portal arch into the next level of a huge labyrinth tower, warm light from below, hand-painted dark fantasy illustration, painterly, landscape 3:2, no characters, no text`

### Раскопки — `events/dig` (экран действия «Копать», 03.11)

> `wide shot inside a dark dungeon corridor, a worn iron shovel stuck in a freshly dug pit of earth and stones, a few old coins and a cracked gem glinting in the dirt, torchlight from the side, hand-painted dark fantasy illustration, painterly, landscape 3:2, no characters, no text`

Все нарисованы (засада, монстры, ничего, путники, сокровище, вход в лабиринт, возвращение в город). Новая заставка — `assets/events/<имя>.webp`, 1536 × 1024.

## Монстры

Новый монстр без картинки: полный рост 1024 × 1536 (иконку лица вырезаю сам). Нужны монстры 3 этажа: Хранитель Тишины, мимик и 9 обитателей Лагеря орков.

### Разлом «Кровавая крепость» (07.11)

### Ледяной бесёнок — `monsters/ice-imp-full`

> `full-body a small mischievous imp made of blue ice and frost with icicle claws and glowing pale eyes, frozen cave with icicles and ancient bronze imperial braziers, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Инеевый жук — `monsters/frost-beetle-full`

> `full-body a dog-sized beetle with a carapace crusted in white hoarfrost, breathing a cloud of icy mist, frozen cave with icicles, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Снежный охотник — `monsters/snow-hunter-full`

> `full-body a wild tribal hunter wrapped in white furs with a bone harpoon on a rope, face painted with blue frost marks, frozen cave with snowdrifts, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Ледяной дух — `monsters/ice-spirit-full`

> `full-body a floating whirling spirit of ice dust and snowflakes with a faint ghostly face and long icy fingers, frozen cave glowing pale blue, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Детёныш мамонта — `monsters/mammoth-calf-full`

> `full-body a young woolly mammoth calf with shaggy brown fur covered in frost and short tusks sheathed in jagged ice, charging, frozen cave, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Арктический Сребророг — `monsters/ice-deer-full`

> `full-body a majestic white stag with huge antlers of clear crystal ice, frost breath, glowing pale eyes, frozen cave with icicles, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Грольф Инеевая Челюсть, дикий полутролль — `monsters/half-troll-full`

> `full-body a huge savage half-troll with grey-blue warty skin, frost on his shoulders, a jaw rimed with ice and a massive club wrapped in ice, standing beside a giant blazing bronze brazier in a frozen cave, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Стервятник-падальщик — `monsters/sand-vulture-full`

> `full-body a scrawny bald desert vulture with ragged dusty feathers and a hooked beak, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Малый скорпион — `monsters/sand-scorpion-full`

> `full-body a dog-sized sand-coloured scorpion with thick chitin plates and a dripping stinger, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Личинка песчаного червя — `monsters/worm-larva-full`

> `full-body a pale segmented sand worm larva with a round toothy maw bursting out of the sand, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Взрослый песчаный червь — `monsters/sand-worm-full`

> `full-body a huge segmented sandworm with armored ochre plates rearing out of a dune, ring of teeth, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Большое жало — `monsters/big-stinger-full`

> `full-body a giant black-and-amber scorpion with a long barbed tail dripping green venom, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Псевдокактус — `monsters/pseudo-cactus-full`

> `full-body a monstrous cactus creature with thorny arms and a hidden mouth among the spines, half disguised as a normal cactus, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Миражный скорпион — `monsters/mirage-scorpion-full`

> `full-body a large translucent scorpion shimmering like a heat mirage, with ghostly duplicate silhouettes around it, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Стервятник мёртвых земель — `monsters/dead-vulture-full`

> `full-body a gigantic storm vulture with dark tattered wings, bone-white skull head and hooked iron-like talons, sandstorm behind, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Кель адской пустыни — `monsters/kel-worm-full`

> `full-body a colossal infernal desert worm with glowing magma cracks between armored segments, a vast maw erupting from cracking sand, sandstorm and beacons sinking in the dunes, desert of quicksand and sinking ancient beacons, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Раб крови — `monsters/blood-slave-full`

> `full-body an emaciated pale undead slave in chains with drained grey skin and hollow red eyes, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Летучая мышь-кровосос — `monsters/blood-bat-full`

> `full-body a large red-eyed vampire bat with torn leathery wings, fangs dripping blood, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Кровавый гуль — `monsters/blood-ghoul-full`

> `full-body a hunched ghoul with long paralysing claws, blood-smeared mouth, crouching to pounce, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Слуга вампиров — `monsters/vampire-servant-full`

> `full-body a gaunt vampire servant in a ragged butler coat, sharp fangs and claws, hungry eyes, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Жрец крови — `monsters/blood-priest-full`

> `full-body a robed cultist priest with a ritual knife and bloody runes on his hands, red sigils glowing, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Кровавая лужа — `monsters/blood-puddle-full`

> `full-body a living pool of thick blood rising into a slimy shape with pseudopods, bones floating inside, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Голем плоти — `monsters/flesh-golem-full`

> `full-body a huge stitched flesh golem made of sewn body parts, iron bolts, massive fists, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Поганище — `monsters/abomination-full`

> `full-body a bloated rotting abomination of fused corpses with a meat hook and chains, sickly green fumes, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Мордрейн, низший рыцарь смерти — `monsters/death-knight-full`

> `full-body a fallen death knight in blackened runed plate armor with a glowing red runesword, tattered cape, cold blue eyes, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Ведьмин лес (3 этаж, 04.11)

### Плакальщица — `monsters/mourner-full`

> `full-body a translucent ghostly woman in a tattered funeral veil, mouth open in a mournful wail, pale blue glow, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Подкидыш — `monsters/changeling-full`

> `full-body a small grotesque stitched creature, a failed witch experiment, mismatched limbs, bubbling acidic blisters on its skin, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Потерявшийся след — `monsters/lost-trail-full`

> `full-body a faceless misty spirit shaped like a lean hound made of fog and footprints, leaving glowing false tracks behind, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Заблудший путник — `monsters/lost-wanderer-full`

> `full-body a ghostly traveler in a ragged cloak with a spectral sword, translucent, hollow glowing eyes, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Соломенное пугало — `monsters/scarecrow-full`

> `full-body a tall animated scarecrow of straw and sackcloth with a rusty sickle, stitched grin, crows around, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Ведьмина сова — `monsters/witch-owl-full`

> `full-body a large black owl with too many glowing purple eyes, ragged feathers, perched on a twisted branch, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Неудачный образец — `monsters/failed-specimen-full`

> `full-body a big bloated mutated beast, failed witch experiment, mismatched armored plates and claws, dripping acid, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Тень служанки — `monsters/maid-shade-full`

> `full-body a ghostly servant girl in a torn maid dress, half-transparent, cold mist trailing from her hands, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Ведьмин кот — `monsters/witch-cat-full`

> `full-body a sleek black cat with glowing green eyes and a crooked tail, half melting into shadow, mischievous grin, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Фонарщик тумана — `monsters/fog-lantern-full`

> `full-body a towering hooded spirit warden carrying many glowing lanterns on a long chain flail, fog swirling around, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Зона ловушек (3 этаж, 03.11)

### Капкан-краб — `monsters/trap-crab-full`

> `full-body a squat crab with a rusty iron shell shaped like an open bear trap, serrated claws, half buried in gravel, a ruined maze of rusty traps, spikes and tripwires among grey rocks, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Проволочный паук — `monsters/wire-spider-full`

> `full-body a thin long-legged spider made of tarnished wire and bone, stretching glinting steel threads between stones, a ruined maze of rusty traps, spikes and tripwires among grey rocks, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Самострел-голем — `monsters/bolt-golem-full`

> `full-body a squat iron construct turret on short stubby legs with a huge loaded crossbow mounted on its chest, quivers of bolts on its back, a ruined maze of rusty traps, spikes and tripwires among grey rocks, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Мастер ловушек — `monsters/trap-master-full`

> `full-body a lean hooded trapper with goggles, belts full of springs, gears and caltrops, a small crossbow in hand, crouching near a hidden trap, a ruined maze of rusty traps, spikes and tripwires among grey rocks, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Валун-жук — `monsters/boulder-beetle-full`

> `full-body a huge beetle with a round stone carapace like a boulder, curled half into a rolling ball, a heavy horn in front, a ruined maze of rusty traps, spikes and tripwires among grey rocks, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Королева ловушек — `monsters/trap-queen-full`

> `full-body a tall mechanical doll queen resembling a woman, porcelain face, brass body, mechanical spider legs and blade arms instead of limbs, gears visible, surrounded by traps, a ruined maze of rusty traps, spikes and tripwires among grey rocks, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

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

### Охотничьи угодья и гоблины под Угрозу (03.11)

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

## Сокровища и артефакты

### Рукавицы северянина — `items/frost-gloves`

> `a pair of worn thick fur-lined leather mittens with frost-blue stitching and a faint icy glow, on a stone pedestal in a labyrinth niche, hand-painted dark fantasy item art, painterly, square 1:1, no text`

### Плащ толстой шкуры — `items/hide-cloak`

> `a heavy worn cloak of thick shaggy beast hide with a bone clasp, frost on the fur, draped over a stone pedestal in a labyrinth niche, hand-painted dark fantasy item art, painterly, square 1:1, no text`

### Амулет инея — `items/frost-amulet`

> `a worn silver amulet with a pale blue ice crystal that breathes frost mist, on a leather cord, on a stone pedestal in a labyrinth niche, hand-painted dark fantasy item art, painterly, square 1:1, no text`

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
