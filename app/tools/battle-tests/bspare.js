// Монстры сначала бьют стоящих героев; упавших — только если до стоящих не добраться никак (решение автора 01.11)
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500); for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + JSON.stringify(x)); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 1 }); c.base = { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const scen = async wall => {
      state.party = [mk(0), mk(1)];
      const S = B.newBattle({ list: ['goblin-sword'], zone: 'goblin', floor: 1 }); B.placeMonsters(S); S.phase = 'fight'; S.dark = false;
      for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = null; S.objs.length = 0;
      const [down, up] = B.heroes(), m = B.mons()[0];
      m.x = 1; m.y = 3; down.x = 1; down.y = 4; up.x = 5; up.y = 3;
      down.hp = 0; down.down = true; B.addStatus(down, 'unconscious', { k: 99 });
      if (wall) { for (let y = 0; y < B.H; y++) { S.cells[y][3] = 'rock'; } }
      m.t = { move: 4, action: 1, bonus: 1, react: 1, moved: 0 }; m.flags.awake = true;
      const hits = []; const da = B.doAttack; B.doAttack = async function (a, t) { hits.push(t.id === down.id ? 'down' : 'up'); return da.apply(this, arguments); };
      const d0 = Math.abs(m.x - up.x); await B.AI.takeTurn(m); B.doAttack = da;
      const r = { hits, moved: [m.x, m.y], closer: Math.abs(m.x - up.x) < d0 }; B.S = null; return r;
    };
    out.open = await scen(false); out.wall = await scen(true);
    return out;
  });
  console.log(JSON.stringify(o));
  ok('стоящий достижим — упавшего не трогает, идёт к стоящему', !o.open.hits.includes('down') && (o.open.closer || o.open.hits.includes('up')), o.open);
  ok('до стоящего не добраться (стена) — добивает упавшего', o.wall.hits.includes('down'), o.wall);
  ok('нет ошибок', !errs.length, errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close();
})();
