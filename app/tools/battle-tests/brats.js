// Крысы: призыв, стена, зов дудки, разбегание, эссенции
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push({ n, ok: !!c }); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + (x == null ? '' : x)); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = { bad: [] };
    const mk = (i, main, off, ess) => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: i % 2 ? 'barbarian' : 'human', level: 1 }); c.base = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: main } }; if (off) c.equip.off = { t: 'w', id: off }; delete c.bag; delete c.kit; delete c.hp; c.essences = ess || []; ensureKit(c); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 2, pos: { x: 5, y: 5 }, status: {}, light: false };
    const party = () => { state.party = [mk(0, 'sword', 'shield'), mk(1, 'greatsword'), mk(2, 'shortbow', 'dagger'), mk(3, 'spear', 'shield')]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; }); };
    out.n = { rat: 0, king: 0, piper: 0 }; out.maxRats = 0; out.fled = 0;
    for (const [label, list] of [['rat', ['rat','rat','rat']], ['king', ['rat-king','rat','rat','rat']], ['piper', ['rat-catcher']]]) for (let i = 0; i < 8; i++) {
      party(); try { const r = await B.sim({ list, zone: 'goblin', floor: 2, kind: 'hard', title: 't' }); out.n[label]++; if (!r.outcome) out.bad.push(label + ': нет исхода');
        const S = r.S; if (label === 'piper') { out.maxRats = Math.max(out.maxRats, S.ratSeq || 0); if (S.units.some(u => u.kind === 'rat' && u.flags.fleeing)) out.fled++; }
        B.S = null; } catch (e) { out.bad.push(label + ': ' + (e && e.message)); B.S = null; }
    }
    // стена крыс героя и призыв стаи
    party(); state.party[0].essences = ['rat-catcher']; state.party[1].essences = ['rat-king'];
    const S = B.newBattle({ list: ['goblin', 'goblin'], zone: 'goblin', floor: 2 }); S.opts.autoHeroes = true; B.placeMonsters(S); B.preStart(S); B.rollInitiative();
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) S.cells[y][x] = null; S.objs.length = 0;
    const [h0, h1] = B.heroes(), [m0, m1] = B.mons(); h0.x = 3; h0.y = 5; h1.x = 1; h1.y = 6; m0.x = 3; m0.y = 1; m1.x = 5; m1.y = 1;
    h0.mp = 20; h1.mp = 20; h0.t = { move: 3, action: 1, bonus: 1, react: 1, moved: 0 }; h1.t = { move: 3, action: 1, bonus: 1, react: 1, moved: 0 };
    const A = B.A['rat-catcher']; out.wallCan = A.can(h0);
    await A.run(h0, {}, { commit() {} }); const rats = B.summonsOf(h0).filter(s => s.kind === 'rat'); out.wall = rats.length; out.wallRow = rats.every(r => r.y === 4) ; out.auto = rats.every(r => r.auto);
    out.wallCap = A.can(h0);
    const K = B.A['rat-king']; await K.run(h1, {}, { commit() {} }); out.king = B.summonsOf(h1).filter(s => s.kind === 'rat').length; out.kingCap = K.can(h1);
    out.resist = B.hookAny ? true : true; h0.pass.push('rat'); out.poison = !!(B.P.rat.resist(h0, { dt: 'poison' }) && !B.P.rat.resist(h0, { dt: 'fire' }));
    return out;
  });
  ok('автобои с крысами без ошибок', o.bad.length === 0, o.bad.slice(0, 5).join('|'));
  ok('крысолов зовёт крыс (больше 2 за бой)', o.maxRats > 2, o.maxRats);
  ok('«Стена крыс»: 3 крысы в ряд перед героем, ходят сами', o.wall === 3 && o.wallRow && o.auto, JSON.stringify(o));
  ok('лимит стены — 3 крысы', o.wallCap !== true, o.wallCap);
  ok('«Призыв стаи»: 2 крысы, лимит 2', o.king === 2 && o.kingCap !== true, JSON.stringify(o));
  ok('«Падальщик»: сопротивление яду', o.poison);
  ok('нет ошибок страницы', errs.length === 0, errs.join('|'));
  console.log(JSON.stringify(o));
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
