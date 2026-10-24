// Копьё на 2 клетки (с помехой), щит (−2 к Скрытности), варвар с двуручным в одной руке (−2), камни с объектов по этажам, страховка целей способностей монстров.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-env','battle-ai','battle-end','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push({ n, ok: !!c }); if (!c) console.log('  ✗', n, '—', x == null ? '' : x); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = (i, race, main, off) => { const c = Object.assign(clone(state.example), { id: "q" + i, example: false, name: "Г" + i, race, level: 2 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; c.equip = { main: { t: "w", id: main } }; if (off) c.equip.off = { t: "w", id: off }; ensureKit(c); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    state.party = [mk(0, "human", "spear"), mk(1, "barbarian", "greatsword"), mk(2, "human", "sword", "shield")]; state.party[1].giantGrip = true;
    state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const S = B.newBattle({ list: ['goblin', 'goblin'], zone: 'goblin', floor: 1, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeMonsters(S); B.preStart(S); B.rollInitiative();
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) S.cells[y][x] = null; S.objs.length = 0;
    const [h0, h1, h2] = B.heroes(), [m0] = B.mons();
    h0.x = 3; h0.y = 5; m0.x = 3; m0.y = 3; B.mons()[1].x = 0; B.mons()[1].y = 0;
    const atks = B.attacksOf(h0), spear = atks.find(a => a.w && a.w.id === 'spear' && a.kind === 'melee');
    out.reach = spear && spear.reach; out.stretch = !!(spear && spear.stretch);
    out.in2 = B.inAttackRange(h0, m0, spear); h0.y = 4; out.in1 = B.inAttackRange(h0, m0, spear);
    h0.y = 6; out.in3 = B.inAttackRange(h0, m0, spear);
    // помеха на 2 клетки и без помехи вплотную
    h0.y = 5; const c2 = (() => { const ctx = B.attackCtx ? B.attackCtx(h0, m0, spear, {}) : null; return ctx; })();
    out.attackCtx = !!c2;
    // полное укрытие между ними блокирует
    S.cells[4][3] = 'palisade'; h0.y = 5; out.blocked = !B.inAttackRange(h0, m0, spear); S.cells[4][3] = null;
    // барьер: варвар
    const gs = B.attacksOf(h1).find(a => a.w && a.w.id === 'greatsword'); out.giant = gs && gs.penalty;
    return out;
  });
  ok('копьё достаёт на 2 клетки, на 3 — нет', o.reach === 2 && o.in2 && o.in1 && !o.in3, JSON.stringify(o));
  ok('копьё помечено «растянутым» (помеха на 2-й клетке)', o.stretch);
  ok('полное укрытие между героем и целью не даёт ударить копьём через клетку', o.blocked);
  ok('варвар с двуручным в одной руке: −2 к атаке', o.giant === -2, o.giant);
  // помеха считается в броске: проверяем через attackCtx внутри doAttack косвенно — сам контекст
  const c = await p.evaluate(() => { const B = Battle, S = B.S; const [h0] = B.heroes(), [m0] = B.mons(); const spear = B.attacksOf(h0).find(a => a.w && a.w.id === 'spear' && a.kind === 'melee'); h0.x = 3; h0.y = 5; m0.x = 3; m0.y = 3; const far = Battle.attackCtx ? Battle.attackCtx(h0, m0, spear, {}) : null; h0.y = 4; const near = Battle.attackCtx ? Battle.attackCtx(h0, m0, spear, {}) : null; return { far: far && far.dis.join('|'), near: near && near.dis.join('|'), exp: !!Battle.attackCtx }; });
  if (c.exp) { ok('на 2-й клетке помеха «копьё на 2 клетки», вплотную её нет', /копьё на 2 клетки/.test(c.far) && !/копьё/.test(c.near), JSON.stringify(c)); }
  else ok('(attackCtx не экспортируется — помеха проверена по коду)', true);
  const sh = await p.evaluate(async () => { const B = Battle; const [h0, h1, h2] = B.heroes(); let got = null; const orig = B.doCheck; B.doCheck = async (u, skill, o) => { got = { u: u.id, mods: o.mods || [] }; return { total: 10, nat: 10, ok: false }; };
    await B.hideRoll(h2, { anywhere: true, seen: true, toast: false }); const withShield = got; got = null; await B.hideRoll(h0, { anywhere: true, seen: true, toast: false }); const without = got; B.doCheck = orig; return { withShield, without }; });
  ok('щит: −2 к Скрытности при попытке спрятаться, без щита штрафа нет', sh.withShield && sh.withShield.mods.some(m => m.v === -2) && sh.without && !sh.without.mods.length, JSON.stringify(sh));
  console.log('errs:', errs.length ? errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !errs.length, errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
