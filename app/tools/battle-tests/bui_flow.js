// Общие шаги сценариев: ждать ход героя, ходить, атаковать, играть лист броска.
const L = require('./bui_lib.js');
const dockClick = (p, id) => p.click(`[data-ba="dock"][data-id="${id}"]`);

async function handleModal(p, prefer) {
  const md = await p.evaluate(() => { const mm = document.querySelector('.bt-modal'); return mm && !mm.hidden && mm.innerText.trim() ? mm.innerText.slice(0, 120).replace(/\n+/g, ' / ') : ''; });
  if (!md) return null;
  const want = prefer === 'no' ? ['no', '__no'] : prefer === 'yes' ? ['yes'] : [];
  let btn = null;
  for (const w of want) { btn = await p.$(`.bt-modal [data-m="${w}"]`); if (btn) break; }
  if (!btn) btn = await p.$('.bt-modal [data-m]');
  if (btn) await btn.click();
  return md;
}
async function waitHero(p, o = {}) {
  for (let i = 0; i < (o.tries || 100); i++) {
    global.__tick = Date.now();
    const m = await L.mode(p); if (m === 'hero') return true;
    if (m === 'result') return false;
    // выбор клетки, начатый до меню хода (вынырнуть из-под земли в начале хода): подсказка должна быть видна, отвечаем касанием клетки или «Отмена»
    const ip = await p.evaluate(() => (window.Battle && Battle.UI && Battle.UI.pick) ? { type: Battle.UI.pick.type, prompt: !!document.querySelector('.bt-panel .bt-prompt'), hl: [...Battle.UI.hl.entries()].filter(([k, c]) => /hl-(move|flee|ally|danger)/.test(c.join(' '))).map(([k]) => k) } : null);
    if (ip) {
      global.__idlePicks = (global.__idlePicks || 0) + 1; if (!ip.prompt) global.__idlePickNoPrompt = true;
      try {
        if (ip.hl.length && global.__idlePicks % 2) { const [x, y] = ip.hl[0].split(',').map(Number); await L.tapCell(p, x, y); await L.sleep(150); const okb = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (okb) await okb.click({ timeout: 2000 }); }
        else { const cb = await p.$('[data-ba="pick-cancel"]'); if (cb) await cb.click({ timeout: 2000 }); }
      } catch (e) { /* панель перерисовалась между поиском и нажатием — повторим на следующем круге */ }
      await L.sleep(300); continue;
    }
    if (o.log) { const md = await handleModal(p, o.prefer || 'no'); if (md) console.log('  модал:', md); } else await handleModal(p, o.prefer || 'no');
    // лист броска (спасбросок героя, смерть и т.п.)
    const sh = await p.$('.bd-ov'); if (sh) await playSheet(p, { quiet: true });
    await L.sleep(300);
  }
  return false;
}

// Играет лист броска до закрытия. mode: 'button' | 'drag'. Возвращает список текстов результатов.
async function playSheet(p, o = {}) {
  const texts = []; let guard = 0, shots = 0;
  while (guard++ < 60) {
    global.__tick = Date.now();
    const cnt = await p.evaluate(() => document.querySelectorAll('.bd-ov:not(.out)').length);
    if (cnt > 1) { const d = await p.evaluate(() => ({ sheets: [...document.querySelectorAll('.bd-ov:not(.out)')].map(e => e.querySelector('h3').textContent + ' / ' + e.querySelector('small').textContent + ' / roll-hidden=' + e.querySelector('.bd-row').hidden), ses: (window.__ses || []).slice(-5), log: Battle.S && Battle.S.log.slice(-8).map(l => l.t) })); console.log('ДВА ЛИСТА', JSON.stringify(d, null, 1)); process.exit(3); }
    const st = await p.evaluate(() => {
      const ov = document.querySelector('.bd-ov:not(.out)'); if (!ov) return { open: false };
      const q = s => ov.querySelector(s), vis = e => e && !e.hidden && !e.disabled;
      return { open: true, title: q('h3') && q('h3').textContent, ok: vis(q('.bd-ok')), okText: q('.bd-ok') && q('.bd-ok').textContent, roll: vis(q('.bd-roll')) && !q('.bd-row').hidden, res: q('.bd-res') && q('.bd-res').textContent, rr: vis(q('.bd-reroll')), x: vis(q('.bd-x')) };
    });
    if (!st.open) break;
    if (st.ok) {
      texts.push(`${st.title}: ${st.res} [${st.okText}]`);
      if (o.shotName && shots < (o.maxShots || 6)) await L.shot(p, `${o.shotName}_${shots++}`);
      if (o.reroll && st.rr) { await p.click('.bd-ov:not(.out) .bd-reroll'); await L.sleep(300); o.reroll = false; continue; }
      await p.click('.bd-ov:not(.out) .bd-ok'); await L.sleep(300); continue;
    }
    if (st.roll) {
      if (o.cancel && st.x) { await p.click('.bd-ov:not(.out) .bd-x'); await L.sleep(300); texts.push('отмена'); break; }
      if (o.mode === 'drag') { await dragThrow(p); } else { await p.click('.bd-ov:not(.out) .bd-roll'); }
      await L.sleep(500);
      if (o.shotName && shots < (o.maxShots || 6)) await L.shot(p, `${o.shotName}_roll${shots++}`);
      continue;
    }
    await L.sleep(200);
  }
  return texts;
}
// Зажать кубик, потянуть и отпустить.
async function dragThrow(p) {
  const r = await p.evaluate(() => { const c = document.querySelector('.bd-ov:not(.out) .bd-arena canvas').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
  const sx = r.x + r.w / 2, sy = r.y + r.h * 0.55;
  await p.mouse.move(sx, sy); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(sx + i * 12, sy - i * 14); await L.sleep(16); }
  await p.mouse.up();
}

module.exports = { dockClick, handleModal, waitHero, playSheet, dragThrow };
