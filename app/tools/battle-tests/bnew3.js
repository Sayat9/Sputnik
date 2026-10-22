// Решения автора: умения-перемещения сверх обычного движения, кинжал (лёгкое оружие, стартовое), «Нож в спину» только лёгким.
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
    const R = [], ok = (name, cond, extra) => R.push({ name, ok: !!cond, extra: extra == null ? '' : String(extra) });
    const B = Battle;
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const Q = [], realGRV = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, writable: true, value: arr => { if (Q.length) { arr[0] = Q.shift(); return arr; } return realGRV(arr); } });
    const F = (...rs) => { Q.length = 0; for (const r of rs) Q.push(r - 1); for (let i = 0; i < 80; i++) Q.push(9); };
    const mk = (i, o = {}) => { const c = Object.assign(clone(state.example), { id: 'e' + i, example: false, name: 'Г' + i, race: 'human', level: 2 }); c.base = { str: 14, dex: 16, con: 12, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: o.main || 'sword' } }; if (o.off) c.equip.off = { t: 'w', id: o.off }; delete c.bag; delete c.kit; delete c.hp; c.essences = o.ess || []; ensureKit(c); c.mp = maxMp(c); return c; };
    const setup = (specs, list) => { const hs = specs.map((s, i) => mk(i, s)); state.party = hs; state.run.status = {}; hs.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; }); B.cfg.fast = true; const S = B.newBattle({ list, zone: 'goblin' }); S.opts.autoHeroes = true; for (const row of S.cells) row.fill(''); S.objs.length = 0; B.mons().forEach(m => { m.ac = 1; m.maxHp = m.hp = 300; }); return S; };
    const T = u => { B.S.curId = u.id; u.t = Object.assign({ move: B.speedOf(u), action: 1, bonus: 1, react: 1, dash: false, disengage: false, attacked: false, riteUsed: false, objUsed: false, moved: 0, startX: u.x, startY: u.y }, {}); };
    // --- #31: перемещение умением не отнимает обычное движение ---
    {
      const S = setup([{ ess: ['goblin-assassin'], main: 'dagger' }], ['goblin']); const H = B.heroes()[0], G = B.mons()[0];
      H.x = 3; H.y = 5; G.x = 0; G.y = 0; T(H); const mv0 = H.t.move; F(20);
      await B.useActive(H, 'goblin-assassin', { cell: [2, 6] });
      ok('Уход в тень: обычное движение не уменьшилось', H.t.move === mv0, mv0 + ' → ' + H.t.move);
      ok('Уход в тень: герой на новой клетке', H.x === 2 && H.y === 6);
      H.t.move = 0; ok('при нулевом остатке движения умение-перемещение всё равно доступно (если есть бонусное действие и мана)', B.actionsFor(H).length > 0);
    }
    // --- #33: кинжал ---
    {
      ok('кинжал есть в справочнике: 1к4, лёгкое', (() => { const w = WEAPONS.find(x => x.id === 'dagger'); return w && /1к4/.test(w.dmg) && w.props.includes('Лёгкое'); })(), JSON.stringify(WEAPONS.find(x => x.id === 'dagger')));
      ok('картинка кинжала в ART', /dagger/.test(ART.weapon('dagger')), ART.weapon('dagger'));
      const S = setup([{ ess: ['goblin-assassin'], main: 'dagger', off: 'dagger' }, { ess: ['goblin-assassin'], main: 'sword' }], ['goblin']); const [A, Sw] = B.heroes(), G = B.mons()[0];
      const la = B.heroAttacks(A).filter(a => a.kind === 'melee'); ok('два кинжала: основной и левая рука доступны', la.length >= 2, la.map(a => a.id + ':' + (a.offhand ? 'off' : 'main')).join(','));
      A.x = 3; A.y = 5; Sw.x = 5; Sw.y = 5; G.x = 3; G.y = 4;
      const swAtk = B.heroAttacks(Sw).find(a => a.kind === 'melee' && a.w);
      ok('обычный меч — не лёгкое оружие', !(swAtk.w.props || []).includes('Лёгкое'));
      B.addStatus(Sw, 'hidden', { k: Infinity }); T(Sw); F(15); const r = await B.doAttack(Sw, G, swAtk, { cancelable: false, onCommit: () => B.commitAttack(Sw, swAtk, G) });
      ok('«Нож в спину» мечом не срабатывает', r.hit && !r.parts.some(p => p.label === 'Нож в спину'), JSON.stringify(r.parts && r.parts.map(p => p.label)));
      const dAtk = la.find(a => !a.offhand); B.addStatus(A, 'hidden', { k: Infinity }); T(A); F(15); const r2 = await B.doAttack(A, G, dAtk, { cancelable: false, onCommit: () => B.commitAttack(A, dAtk, G) });
      ok('«Нож в спину» кинжалом срабатывает', r2.hit && r2.parts.some(p => p.label === 'Нож в спину'), JSON.stringify(r2.parts && r2.parts.map(p => p.label)));
    }
    return { R };
  });
  const bad = out.R.filter(r => !r.ok);
  console.log(`проверок: ${out.R.length}, не прошли: ${bad.length}`);
  for (const r of bad) console.log('  ✗', r.name, '—', r.extra);
  if (process.env.VERBOSE) for (const r of out.R.filter(r => r.ok)) console.log('  ✓', r.name);
  console.log('page errors:', [...new Set(errs)].slice(0, 10));
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
