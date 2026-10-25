// Онлайн-лобби: игроки создают героев одновременно с ведущим и видят всех в общей группе; выход и повторный вход в комнату; закрытие и новое открытие комнаты.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });          // один контекст нужен для BroadcastChannel; хранилище у каждой страницы своё, как на разных телефонах
  const h = await ctx.newPage(), c1 = await ctx.newPage(), c2 = await ctx.newPage(), errs = [];
  for (const p of [h, c1, c2]) await p.addInitScript(() => { const m = new Map(); Object.assign(Storage.prototype, { getItem(k) { return m.has(k) ? m.get(k) : null; }, setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); }, clear() { m.clear(); } }); });
  for (const [n, p] of [['host', h], ['c1', c1], ['c2', c2]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.addInitScript(() => { localStorage.clear(); });
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  const join = async (p, name) => { await p.addInitScript(() => { localStorage.clear(); }); await p.goto(URL + '?net=loopback&mode=player'); await p.waitForTimeout(700); await p.fill('#nj-code', code); await p.fill('#nj-name', name); await p.click('[data-nj="go"]'); await p.waitForTimeout(1200); };
  await join(c1, 'Вася'); await join(c2, 'Петя');
  ok('оба в сети', (await h.evaluate(() => Object.values(Net.players).filter(p => p.online).length)) === 2);
  // ведущий создаёт своего героя (экран отряда открыт), игроки создают своих одновременно
  await h.evaluate(() => { openForge('race', 'first'); const c = Object.assign(clone(DEFAULT_CHAR), { id: 'hH', name: 'Хозяин', example: false }); c.base = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); state.party.push(c); saveChar(); forge.step = 'team'; forge.draft = null; renderForge(); });
  const mkHero = (p, name) => p.evaluate(async name => { const c = Object.assign(clone(DEFAULT_CHAR), { id: 'c' + Math.random().toString(36).slice(2, 7), name, example: false, race: 'human', gender: 'm' }); c.base = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: 'sword' } }; delete c.owner; await NetGlue.submitHero(c); return true; }, name);
  await Promise.all([mkHero(c1, 'Васин'), mkHero(c2, 'Петин')]);
  await h.waitForTimeout(1200);
  const hostTeam = await h.evaluate(() => document.getElementById('forge').textContent);
  ok('ведущий видит героев игроков на экране отряда', /Васин/.test(hostTeam) && /Петин/.test(hostTeam) && /Хозяин/.test(hostTeam), hostTeam.slice(0, 200));
  ok('в группе три героя', (await h.evaluate(() => state.party.length)) === 3);
  for (const [n, p] of [['c1', c1], ['c2', c2]]) {
    const txt = await p.evaluate(() => document.getElementById('view').textContent + ' ' + state.party.map(c => c.name).join());
    ok(n + ': видит всех троих', /Хозяин/.test(txt) && /Васин/.test(txt) && /Петин/.test(txt), txt.slice(0, 160));
  }
  // выход из комнаты и повторный вход
  await c1.evaluate(() => Net.leave()); await c1.waitForTimeout(500);
  ok('игрок вышел', (await c1.evaluate(() => Net.status)) === 'off');
  await c1.evaluate((code) => { const cr = JSON.parse(localStorage.getItem('sputnik.net.v1') || '{}'); Net.join(code, cr.name || 'Вася', cr.pid, () => ({ heroes: state.party.filter(c => c.owner && c.owner === Net.pid()) })); }, code);
  await c1.waitForTimeout(1500);
  ok('повторный вход: в сети', (await c1.evaluate(() => Net.status)) === 'online', await c1.evaluate(() => Net.status));
  ok('повторный вход: у ведущего всё те же 2 игрока, без дублей', (await h.evaluate(() => Object.keys(Net.players).length)) === 2 && (await h.evaluate(() => Object.values(Net.players).filter(p => p.online).length)) === 2);
  ok('герой остался за игроком', await c1.evaluate(() => state.party.some(c => c.name === 'Васин' && NetGlue.isMine(c))));
  // быстрый выход-вход несколько раз подряд не плодит соединения
  for (let i = 0; i < 3; i++) { await c1.evaluate(code => { Net.leave(); const cr = JSON.parse(localStorage.getItem('sputnik.net.v1') || '{}'); Net.join(code, cr.name, cr.pid, () => ({ heroes: [] })); }, code); }
  await c1.waitForTimeout(2500);
  ok('после быстрых входов связь одна и стабильна', (await c1.evaluate(() => Net.status)) === 'online' && (await h.evaluate(() => Object.values(Net.players).filter(p => p.online).length)) === 2);
  // ведущий закрывает комнату и открывает снова с тем же кодом
  await h.evaluate(() => NetGlue.stopHost()); await h.waitForTimeout(500);
  const code2 = await h.evaluate(async () => await NetGlue.startHost());
  ok('код комнаты сохранился', code2 === code, [code, code2]);
  await c1.waitForTimeout(6000);
  ok('игроки сами вернулись в комнату', (await c1.evaluate(() => Net.status)) === 'online' && (await c2.evaluate(() => Net.status)) === 'online', [await c1.evaluate(() => Net.status), await c2.evaluate(() => Net.status)]);
  ok('герои на месте после перезапуска комнаты', (await h.evaluate(() => state.party.length)) === 3);
  ok('нет ошибок страниц', !errs.length, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})();
