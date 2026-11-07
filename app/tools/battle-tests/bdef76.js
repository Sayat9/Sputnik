// Сравнение защиты (вариант Б, 02.11): смертность героев разных сборок до и после.
// node bdef.js [N] [корень приложения] — корень по умолчанию /home/user/app; старая копия — любой каталог с index.html и assets.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
const N = +process.argv[2] || 30, ROOT = process.argv[3] || '/home/user/app', ONLY = process.argv[4] || '', LV7 = +(process.env.LV7 || 3), LV6 = +(process.env.LV6 || 3);
const G = (id, n) => Array(n).fill(id);
// [метка, этаж, уровень, список монстров, зона]
const CASES = [          // [метка, этаж, уровень героев, монстры, зона ('' — из данных монстра)]
  ['волколак', 2, LV7, ['werewolf'], ''],
  ['крот-исполин', 2, LV7, ['giant-mole'], ''],
  ['болотный клык', 2, LV7, ['swamp-fang'], ''],
  ['трупоед', 2, LV7, ['corpse-eater'], ''],
  ['пепельник', 2, LV7, ['ash-wraith'], ''],
  ['костяной рыцарь+2', 2, LV7, ['bone-knight', 'skeleton', 'skeleton'], ''],
  ['король гоблинов+свита', 2, LV7, 'KING', 'goblin'],
  ['магмовый голем', 2, LV7, ['magma-golem'], ''],
  ['кристальный колосс', 2, LV7, ['crystal-colossus'], ''],
  ['дух бури', 2, LV7, ['storm-spirit'], ''],
  ['палач+2 орка', 3, LV7, ['orc-executioner', 'orc-spear', 'orc-thrower'], 'orc'],
  ['шаманка+2 орка', 3, LV7, ['orc-shaman', 'orc-spear', 'orc-scout'], 'orc'],
  ['вожак+2 орка', 3, LV7, ['orc-guard', 'orc-spear', 'orc-thrower'], 'orc'],
  ['вожак+3 орка+волк', 3, LV7, ['orc-guard', 'orc-spear', 'orc-thrower', 'orc-scout', 'orc-wolf'], 'orc'],
  ['4 орка+волк+сокол', 3, LV7, ['orc-spear', 'orc-thrower', 'orc-scout', 'orc-spear', 'orc-wolf', 'orc-falcon'], 'orc'],
  ['вождь+волк (6)', 3, LV6, ['orc-chief', 'orc-wolf'], 'orc'],
  ['мимик (6)', 3, LV6, ['mimic'], ''],
  ['хранитель тишины (6)', 3, LV6, ['silence-keeper'], ''],
  ['З: жучок+шакал+крыса', 3, LV7, ['toll-beetle', 'echo-jackal', 'toll-rat'], ''],
  ['З: шакалы ×3', 3, LV7, ['echo-jackal', 'echo-jackal', 'echo-jackal'], ''],
  ['З: страж+визгун+шакал', 3, LV7, ['toll-guard', 'shrieker', 'echo-jackal'], ''],
  ['З: бык+бык+жучок', 3, LV7, ['toll-bull', 'toll-bull', 'toll-beetle'], ''],
  ['З: звонарь+страж+крыса', 3, LV7, ['bell-ringer', 'toll-guard', 'toll-rat'], ''],
  ['З: хор ×4', 3, LV7, ['choir-dead', 'choir-dead', 'choir-dead', 'choir-dead'], ''],
  ['З: охотник+2', 3, LV7, ['toll-hunter', 'echo-jackal', 'toll-rat'], ''],
  ['Х: служки+херувим', 3, LV7, ['stone-acolyte', 'dust-cherub', 'stone-acolyte'], ''],
  ['Х: кариатида+алебардист+служка', 3, LV7, ['caryatid', 'marble-halberdier', 'stone-acolyte'], ''],
  ['Х: страж+святая', 3, LV7, ['marble-guardian', 'marble-saint'], ''],
  ['Х: скульптор+служка (6)', 3, LV6, ['faceless-sculptor', 'stone-acolyte'], ''],
  ['У: егерь+гончая+гриф', 3, LV7, ['bone-ranger', 'thorn-hound', 'grey-vulture'], ''],
  ['У: лиса+лось+гончая', 3, LV7, ['iron-fox', 'stone-elk', 'thorn-hound'], ''],
  ['У: вожак+3 гончие', 3, LV7, ['pack-leader', 'thorn-hound', 'thorn-hound', 'thorn-hound'], ''],
  ['У: страж лощин+2 гончие', 3, LV7, ['glen-warden', 'thorn-hound', 'thorn-hound'], ''],
  ['У: следопыт+егерь+гончая', 3, LV7, ['tracker-hunter', 'bone-ranger', 'thorn-hound'], ''],
  ['У: ворон', 3, LV7, ['keen-raven'], ''],
  ['У: тихий хищник (6)', 3, LV6, ['silent-predator'], ''],
  ['П: 3 жука/гончие', 3, LV7, ['coal-beetle', 'ember-salamander', 'ember-salamander'], ''],
  ['П: голем+жук+гончая', 3, LV7, ['brazier-golem', 'coal-beetle', 'ember-salamander'], ''],
  ['П: 2 голема+гончая', 3, LV7, ['brazier-golem', 'brazier-golem', 'ember-salamander'], ''],
  ['П: жнец+2 гончие', 3, LV7, ['ember-reaper', 'ember-salamander', 'ember-salamander'], ''],
  ['П: змей+жук', 3, LV7, ['magma-wyrm', 'coal-beetle'], ''],
  ['П: палач+жук', 3, LV7, ['ash-executioner', 'coal-beetle'], ''],
  ['Л: краб+паук+краб', 3, LV7, ['trap-crab', 'wire-spider', 'trap-crab'], ''],
  ['Л: самострел+2', 3, LV7, ['bolt-golem', 'trap-crab', 'wire-spider'], ''],
  ['Л: 2 самострела+паук', 3, LV7, ['bolt-golem', 'bolt-golem', 'wire-spider'], ''],
  ['Л: мастер+2', 3, LV7, ['trap-master', 'trap-crab', 'wire-spider'], ''],
  ['Л: валун-жук+краб', 3, LV7, ['boulder-beetle', 'trap-crab'], ''],
  ['Л: королева+самострел (6)', 3, LV6, ['trap-queen', 'bolt-golem'], ''],
  ['П: кузнец+голем (6)', 3, LV6, ['forge-smith', 'brazier-golem'], ''],
  ['В: 3 плакальщицы/подкидыша', 3, LV7, ['mourner', 'changeling', 'changeling'], ''],
  ['В: пугало+2', 3, LV7, ['scarecrow', 'mourner', 'changeling'], ''],
  ['В: сова+2', 3, LV7, ['witch-owl', 'changeling', 'changeling'], ''],
  ['В: путник+плакальщица (призраки)', 3, LV7, ['lost-wanderer', 'mourner', 'changeling'], ''],
  ['В: тень служанки+2 плакальщицы', 3, LV7, ['maid-shade', 'mourner', 'mourner'], ''],
  ['В: кот+сова+подкидыш', 3, LV7, ['witch-cat', 'witch-owl', 'changeling'], ''],
  ['В: пугало+путник+подкидыш', 3, LV7, ['scarecrow', 'lost-wanderer', 'changeling'], ''],
  ['В: 2 образца+подкидыш', 3, LV7, ['failed-specimen', 'failed-specimen', 'changeling'], ''],
  ['В: след+2 подкидыша', 3, LV7, ['lost-trail', 'changeling', 'changeling'], ''],
  ['В: фонарщик (6)', 3, LV6, ['fog-lantern'], 'undead'],
  ['В: мимик (6)', 3, LV6, ['mimic'], 'undead'],
  ['К: 3 раба/мыши', 1, LV7, ['blood-slave', 'blood-bat', 'blood-slave'], 'undead'],
  ['К: гуль+2', 1, LV7, ['blood-ghoul', 'blood-slave', 'blood-bat'], 'undead'],
  ['К: слуга+жрец+раб', 1, LV7, ['vampire-servant', 'blood-priest', 'blood-slave'], 'undead'],
  ['К: лужа+гуль+мышь', 1, LV7, ['blood-puddle', 'blood-ghoul', 'blood-bat'], 'undead'],
  ['К: голем плоти+раб', 1, LV7, ['flesh-golem', 'blood-slave'], 'undead'],
  ['К: поганище+раб', 1, LV7, ['abomination', 'blood-slave'], 'undead'],
  ['К: Мордрейн+слуга', 1, LV7, ['death-knight', 'vampire-servant'], 'undead'],
  ['И: 3 беса/жука', 1, LV7, ['ice-imp', 'frost-beetle', 'ice-imp'], 'stone', { ice: 1 }],
  ['И: охотник+дух+бес', 1, LV7, ['snow-hunter', 'ice-spirit', 'ice-imp'], 'stone', { ice: 1 }],
  ['И: мамонтёнок+бес', 1, LV7, ['mammoth-calf', 'ice-imp'], 'stone', { ice: 1 }],
  ['И: Арктический Сребророг+бес', 1, LV7, ['ice-deer', 'ice-imp'], 'stone', { ice: 1 }],
  ['И: Грольф+бес', 1, LV7, ['half-troll', 'ice-imp'], 'stone', { ice: 1, big: 1 }],
  ['Пе: стервятник+скорпион+личинка', 1, LV7, ['sand-vulture', 'sand-scorpion', 'worm-larva'], 'beast', { sand: 1 }],
  ['Пе: червь+жало+скорпион', 1, LV7, ['sand-worm', 'big-stinger', 'sand-scorpion'], 'beast', { sand: 1 }],
  ['Пе: кактус+жало+стервятник', 1, LV7, ['pseudo-cactus', 'big-stinger', 'sand-vulture'], 'beast', { sand: 1 }],
  ['Пе: миражный скорпион+скорпион', 1, LV7, ['mirage-scorpion', 'sand-scorpion'], 'beast', { sand: 1 }],
  ['Пе: стервятник мёртвых земель+падальщик', 1, LV7, ['dead-vulture', 'sand-vulture'], 'beast', { sand: 1 }],
  ['Пе: Кель', 1, LV7, ['kel-worm'], 'beast', { sand: 1 }],
  ['Ш: 3 шахтёра/кобольда/слизь', 1, LV7, ['goblin-miner', 'kobold', 'slime'], 'goblin', { mine: 1 }],
  ['Ш: страж+подрывник+кобольд', 1, LV7, ['kobold-guard', 'goblin-blaster', 'kobold'], 'goblin', { mine: 1 }],
  ['Ш: кислотная+каменная+делящаяся', 1, LV7, ['acid-slime', 'stone-slime', 'split-slime'], 'goblin', { mine: 1 }],
  ['Ш: призрак+вагонетка+слизь (тьма)', 1, LV7, ['mine-ghost', 'cart-mimic', 'slime'], 'goblin', { mine: 4 }],
  ['Ш: глава стражи+страж', 1, LV7, ['kobold-captain', 'kobold-guard'], 'goblin', { mine: 2 }],
  ['Ш: главный прораб+шахтёр', 1, LV7, ['goblin-foreman', 'goblin-miner'], 'goblin', { mine: 3 }],
  ['Ш: Римуру+слизь', 1, LV7, ['rimuru', 'slime'], 'goblin', { mine: 5 }],
  ['Г: противный+3 гоблина', 2, 3, ['nasty-goblin', 'goblin', 'goblin-sword', 'goblin-spear'], 'goblin'],
  ['Г: провокатор+3 гоблина', 2, 3, ['goblin-provoker', 'goblin', 'goblin-archer', 'goblin-spear'], 'goblin'],
].filter(c => !ONLY || c[0].includes(ONLY));
const BUILDS = {
  // сборка: раса, статы, руки, тело
  'танк (кольчуга+щит)': { race: 'human', base: { str: 16, dex: 10, con: 15, int: 8, wis: 12, cha: 10 }, main: 'sword', off: 'shield', body: 'chainmail' },
  'танк сталь+ростовой': { race: 'dwarf', base: { str: 16, dex: 10, con: 16, int: 8, wis: 12, cha: 8 }, main: 'tower-shield', body: 'chainmail', steel: true },
  'ловкач (кожа, рапира+кинжал)': { race: 'human', base: { str: 10, dex: 18, con: 13, int: 10, wis: 12, cha: 10 }, main: 'rapier', off: 'dagger', body: 'leather' },
  'ловкач без брони (2 кинжала)': { race: 'fairy', base: { str: 8, dex: 18, con: 12, int: 10, wis: 12, cha: 12 }, main: 'dagger', off: 'dagger', body: 'clothes' },
  'стрелок (кожа, лук)': { race: 'human', base: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 10 }, main: 'shortbow', off: 'dagger', body: 'leather' },
  'два меча (шкура)': { race: 'human', base: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 10 }, main: 'sword', off: 'sword', body: 'hide' },
  'средний щит (шкура, меч+щит)': { race: 'human', base: { str: 15, dex: 14, con: 14, int: 8, wis: 12, cha: 10 }, main: 'sword', off: 'shield', body: 'hide' },
  'средний копьё (шкура, копьё+щит)': { race: 'dwarf', base: { str: 15, dex: 12, con: 15, int: 8, wis: 12, cha: 10 }, main: 'spear', off: 'shield', body: 'hide' },
  'сталь: меч+щит (кольчуга)': { race: 'human', base: { str: 16, dex: 12, con: 15, int: 8, wis: 12, cha: 10 }, main: 'sword', off: 'shield', body: 'chainmail', steel: true },
  'сталь: двуручный (шкура)': { race: 'barbarian', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 }, main: 'greatsword', body: 'hide', steel: true },
  'сталь: рапира (кожа)': { race: 'human', base: { str: 10, dex: 18, con: 13, int: 10, wis: 12, cha: 10 }, main: 'rapier', off: 'dagger', body: 'leather', steel: true },
  'сталь: лук (кожа)': { race: 'human', base: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 10 }, main: 'longbow', body: 'leather', steel: true },
  'варвар двуручный': { race: 'barbarian', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 }, main: 'greatsword', body: 'hide' },
};
const PARTIES = process.env.STEEL ? [['сталь: меч', 'сталь: двуруч', 'сталь: рапира', 'сталь: лук']] : [
  ['танк (', 'танк сталь', 'средний щит', 'стрелок'],
  ['средний щит', 'средний копьё', 'два меча', 'варвар'],
  ['танк (', 'средний щит', 'ловкач (', 'стрелок'],
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto(`file://${ROOT}/index.html`); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `${ROOT}/assets/js/${f}.js` });
  const rep = await p.evaluate(async ({ N, CASES, BUILDS, PARTIES }) => {
    const keys = Object.keys(BUILDS), find = s => keys.find(k => k.startsWith(s)) || (() => { throw new Error('нет сборки ' + s); })();
    const mk = (name, i, lvl) => {
      const h = BUILDS[name];
      const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: h.race, level: lvl });
      c.base = { ...h.base }; c.equip = { main: { t: 'w', id: h.main, ...(h.steel ? { steel: true } : {}) } };
      if (h.off) c.equip.off = { t: 'w', id: h.off, ...(h.steel ? { steel: true } : {}) };
      c.equip.body = h.body === 'clothes' ? { t: 'g', id: 'clothes' } : { t: 'a', id: h.body, ...(h.steel ? { steel: true } : {}) };
      if (h.race === 'barbarian' && h.off) c.giantGrip = true;
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.equip.body = h.body === 'clothes' ? { t: 'g', id: 'clothes' } : { t: 'a', id: h.body, ...(h.steel ? { steel: true } : {}) };
      c.hp = maxHp(c); c.mp = maxMp(c); return c;
    };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: true };
    const out = { cases: [], heroes: {} };
    for (const party of PARTIES) for (const [label, floor, lvl, list, zone, xo] of CASES) {
      const names = party.map(find);
      let win = 0, wipe = 0, rounds = 0; const per = names.map(() => ({ down: 0, dead: 0, hp: 0, hpTot: 0 }));
      let info = null;
      for (let i = 0; i < N; i++) {
        try {
          state.party = names.map((n, j) => mk(n, j, lvl)); if (/^В:/.test(label)) state.party.forEach(c => { if (c.equip.main) c.equip.main.salt = true; });          // лес: у отряда оружие с солью (призраки) state.run.floor = floor; state.run.status = {};
          state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3 }; });
          if (!info) info = state.party.map(c => { const d = derived(totals(c), c); return `${d.ac}${d.prot != null ? '/' + d.prot : ''} ОЗ ${maxHp(c)}`; });
          const L2 = list === 'KING' ? kingEscort() : list; const z = zone || (MONSTERS.find(x => x.id === L2[0]) || {}).zone || 'stone'; if (xo && xo.big) state.party.forEach(c => { (c.bag ||= []).push({ t: 'g', id: 'torch', qty: 3 }); }); const iceX = xo && xo.mine ? { place: 'Зелёная шахта', mineLevel: xo.mine, dark: xo.mine === 4 } : xo && xo.sand ? { place: 'Зыбучие пески', big10: true } : xo && xo.ice ? { place: 'Ледяной грот', big10: true, bigBrazier: !!xo.big, cold: Object.fromEntries(state.party.map(c => [c.id, 0])) } : {}; const r = await Battle.sim({ list: L2.slice(), zone: z, floor, ambush: false, kind: 'hard', title: 't', ...iceX }); const S = r.S;
          if (r.outcome === 'win' || r.outcome === 'retreat') win++;
          const hs = S.units.filter(u => u.side === 'hero' && !u.summon && u.hero);
          if (hs.every(u => u.down || u.dead || !u.alive)) wipe++;
          hs.forEach(u => { const k = state.party.findIndex(c => c.id === u.ref); if (k < 0) return; if (u.down || u.dead) per[k].down++; if (u.dead) per[k].dead++; per[k].hp += u.maxHp - Math.max(0, u.hp); per[k].hpTot += u.maxHp; });
          rounds += r.rounds; Battle.S = null;
        } catch (e) { out.err = String(e && e.stack).slice(0, 300); Battle.S = null; }
      }
      out.cases.push({ party: party.join(', '), label, win: Math.round(win / N * 100), wipe: Math.round(wipe / N * 100), rounds: +(rounds / N).toFixed(1), info,
        per: per.map((x, k) => ({ n: names[k], down: Math.round(x.down / N * 100), dead: Math.round(x.dead / N * 100), lost: x.hpTot ? Math.round(x.hp / x.hpTot * 100) : 0 })) });
      names.forEach((n, k) => { const H = out.heroes[n] ||= { fights: 0, down: 0, dead: 0 }; H.fights += N; H.down += per[k].down; H.dead += per[k].dead; });
    }
    return out;
  }, { N, CASES, BUILDS, PARTIES });
  console.log(JSON.stringify(rep));
  if (errs.length) console.error('errs', errs.slice(0, 5));
  await b.close();
})();
