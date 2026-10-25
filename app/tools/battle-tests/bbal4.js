// Баланс 7–8 класса: отряд из 4 героев 1 уровня со стартовыми наборами против одиночек и стандартных групп.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
const N = +process.argv[2] || 40, ONLY = process.argv[3] || '';
const G = (id, n) => Array(n).fill(id);
const CASES = [
  // [monster, floor, label, list]
  ['hobgoblin',1,'1',G('hobgoblin',1)], ['hobgoblin',1,'+3 гоблина',[...G('hobgoblin',1),...G('goblin',3)]],
  ['dark-bear',1,'1',G('dark-bear',1)], ['skeleton-warrior',1,'1',G('skeleton-warrior',1)], ['stone-guardian',1,'1',G('stone-guardian',1)],
  ['goblin-assassin',2,'1',G('goblin-assassin',1)], ['goblin-assassin',2,'2',G('goblin-assassin',2)],
  ['goblin-trapper',2,'1',G('goblin-trapper',1)], ['goblin-trapper',2,'+2 гоблина',[...G('goblin-trapper',1),...G('goblin',2)]],
  ['goblin-elder',2,'1',G('goblin-elder',1)], ['goblin-elder',2,'+3 гоблина',[...G('goblin-elder',1),...G('goblin',3)]],
  ['hobgoblin-brute',2,'1',G('hobgoblin-brute',1)], ['hobgoblin-brute',2,'3',G('hobgoblin-brute',3)],
  ['hobgoblin-thrower',2,'1',G('hobgoblin-thrower',1)], ['hobgoblin-thrower',2,'3',G('hobgoblin-thrower',3)],
  ['hobgoblin-driver',2,'1',G('hobgoblin-driver',1)], ['hobgoblin-driver',2,'+4 гоблина',[...G('hobgoblin-driver',1),...G('goblin',4)]],
  ['hobgoblin-shield',2,'1',G('hobgoblin-shield',1)], ['hobgoblin-shield',2,'3',G('hobgoblin-shield',3)],
  ['dire-wolf',2,'1',G('dire-wolf',1)], ['dire-wolf',2,'+3 волка',[...G('dire-wolf',1),...G('wolf',3)]],
  ['web-spider',2,'1',G('web-spider',1)], ['web-spider',2,'3',G('web-spider',3)],
  ['whisperer',2,'1',G('whisperer',1)], ['mirror-dead',2,'1',G('mirror-dead',1)], ['gravedigger',2,'1',G('gravedigger',1)],
  ['plague-fat',2,'1',G('plague-fat',1)], ['ash-spirit',2,'1',G('ash-spirit',1)], ['ash-spirit',2,'+пепельник',['ash-spirit','ash-wraith']],
  ['goblin-king',2,'1',G('goblin-king',1)], ['goblin-king',2,'+4 гоблина',[...G('goblin-king',1),...G('goblin',4)]],
  ['goblin-bomber',2,'1',G('goblin-bomber',1)], ['goblin-bomber',2,'+3 щитоносца',[...G('goblin-bomber',1),...G('hobgoblin-shield',3)]],
  ['goblin-thief',2,'1',G('goblin-thief',1)], ['goblin-thief',2,'+3 гоблина',[...G('goblin-thief',1),...G('goblin',3)]],
  ['werewolf',2,'1',G('werewolf',1)], ['werewolf',2,'+4 волка',[...G('werewolf',1),...G('wolf',4)]],
  ['giant-mole',2,'1',G('giant-mole',1)], ['swamp-fang',2,'1',G('swamp-fang',1)], ['spider-queen',2,'1',G('spider-queen',1)],
  ['blackwing',2,'1',G('blackwing',1)], ['blackwing',2,'+4 вороны',[...G('blackwing',1),...G('crow',4)]],
  ['faceless-ringer',2,'1',G('faceless-ringer',1)], ['bone-knight',2,'1',G('bone-knight',1)], ['bone-knight',2,'+3 скелета',[...G('bone-knight',1),...G('skeleton',3)]],
  ['corpse-eater',2,'1',G('corpse-eater',1)], ['ash-wraith',2,'1',G('ash-wraith',1)],
].filter(c => !ONLY || c[0] === ONLY).filter((c, i) => !process.argv[4] || i % +process.argv[4].split('/')[1] === +process.argv[4].split('/')[0]);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async ({ N, CASES }) => {
    const presets = [
      { race: 'barbarian', main: 'sword', off: 'shield', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 } },
      { race: 'human', main: 'sword', off: 'shield', base: { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 } },
      { race: 'human', main: 'shortbow', off: 'dagger', base: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 } },
      { race: 'barbarian', main: 'greatsword', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 } },
    ];
    const mk = (h, i) => {
      const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: h.race, level: 1 });
      c.base = { ...h.base }; c.equip = { main: { t: 'w', id: h.main } }; if (h.off) c.equip.off = { t: 'w', id: h.off };
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.mp = maxMp(c); return c;
    };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const out = [];
    for (const [mid, floor, label, list] of CASES) {
      const m = MONSTERS.find(x => x.id === mid);
      let win = 0, ret = 0, flee = 0, wipe = 0, downs = 0, dead = 0, rounds = 0, hpLost = 0, hpTot = 0, err = '';
      for (let i = 0; i < N; i++) {
        try {
          state.party = presets.map(mk); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
          const r = await Battle.sim({ list, zone: m.zone, floor, ambush: false, kind: 'hard', title: 't' }); const S = r.S;
          if (r.outcome === 'win') win++; else if (r.outcome === 'retreat') ret++; else flee++;
          if (S.units.filter(u => u.side === 'hero').every(u => u.down || u.dead)) wipe++;
          for (const u of S.units.filter(u => u.side === 'hero')) { if (u.down) downs++; if (u.dead) dead++; hpLost += u.maxHp - Math.max(0, u.hp); hpTot += u.maxHp; }
          rounds += r.rounds; Battle.S = null;
        } catch (e) { err = String(e && e.message); Battle.S = null; }
      }
      out.push({ m: mid, cls: m.cls, label, win: Math.round(win / N * 100), ret: Math.round(ret / N * 100), flee: Math.round(flee / N * 100), wipe: Math.round(wipe / N * 100), downs: +(downs / N).toFixed(2), dead: +(dead / N).toFixed(2), hp: Math.round(hpLost / hpTot * 100), rounds: +(rounds / N).toFixed(1), err });
    }
    return out;
  }, { N, CASES });
  console.log('монстр'.padEnd(18), 'кл', 'состав'.padEnd(14), 'побед%', 'отст%', 'бег%', 'wipe%', 'упали', 'погибли', 'ОЗ-%', 'раунд');
  for (const r of rep) console.log(r.m.padEnd(18), String(r.cls).padStart(2), r.label.padEnd(14), String(r.win).padStart(6), String(r.ret).padStart(5), String(r.flee).padStart(4), String(r.wipe).padStart(5), String(r.downs).padStart(5), String(r.dead).padStart(7), String(r.hp).padStart(4), String(r.rounds).padStart(5), r.err ? 'ERR ' + r.err : '');
  console.log('errs', errs.slice(0, 5));
  await b.close();
})();
