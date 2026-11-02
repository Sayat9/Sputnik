// Сравнение защиты (вариант Б, 02.11): смертность героев разных сборок до и после.
// node bdef.js [N] [корень приложения] — корень по умолчанию /home/user/app; старая копия — любой каталог с index.html и assets.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
const N = +process.argv[2] || 30, ROOT = process.argv[3] || '/home/user/app', ONLY = process.argv[4] || '', LV7 = +(process.env.LV7 || 3), LV6 = +(process.env.LV6 || 3);
const G = (id, n) => Array(n).fill(id);
// [метка, этаж, уровень, список монстров, зона]
const CASES = [          // [метка, этаж, уровень, монстры, зона, засада]
  // 8 класс — 2 уровень
  ['8: хобгоблин', 1, 2, ['hobgoblin'], 'goblin'],
  ['8: тёмный медведь', 1, 2, ['dark-bear'], 'beast'],
  ['8: скелет-воин', 1, 2, ['skeleton-warrior'], 'undead'],
  ['8: каменный сторож', 1, 2, ['stone-guardian'], 'stone'],
  ['8: тройка хобгоблинов', 2, 2, ['hobgoblin-brute', 'hobgoblin-thrower', 'hobgoblin-driver'], 'goblin'],
  ['8: матёрый волк+2 волка', 2, 2, ['dire-wolf', 'wolf', 'wolf'], 'beast'],
  ['8: могильщик+2 скелета', 2, 2, ['gravedigger', 'skeleton', 'skeleton'], 'undead'],
  ['8: кристаллоид+пёс', 2, 2, ['crystalloid', 'magma-hound'], 'stone'],
  ['8: орки ×3', 3, 2, ['orc-spear', 'orc-thrower', 'orc-scout'], 'orc'],
  ['8: засада громилы+2 гоблина', 2, 2, ['hobgoblin-brute', 'goblin-sword', 'goblin-archer'], 'goblin', true],
  // 7 класс — 3 уровень
  ['7: волколак', 2, 3, ['werewolf'], ''],
  ['7: крот-исполин', 2, 3, ['giant-mole'], ''],
  ['7: болотный клык', 2, 3, ['swamp-fang'], ''],
  ['7: паучиха-матка', 2, 3, ['spider-queen'], ''],
  ['7: трупоед', 2, 3, ['corpse-eater'], ''],
  ['7: пепельник', 2, 3, ['ash-wraith'], ''],
  ['7: костяной рыцарь+2', 2, 3, ['bone-knight', 'skeleton', 'skeleton'], ''],
  ['7: король+свита', 2, 3, 'KING', 'goblin'],
  ['7: гоблин-вор', 2, 3, ['goblin-thief'], 'goblin'],
  ['7: магмовый голем', 2, 3, ['magma-golem'], ''],
  ['7: кристальный колосс', 2, 3, ['crystal-colossus'], ''],
  ['7: дух бури', 2, 3, ['storm-spirit'], ''],
  ['7: палач+2 орка', 3, 3, ['orc-executioner', 'orc-spear', 'orc-thrower'], 'orc'],
  ['7: страж+2 орка', 3, 3, ['orc-guard', 'orc-spear', 'orc-scout'], 'orc'],
  ['7: засада волколака', 2, 3, ['werewolf'], '', true],
  // 6 класс — 3 и 4 уровень
  ['6: вождь+волк (3 ур.)', 3, 3, ['orc-chief', 'orc-wolf'], 'orc'],
  ['6: вождь+волк (4 ур.)', 3, 4, ['orc-chief', 'orc-wolf'], 'orc'],
  ['6: мимик (3 ур.)', 3, 3, ['mimic'], ''],
  ['6: хранитель тишины (4 ур.)', 3, 4, ['silence-keeper'], ''],
].filter(c => !ONLY || c[0].includes(ONLY));
const BUILDS = {
  // сборка: раса, статы, руки, тело
  'танк (кольчуга+щит)': { race: 'human', base: { str: 16, dex: 10, con: 15, int: 8, wis: 12, cha: 10 }, main: 'sword', off: 'shield', body: 'chainmail' },
  'танк сталь+ростовой': { race: 'dwarf', base: { str: 16, dex: 10, con: 16, int: 8, wis: 12, cha: 8 }, main: 'tower-shield', body: 'chainmail', steel: true },
  'ловкач (кожа, рапира+кинжал)': { race: 'human', base: { str: 10, dex: 18, con: 13, int: 10, wis: 12, cha: 10 }, main: 'rapier', off: 'dagger', body: 'leather' },
  'ловкач без брони (2 кинжала)': { race: 'fairy', base: { str: 8, dex: 18, con: 12, int: 10, wis: 12, cha: 12 }, main: 'dagger', off: 'dagger', body: 'clothes' },
  'стрелок (кожа, лук)': { race: 'human', base: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 10 }, main: 'shortbow', off: 'dagger', body: 'leather' },
  'два меча (шкура)': { race: 'human', base: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 10 }, main: 'sword', off: 'sword', body: 'hide' },
  'провокатор (кольчуга+щит, Угроза 2)': { race: 'human', base: { str: 16, dex: 10, con: 15, int: 8, wis: 12, cha: 10 }, main: 'sword', off: 'shield', body: 'chainmail', threat: 2 },
  'средний щит (шкура, меч+щит)': { race: 'human', base: { str: 15, dex: 14, con: 14, int: 8, wis: 12, cha: 10 }, main: 'sword', off: 'shield', body: 'hide' },
  'средний копьё (шкура, копьё+щит)': { race: 'dwarf', base: { str: 15, dex: 12, con: 15, int: 8, wis: 12, cha: 10 }, main: 'spear', off: 'shield', body: 'hide' },
  'варвар двуручный': { race: 'barbarian', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 }, main: 'greatsword', body: 'hide' },
};
const PARTIES = [
  ['танк (', 'танк сталь', 'средний щит', 'стрелок'],
  ['средний щит', 'средний копьё', 'два меча', 'варвар'],
  ['танк (', 'средний щит', 'ловкач (', 'стрелок'],
  ['провокатор', 'средний щит', 'ловкач (', 'стрелок'],
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto(`file://${ROOT}/index.html`); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `${ROOT}/assets/js/${f}.js` });
  const rep = await p.evaluate(async ({ N, CASES, BUILDS, PARTIES, VAR }) => {
    if (VAR.hp) Battle.D.monHpMult = VAR.hp; if (VAR.nocut) Battle.D.monDmgCut = {}; if (VAR.cap) Battle.D.protMaxShare = VAR.cap; if (VAR.dpc) Battle.D.monDmgPerCls = VAR.dpc;
    const keys = Object.keys(BUILDS), find = s => keys.find(k => k.startsWith(s)) || (() => { throw new Error('нет сборки ' + s); })();
    const mk = (name, i, lvl) => {
      const h = BUILDS[name];
      const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: h.race, level: lvl });
      c.base = { ...h.base }; c.equip = { main: { t: 'w', id: h.main, ...(h.steel ? { steel: true } : {}) } };
      if (h.off) c.equip.off = { t: 'w', id: h.off };
      c.equip.body = h.body === 'clothes' ? { t: 'g', id: 'clothes' } : { t: 'a', id: h.body, ...(h.steel ? { steel: true } : {}) };
      if (h.race === 'barbarian' && h.off) c.giantGrip = true;
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.equip.body = h.body === 'clothes' ? { t: 'g', id: 'clothes' } : { t: 'a', id: h.body, ...(h.steel ? { steel: true } : {}) };
      if (h.threat) c.threat = h.threat; c.hp = maxHp(c); c.mp = maxMp(c); return c;
    };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: true };
    const out = { cases: [], heroes: {} };
    for (const party of PARTIES) for (const [label, floor, lvl, list, zone, amb] of CASES) {
      const names = party.map(find);
      let win = 0, wipe = 0, rounds = 0; const per = names.map(() => ({ down: 0, dead: 0, hp: 0, hpTot: 0 }));
      let info = null;
      for (let i = 0; i < N; i++) {
        try {
          state.party = names.map((n, j) => mk(n, j, lvl)); state.run.floor = floor; state.run.status = {};
          state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3 }; });
          if (!info) info = state.party.map(c => { const d = derived(totals(c), c); return `${d.ac}${d.prot != null ? '/' + d.prot : ''} ОЗ ${maxHp(c)}`; });
          const L2 = list === 'KING' ? kingEscort() : list; const z = zone || (MONSTERS.find(x => x.id === L2[0]) || {}).zone || 'stone'; const r = await Battle.sim({ list: L2, zone: z, floor, ambush: !!amb, kind: 'hard', title: 't' }); const S = r.S;
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
  }, { N, CASES, BUILDS, PARTIES, VAR: { hp: +(process.env.MONHP || 0), nocut: !!process.env.NOCUT, cap: +(process.env.PCAP || 0), dpc: +(process.env.DPC || 0) } });
  console.log(JSON.stringify(rep));
  if (errs.length) console.error('errs', errs.slice(0, 5));
  await b.close();
})();
