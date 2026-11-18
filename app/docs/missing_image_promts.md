# missing_image_promts — промты для картинок, которых ещё нет

Единый перечень. Здесь лежат **только** промты тех картинок, которых в приложении пока нет. Нарисовали и положили файл — **удалите его промт из этого документа** (и добавьте путь в `RASTER` в `index.html`, если это `.webp`). Шаблоны и правила стиля — `docs/art-style.md`. Что уже нарисовано — смотрите в `assets/` (раньше был `docs/art-index.md`).

Файлы: предметы `assets/items/<id>.webp`, NPC `assets/npc/<имя>.webp`, расы `assets/races/<id>.webp`, монстры `assets/monsters/<id>-face.webp` и `<id>-full.webp`. Пока картинки нет, приложение показывает SVG-заглушку из `tools/gen_art.py` / кода.

## События на шаге (заставки)

### Башня — 4 этаж: заставки дверей (16.11)

Общий стиль: `…, hand-painted dark fantasy scene art, landscape 3:2, no text`.

### Бой — `events/tower-fight`

> `an arched stone doorway in an ancient tower, beyond it shadowy armed figures waiting in torchlight, dark fantasy, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Групповой бой — `events/tower-group`

> `an arched stone doorway in an ancient tower, beyond it a crowd of many glowing eyes in the darkness, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Тяжёлый бой — `events/tower-hard`

> `a heavy iron-bound tower door with claw marks and blood, menacing red light behind it, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Мини-босс — `events/tower-mini`

> `an ornate tower door with a cracked emblem, a large silhouette and its guards visible through the gap, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Босс — `events/tower-boss`

> `a colossal gilded tower gate with a crown emblem, an enormous shadow looming behind, golden light, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Зона отдыха — `events/tower-rest`

> `a quiet tower chamber with a small hearth, bedrolls and a warm glow, safe and calm, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Зона лечения — `events/tower-heal`

> `a tower chamber with a glowing turquoise healing spring and moss, soft light, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Испытание — `events/tower-trial`

> `a tower chamber with a strange mechanism, runes and a riddle carved on a stone door, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Сокровищница — `events/tower-treasure`

> `a tower vault full of gold coins, gems and an ornate chest, glittering light, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Библиотека — `events/tower-library`

> `a dusty tower library with tall shelves, floating candles and open ancient tomes, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Разлом — `events/tower-rift`

> `a tower doorway torn into a swirling violet rift portal, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Выход на 5 этаж — `events/tower-exit`

> `a tower stairway leading up to a dormant blue portal at the top, sealed, hand-painted dark fantasy scene art, landscape 3:2, no text`

### Башня — 4 этаж, монстры (17.11)

### Ползучая лоза — `monsters/creeping-vine-full`

> `full-body a creeping thorny vine monster hiding among grass on a stone tower floor, many whip-like tendrils rising, small leaves, faintly glowing sap, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Свечной огарок — `monsters/candle-stub-full`

> `full-body a small living candle stub creature, melted wax body with tiny arms, a bright flame wick on its head, wax drips, dark stone tower corridor, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Пыльная моль — `monsters/dust-moth-full`

> `full-body a large grey dust moth with frayed wings shedding pale dust, fluttering toward a torch flame in a dark tower room, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Каменный клоп — `monsters/wall-bug-full`

> `full-body a flat stone-shelled bug crawling out of a crack in old masonry, grey plates that look like bricks, short mandibles, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Гарпия — `monsters/harpy-full`

> `full-body a gaunt harpy with ragged dark feathers, human-like screaming face, long talons, perched on a broken tower ledge, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Гаргулья — `monsters/gargoyle-full`

> `full-body a crouching stone gargoyle with folded bat wings and cracked grey skin, pretending to be a statue on a tower pedestal, eyes faintly glowing, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Кентавр-разбойник — `monsters/centaur-raider-full`

> `full-body a lean centaur raider with a short bow, leather armor and a hood, scarred chestnut horse body, quiver of arrows, galloping pose, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Гигантская мухоловка — `monsters/flytrap-full`

> `full-body a giant venus flytrap monster rooted into cracked tower floor stones, huge toothed jaws dripping digestive sap, sweet glowing nectar, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Живой фолиант — `monsters/living-tome-full`

> `full-body a flying living book with fluttering pages like wings, sharp paper edges, glowing runes and an ink eye on the cover, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Пустой доспех — `monsters/empty-armor-full`

> `full-body an empty suit of old plate armor walking on its own, dark hollow visor with nothing inside, rusty longsword, faint mist inside the joints, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Песочный часовой — `monsters/sand-sentinel-full`

> `full-body a brass clockwork sentinel with an hourglass for a chest, sand flowing inside, a long clock-hand spear, gears visible, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Древняя гарпия — `monsters/elder-harpy-full`

> `full-body an ancient matriarch harpy, large and grey-feathered, old wrinkled cruel face, crown of bones, massive hooked talons, wings spread, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Гаргулья-страж — `monsters/gargoyle-guard-full`

> `full-body a bulky stone gargoyle guardian with heavy fists and broad wings, standing protectively in front of a tower door, moss in the cracks, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Кентавр-рыцарь — `monsters/centaur-knight-full`

> `full-body a centaur knight in full plate armor with a long lance and a tower shield, armored horse body with barding, noble stern face, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Механический конь — `monsters/mech-horse-full`

> `full-body a mechanical steam horse made of steel plates and pistons, glowing furnace in the chest, steam from the nostrils, riveted legs, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Цветок-сирена — `monsters/siren-flower-full`

> `full-body a huge beautiful flower with a woman-like pistil face singing, glittering pollen clouds, thorny stems rooted in stone, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Стеклянный голем — `monsters/glass-golem-full`

> `full-body a humanoid golem of cracked glass refracting light into rainbow shards, sharp edges, hollow transparent body, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Древняя гаргулья — `monsters/elder-gargoyle-full`

> `full-body an ancient huge gargoyle of weathered black stone, horned, huge wings, tail with stone spikes, petrifying glowing eyes, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Паровой бык — `monsters/steam-bull-full`

> `full-body a massive steam-powered bull made of riveted steel, pressure gauges on its back, boiler belly glowing red, steam venting from horns, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Древень-страж — `monsters/treant-warden-full`

> `full-body a giant treant guardian with bark armor and branch arms, roots bursting through the tower floor, small glowing sap wounds, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Кентавр-вождь — `monsters/centaur-chief-full`

> `full-body a centaur chieftain with a longbow and a curved sabre, chainmail, feathered war banner on the back, proud scarred face, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Сфинкс-привратник — `monsters/sphinx-full`

> `full-body a sphinx gatekeeper with a lion body, eagle wings and a calm wise human face, ancient headdress, guarding a tower gate with carved riddles, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Непримечательная тень — `monsters/plain-shadow-full`

> `full-body an unremarkable humanoid shadow, a thin grey silhouette with no face that looks like an ordinary person at first glance, slightly blurred edges dissolving into smoke, holding a short dark knife low behind its back, standing in the corner of a dim stone tower room, torchlight casting long shadows, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Кладбище прошлого, монстры мест (14.11)

### Колодезная утопленница — `monsters/well-drowned-full`

> `full-body a drowned undead woman climbing out of an old stone well, long wet black hair, waterlogged grey skin, reaching hands, night village, moonlight, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Могильщик-упырь — `monsters/ghoul-digger-full`

> `full-body a hunched ghoul gravedigger with long claws covered in earth, a torn leather apron, half emerging from a freshly dug grave, night cemetery, mist, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Надгробный страж — `monsters/tomb-guardian-full`

> `full-body a living tombstone golem made of mossy cracked gravestones, a carved stone face, heavy stone fists, night cemetery, mist, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Гробовая плесень — `monsters/grave-mold-full`

> `a pale fungal mold mass growing over an old coffin, spore clouds, small glowing caps, dark stone crypt, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Склепный червь — `monsters/crypt-worm-full`

> `full-body a huge pale crypt worm with a round toothy maw bursting from bones and broken coffins, dark stone crypt, candlelight, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Ключник — `monsters/keyholder-full`

> `full-body a rusty undead skeleton jailer with a huge ring of iron keys and a long chain with a shackle, tattered keeper robe, dark stone crypt, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Коса последнего вздоха — `items/art-death-scythe`

> `a long two-handed scythe with a dark worn wooden shaft and a pale ghostly blade, faint grey mist around the edge, worn and used, lying on a stone pedestal in a labyrinth niche, hand-painted dark fantasy item art, square 1:1, no text`

### Секреты воровства — `items/thief-secrets`

> `a worn leather book with burnt edges, lockpicks tucked into its spine and a small brass key on a string, lying on a stone pedestal in a labyrinth niche, hand-painted dark fantasy item art, square 1:1, no text`

### Тайны вечной жизни — `items/eternal-secrets`

> `an ancient black leather book with bone clasps and a faintly glowing green rune on the cover, worn and used, lying on a stone pedestal in a labyrinth niche, hand-painted dark fantasy item art, square 1:1, no text`

### Чаща прошлого (разлом 2 этажа, 08.11)

### Лютоволк, неудачный образец — `monsters/lab-direwolf-full`

> `full-body a huge scarred mutant wolf with patches of missing fur and surgical stitches, a metal collar with a key card, ancient dense primeval forest with giant mossy trees, sunbeams, a sinister laboratory hidden deep inside, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Шприц мутагена — `items/mutagen-syringe`

> `an ornate brass and glass syringe filled with glowing green mutagen, on dark wood, hand-painted dark fantasy item icon, square, no text`

### Гоблинград (разлом 2 этажа, 08.11)

### Гоблин-торговец — `monsters/goblin-merchant-full`

> `full-body a greedy goblin merchant with a heavy coin purse and a tray of trinkets, throwing coins, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Фонарщик — `monsters/goblin-lamplighter-full`

> `full-body a goblin lamplighter carrying a long pole with a glowing oil lantern, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Сторожевая гиена — `monsters/city-hyena-full`

> `full-body a scrawny spotted hyena with a spiked guard collar, barking, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Карманник — `monsters/goblin-pickpocket-full`

> `full-body a sly small goblin pickpocket in a hood holding a stolen potion, grinning, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Гоблин-поджигатель — `monsters/goblin-arsonist-full`

> `full-body a goblin arsonist with burning bottles of oil and singed clothes, slums, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Безумный гоблин — `monsters/mad-goblin-full`

> `full-body a wild-eyed mad goblin laughing hysterically, holding a broken plank, ragged clothes, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Городской стражник — `monsters/city-guard-full`

> `full-body a goblin city guard in chainmail with a long halberd, standing at attention, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Крышный лучник — `monsters/roof-archer-full`

> `full-body a goblin archer crouching on a rooftop with a short bow, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Механический пёс — `monsters/clockwork-hound-full`

> `full-body a clockwork dog made of copper plates, gears and springs, glowing eyes, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Гоблин-глашатай — `monsters/goblin-herald-full`

> `full-body a goblin herald in bright tabard blowing a large curved horn, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Шаман-жрец храма — `monsters/temple-shaman-full`

> `full-body a goblin temple priest with ancestral skull staff and ritual paint, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Головорез — `monsters/slum-thug-full`

> `full-body a burly goblin thug with a spiked club, scars, lurking in an alley, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Хобгоблин-сержант — `monsters/hob-sergeant-full`

> `full-body a disciplined hobgoblin sergeant in scale armor with a longsword and shield, shouting orders, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Вождь Гракх Основатель — `monsters/gob-founder-full`

> `full-body a mighty goblin warlord founder king in trophy plate armor with a great axe and a war banner, throne room, a bustling ancient goblin city of crooked wooden houses, lanterns and narrow streets, a palace on a hill, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Корона основателя — `items/founder-crown`

> `a crude but majestic goblin crown of iron and gold with trophy fangs, on dark wood, hand-painted dark fantasy item icon, square, no text`

### Староста Азик Эггерс — `npc/elder` (Кладбище прошлого, 09.11)

> `bust portrait of a kind elderly village elder with a grey beard, simple wool clothes and a walking staff, warm tavern light, a quiet village with a cemetery behind, hand-painted dark fantasy portrait, square 1:1, no text`

### Слуга вампиров — `monsters/vampire-servant-full`

> `full-body a gaunt vampire servant in a ragged butler coat, sharp fangs and claws, hungry eyes, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Жрец крови — `monsters/blood-priest-full`

> `full-body a robed cultist priest with a ritual knife and bloody runes on his hands, red sigils glowing, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Кровавая лужа — `monsters/blood-puddle-full`

> `full-body a living pool of thick blood rising into a slimy shape with pseudopods, bones floating inside, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Голем плоти — `monsters/flesh-golem-full`

> `full-body a huge stitched flesh golem made of sewn body parts, iron bolts, massive fists, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Поганище — `monsters/abomination-full`

> `full-body a bloated rotting abomination of fused corpses with a meat hook and chains, sickly green fumes, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Мордрейн, низший рыцарь смерти — `monsters/death-knight-full`

> `full-body a fallen death knight in blackened runed plate armor with a glowing red runesword, tattered cape, cold blue eyes, blood-soaked gothic fortress and dark sewers with red torchlight, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Ведьмин лес (3 этаж, 04.11)

### Подкидыш — `monsters/changeling-full`

> `full-body a small grotesque stitched creature, a failed witch experiment, mismatched limbs, bubbling acidic blisters on its skin, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Неудачный образец — `monsters/failed-specimen-full`

> `full-body a big bloated mutated beast, failed witch experiment, mismatched armored plates and claws, dripping acid, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Ведьмин кот — `monsters/witch-cat-full`

> `full-body a sleek black cat with glowing green eyes and a crooked tail, half melting into shadow, mischievous grin, misty dark witch forest with crooked trees and pale fog, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

### Монстры Звона и Храма изваяний (3 этаж, 03.11)

### Каменный служка — `monsters/stone-acolyte-full`

> `full-body a small living statue of a hooded acolyte made of cracked grey stone, crumbling pebbles falling, temple of statues, hand-painted dark fantasy creature art, full figure, portrait 2:3, no text`

## Предметы, оружие и броня

Стальное и более сильное снаряжение рисуется на лучшем фоне, чем обычное: «новое, блестящее» предмет (`new shiny steel …`), резная подставка (`decorated wooden display stand`), ниша-арсенал (`softly lit arsenal alcove`), знамёна и доспехи вдоль стен. Образец: `a new shiny steel warhammer with a squared head and a pointed back spike on a hardwood haft, standing upright, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`.

## Оружие и броня (обычное и стальное)

Обычное — потёртое, на простом пьедестале; стальное — новое и блестящее, на резной подставке в арсенале (образец выше). Файлы `assets/items/<id>.webp`, стальные — `assets/items/steel-<id>.webp`. Остальное оружие и броня уже нарисованы.

### Новое оружие и расходники (12.11)

Пока картинки нет, палочка, моргенштерн и цеп показываются без картинки (значок-заглушка), посох — прежней картинкой.

### Палочка — `items/wand`

> `a worn battle-used slender wooden magic wand with a small cloudy crystal at the tip and leather grip wrap, standing upright, resting against a simple wooden weapon display stand, scratches and nicks, light wear, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Посох (магический, вместо прежней жерди) — `items/staff`

> `a worn battle-used carved wooden mage staff with a dull crystal focus held in a forked top, standing upright, resting against a simple wooden weapon display stand, scratches and nicks, light wear, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Моргенштерн — `items/morningstar`

> `a worn battle-used morning star: a spiked iron ball on a short chain attached to a wooden handle, standing upright, resting against a simple wooden weapon display stand, scratches and nicks, light wear, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Цеп — `items/flail`

> `a worn battle-used long chain flail with a small iron weight and a hook at the end, coiled chain, wooden handle, standing upright, resting against a simple wooden weapon display stand, scratches and nicks, light wear, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Палочка с серебряной оплёткой (стальная) — `items/steel-wand`

> `a new shiny magic wand of dark polished wood with silver wire wrapping and a clear bright crystal at the tip, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Окованный посох (стальной; перерисовать под магический) — `items/steel-staff`

> `a new shiny mage staff bound with polished steel bands, a bright crystal focus in a steel claw setting at the top, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Стальной моргенштерн — `items/steel-morningstar`

> `a new shiny steel morning star: a polished spiked steel ball on a steel chain with a hardwood handle, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Стальной цеп — `items/steel-flail`

> `a new shiny steel chain flail with a polished steel weight and a sharp hook, neatly coiled steel chain, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Стальные стрелы — `items/arrow-steel`

> `a bundle of new arrows with shiny tempered steel arrowheads and grey fletching in a leather quiver, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Метательные кинжалы — `items/throw-dagger`

> `a worn leather bandolier holding ten small plain throwing knives without guards, standing upright, resting against a simple wooden weapon display stand, scratches and nicks, light wear, inside a softly lit stone dungeon alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Стальные метательные кинжалы — `items/throw-dagger-steel`

> `a new leather bandolier holding ten shiny polished steel throwing knives, resting against a decorated wooden display stand, on a small stone pedestal with a faintly glowing amber magic stone set into its front, inside a softly lit arsenal alcove, warm light, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

## Артефактное оружие и броня

Файлы `assets/items/art-<id>.webp` (приложение берёт их само, как только путь `items/art-<id>` добавлен в `RASTER`; пока картинки нет — показывается картинка обычного оружия). Фон — резной пьедестал с фиолетовым камнем в сокровищнице.

### Артефакты нового оружия (12.11, по описаниям автора)

### Посох метеора — `items/art-meteor-staff`

> `a carved dark mage staff topped with a jagged burning meteorite shard held in iron claws, glowing orange cracks and small embers drifting, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Утренняя звезда — `items/art-dawn-star`

> `an ornate morning star whose spiked ball glows with warm golden sunrise light, radiant rays between the spikes, gilded chain and handle, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Палочка цепной молнии — `items/art-chain-wand`

> `a slender silver-bound magic wand with a forked crystal tip, bright blue-white chain lightning arcing between the prongs, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

### Цеп-ловец — `items/art-binder-flail`

> `an ornate long chain flail with shackle-like links and a clawed catching hook at the end, faint violet glow on the links, on an ornate carved stone pedestal with a glowing violet magic stone set into its front, inside a softly lit treasure vault alcove with faint arcane runes on the walls, hand-painted fantasy RPG item art, stylized, clean readable silhouette, centered, square 1:1, no text`

## Сокровища и артефакты

## Находки (после определения)

## NPC и интерфейсы

## Здания города

Все 14 прежних зданий нарисованы. Новое:

