// Кладбище прошлого: настоящие бои в интерфейсе (не симуляция) с новыми монстрами — тьма, поле 10×10, диалог, призывы, снимок боя; после боя — сундук и выход.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push('page: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | '))); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); }); p.on('response', r => { if (r.status() === 404 && !/packs\/web|elder\.webp|sfx\//.test(r.url())) errs.push('404: ' + r.url().replace(/^.*8765\//, '')); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false, skipDice: true, anim: true } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const out = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), res = [], toasts = []; const _t = toast; toast = function (t) { toasts.push(String(t)); return _t.apply(this, arguments); };
    const mk = (id, n, w, off, ess) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 6, rank: 7 }); c.base = { str: 16, dex: 14, con: 16, int: 12, wis: 14, cha: 10 }; c.equip = { main: { t: 'w', id: w, steel: true }, ...(off ? { off: { t: 'w', id: off, steel: true } } : {}) }; delete c.bag; delete c.kit; delete c.hp; c.essences = ess; ensureKit(c); c.equip.body = { t: 'a', id: 'chainmail', steel: true }; addToBag(c, { t: 'g', id: 'torch', qty: 3 }); if (w === 'longbow') addToBag(c, { t: 'g', id: 'arrow', qty: 40 }); c.mp = maxMp(c); return c; };
    const party = () => [mk('p0', 'Аргон', 'sword', 'shield', ['buried-priest', 'dead-templar']), mk('p1', 'Борис', 'greataxe', null, ['penitent-dead', 'night-abbot']), mk('p2', 'Вера', 'longbow', null, ['lesser-death', 'candle-acolyte']), mk('p3', 'Глеб', 'staff', null, [])];
    state.party = party(); newRun(); const run = state.run; run.floor = 2; run.variant = 'undead'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); dgUi.res = null;
    const k = Object.keys(run.riftsF2.tiles)[0].split(',').map(Number); run.pos = { x: k[0], y: k[1] }; riftEnter(); const R = run.rift; location.hash = 'labyrinth'; await wait(300);
    for (let i = 0; i < 4; i++) { const d = document.getElementById('vn-dlg'); if (d) d.click(); await wait(200); } dgUi.res = null; rerender();
    const play = async () => { const t0 = Date.now(); let ser = 0;
      for (let i = 0; i < 6000 && dgUi.enc && Date.now() - t0 < 150000; i++) {
        if (typeof Battle === 'undefined' || !Battle.UI || !Battle.UI.active) { await wait(30); continue; }
        Battle.cfg.fast = Date.now() - t0 > 20000; const UI = Battle.UI, S = Battle.S; if (S) S.opts.autoHeroes = true;
        if (S && i % 40 === 0) { try { const snap = Battle.ser(S); if (!snap) throw new Error('пустой снимок'); JSON.parse(JSON.stringify(snap)); ser++; } catch (e) { res.push('снимок боя: ' + e.message); } }
        const vn = document.getElementById('vn-dlg'); if (vn) { vn.click(); await wait(40); continue; }
        const md = document.querySelector('.bt-modal'); const yes = md && !md.hidden && md.querySelector('[data-m="yes"]'); if (yes) { yes.click(); await wait(5); continue; }
        const sum = [...document.querySelectorAll('.bt-modal .fx-btn.primary')].find(b => b.offsetParent && !b.classList.contains('bt-done') && /^Готово$/.test(b.textContent.trim())); if (sum) { sum.click(); await wait(5); continue; }
        const sheetBtn = document.querySelector('.bd-ov:not(.out) .bd-ok:not([hidden])'); if (sheetBtn) { sheetBtn.click(); await wait(5); continue; }
        const roll = document.querySelector('.bd-ov:not(.out) .bd-roll:not([disabled])'); if (roll && !document.querySelector('.bd-ov:not(.out) .bd-row').hidden) { roll.click(); await wait(30); continue; }
        if (UI.mode === 'place' || UI.mode === 'ambush') UI.placeDone();
        else if (UI.mode === 'hero' && UI.endTurn) UI.endTurn();
        else if (UI.mode === 'result') { for (const lv of document.querySelectorAll('.bt-ess [data-ec="leave"]:not([disabled])')) if (lv.offsetParent) lv.click(); const d = document.querySelector('.bt-done:not([hidden])'); if (d) d.click(); }
        await wait(10);
      }
      return { hung: !!(dgUi.enc && Battle.running), ser, ms: Date.now() - t0 }; };
    const heal = () => { state.party = party(); state.party.forEach(c => { run.status[c.id] = { fat: 0, sat: 9, starve: 0, awake: 0 }; }); };
    const cases = [
      ['церковь: тяжёлая', () => { R.zone = null; R.phase = 'night'; riftFight('Церковь: тяжёлая встреча', ['dead-templar', 'penitent-dead', 'candle-acolyte']); }],
      ['склеп: священник во тьме', () => { run.light = false; R.zone = 'crypt'; riftFight('Склеп: Погребённый священник', ['buried-priest', 'skeleton-warrior']); dgUi.enc.gyCrypt = true; R.zone = null; }],
      ['дух смерти', () => { riftFight('Свет на кладбище: Младший дух смерти', ['lesser-death']); dgUi.enc.gySpirit = true; }],
      ['Азик с диалогом', () => { gyAzik(); }],
      ['настоятель (страж)', () => { riftFight('Страж разлома: Настоятель Вечной ночи', ['night-abbot', 'candle-acolyte']); dgUi.enc.gyBoss = true; }],
    ];
    for (const [name, start] of cases) {
      heal(); dgUi.res = null; dgUi.enc = null; start(); const ev = dgUi.enc, flags = { dark: !!ev.dark, big: !!ev.big10 }; saveChar(); rerender();
      const r = await play(); await wait(300);
      res.push({ name, outcome: ev.outcome, ...flags, hung: r.hung, ser: r.ser, sec: Math.round(r.ms / 1000), res: dgUi.res ? dgUi.res.title : null, chest: !!(dgUi.res && dgUi.res.anim === 'chest'), rift: !!run.rift });
      if (r.hung) { try { Battle.abort(); } catch (e) {} await wait(300); dgUi.enc = null; }
    }
    return { res, toasts: toasts.filter(t => /ошиб|error|not a function|undefined/i.test(t)), R: { cryptDone: R.cryptDone, key: R.churchKey, spirit: R.spiritDead, azik: R.azikDead, boss: R.bossDead } };
  });
  let bad = 0; for (const r of out.res) { if (typeof r === 'string') { console.log('  ✗', r); bad++; continue; } const ok = !r.hung && r.outcome; if (!ok) bad++; console.log(` ${ok ? '✓' : '✗'} ${r.name}: ${r.outcome || 'нет итога'}${r.dark ? ', тьма' : ''}${r.big ? ', 10×10' : ''}, ${r.sec} с, снимков ${r.ser}${r.res ? ', окно «' + r.res + '»' : ''}${r.chest ? ' (сундук)' : ''}`); }
  console.log('состояние разлома:', JSON.stringify(out.R));
  if (out.toasts.length) { console.log('сообщения об ошибках:', out.toasts.slice(0, 5)); bad++; }
  if (errs.length) { console.log('ошибки:', [...new Set(errs)].slice(0, 6)); bad++; }
  console.log(`не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
