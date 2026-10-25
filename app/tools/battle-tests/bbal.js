// Баланс: фиксированный отряд из 3 героев 1 уровня против каждого монстра 1 этажа (1–3 штуки), headless.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle'];
const N = +process.argv[2] || 30, LEVEL = +process.argv[3] || 1;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async ({ N, LEVEL }) => {
    const mons1 = MONSTERS.filter(m => m.floor === 1 && !m.draft);
    const presets = [
      { race: 'barbarian', main: 'sword', off: 'shield', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 } },
      { race: 'human', main: 'shortbow', base: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 } },
      { race: 'dwarf', main: 'warhammer', off: 'shield', base: { str: 15, dex: 10, con: 16, int: 10, wis: 12, cha: 8 } },
    ];
    const mk = (h, i) => {
      const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: h.race, level: LEVEL });
      c.base = { ...h.base }; c.equip = { main: { t: 'w', id: h.main } }; if (h.off) c.equip.off = { t: 'w', id: h.off };
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.mp = maxMp(c); return c;
    };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const out = [];
    for (const m of mons1) {
      const counts = m.cls === 8 ? [1] : [1, 2, 3];
      for (const cnt of counts) {
        let win = 0, ret = 0, flee = 0, def = 0, downs = 0, dead = 0, rounds = 0, hpLost = 0, hpTot = 0;
        for (let i = 0; i < N; i++) {
          state.party = presets.map(mk); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
          const ev = { list: Array(cnt).fill(m.id), zone: m.zone, ambush: Math.random() < .2, kind: 'hard', title: 't' };
          const r = await Battle.sim(ev); const S = r.S;
          if (r.outcome === 'win') win++; else if (r.outcome === 'retreat') ret++; else flee++;
          if (S.units.filter(u => u.side === 'hero').every(u => u.down || u.dead)) def++;
          for (const u of S.units.filter(u => u.side === 'hero')) { if (u.down) downs++; if (u.dead) dead++; hpLost += u.maxHp - Math.max(0, u.hp); hpTot += u.maxHp; }
          rounds += r.rounds; Battle.S = null;
        }
        out.push({ m: m.id, cls: m.cls, cnt, win: Math.round(win / N * 100), retreat: Math.round(ret / N * 100), other: Math.round(flee / N * 100), wipe: Math.round(def / N * 100), downPerBattle: +(downs / N).toFixed(2), deadPerBattle: +(dead / N).toFixed(2), hpLostPct: Math.round(hpLost / hpTot * 100), rounds: +(rounds / N).toFixed(1) });
      }
    }
    return out;
  }, { N, LEVEL });
  console.log('монстр'.padEnd(18), 'кл', 'шт', 'победа%', 'бегство%', 'прочее%', 'wipe%', 'нокаутов', 'смертей', 'потеря ОЗ%', 'раундов');
  for (const r of rep) console.log(r.m.padEnd(18), String(r.cls).padStart(2), String(r.cnt).padStart(2), String(r.win).padStart(7), String(r.retreat).padStart(8), String(r.other).padStart(7), String(r.wipe).padStart(5), String(r.downPerBattle).padStart(8), String(r.deadPerBattle).padStart(7), String(r.hpLostPct).padStart(9), String(r.rounds).padStart(7));
  console.log('errs', errs.slice(0, 5));
  await b.close();
})();
