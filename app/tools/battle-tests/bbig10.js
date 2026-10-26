// Поле 10×10 на 3 этаже: размер, расстановка, местность, полный бой (симуляция), снимок для онлайна, возврат к 7×7.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-ui','battle-menu','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  await p.addStyleTag({ path: '/home/user/app/assets/css/battle.css' });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + (x == null ? '' : JSON.stringify(x))); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = (i) => { const c = Object.assign(clone(state.example), { id: 'q' + i, example: false, name: 'Г' + i, race: 'human', level: 3 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    state.party = [mk(0), mk(1), mk(2)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const geom = (floor) => {
      const S = B.newBattle({ list: ['goblin', 'goblin', 'goblin-archer', 'hobgoblin'], zone: 'goblin', floor, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S);
      const hs = B.heroes(), ms = B.mons();
      return { n: S.n, W: B.W, H: B.H, rows: S.cells.length, cols: S.cells[0].length, hy: hs.map(h => h.y), my: ms.map(m => m.y), inb: [...hs, ...ms].every(u => B.inB(u.x, u.y)), overlap: new Set([...hs, ...ms].map(u => u.x + ',' + u.y)).size === hs.length + ms.length, obst: S.cells.flat().filter(c => c).length, S };
    };
    const g3 = geom(3); out.g3 = { ...g3, S: undefined };
    // ловушки/террейн — связность
    out.connected3 = (() => { const S = B.S; const free = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) { const t = S.cells[y][x]; if (!(t && B.D.terrain[t].obstacle)) free.push([x, y]); } const seen = new Set([free[0].join()]), q = [free[0]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of B.DIRS) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (B.inB(nx, ny) && !seen.has(k) && !(S.cells[ny][nx] && B.D.terrain[S.cells[ny][nx]].obstacle)) { seen.add(k); q.push([nx, ny]); } } } return seen.size === free.length; })();
    // ambush
    const Sa = B.newBattle({ list: ['goblin', 'goblin'], zone: 'goblin', floor: 3, ambush: true, kind: 'hard', title: 'x' }); B.placeHeroesDefault(Sa); B.placeMonsters(Sa);
    out.ambush = { hy: B.heroes().map(h => h.y), my: B.mons().map(m => m.y) };
    // снимок: размер сохраняется
    const snap = B.ser(Sa); B.setSize(7); const T = { ev: Sa.ev }; B.restoreInto(T, snap); out.restoreN = [T.n, B.W, B.H];
    const g2 = geom(2); out.g2 = { ...g2, S: undefined };
    // полные симуляции на 3 этаже
    out.sims = []; for (let i = 0; i < 12; i++) { const r = await B.sim({ list: ['goblin', 'goblin', 'goblin-archer', 'hobgoblin', 'goblin-shaman'].slice(0, 3 + i % 3), zone: ['goblin', 'beast', 'undead', 'stone'][i % 4], floor: 3, kind: 'hard', title: 't' }); out.sims.push(r && r.outcome); }
    // после 3 этажа — обычный бой снова 7×7
    const g1 = geom(1); out.g1 = { n: g1.n, W: g1.W };
    return out;
  });
  ok('3 этаж: поле 10×10', o.g3.n === 10 && o.g3.W === 10 && o.g3.H === 10 && o.g3.rows === 10 && o.g3.cols === 10, o.g3);
  ok('герои — в трёх нижних рядах (7–9), враги — вверху (0–3), все на поле и не наложились', o.g3.hy.every(y => y >= 7) && o.g3.my.every(y => y <= 3) && o.g3.inb && o.g3.overlap, o.g3);
  ok('местность связна, препятствий больше, чем на 7×7', o.connected3 && o.g3.obst >= o.g2.obst, [o.connected3, o.g3.obst, o.g2.obst]);
  ok('засада: враги ближе к героям', o.ambush.my.some(y => y >= 4) && o.ambush.hy.every(y => y >= 7), o.ambush);
  ok('снимок боя помнит размер поля', o.restoreN[0] === 10 && o.restoreN[1] === 10, o.restoreN);
  ok('бой 1–2 этажа остаётся 7×7', o.g2.n === 7 && o.g2.W === 7 && o.g1.n === 7 && o.g2.hy.every(y => y >= 4), [o.g1, o.g2]);
  ok('12 полных боёв на 10×10 доходят до конца', o.sims.length === 12 && o.sims.every(x => x), o.sims);
  ok('нет ошибок страницы', errs.length === 0, errs.slice(0, 3));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close();
})();
