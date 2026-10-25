// Топь болотного клыка (увязание, выбраться действием, нырок с тыла) и тьма крота с тёмным зрением
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
    const B = Battle; B.cfg.fast = true; const out = { sink: 0, back: 0, mire: 0, battles: 0, dvDis: null, nodvDis: null, noReactDv: null };
    const mk = (i, race) => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race, level: 1 }); c.base = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 2, pos: { x: 5, y: 5 }, status: {}, light: false };
    for (let i = 0; i < 12; i++) {
      state.party = [mk(0, 'human'), mk(1, 'barbarian'), mk(2, 'human')]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      const r = await B.sim({ list: ['swamp-fang'], zone: 'beast', floor: 2, kind: 'hard', title: 't' }); out.battles++;
      const S = r.S; out.mire += S.cells.flat().filter(c => c === 'mire').length;
      for (const l of S.log) { if (/увяз в топи/.test(l.t)) out.sink++; if (/выныривает с тыла/.test(l.t)) out.back++; }
      B.S = null;
    }
    // тьма крота: тёмное зрение снимает помеху
    state.party = [mk(0, 'human'), mk(1, 'barbarian'), mk(2, 'human')]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const S = B.newBattle({ list: ['giant-mole'], zone: 'beast', floor: 2 }); S.opts.autoHeroes = true; B.placeMonsters(S); B.preStart(S); B.rollInitiative();
    const [h0, h1] = B.heroes(), [m] = B.mons(); out.pit = S.pitDark; h0.x = 2; h0.y = 5; m.x = 2; m.y = 4;
    const atk = B.attacksOf(h0)[0];
    h0.dv = false; out.nodvDis = B.attackCtx(h0, m, atk, {}).dis.some(d => /кромешная/.test(d));
    h0.dv = true; out.dvDis = B.attackCtx(h0, m, atk, {}).dis.some(d => /кромешная/.test(d));
    return out;
  });
  ok('на топи есть клетки «Топь»', o.mire > 12 * 5, o.mire);
  ok('герои увязают в топи', o.sink > 0, JSON.stringify(o));
  ok('клык выныривает с тыла', o.back > 0, JSON.stringify(o));
  ok('бой с кротом — кромешная тьма', o.pit === true);
  ok('без тёмного зрения помеха', o.nodvDis === true);
  ok('с тёмным зрением помехи нет', o.dvDis === false, JSON.stringify(o));
  ok('нет ошибок страницы', errs.length === 0, errs.join('|'));
  console.log(JSON.stringify(o));
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
