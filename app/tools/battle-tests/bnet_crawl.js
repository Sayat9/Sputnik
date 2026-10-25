// Онлайн: ведущий и игрок на настоящем приложении (loopback): комната, роли, зеркало состояния, свои герои, ограничения.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.addInitScript(() => { localStorage.clear(); });
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  // ведущий: отряд из двух героев, в городе
  await h.evaluate(() => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 2 }); c.base = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис')]; state.townUnlocked = true; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB'] }]; saveChar(); location.hash = 'town';
  });
  await h.waitForTimeout(300);
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  ok('код комнаты', /^[A-Z0-9]{5}$/.test(code), code);
  // игрок
  await c.addInitScript(() => { localStorage.clear(); });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(800);
  ok('режим игрока', await c.evaluate(() => APP_MODE === 'player' && document.body.classList.contains('net-player')));
  ok('экран входа', await c.evaluate(() => !document.getElementById('netjoin').hidden));
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]');
  await c.waitForTimeout(1500);
  const pid = await h.evaluate(() => Object.keys(Net.players)[0]);
  await h.evaluate(pid => { state.party[0].owner = pid; saveChar(); NetGlue.pushAll(); }, pid);
  await c.waitForTimeout(700);
  const hist = [];
  const SKIP = /Сброс|Удалить|Стереть|Выйти|Покинуть|Обновить|Перезагр|Очистить|Кик|Исключить|Закрыть комнату|Остановить/i;
  const stats = {};
  async function crawl(p, name, route, prep) {
    const sel = 'button, [data-act], [data-a], [data-go], [data-b], [data-tab], [data-hx], [data-bld], a[href^="#"], .btn, [role=button]';
    const count = async () => { await prep(); return p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent && !e.disabled && !e.closest('[hidden]')).map(e => (e.textContent || e.title || e.getAttribute('aria-label') || '').trim().slice(0, 30)), sel); };
    if (global.__stop) return; const labels = await count(); const key = name + ':' + route; stats[key] = { n: labels.length, clicked: 0 };
    for (let i = 0; i < Math.min(labels.length, 70); i++) {
      if (SKIP.test(labels[i])) continue;
      await prep();
      hist.push(name + ':' + labels[i]); const before = errs.length;
      try {
        const done = await p.evaluate(([sel, i, skip]) => { const l = [...document.querySelectorAll(sel)].filter(e => e.offsetParent && !e.disabled && !e.closest('[hidden]')); if (!l[i]) return false; const t = (l[i].textContent || l[i].title || '').trim(); if (new RegExp(skip, 'i').test(t) || l[i].dataset.nx === 'stop' || l[i].dataset.nb === 'leave') return false; l[i].click(); return true; }, [sel, i, SKIP.source]);
        if (done) stats[key].clicked++;
        await p.waitForTimeout(120);
        await p.keyboard.press('Escape');
      } catch (e) { errs.push(name + ' crawl: ' + e.message.slice(0, 80)); }
      if (name === 'host') { const st = await c.evaluate(() => Net.status); if (st !== 'online') { console.log('  ✗ после клика ведущего «' + labels[i] + '» (' + key + ') игрок: ' + st); console.log('  история:', hist.slice(-6).join(' | '), await h.evaluate(() => [Net.status, Object.values(Net.players).map(p => p.online)])); global.__stop = 1; return; } }
      if (name === 'client') { const st = await p.evaluate(() => Net.status); if (st !== 'online') { console.log('  ✗ игрок отключился после «' + labels[i] + '» (' + key + ') статус ' + st); await p.waitForTimeout(2500); console.log('    через 2.5с:', await p.evaluate(() => Net.status)); if (!global.__d) { global.__d = 1; } else throw new Error('stop'); } }
      if (errs.length > before) console.log('  ✗ ошибка после «' + labels[i] + '» (' + key + '):', errs.slice(before).join(' | ').slice(0, 200));
    }
  }
  const routes = ['', 'town', 'labyrinth', 'bestiary', 'character', 'library'];
  for (const [name, p] of [['host', h], ['client', c]]) for (const r of routes) {
    await crawl(p, name, r || 'home', async () => { await p.evaluate(r => { try { document.querySelectorAll('.ov,.overlay,dialog').forEach(d => d.hidden = true); } catch (e) {} location.hash = r; }, r); await p.waitForTimeout(250); });
  }
  console.log(JSON.stringify(stats));
  // согласованность состояния после всех кликов
  await h.waitForTimeout(1200);
  const hs = await h.evaluate(() => JSON.stringify(state.party.map(x => [x.id, x.hp, x.gold, x.bag.length, x.owner])));
  const cs = await c.evaluate(() => JSON.stringify(state.party.map(x => [x.id, x.hp, x.gold, x.bag.length, x.owner])));
  ok('состояние отряда совпадает', hs === cs, [hs, cs]);
  ok('игрок онлайн', await c.evaluate(() => Net.status) === 'online');
  ok('нет ошибок страниц', errs.length === 0, errs.slice(0, 5));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close();
})();
