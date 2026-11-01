# missing_image_promts — промты для картинок, которых ещё нет

Единый перечень. Здесь лежат **только** промты тех картинок, которых в приложении пока нет. Нарисовали и положили файл — **удалите его промт из этого документа** (и добавьте путь в `RASTER` в `index.html`, если это `.webp`). Шаблоны и правила стиля — `docs/art-style.md`. Что уже нарисовано — смотрите в `assets/` (раньше был `docs/art-index.md`).

Файлы: предметы `assets/items/<id>.webp`, NPC `assets/npc/<имя>.webp`, расы `assets/races/<id>.webp`, монстры `assets/monsters/<id>-face.webp` и `<id>-full.webp`. Пока картинки нет, приложение показывает SVG-заглушку из `tools/gen_art.py` / кода.

## События на шаге (заставки)

Все нарисованы (засада, монстры, ничего, путники, сокровище, вход в лабиринт, возвращение в город). Новая заставка — `assets/events/<имя>.webp`, 1536 × 1024.

## Монстры

Новый монстр без картинки: полный рост 1024 × 1536 (иконку лица вырезаю сам). Нужны два монстра 3 этажа.

### Хранитель Тишины — `monsters/silence-keeper-full`

> `full-body tall hooded spirit in a grey silver-trimmed robe, face hidden in shadow, one finger pressed to where the lips would be, a heavy silver mace in the other hand, ghostly mist at the feet, eerie silent dungeon hall behind, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

### Мимик — `monsters/mimic-full`

> `full-body treasure chest mimic mid-lunge, a worn wooden chest with a wide toothy maw, a long sticky tongue, glowing amber eyes under the lid, tiny gold coins stuck to its teeth, dark dungeon floor, hand-painted dark fantasy creature art, painterly, full figure, portrait 2:3, no text`

## Предметы, оружие и броня

Стальное и более сильное снаряжение рисуется на лучшем фоне, чем обычное: «новое, блестящее» предмет (`new shiny steel …`), резная подставка (`decorated wooden display stand`), ниша-арсенал (`softly lit arsenal alcove`), знамёна и доспехи вдоль стен. Образец: `a new shiny steel warhammer with a squared head and a pointed back spike on a hardwood haft, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`.

### Ремонтный набор — `repair-kit`

> `a small worn leather roll-up repair kit lying open: a tiny hammer, a few steel rivets, a strip of leather patches, a pot of glue and a whetting file, scuffs and oil stains, on a small worn stone pedestal in a stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Продвинутый ремонтный набор — `repair-kit-pro`

> `a sturdy well-kept dwarven toolbox with brass corners lying open: fine chisels, a small anvil block, tempered files, steel plates and neat coils of wire, used but cared for, on a small worn stone pedestal in a stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

## Оружие и броня (обычное и стальное)

Обычное — потёртое, на простом пьедестале; стальное — новое и блестящее, на резной подставке в арсенале (образец выше). Файлы `assets/items/<id>.webp`, стальные — `assets/items/steel-<id>.webp`. Остальное оружие и броня уже нарисованы.

### Пика — `items/pike`

> `a worn knight's pike with a long slender faceted steel head, nicks along the edge, dark wood shaft with a frayed leather grip, standing upright, on a small worn stone pedestal in a stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Стальная пика — `items/steel-pike`

> `a new shiny steel knight's pike with a long slender faceted head and polished steel collar, dark lacquered wood shaft with a fresh leather grip, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

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

### Лук «Падающая звезда» — `items/art-falling-star`

> `an elegant white-wood longbow with a glowing golden star set in the grip and a faint comet trail along the limbs, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Эхо-клинок — `items/art-echo-blade`

> `a straight steel sword with a faint translucent duplicate blade offset behind it and soft blue echo ripples, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Посох разрядов — `items/art-discharge-staff`

> `an ash staff with a cage of copper coils and a crackling blue-white orb at the head, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

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

### Серебряный колокольчик — `items/tollbell`

> `a small silver hand bell with a dark ribbon, faint cold glow along the rim, engraved wave pattern, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Кольцо братского духа — `items/brotherhood-ring`

> `a simple worn gold ring with two clasped hands engraved around the band, soft warm glow, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Колчан режиссёра — `items/director-quiver`

> `an ornate leather quiver embossed with theatre masks, ten white-fletched arrows sticking out, brass fittings, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Серебряная соль — `items/silver-salt`

> `a heavy silver-clasped linen pouch of glittering coarse silver salt spilling out a little, faint cold glow, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Слабая серебряная соль — `items/weak-salt`

> `a small worn linen pouch of fine grey salt flecked with silver dust, tied with string, on a small worn stone pedestal in a stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Флейта успокоения — `calm-flute`

> `a refined bone-and-silver flute with delicate silver inlay, a pale blue silk ribbon and faint soothing glow around its finger holes, new and polished, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Огонь, указывающий путь — `flame`

> `a small worn bronze oil lamp with a calm flame bending to one side as if pulled by a breeze, soot marks on the metal, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Вечный очаг — `hearth`

> `a small worn cast-iron hearth brazier with a never-dying gentle orange flame and warm embers, soot-blackened edges, little legs scratched and dented, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Игральные кубики — `dice`

> `a pair of worn bone dice with chipped corners and faded pips, one showing a tiny glint of amber inside, resting on a small leather pouch, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Бубенец-предвестник — `bell`

> `a small tarnished silver bell with a leather strap, dents and green patina in the grooves, a tiny crack, hanging from a short wooden stand, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Фляга странника — `flask`

> `a worn leather-wrapped traveler's flask with a brass stopper on a chain, scuffs and stains on the leather, a faint warm glow around the cork, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Монокль Амона — `monocle`

> `an ornate brass monocle with a thick round lens that shows a faint glowing eye-like iris, thin engraved rune ring around the rim and a short chain with a clasp, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Сапоги скороходы — `boots`

> `a pair of sturdy travel boots of supple brown leather with small silver wing motifs along the ankles and a faint pale-blue gust swirling around the soles, scuffed toes and worn laces, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Экстракт попутного ветра — `wind`

> `a small corked glass vial filled with swirling pale-blue and white mist like a tiny captive breeze, a worn leather cord and a hand-written paper tag around the neck, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Точильный камень — `whetstone`

> `a long smooth whetstone with a faint silver sheen and a few glowing runes along its edge, worn hollow in the middle by long use, lying on a folded cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Молот Дедала — `daedalus-hammer`

> `a compact smith's hammer with a bronze head engraved with a tiny labyrinth pattern and a dark wooden haft wrapped in worn leather, a few sparks of faint golden light floating around the head, resting against a small anvil block, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет несокрушимости — `unbreakable-charm`

> `an old iron amulet on a thick chain: a scratched round shield-shaped medallion with a tiny diamond set in the middle, dull but unbroken, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет починки — `repair-charm`

> `a small bronze amulet on a cord shaped like a crossed hammer and needle, green patina and a faint warm glow, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет прочности — `durable-charm`

> `a heavy round stone-and-iron amulet on a leather cord, a pale blue crystal in the center and thick plate-like rim, faint cyan glow, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет регенерации — `regen-charm`

> `a small round amulet on a thin chain with a deep red heart-shaped stone wrapped in tiny green leaves, soft pulsing red glow, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет маны — `mana-charm`

> `a small silver amulet on a chain with a deep blue teardrop crystal, tiny sparkles of blue light drifting around it, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет усталости — `fatigue-charm`

> `a worn wooden-and-silver amulet shaped like a crescent moon with a closed eye engraved on it, faint violet glow, on a faded cord, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

### Амулет голода — `hunger-charm`

> `a small rustic amulet on a cord: a carved wooden bead ring around a tiny golden wheat ear, warm amber glow, resting on a small cloth, on a small worn stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, painterly, clean readable silhouette, centered, square 1:1, no text`

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

Все 14 зданий нарисованы.

## Поле боя

### Походный сундучок (Ведьмин лес) — `terrain/stash`

> `a small purple-grey travelling chest with a gold latch on dark forest ground, top-down view, fantasy battle map tile, hand-painted, square 1:1, no text`
