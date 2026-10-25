// Онлайн-бой с настоящим интерфейсом игрока: зеркало боя, ход своего героя с меню, конец хода.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.addInitScript(() => localStorage.clear()); await c.addInitScript(() => localStorage.clear());
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  await h.evaluate(async () => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 3 }); c.base = { str: 16, dex: 12, con: 16, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис')]; state.townUnlocked = true; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB'] }]; saveChar(); location.hash = 'labyrinth';
    await loadBattle();
  });
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(800);
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]'); await c.waitForTimeout(1500);
  const pid = await h.evaluate(() => Object.keys(Net.players)[0]);
  await h.evaluate(pid => { state.party[0].owner = pid; saveChar(); NetGlue.pushAll(true); }, pid);
  await c.waitForTimeout(800);
  await h.evaluate(() => {
    window.hturns = []; Battle.UI.heroTurn = async u => { hturns.push(u.name); await Battle.AI.takeTurn(u); };
    Battle.Dice.session = (u, m) => Battle.autoSession(u, m);
    const ev = { list: ['goblin', 'goblin', 'goblin'], zone: 'goblin', ambush: false, kind: 'hard', title: 'тест', floor: 1 };
    Battle.running = true; Battle.UI.open(); window.pr = Battle.start(ev); setTimeout(() => Battle.UI.placeDone(), 600);
  });
  // игрок: ждём свой ход с настоящим интерфейсом
  await c.waitForFunction(() => window.Battle && Battle.UI && Battle.UI.active && Battle.UI.mode === 'hero', null, { timeout: 30000 });
  ok('у игрока открыт бой и режим хода', true);
  await c.waitForTimeout(500); await c.screenshot({ path: '/tmp/battle-shots/net_turn.png' });
  ok('в меню боя нет функций ведущего', await c.evaluate(() => { Battle.UI.menu(); const t = document.querySelector('.bt-modal').textContent; document.querySelector('.bt-modal').hidden = true; return !/Мастер: завершить|Авто-бой|Обычный экран/.test(t); }));
  const hasAttack = await c.evaluate(() => !!document.querySelector('.bt-panel [data-ba], .bt-panel button'));
  ok('панель действий есть', hasAttack);
  await c.evaluate(() => Battle.UI.endTurn && Battle.UI.endTurn());
  await h.waitForFunction(() => window.hturns && hturns.length >= 1, null, { timeout: 30000 });
  ok('ведущий продолжил бой после хода игрока', true);
  // не-активный игрок видит зеркало: проверим, что у игрока S обновляется
  await c.waitForTimeout(1500);
  const rounds = await c.evaluate(() => Battle.S ? Battle.S.round : null);
  ok('зеркало боя обновляется', rounds >= 1, rounds);
  await c.screenshot({ path: '/tmp/battle-shots/net_mirror.png' });
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.length ? [...new Set(errs)].slice(0, 6) : '');
  await b.close();
})();
