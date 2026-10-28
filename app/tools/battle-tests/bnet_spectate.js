// Онлайн-бой с двумя игроками: зрители не видят чужую расстановку/меню, видят броски и сводки, итог боя; КД и эссенции монстров скрыты; перебросы только свои.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  const h = await ctx.newPage(), c1 = await ctx.newPage(), c2 = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['c1', c1], ['c2', c2]]) { p.on('pageerror', e => errs.push(n + ': ' + e.message)); await p.addInitScript(() => { const m = new Map(); Object.assign(Storage.prototype, { getItem(k) { return m.has(k) ? m.get(k) : null; }, setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); }, clear() { m.clear(); } }); }); }
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  await h.evaluate(async () => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 3, insp: 2 }); c.base = { str: 16, dex: 8, con: 16, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис'), mk('hC', 'Цезарь')]; state.townUnlocked = true; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB', 'hC'] }]; saveChar(); location.hash = 'labyrinth';
    state.settings = { ...(state.settings || {}), monDice: false }; await loadBattle();
  });
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  const join = async (p, name) => { await p.goto(URL + '?net=loopback&mode=player'); await p.waitForTimeout(700); await p.fill('#nj-code', code); await p.fill('#nj-name', name); await p.click('[data-nj="go"]'); await p.waitForTimeout(1200); };
  await join(c1, 'Вася'); await join(c2, 'Петя');
  const pids = await h.evaluate(() => Object.values(Net.players).map(p => p.pid));
  await h.evaluate(pids => { state.party[0].owner = pids[0]; state.party[1].owner = pids[1]; saveChar(); NetGlue.pushAll(true); }, pids);
  await c1.waitForTimeout(800);
  await h.evaluate(() => {
    window.hturns = []; Battle.UI.heroTurn = async u => { hturns.push(u.name); await Battle.AI.takeTurn(u); };
    const ev = { list: ['goblin', 'goblin'], zone: 'goblin', ambush: false, kind: 'hard', title: 'тест', floor: 1 };
    Battle.running = true; Battle.UI.open(); setInterval(() => { if (Battle.UI.placeOnly) Battle.UI.placeDone(); }, 300); window.pr = Battle.start(ev);
  });
  // расстановка: у каждого игрока по очереди своя панель; у зрителя панели «В бой!» нет
  let saw = { c1: false, c2: false, spectatorGo: false };
  for (let i = 0; i < 80 && !(saw.c1 && saw.c2); i++) {
    for (const [n, p] of [['c1', c1], ['c2', c2]]) {
      const own = await p.evaluate(() => !!(window.Battle && Battle.UI && Battle.UI.placeOnly));
      if (own && !saw[n]) { saw[n] = true; const other = n === 'c1' ? c2 : c1; saw.spectatorGo = saw.spectatorGo || await other.evaluate(() => !!document.querySelector('.bt-panel [data-ba="place-go"]')); await p.click('.bt-panel [data-ba="place-go"]'); }
    }
    await c1.waitForTimeout(250);
  }
  ok('оба игрока расставили героев', saw.c1 && saw.c2);
  ok('у зрителя нет панели «В бой!» чужого героя', !saw.spectatorGo);
  // после расстановки панель готовности не висит ни у кого
  await c1.waitForTimeout(600);
  ok('после расстановки у игроков нет «В бой!»', !(await c1.evaluate(() => !!document.querySelector('[data-ba="place-go"]'))));
  // КД и эссенции монстров скрыты у игрока
  await c2.waitForFunction(() => window.Battle && Battle.S && Battle.S.phase === 'fight', null, { timeout: 30000 });
  const insp = await c2.evaluate(() => { const m = Battle.mons()[0]; Battle.UI.inspect(m); const t = document.querySelector('.bt-modal').textContent; document.querySelector('.bt-modal').hidden = true; return t; });
  ok('в окне монстра у игрока нет КД и эссенции', !/КД\s*\d/.test(insp) && !/\(П\)|\(А\)/.test(insp), insp.slice(0, 160));
  // чужой бросок виден зрителю
  await c1.evaluate(() => Battle.Net.emit({ sid: 'tst', who: 'Аргон', side: 'hero', title: 'Бросок атаки', sub: 'Аргон → Гоблин', k: 'res', total: 17, nat: 12 }));
  await c2.waitForTimeout(500);
  ok('зритель видит чужой бросок', await c2.evaluate(() => { const e = document.getElementById('bnwatch'); return !!e && !e.hidden && /17/.test(e.textContent); }));
  ok('ведущий тоже видит бросок игрока', await h.evaluate(() => { const e = document.getElementById('bnwatch'); return !!e && /17/.test(e.textContent); }));
  // сводка спасбросков: перебросить может только владелец
  await h.evaluate(() => { const hs = Battle.heroes().filter(u => u.hero && u.hero.owner); window.sumP = Battle.massSave([hs[0], hs[1]], 'dex', 40, { title: 'Тест-сводка' }); });
  await c1.waitForTimeout(800);
  const rr1 = await c1.evaluate(() => document.querySelectorAll('#bnsum [data-bs=rr]').length), rr2 = await c2.evaluate(() => document.querySelectorAll('#bnsum [data-bs=rr]').length);
  ok('у каждого владельца своя кнопка переброса, чужой нет', rr1 === 1 && rr2 === 1, [rr1, rr2]);
  const hostRR = await h.evaluate(() => document.querySelectorAll('.bt-modal [data-rr]:not([disabled])').length);
  ok('у ведущего нет переброса за героев друзей', hostRR === 0, hostRR);
  await c1.click('#bnsum [data-bs=rr]'); await c1.waitForTimeout(800);
  ok('переброс игрока применился (кнопка исчезла или расход)', (await h.evaluate(() => Battle.heroes().find(u => u.hero && u.hero.owner === Object.values(Net.players)[0].pid).insp)) <= 1);
  await h.evaluate(() => { document.querySelector('.bt-modal [data-m=sumok]').click(); }); await c1.waitForTimeout(600);
  ok('сводка закрылась у игроков', !(await c1.evaluate(() => !!document.getElementById('bnsum'))) && !(await c2.evaluate(() => !!document.getElementById('bnsum'))));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.length ? [...new Set(errs)].slice(0, 6) : '');
  await c2.screenshot({ path: '/tmp/battle-shots/net_spec.png' });
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})();
