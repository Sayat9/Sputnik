// «Обезьяна»: настоящие случайные клики по всем экранам (карта 1 и 2 этажа, город, герой, бой, справочник).
// После каждого клика — инварианты: нет ошибок, окна не наслаиваются, ничего не вылезает за экран по ширине,
// кнопки окон достижимы (внутри экрана или в прокручиваемом окне), нет NaN/undefined, нет лишней «Поджечь паутину».
// node bmonkey.js [шагов на сценарий=250] [seed]
const L = require('./bui_lib.js');
const STEPS = +process.argv[2] || 250;
(async () => {
  const { b, p } = await L.launch(400, 860);
  const issues = new Map(), note = (k, v) => { if (!issues.has(k)) issues.set(k, v); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: true });
  await p.evaluate(() => { window.confirm = () => true; window.prompt = () => null; window.alert = () => {}; });
  const check = tag => p.evaluate(tag => {
    const out = [], W = innerWidth, H = innerHeight;
    const vis = el => { if (!el.getClientRects().length) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
    // 1) экран не двигается по ширине
    const se = document.scrollingElement; if (se.scrollWidth > W + 2) out.push(['ширина', `страница шире экрана: ${se.scrollWidth} > ${W}`]);
    if (scrollX) out.push(['ширина', `страница сдвинута вбок: scrollX=${scrollX}`]);
    // 2) окна поверх экрана
    const big = [...document.querySelectorAll('body *')].filter(el => { const cs = getComputedStyle(el); if (cs.position !== 'fixed' && !el.classList.contains('bt-modal')) return false; if (!vis(el)) return false; const r = el.getBoundingClientRect(); return r.width * r.height > W * H * 0.35; })
      .filter(el => !el.classList.contains('bt-root') && el.id !== 'scrim');
    const POP = ['diceov', 'iteminfo', 'fxinfo', 'saveov', 'net-logov', 'netov'];          // кубик, подсказки, окно «Онлайн» и журнал сети — законно поверх окна
    const top = big.filter(el => !big.some(o => o !== el && o.contains(el)) && !POP.includes(el.id) && !el.classList.contains('fx-toast') && !el.classList.contains('out'));
    window.__seen ||= {}; for (const el of big) window.__seen[el.id ? '#' + el.id : '.' + [...el.classList].join('.')] = 1; window.__seen['hash:' + location.hash] = 1;
    if (document.querySelector('.bt-root:not([hidden])')) window.__seen['бой:' + (Battle.UI && Battle.UI.mode)] = 1;
    const name = el => el.id ? '#' + el.id : '.' + [...el.classList].join('.');
    if (top.length === 2 && top.some(el => el.id === 'heroov') && top.some(el => el.classList.contains('mapov'))) top.length = 0;          // карточка героя из списка инициативы — поверх окна встречи, так задумано
    if (top.length > 1) out.push(['наслоение', 'видно сразу несколько окон: ' + top.map(name).join(' + ')]);
    // 3) кнопки окон и меню: не за краем экрана, а снизу — только если окно прокручивается
    const scrollable = (el, ax = 'Y') => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (ax === 'Y' ? /(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1 : /(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
    for (const root of top) for (const btn of root.querySelectorAll('button, [data-hx], [data-ba], summary')) {
      if (!vis(btn)) continue; const r = btn.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      if ((r.right > W + 2 || r.left < -2) && !scrollable(btn, 'X')) out.push(['за краем', `${name(root)}: «${(btn.textContent || '').trim().slice(0, 30)}» вылезает по ширине (${Math.round(r.left)}..${Math.round(r.right)})`]);
      else if ((r.bottom > H + 2 || r.top < -2) && !scrollable(btn)) out.push(['за краем', `${name(root)}: «${(btn.textContent || '').trim().slice(0, 30)}» за экраном снизу/сверху и окно не прокручивается`]);
    }
    // 4) мусор в тексте
    const txt = document.body.innerText; const m = txt.match(/.{0,40}\b(NaN|undefined|\[object Object\])\b.{0,40}/);
    if (m) { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, where = ''; while ((n = w.nextNode())) if (/\b(NaN|undefined|\[object Object\])\b/.test(n.data) && n.parentElement && n.parentElement.getClientRects().length) { const host = n.parentElement.closest('[id]'); where = (host ? '#' + host.id : '') + ' <' + n.parentElement.tagName.toLowerCase() + ' class="' + n.parentElement.className + '"> ' + n.parentElement.outerHTML.slice(0, 200); break; }
      out.push(['мусор', m[0].replace(/\s+/g, ' ') + ' || ' + where]); }
    // 5) «Поджечь паутину» — только если знают условия паучихи
    const qk = (() => { try { return queenKnown(); } catch (e) { return false; } })();
    if (!qk && /Поджечь паутину/.test(txt)) out.push(['паутина', 'кнопка «Поджечь паутину» без знания условий паучихи']);
    return out.map(([k, v]) => [k, tag + ': ' + v]);
  }, tag);
  const SKIP = /удалить|сброс|стереть|новый поход|начать заново|выйти из комнаты|импорт|экспорт|файл|закрыть комнату|отправить в лабиринт навсегда|выгнать|кик/i;
  const run = async (label, prep, steps = STEPS) => {
    await p.evaluate(() => saveChar()).catch(() => {}); await p.reload(); await L.sleep(500);
    await p.evaluate(() => { window.confirm = () => true; window.prompt = () => null; window.alert = () => {}; });
    await p.evaluate(prep);
    await L.sleep(150);
    const trail = [];
    for (let i = 0; i < steps; i++) {
      const c = await p.evaluate(src => {
        const SK = new RegExp(src, 'i'), W = innerWidth, H = innerHeight, vis = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
        let els = [...document.querySelectorAll('button, summary, [data-hx], [data-ba], [data-act], [data-go], a[href^="#"], [role=button], .bt-board, .map td, .map .c, [data-x]')]
          .filter(el => vis(el) && !el.disabled && !SK.test(el.textContent || '') && el.type !== 'file');
        els = els.filter(el => { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x > W || y > H) return false; const t = document.elementFromPoint(x, y); return t && (t === el || el.contains(t)); });
        if (!els.length) return null;
        const el = els[Math.floor(Math.random() * els.length)], r = el.getBoundingClientRect();
        const ox = el.classList.contains('bt-board') ? (Math.random() - .5) * r.width * .9 : 0, oy = el.classList.contains('bt-board') ? (Math.random() - .5) * r.height * .9 : 0;
        return { x: r.left + r.width / 2 + ox, y: r.top + r.height / 2 + oy, t: (el.textContent || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30) };
      }, SKIP.source);
      if (!c) { await p.keyboard.press('Escape'); await p.evaluate(() => { if (!document.querySelector('.bt-root:not([hidden])')) { location.hash = ['labyrinth', 'town', ''][Math.floor(Math.random() * 3)]; } }); await L.sleep(80); continue; }
      trail.push(c.t); if (trail.length > 8) trail.shift();
      await p.mouse.click(c.x, c.y); await L.sleep(70 + Math.random() * 80);
      if (Math.random() < 0.04) { await p.mouse.click(5, 5); await L.sleep(40); }          // тап по пустому месту
      const errsNow = p.errs.splice(0);
      for (const e of errsNow) note('ошибка: ' + e.slice(0, 600), `${label} шаг ${i} после: ${trail.join(' → ')}`);
      for (const [k, v] of await check(label)) note(k + ' | ' + v.replace(/\d+\.\.\d+/, '…'), `шаг ${i} после: ${trail.join(' → ')}`);
      // бой, который тянется слишком долго, сворачиваем
      if (i % 60 === 59) await p.evaluate(() => { try { if (window.Battle && Battle.S && Battle.S.units && !document.querySelector('.bt-root[hidden]') && Math.random() < .5) { Battle.mons().forEach(m => { m.hp = 1; }); } } catch (e) {} });
    }
  };
  const t0 = Date.now();
  await run('карта 1 этажа', () => { location.hash = 'labyrinth'; rerender(); });
  await run('паутина 2 этажа', () => { const r = state.run; r.floor = 2; r.variant = 'beast'; r.sp = null; r.tier = null; r.pos = { x: 8, y: 4 }; r.light = false; delete journal().known['spider-queen']; location.hash = 'labyrinth'; rerender(); });
  await run('город', () => { state.townUnlocked = true; state.run = null; saveChar(); location.hash = 'town'; rerender(); });
  await run('герой', () => { location.hash = 'town'; rerender(); openHero(state.party[0].id); });
  await run('справочник', () => { location.hash = Object.keys(TABS).find(k => /mon/.test(k)) || 'monsters'; rerender(); }, Math.round(STEPS / 2));
  await run('бой', async () => { newRun(); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; }); location.hash = 'labyrinth'; rerender();
    const list = ['goblin', 'goblin-archer', 'wolf'], ev = { kind: 'hard', title: 'Тяжёлая встреча', raw: 10, n: 10, cause: 'event', list, zone: 'goblin', border: false, key: tkey(state.run.pos.x, state.run.pos.y), outcome: null, killed: [], turn: 0, round: 1, tactical: true, floor: 1 };
    ev.init = rollInitiative(list, false); dgUi.enc = ev; rerender(); });
  console.log(`прогон: ${((Date.now() - t0) / 1000).toFixed(0)} с, шагов ≈ ${STEPS * 5.5}`);
  console.log('экраны:', Object.keys(await p.evaluate(() => window.__seen || {})).join(', '));
  if (!issues.size) console.log('замечаний нет');
  for (const [k, v] of issues) console.log('✗', k, '\n    ', v);
  console.log(`замечаний: ${issues.size}`);
  await b.close();
})();
