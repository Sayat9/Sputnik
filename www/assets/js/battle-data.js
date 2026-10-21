/* Тактический бой: статические данные (местность, статусы, монстры 1 этажа, расы).
   Грузится только при включённом тактическом бое. См. docs/battle.md. */
(function () {
  const Battle = (window.Battle = window.Battle || {});
  const D = (Battle.D = {});

  /* ---------- типы урона ---------- */
  D.DT = { pierce: "колющий", slash: "рубящий", bludgeon: "дробящий", fire: "огонь", cold: "холод", poison: "яд", thunder: "звук",
    lightning: "молния", necrotic: "некротический", psychic: "психический", radiant: "излучение", force: "силовой", acid: "кислота" };
  D.DT_FROM_RU = { "колющий": "pierce", "рубящий": "slash", "дробящий": "bludgeon", "огонь": "fire", "огнём": "fire", "холодом": "cold", "холод": "cold",
    "ядом": "poison", "звуком": "thunder", "молнией": "lightning", "некротический": "necrotic", "психический": "psychic" };
  D.DT_ICON = { pierce: "➶", slash: "⚔", bludgeon: "🔨", fire: "🔥", cold: "❄", poison: "☠", thunder: "♫", lightning: "ϟ", necrotic: "☾", psychic: "✺" };

  /* ---------- местность ---------- */
  // Рисунки клеток (viewBox 0 0 100 100). obstacle — непроходима и даёт укрытие линиям, проходящим через неё.
  const sh = '<ellipse cx="50" cy="82" rx="34" ry="9" fill="#000" opacity=".28"/>';
  D.SVG = {
    rock: sh + '<path d="M14 74 Q10 48 30 38 Q44 24 62 32 Q86 36 88 62 Q90 78 70 82 Q40 88 14 74Z" fill="#74787b" stroke="#2f3235" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M30 42 Q44 32 60 38" stroke="#a9adb0" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M52 52 L60 68 M36 60 L44 72" stroke="#4a4d50" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M20 68 Q30 60 40 68Z" fill="#5d8a4a" opacity=".8"/>',
    tree: sh + '<rect x="44" y="56" width="12" height="28" rx="3" fill="#5b3e24" stroke="#2c1d0f" stroke-width="2.5"/><circle cx="50" cy="40" r="28" fill="#2f6a34" stroke="#173a1b" stroke-width="3"/>' +
      '<circle cx="36" cy="46" r="17" fill="#3b8340"/><circle cx="63" cy="34" r="15" fill="#44904a"/><circle cx="44" cy="29" r="8" fill="#63b868" opacity=".6"/>',
    tent: sh + '<path d="M10 84 L50 16 L90 84Z" fill="#8a6a3a" stroke="#3d2c14" stroke-width="3" stroke-linejoin="round"/><path d="M50 16 L50 84" stroke="#3d2c14" stroke-width="2.5"/>' +
      '<path d="M36 84 L50 48 L64 84Z" fill="#231508"/><path d="M22 70 L34 60 M78 70 L66 60" stroke="#5a4020" stroke-width="3"/><circle cx="50" cy="14" r="4" fill="#d8ccb0" stroke="#3d2c14" stroke-width="2"/>',
    crate: sh + '<rect x="10" y="48" width="44" height="38" fill="#8b5e2e" stroke="#3b2411" stroke-width="3"/><path d="M10 48 L54 86 M54 48 L10 86" stroke="#5e3d1c" stroke-width="3"/>' +
      '<rect x="46" y="22" width="40" height="38" fill="#9a6a34" stroke="#3b2411" stroke-width="3" transform="translate(0 10)"/><path d="M46 32 H86 M46 46 H86" stroke="#5e3d1c" stroke-width="2.5" transform="translate(0 10)"/>',
    grave: '<ellipse cx="50" cy="86" rx="32" ry="8" fill="#000" opacity=".3"/><path d="M26 86 V42 Q26 16 50 16 Q74 16 74 42 V86Z" fill="#8f929a" stroke="#34363c" stroke-width="3"/>' +
      '<path d="M50 30 V62 M38 42 H62" stroke="#3d3f46" stroke-width="5" stroke-linecap="round"/><path d="M28 86 Q50 74 72 86Z" fill="#5a6e4a"/>',
    crystal: sh + '<path d="M28 84 L20 46 L32 20 L44 50 L40 84Z" fill="#59c4d8" stroke="#1d6070" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M46 84 L44 28 L57 6 L70 32 L64 84Z" fill="#7fe0ee" stroke="#1d6070" stroke-width="3" stroke-linejoin="round"/><path d="M64 84 L66 54 L80 40 L86 84Z" fill="#46acc2" stroke="#1d6070" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M54 18 L51 62" stroke="#effeff" stroke-width="3" opacity=".8" stroke-linecap="round"/>',
    bush: sh + '<circle cx="32" cy="62" r="20" fill="#3d7a38" stroke="#1d4420" stroke-width="3"/><circle cx="64" cy="58" r="22" fill="#4a8c42" stroke="#1d4420" stroke-width="3"/>' +
      '<circle cx="48" cy="44" r="18" fill="#58a24e" stroke="#1d4420" stroke-width="3"/><circle cx="38" cy="52" r="3" fill="#c0392b"/><circle cx="60" cy="64" r="3" fill="#c0392b"/><circle cx="52" cy="40" r="3" fill="#c0392b"/>',
    thorns: sh + '<path d="M12 82 Q16 46 34 26 M28 84 Q34 48 50 18 M46 84 Q50 44 62 14 M64 84 Q68 50 82 24 M82 82 Q84 58 92 40" stroke="#5a4426" stroke-width="5.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M20 60 l-10 -3 M25 44 l-10 -7 M38 40 l-10 -9 M44 64 l-11 -2 M55 36 l-10 -9 M57 60 l11 -4 M70 42 l11 -7 M68 66 l11 2 M86 54 l8 -6 M40 24 l-9 -2 M60 24 l10 -3" stroke="#35281a" stroke-width="3.2" stroke-linecap="round"/>' +
      '<ellipse cx="30" cy="34" rx="7" ry="3.6" fill="#8d7c3a" transform="rotate(-35 30 34)"/><ellipse cx="66" cy="30" rx="7" ry="3.6" fill="#7d6d32" transform="rotate(25 66 30)"/><ellipse cx="48" cy="52" rx="6" ry="3.2" fill="#9b8a44" transform="rotate(-10 48 52)"/><ellipse cx="78" cy="58" rx="6" ry="3.2" fill="#85753a" transform="rotate(30 78 58)"/>',
    shrooms: sh + '<rect x="25" y="52" width="10" height="30" rx="4" fill="#cfd6c6" stroke="#4b5648" stroke-width="2.5"/><path d="M12 58 Q30 18 48 58Z" fill="#7a5cc4" stroke="#3b2a6b" stroke-width="3"/><circle cx="25" cy="46" r="3.2" fill="#e0d6ff"/><circle cx="36" cy="50" r="2.6" fill="#e0d6ff"/>' +
      '<rect x="58" y="44" width="11" height="38" rx="4" fill="#d6dccb" stroke="#4b5648" stroke-width="2.5"/><path d="M42 50 Q64 4 86 50Z" fill="#46b7a6" stroke="#1d5a50" stroke-width="3"/><circle cx="55" cy="36" r="3.4" fill="#d4fff6"/><circle cx="68" cy="26" r="2.8" fill="#d4fff6"/><circle cx="74" cy="42" r="2.4" fill="#d4fff6"/>' +
      '<rect x="80" y="64" width="7" height="18" rx="3" fill="#cfd6c6" stroke="#4b5648" stroke-width="2"/><path d="M71 68 Q84 44 97 68Z" fill="#c4607a" stroke="#6b2a3b" stroke-width="2.5"/>',
    puddle: '<ellipse cx="50" cy="56" rx="42" ry="28" fill="#3d7fa8" opacity=".88" stroke="#1d4a66" stroke-width="3"/><ellipse cx="42" cy="50" rx="24" ry="13" fill="#6fb3d6" opacity=".7"/>' +
      '<path d="M28 62 Q40 55 50 62 M54 50 Q62 46 72 53" stroke="#d6f0ff" stroke-width="2.5" fill="none" opacity=".85" stroke-linecap="round"/>',
    mud: '<ellipse cx="50" cy="56" rx="42" ry="28" fill="#5b4326" stroke="#33250f" stroke-width="3"/><ellipse cx="44" cy="52" rx="26" ry="13" fill="#6d5230"/><circle cx="64" cy="60" r="5" fill="#33250f" opacity=".6"/><circle cx="32" cy="62" r="3.5" fill="#33250f" opacity=".6"/>',
    bones: '<path d="M14 72 L50 52" stroke="#e8dec6" stroke-width="7" stroke-linecap="round"/><circle cx="12" cy="74" r="5.5" fill="#e8dec6"/><circle cx="52" cy="50" r="5.5" fill="#e8dec6"/>' +
      '<path d="M30 40 L74 62" stroke="#d9cfb6" stroke-width="6" stroke-linecap="round"/><ellipse cx="68" cy="38" rx="14" ry="12" fill="#efe6d0" stroke="#8a7f68" stroke-width="2.5"/><circle cx="63" cy="37" r="3.4" fill="#2a2a30"/><circle cx="74" cy="37" r="3.4" fill="#2a2a30"/><path d="M62 47h12" stroke="#8a7f68" stroke-width="2.5"/>',
    moss: '<ellipse cx="50" cy="58" rx="42" ry="26" fill="#4f7a3a" opacity=".92" stroke="#2b4a1f" stroke-width="2.5"/><circle cx="34" cy="54" r="11" fill="#6a9a50"/><circle cx="58" cy="62" r="13" fill="#5d8d46"/><circle cx="68" cy="48" r="8" fill="#7aae5c"/>',
    stakes: '<ellipse cx="50" cy="84" rx="38" ry="8" fill="#000" opacity=".28"/><path d="M18 84 L24 32 L32 84Z M42 84 L48 20 L56 84Z M66 84 L72 36 L80 84Z" fill="#8a6a3a" stroke="#3d2c14" stroke-width="3" stroke-linejoin="round"/>',
    fire: '<ellipse cx="50" cy="78" rx="36" ry="13" fill="#2b2b2b"/><circle cx="22" cy="78" r="7" fill="#6b6e72"/><circle cx="78" cy="78" r="7" fill="#6b6e72"/><circle cx="40" cy="86" r="6" fill="#7a7d80"/><circle cx="62" cy="86" r="6" fill="#7a7d80"/>' +
      '<path class="fl" d="M50 18 C64 38 74 48 67 64 C63 76 37 76 33 64 C27 48 43 42 50 18Z" fill="#f2851f"/><path class="fl2" d="M50 42 C58 52 61 58 57 66 C54 72 46 72 44 66 C40 58 47 54 50 42Z" fill="#ffd54a"/>',
    fog: '<ellipse cx="32" cy="58" rx="32" ry="19" fill="#cdd3dc" opacity=".5"/><ellipse cx="64" cy="48" rx="34" ry="21" fill="#dbe0e8" opacity=".46"/><ellipse cx="50" cy="68" rx="36" ry="15" fill="#c0c7d2" opacity=".44"/>',
    trap: '<ellipse cx="50" cy="70" rx="38" ry="13" fill="#2a1e12"/><path d="M12 68 L25 38 L38 68 L50 38 L62 68 L75 38 L88 68Z" fill="#a3a9af" stroke="#3b3f44" stroke-width="2.5" stroke-linejoin="round"/>',
    web: '<path d="M50 8 V92 M8 50 H92 M18 18 L82 82 M82 18 L18 82" stroke="#e6e9ee" stroke-width="2" opacity=".8"/><circle cx="50" cy="50" r="14" fill="none" stroke="#e6e9ee" stroke-width="2" opacity=".8"/><circle cx="50" cy="50" r="28" fill="none" stroke="#e6e9ee" stroke-width="2" opacity=".7"/>',
  };
  // Свойства клеток. cost — стоимость входа (2 = труднопроходная), cover — укрытие для занявшего клетку (дальние атаки +2 КД).
  D.terrain = {
    rock:    { name: "Валун", obstacle: true, note: "Не пройти. Даёт укрытие тем, кто за ним." },
    tree:    { name: "Дерево", obstacle: true, note: "Не пройти. Даёт укрытие." },
    tent:    { name: "Шатёр", obstacle: true, note: "Не пройти. Даёт укрытие." },
    crate:   { name: "Ящики", obstacle: true, note: "Не пройти. Даёт укрытие." },
    grave:   { name: "Надгробие", obstacle: true, note: "Не пройти. Даёт укрытие." },
    crystal: { name: "Кристалл", obstacle: true, light: 2, note: "Не пройти. Светится: в тьме освещает 2 клетки." },
    bush:    { name: "Заросли", cost: 2, cover: 2, hide: true, thicket: true, note: "Труднопроходны (клетка стоит 2). +2 КД от дальних атак, можно прятаться." },
    thorns:  { name: "Колючие заросли", cost: 2, cover: 2, hide: true, thicket: true, note: "Труднопроходны (клетка стоит 2). +2 КД от дальних атак, можно прятаться." },
    shrooms: { name: "Грибные заросли", cost: 2, cover: 2, hide: true, thicket: true, note: "Труднопроходны (клетка стоит 2). +2 КД от дальних атак, можно прятаться." },
    puddle:  { name: "Лужа", wet: true, note: "Кто вошёл — промок: холод и молния +1к4, огонь не поджигает." },
    mud:     { name: "Грязь", cost: 2, note: "Труднопроходна." },
    bones:   { name: "Груда костей", cost: 2, note: "Труднопроходна." },
    moss:    { name: "Цепкий мох", cost: 2, note: "Труднопроходен." },
    stakes:  { name: "Колья", cost: 2, note: "Труднопроходны." },
    fire:    { name: "Костёр", hazard: "fire", light: 3, note: "1к4 урона огнём тому, кто вошёл или начал ход. Освещает 3 клетки." },
    fog:     { name: "Туман", cover: 2, hide: true, note: "+2 КД от дальних атак, можно прятаться." },
  };
  // Зоны: фон, перечень препятствий и украшений. [мин, макс] — сколько клеток; blob — пятном; trap — скрытые ловушки гоблинов.
  // «Подсыпка» местности (battle-core.js → genTerrain): если на поле мало укрытий или нет зарослей, иногда добавляем их.
  // minCover — сколько клеток с укрытием (препятствия, заросли, туман) хотим иметь; *Chance — вероятность подсыпки; thicketN — размер пятна зарослей.
  D.gen = { minCover: 5, coverChance: 0.75, thicketChance: 0.6, thicketN: [2, 4] };
  D.zones = {
    goblin: { name: "Лагерь гоблинов", obst: ["tent", "crate", "rock"], nObst: [3, 5], thicket: "thorns", feats: [["stakes", 1, 2], ["mud", 1, 3, true], ["fire", 0, 1], ["puddle", 0, 2, true]], traps: [0, 2],
      bg: { base: "#4a4026", base2: "#2b2414", dots: ["#6a5a36", "#3a301a", "#7d6c40"], tufts: "#6b7a2e", label: "Лагерь гоблинов" } },
    beast: { name: "Звериная чаща", obst: ["tree", "rock"], nObst: [3, 5], thicket: "bush", feats: [["bush", 2, 4], ["mud", 0, 2, true], ["puddle", 1, 3, true]], traps: [0, 0],
      bg: { base: "#2f4a24", base2: "#17260f", dots: ["#3f6a30", "#22381a", "#587a3c"], tufts: "#6ea04a", label: "Звериная чаща" } },
    undead: { name: "Погост", obst: ["grave", "rock"], nObst: [3, 5], thicket: "thorns", feats: [["bones", 2, 3], ["fog", 2, 4, true], ["puddle", 0, 2, true]], traps: [0, 0],
      bg: { base: "#3a3744", base2: "#1c1a24", dots: ["#55526a", "#2a2834", "#6e6a84"], tufts: "#5b6a4a", label: "Погост" } },
    stone: { name: "Каменная пещера", obst: ["rock", "crystal"], nObst: [3, 5], thicket: "shrooms", feats: [["moss", 1, 3], ["puddle", 1, 3, true]], traps: [0, 0],
      bg: { base: "#3b4650", base2: "#1c2228", dots: ["#556573", "#2b343c", "#6f8394"], tufts: "#4f7a3a", label: "Каменная пещера" } },
  };

  /* ---------- скорость в бою ---------- */
  // Все, и герои и монстры, двигаются в бою медленнее: от обычных клеток скорости (1 клетка = 1,5 м) отнимается speedCut клеток.
  // 9 м = 4 клетки; всё поле (6 клеток) без рывка пересекают только от 12 м (две эссенции «+1,5 м», волк, лиса, тёмный медведь).
  D.speedCut = 2;

  /* ---------- стрелы ---------- */
  // Исход выстрела героя (от худшего к лучшему): 1 на кубике — промах и стрела ломается; промах — стрела упала на поле;
  // попадание впритык (бросок не выше КД цели + breakMargin) — стрела ломается; попадание и критическое попадание — стрела цела.
  // Целые стрелы подбираются в конце боя, если отряд не бежал.
  D.arrow = { breakMargin: 1 };

  /* ---------- статусы ---------- */
  // ico — путь в сетке 24×24 (stroke), good — полезный статус. Эффекты прописаны в battle-core.js.
  D.status = {
    prone:       { name: "Сбит с ног", ico: '<circle cx="5.5" cy="13" r="2"/><path d="M8 14.5h8l3-3M8 14.5l-2 4.5M16 14.5l-3 4.5M3 20.5h18"/>', desc: "Атаки в ближнем бою по нему — с преимуществом, дальние — с помехой. Его атаки — с помехой. Встать — половина скорости." },
    grappled:    { name: "Схвачен", ico: '<path d="M8 12V6.5a1.5 1.5 0 013 0V11M11 10V5a1.5 1.5 0 013 0v6M14 10.5V6.5a1.5 1.5 0 013 0V14c0 4-2 6-5 6s-5-2-6-5l-1-3 2 1z"/>', desc: "Скорость 0. Вырваться: действие, Атлетика или Акробатика против Сл." },
    restrained:  { name: "Опутан", ico: '<rect x="2.5" y="9" width="11" height="6" rx="3"/><rect x="10.5" y="9" width="11" height="6" rx="3"/>', desc: "Скорость 0. Атаки по нему — с преимуществом, его атаки и спасброски Ловкости — с помехой." },
    pinned:      { name: "Пригвождён", ico: '<circle cx="12" cy="7" r="3.5"/><path d="M12 10.5V21M8.5 21h7"/>', desc: "Скорость 0." },
    slowed:      { name: "Замедлен", ico: '<path d="M12 4v10M7 11l5 5 5-5M6 20h12"/>', desc: "Скорость снижена." },
    poisoned:    { name: "Отравлен", ico: '<path d="M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z"/><circle cx="10" cy="14" r=".9" fill="currentColor"/><circle cx="14" cy="14" r=".9" fill="currentColor"/><path d="M10.5 17.2h3"/>', desc: "Помеха на атаки и проверки." },
    frightened:  { name: "Испуган", ico: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="16.6" r=".9" fill="currentColor"/>', desc: "Помеха на атаки. Нельзя приближаться к источнику страха." },
    dazzled:     { name: "Ослеплён вспышкой", ico: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>', desc: "Помеха на следующий бросок атаки." },
    shaken:      { name: "Оглушён грохотом", ico: '<path d="M4 10h3l4-3.5v11L7 14H4zM14 9c2 1.5 2 4.5 0 6M17 7c3 3 3 7 0 10"/>', desc: "Помеха на следующую проверку или спасбросок Ловкости." },
    bleeding:    { name: "Кровотечение", ico: '<path d="M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z" fill="currentColor" fill-opacity=".35"/>', desc: "1 урона в начале каждого хода. Остановить: лечение или Медицина Сл 10 (действие)." },
    burning:     { name: "Горит", ico: '<path d="M12 3c3 3 5 5 5 8.5A5 5 0 017 11.5c0-2 1-3 2-4 0 2 1 3 2 3 1-2 0-4 1-7.5z"/>', desc: "1к4 урона огнём в начале хода. Потушить: действие или вода." },
    wet:         { name: "Промок", ico: '<path d="M8 4c2 3 3 5 3 7a3 3 0 01-6 0c0-2 1-4 3-7zM16 9c2 3 3 4.5 3 6.5a3 3 0 01-6 0c0-2 1-3.5 3-6.5z"/>', desc: "Урон холодом и молнией +1к4. Огонь не поджигает, горение тухнет. Преимущество на выскальзывание из захвата." },
    dodging:     { name: "Оборона", good: true, ico: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>', desc: "Атаки по нему — с помехой, преимущество на спасброски Ловкости. До начала его следующего хода." },
    hidden:      { name: "Скрыт", good: true, ico: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 20L20 4"/>', desc: "Противники его не видят: его первая атака — с преимуществом. После атаки он раскрыт." },
    helped:      { name: "Помощь союзника", good: true, ico: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.400 9.300l6-.7z"/>', desc: "Следующая атака по этой цели — с преимуществом." },
    guarded:     { name: "Прикрыт щитом", good: true, ico: '<path d="M5 4h14v8c0 5-3 7.500-7 9-4-1.500-7-4-7-9z"/><path d="M12 4v17"/>', desc: "+2 КД (половинное укрытие) до начала хода прикрывающего." },
    noheal:      { name: "Раны не затягиваются", ico: '<path d="M12 20s-7-4.500-7-10a4 4 0 017-2.500A4 4 0 0119 10c0 5.500-7 10-7 10z"/><path d="M4 4l16 16"/>', desc: "Нельзя восстанавливать ОЗ." },
    weakened:    { name: "Ослаблен", ico: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>', desc: "−1 к атакам и спасброскам до конца боя." },
    rush:        { name: "Рывок", good: true, ico: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>', desc: "+2 к первой рукопашной атаке в этот ход." },
    flicker:     { name: "Мерцание", good: true, ico: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/>', desc: "Первая атака по нему до его следующего хода — с помехой." },
    lit:         { name: "Светится", good: true, ico: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', desc: "Тусклый свет в радиусе 2 клеток." },
    envenomed:   { name: "Яд на клыках", good: true, ico: '<path d="M8 4l4 7 4-7M8 4c0 8 4 14 4 16 0-2 4-8 4-16"/>', desc: "Следующее попадание рукопашной атакой в этот ход отравит." },
    deceived:    { name: "Потерял след", ico: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><path d="M12 9v6M9 12h6" opacity=".0"/><path d="M4 20L20 4"/>', desc: "Не видит того, кто его обманул: его атаки по нему — с помехой." },
    unconscious: { name: "Без сознания", ico: '<path d="M5 5h6l-6 6h6M13 13h5l-5 5h5"/>', desc: "Лежит, не действует. Атаки вблизи по нему с преимуществом и критом. Спасброски от смерти в начале хода." },
    stable:      { name: "Стабилен", good: true, ico: '<path d="M5 5h6l-6 6h6M13 13h5l-5 5h5"/><path d="M4 21h16"/>', desc: "Без сознания, но не умрёт." },
    spearstop:   { name: "Остановлен копьём", ico: '<path d="M4 20L18 6M18 6l-5 .5M18 6l-.5 5"/><path d="M3 8h6"/>', desc: "Скорость 0 до конца хода." },
    sleepy:      { name: "Сонный", ico: '<path d="M20 14.500A8 8 0 019.500 4a8 8 0 1010.500 10.500z"/>', desc: "Усталость +1 до Отдыха (герой) или −1 к атакам и спасброскам (монстр)." },
    trapped:     { name: "В капкане", ico: '<path d="M3 18l3-9 3 9 3-9 3 9 3-9 3 9z"/>', desc: "Скорость 0. Вырваться: действие и проверка Силы против Сл ловушки." },
    unseen:      { name: "Невидим", good: true, ico: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>', desc: "Не виден противникам." },
  };

  /* ---------- расы в бою ---------- */
  D.race = {
    human: {},
    barbarian: { fearAdv: true, reroll: "rite" },                // Дух воина; Наследие обряда — перебросить кости урона рукопашной атаки
    dwarf: { dv: true },
    beastkin: { disSound: true },                                // Острые чувства: помеха на спасброски против грома
    fairy: { vuln: ["thunder"], bushStealth: true },             // Чуткий слух; Шаг в листве
    dragon: { heart: true, disCold: true },                      // Драконье сердце; Холодная кровь
  };

  /* ---------- кулдауны эссенций 1 этажа (раунды) ----------
     В rules.md перезарядка указана у 8 класса; для 9 класса она выведена из цены маны (черновик). */
  D.essCd = { goblin: 3, "goblin-archer": 2, "goblin-sword": 2, "goblin-spear": 2, wolf: 3, fox: 2, mouse: 3, bat: 3, zombie: 2, skeleton: 3, "skeleton-archer": 3,
    ghoul: 2, "living-stone": 2, pixie: 3, wisp: 3, "green-boulder": 3, hobgoblin: 2, "dark-bear": 3, "skeleton-warrior": 2, "stone-guardian": 3 };

  /* ---------- боевая таблица монстров 1 этажа ----------
     ОЗ, КД, скорость, характеристики, чувства берутся из MONSTERS (index.html); здесь — атаки, размер, особенности и ИИ.
     atk: hit — бонус к попаданию, dmg — кости, dt — тип урона, kind — melee|ranged, reach — клеток (1 = 1,5 м), range — [обычная, макс.] клеток.
     seq — порядок атак за ход (мультиатака). ai: см. battle-ai.js. */
  const melee = (id, n, hit, dmg, dt, reach = 1) => ({ id, n, hit, dmg, dt, kind: "melee", reach });
  const ranged = (id, n, hit, dmg, dt, r1, r2) => ({ id, n, hit, dmg, dt, kind: "ranged", range: [r1, r2] });
  D.mon = {
    goblin: { atk: [melee("knife", "Ржавый нож", 4, "1к4+2", "pierce"), ranged("sling", "Праща", 4, "1к4+2", "bludgeon", 6, 24)],
      ai: { int: 2, role: "skirmisher", focus: ["weak", "nearest"], morale: { type: "pack", dc: 10, mod: -1 }, trapSafe: true, openers: ["trap"], ranged: "ifNoMelee" } },
    "goblin-archer": { atk: [ranged("bow", "Короткий лук", 5, "1к6+3", "pierce", 18, 66), melee("knife", "Нож", 5, "1к4+3", "pierce")],
      ai: { int: 2, role: "ranged", keep: 3, focus: ["runner", "hidden", "nearest"], morale: { type: "pack", dc: 10, mod: 0 }, trapSafe: true, openers: ["pin"], kite: true } },
    "goblin-sword": { atk: [melee("cleaver", "Тесак", 3, "1к6+1", "slash")],
      ai: { int: 2, role: "brute", focus: ["cluster", "nearest"], morale: { type: "pack", dc: 10, mod: -1 }, trapSafe: true, openers: ["sweep"] } },
    "goblin-spear": { atk: [melee("spear", "Копьё", 3, "1к6+1", "pierce", 2), ranged("throw", "Метнуть копьё", 3, "1к6+1", "pierce", 4, 12)],
      ai: { int: 2, role: "secondLine", focus: ["nearest", "weak"], morale: { type: "pack", dc: 10, mod: 0 }, trapSafe: true, openers: [], throwWhenBroken: true } },
    hobgoblin: { atk: [melee("sword", "Длинный меч", 4, "1к8+2", "slash")],
      ai: { int: 3, role: "brute", focus: ["attacker", "nearest"], morale: { type: "alone", dc: 10, mod: -1, adv: true }, openers: ["rush"], berserk: true } },
    "dark-bear": { size: 2, atk: [melee("bite", "Укус", 5, "1к8+3", "pierce"), melee("claws", "Когти", 5, "2к4+3", "slash")], seq: ["bite", "claws"],
      ai: { int: 1, role: "brute", focus: ["torch", "nearest", "weak"], fleeHp: 0.2, openers: ["grab"] } },
    "skeleton-warrior": { atk: [melee("sword", "Длинный меч", 4, "1к8+2", "slash"), melee("bash", "Удар щитом", 4, "1к4+2", "bludgeon")], vuln: ["bludgeon"], shield: true,
      ai: { int: 2, role: "sentinel", wake: 2, focus: ["nearest"], noFlee: true, openers: [] } },
    "stone-guardian": { atk: [melee("fist", "Каменный кулак", 5, "1к8+3", "bludgeon")], seq: ["fist", "fist"], oreVein: true, tremor: 2,
      ai: { int: 1, role: "guardian", leash: 2, focus: ["nearest", "cluster"], noFlee: true, openers: ["rockfall"] } },
    wolf: { atk: [melee("claws", "Когти", 4, "1к4+2", "slash")],
      ai: { int: 1, role: "swarm", focus: ["wounded", "weak"], fleeHp: 0.3, openers: ["rush"], circle: true } },
    fox: { atk: [melee("bite", "Укус", 5, "1к4+3", "pierce")],
      ai: { int: 2, role: "skirmisher", focus: ["weak", "prone", "nearest"], fleeHp: 0.5, hitRun: true, hide: true, openers: ["trail"] } },
    mouse: { atk: [melee("bite", "Укус", 4, "1к4", "pierce")],
      ai: { int: 1, role: "skittish", focus: ["nearest", "cluster"], fleeHp: 0.5, openers: ["squeak"] } },
    bat: { atk: [melee("bite", "Укус", 5, "1к4+3", "pierce")], blind: 2,
      ai: { int: 1, role: "skirmisher", focus: ["torch", "nearest"], fleeHp: 0.4, hitRun: true, openers: ["envenom"] } },
    zombie: { atk: [melee("slam", "Удар", 3, "1к6+1", "bludgeon")],
      ai: { int: 0, role: "melee", focus: ["nearest"], noFlee: true, openers: ["grab"] } },
    skeleton: { atk: [melee("sword", "Ржавый меч", 4, "1к6+2", "slash")], vuln: ["bludgeon"],
      ai: { int: 1, role: "melee", focus: ["nearest"], noFlee: true, openers: ["rattle"] } },
    "skeleton-archer": { atk: [ranged("bow", "Короткий лук", 5, "1к6+3", "pierce", 16, 64), melee("dagger", "Кинжал", 5, "1к4+3", "pierce")], vuln: ["bludgeon"],
      ai: { int: 2, role: "ranged", keep: 3, focus: ["weak", "nearest"], noFlee: true, hide: true, still: true, openers: ["icearrow"], kite: true } },
    ghoul: { atk: [melee("claws", "Когти", 4, "1к4+2", "slash"), melee("bite", "Укус", 4, "1к6+2", "pierce")],
      ai: { int: 1, role: "melee", focus: ["prone", "wounded", "weak"], fleeHp: 0.2, openers: ["lockbite"] } },
    "living-stone": { atk: [melee("fist", "Кулак", 4, "1к6+2", "bludgeon")], backstab: true,
      ai: { int: 0, role: "melee", focus: ["nearest"], noFlee: true, openers: ["smash"] } },
    pixie: { atk: [melee("needle", "Игла", 6, "1к4", "pierce")],
      ai: { int: 2, role: "skittish", focus: ["weak", "nearest"], fleeHp: 0.5, hitRun: true, flitter: true, openers: ["dust"] } },
    wisp: { atk: [melee("touch", "Касание", 5, "1к4", "fire")],
      ai: { int: 1, role: "skirmisher", focus: ["nearest"], fleeHp: 0.5, hitRun: true, relocate: true, openers: ["flash"] } },
    "green-boulder": { atk: [melee("slam", "Удар", 4, "1к8+2", "bludgeon")], mossAura: true,
      ai: { int: 0, role: "melee", focus: ["nearest"], noFlee: true, openers: ["moss"] } },
  };

  /* ---------- иконки меню действий (24×24, stroke) ---------- */
  D.ico = {
    attack: '<path d="M14.500 4l6-1-1 6L9 19.500l-4.500-4.500zM5 15l-2.500 2.500M7.500 17.500L5 20"/>',
    skills: '<path d="M12 2l2.200 5.800L20 10l-5.800 2.200L12 18l-2.200-5.800L4 10l5.800-2.200zM19 16l.9 2.100L22 19l-2.100.9L19 22l-.9-2.100L16 19l2.100-.9z"/>',
    move: '<path d="M7 20c0-4 1-6 4-6M12 20c0-3 1-4 3-4M10 9a2.200 2.800 0 100-5.600A2.200 2.800 0 0010 9zM17 15a2 2.500 0 100-5 2 2.500 0 000 5z"/>',
    defend: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 7v10M8 11h8"/>',
    more: '<circle cx="5" cy="12" r="1.800"/><circle cx="12" cy="12" r="1.800"/><circle cx="19" cy="12" r="1.800"/>',
    items: '<path d="M6 9h12l1 11H5zM9 9V6a3 3 0 016 0v3"/>',
    flee: '<path d="M14 4l5 5-5 5M19 9H8M8 4H4v16h4"/>',
    end: '<path d="M5 4v16M5 5h12l-3 4 3 4H5"/>',
    dash: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    disengage: '<path d="M4 12h12M12 7l5 5-5 5M20 5v14"/>',
    help: '<path d="M12 3l2.600 5.600 6 .7-4.500 4.100 1.300 6L12 16.400 6.600 19.400l1.300-6L3.400 9.300l6-.7z"/>',
    hide: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.600"/><path d="M4 20L20 4"/>',
    grapple: '<path d="M8 12V6.500a1.500 1.500 0 013 0V11M11 10V5a1.500 1.500 0 013 0v6M14 10.500V6.500a1.500 1.500 0 013 0V14c0 4-2 6-5 6s-5-2-6-5l-1-3 2 1z"/>',
    shove: '<path d="M3 12h11M10 7l5 5-5 5M18 6v12"/>',
    potion: '<path d="M10 3h4M10 3v5l-5 8a4 4 0 003.500 6h7a4 4 0 003.500-6l-5-8V3"/><path d="M7 15h10"/>',
    torch: '<path d="M12 3c2 2 3 3.500 3 5.500A3 3 0 019 8.500C9 6.500 10 5 12 3z"/><path d="M9.500 11h5l-1.500 10h-2z"/>',
    shield: '<path d="M5 4h14v8c0 5-3 7.500-7 9-4-1.500-7-4-7-9z"/><path d="M12 4v17"/>',
    fist: '<path d="M7 11V8a1.500 1.500 0 013 0v-1a1.500 1.500 0 013 0v1a1.500 1.500 0 013 0v3.500c0 4-2 6.500-5.500 6.500S7 15 7 12z"/>',
    arrow: '<path d="M4 20L18 6M18 6h-5M18 6v5M4 20l1-4M4 20l4-1"/>',
    throwing: '<path d="M4 20L16 8M16 8l-5 .5M16 8l-.5 5M18 4l2 2"/>',
    bow: '<path d="M6 3c8 3 8 15 0 18M6 3v18M6 12h13M16 9l3 3-3 3"/>',
    wait: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="10.500" cy="10.500" r="6"/><path d="M15 15l5.500 5.500"/>',
    heart: '<path d="M12 20s-7-4.500-7-10a4 4 0 017-2.500A4 4 0 0119 10c0 5.500-7 10-7 10z"/>',
    skull: '<path d="M12 3a8 8 0 00-5 14v3h10v-3a8 8 0 00-5-14z"/><circle cx="9" cy="11" r="1.600"/><circle cx="15" cy="11" r="1.600"/>',
    reroll: '<path d="M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.600"/>',
  };

  Battle.ready = false;           // выставит battle.js, когда загрузятся все файлы
})();
