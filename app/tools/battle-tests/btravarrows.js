// Путник-лучник: 20–40 стрел, тратятся и ломаются по правилам, без стрел — бьёт кулаком; целые стрелы и остаток в колчане — отряду
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + JSON.stringify(x)); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 1 }); c.base = { str: 14, dex: 12, con: 16, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.bag = []; return c; };
    newRun(); state.run.status = {};
    // генерация: у лучников 20–40 стрел, у остальных нет
    const ar = []; for (let k = 0; k < 40; k++) for (const t of genTravelers(1)) ar.push([t.weapon, t.carry.arrows]);
    out.genOk = ar.every(([w, a]) => /bow$/.test(w) ? a >= 20 && a <= 40 : a == null); out.bows = ar.filter(([w]) => /bow$/.test(w)).length;
    // бой: лучник с 2 стрелами
    const t = genTravelers(1)[0]; t.weapon = 'shortbow'; t.carry.arrows = 2; t.base.dex = 16; delete Battle.D.mon[t.id]; travPurge(); travRestore();
    state.party = [mk(0), mk(1)]; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const S = B.newBattle({ list: [t.id], zone: 'goblin', floor: 1 }); B.placeMonsters(S);
    const u = B.mons()[0]; out.arrowsStart = u.arrows; out.atks = B.attacksOf(u).map(a => a.kind + ':' + a.n);
    const h = B.heroes()[0]; h.hp = h.maxHp = 500;
    for (let i = 0; i < 2; i++) { const atk = B.attacksOf(u).find(a => a.kind === 'ranged'); await B.doAttack(u, h, atk); }
    out.left = u.arrows; out.afterAtks = B.attacksOf(u).map(a => a.kind); out.drops = S.drops.filter(d => d.kind === 'arrow' && d.mon).length;
    // итог: отряд победил — целые стрелы с поля и остаток в колчане (0) — отряду
    const before = state.party.reduce((s, c) => s + countGear(c, 'arrow'), 0);
    u.alive = false; S.killed.push(0); B.End.cleanup(S, 'win');
    out.gained = state.party.reduce((s, c) => s + countGear(c, 'arrow'), 0) - before; out.spec = t.carry.arrows; out.gear = (S.gear || []).map(g => g.t);
    // добыча с колчана убитого
    t.carry.arrows = 7; t.carry.looted = false; out.loot = travLoot([t.id]);
    return out;
  });
  console.log(JSON.stringify(o));
  ok('лучники путников получают 20–40 стрел, остальные — нет', o.genOk && o.bows > 0, o);
  ok('в бою стрелы считаются, есть запасной удар кулаком', o.arrowsStart === 2 && o.atks.some(a => /кулаком/.test(a)), o);
  ok('после 2 выстрелов стрел 0 — из лука не стреляет', o.left === 0 && !o.afterAtks.includes('ranged'), o);
  ok('целые стрелы с поля — отряду, остаток колчана записан', o.gained === o.drops && o.spec === 0, o);
  ok('добыча: остаток колчана убитого', o.loot.some(l => /стрел/i.test(l)), o.loot);
  ok('нет ошибок', !errs.length, errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close();
})();
