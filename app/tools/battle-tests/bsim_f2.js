// Автобои с каждым монстром 2 этажа (боевая запись из статблока): исключения, зависания, инварианты.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-env','battle-ai','battle-end','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const out = await p.evaluate(async () => {
    const B = Battle, R = [], ok = (name, cond, extra) => R.push({ name, ok: !!cond, extra: extra == null ? '' : String(extra) });
    state.run = state.run || { floor: 2, pos: { x: 5, y: 5 }, status: {}, light: false };
    const mk = (i, o = {}) => { const c = Object.assign(clone(state.example), { id: 'e' + i, example: false, name: 'Г' + i, race: 'human', level: 2 }); c.base = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: o.main || 'sword' } }; delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.mp = maxMp(c); return c; };
    const ids = MONSTERS.filter(m => m.floor === 2 && m.abil && m.traits && m.traits.some(t => t[2] === 'attacks')).map(m => m.id);
    ok('есть монстры 2 этажа со статблоком', ids.length >= 28, ids.length);
    const zoneOf = id => MONSTERS.find(m => m.id === id).zone;
    let bad = [], rounds = 0, n = 0;
    for (const id of ids) for (let rep = 0; rep < 3; rep++) {
      const hs = [mk(1, { main: rep ? 'warhammer' : 'sword' }), mk(2, { main: 'shortbow' }), mk(3)]; state.party = hs; state.run.status = {}; hs.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      B.cfg.fast = true;
      try {
        const list = Array(1 + (rep % 2) + (MONSTERS.find(m => m.id === id).cls === 9 ? 2 : 0)).fill(id);
        const S = await B.start({ list, zone: zoneOf(id), floor: 2, ambush: rep === 2, killed: [] }, { sim: true, autoHeroes: true });
        n++; rounds += S.round; if (!S.outcome) bad.push(id + ': нет исхода');
        for (const u of B.S.units) if (!(u.hp >= 0) || u.hp > u.maxHp) bad.push(id + ': ОЗ ' + u.hp);
      } catch (e) { bad.push(id + ': ' + (e && e.message)); }
    }
    ok('боёв без ошибок: ' + n, bad.length === 0, bad.slice(0, 8).join(' | '));
    const noAtk = ids.filter(id => { const m = MONSTERS.find(x => x.id === id); const cb = D_mon(id); return !cb || !cb.atk.length; });
    function D_mon(id) { return B.D.mon[id]; }
    ok('у каждого есть атаки', noAtk.length === 0, noAtk.join(','));
    return { R, rounds: rounds / Math.max(1, n) };
  });
  const bad = out.R.filter(r => !r.ok);
  console.log(`проверок: ${out.R.length}, не прошли: ${bad.length}; среднее раундов: ${out.rounds.toFixed(1)}`);
  for (const r of bad) console.log('  ✗', r.name, '—', r.extra);
  console.log('page errors:', [...new Set(errs)].slice(0, 10));
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
