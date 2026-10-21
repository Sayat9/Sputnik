// «Обезьяна»: случайные действия героев через настоящий интерфейс; ищем зависания, ошибки и нарушения инвариантов.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const seed0 = +process.argv[2] || 1;
const SC = JSON.parse(process.argv[3] || '{}');
function rng32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = rng32(seed0);
const pickR = a => a[Math.floor(rnd() * a.length)];

async function invariants(p, tag) {
  return p.evaluate(tag => {
    const out = [], S = Battle.S; if (!S) return out;
    const occ = {};
    for (const u of S.units) {
      if (isNaN(u.hp) || u.hp < 0 || u.hp > u.maxHp) out.push(`${tag}: hp ${u.name} ${u.hp}/${u.maxHp}`);
      if (u.side === 'hero' && (isNaN(u.mp) || u.mp < 0 || u.mp > u.maxMp)) out.push(`${tag}: mp ${u.name} ${u.mp}/${u.maxMp}`);
      if (u.hero && u.hero.hp !== u.hp) out.push(`${tag}: рассинхрон ОЗ ${u.name} ${u.hero.hp} vs ${u.hp}`);
      if (!u.alive || u.fled || u.escaped) continue;
      if (u.x < 0 || u.y < 0 || u.x + u.size > 7 || u.y + u.size > 7) out.push(`${tag}: вне поля ${u.name} ${u.x},${u.y}`);
      for (const [x, y] of Battle.footprint(u)) { const k = x + ',' + y; if (occ[k]) out.push(`${tag}: два юнита в ${k}: ${occ[k]}, ${u.name}`); occ[k] = u.name; if (Battle.obstacleAt(x, y)) out.push(`${tag}: ${u.name} в препятствии ${k}`); }
    }
    return out;
  }, tag);
}

async function driveOption(p, log) {
  for (let i = 0; i < 160; i++) {
    if ((await L.mode(p)) === 'result') return 'turn-over';
    const sheet = await p.$('.bd-ov:not(.out)');
    if (sheet) { const t = await F.playSheet(p, { mode: rnd() < .5 ? 'drag' : 'button', cancel: rnd() < .12, reroll: rnd() < .3 }); log.push('лист'); continue; }
    const md = await F.handleModal(p, rnd() < .8 ? 'yes' : 'no'); if (md) { log.push('модал:' + md.slice(0, 70)); await L.sleep(200); if (log.filter(x => x.startsWith('модал')).length > 12) return 'STUCK'; continue; }
    const st = await p.evaluate(() => ({ busy: Battle.UI.busy, mode: Battle.UI.mode, pick: Battle.UI.pick ? Battle.UI.pick.type : null, ids: [...(Battle.UI.targetIds || [])].map(id => { const u = Battle.byId(id); return { x: u.x, y: u.y }; }), hl: [...Battle.UI.hl].map(([k, c]) => [k, c.join(' ')]), canOk: Battle.UI.pick && Battle.UI.pick.canOk }));
    if (st.mode !== 'hero') return 'turn-over';
    if (st.pick) {
      log.push('pick:' + st.pick);
      if (rnd() < .12) { await p.click('[data-ba="pick-cancel"]'); await L.sleep(200); continue; }
      const t = st.pick;
      if (t === 'unit') { const x = pickR(st.ids); await L.tapCell(p, x.x, x.y); }
      else if (t === 'units') { for (const x of st.ids.slice(0, 1 + Math.floor(rnd() * 3))) { await L.tapCell(p, x.x, x.y); await L.sleep(60); } const ok = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (ok) await ok.click(); else await p.click('[data-ba="pick-cancel"]'); }
      else if (t === 'cell' || t === 'move') {
        const cells = st.hl.filter(([k, c]) => /hl-(move|flee|ally|danger)/.test(c)); if (!cells.length) { await p.click('[data-ba="pick-cancel"]'); }
        else { const [x, y] = pickR(cells)[0].split(',').map(Number); await L.tapCell(p, x, y); await L.sleep(100); const ok = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (ok) await ok.click(); }
      }
      else if (t === 'area') { const ok = await p.$('[data-ba="pick-ok"]'); if (ok) await ok.click(); }
      else if (t === 'cube') { const cells = st.hl.filter(([k, c]) => /hl-reach/.test(c)); if (cells.length) { const [x, y] = pickR(cells)[0].split(',').map(Number); await L.tapCell(p, x, y); await L.sleep(100); const ok = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (ok) await ok.click(); else await p.click('[data-ba="pick-cancel"]'); } else await p.click('[data-ba="pick-cancel"]'); }
      else { await p.click('[data-ba="pick-cancel"]'); }
      await L.sleep(300); continue;
    }
    if (!st.busy) return 'done';
    await L.sleep(150);
  }
  return 'STUCK';
}

(async () => {
  const { b, p } = await L.launch(400, 860);
  const rec = { seed: seed0, sc: SC, turns: 0, acts: {}, issues: [], outcome: null };
  await L.setup(p, { heroes: SC.heroes || ['barb2', 'archer', 'fairy'], level: SC.level || 1 });
  if (SC.dark) await p.evaluate(() => { /* тьма у портала */ const r = state.run; for (const [x, y] of [[0,0],[0,10],[10,0],[10,10],[1,1],[9,9]]) { if (isDark(x, y)) { r.pos = { x, y }; break; } } r.light = false; });
  await L.startFightPage(p, { list: SC.list || ['goblin', 'goblin'], zone: SC.zone || 'goblin', ambush: !!SC.ambush });
  await p.waitForFunction(() => window.Battle && Battle.UI && (Battle.UI.mode === 'place' || Battle.UI.mode === 'ambush'), null, { timeout: 20000 });
  // случайная расстановка нескольких героев
  if (!SC.ambush && rnd() < .7) { for (let k = 0; k < 4; k++) { const x = Math.floor(rnd() * 7), y = 4 + Math.floor(rnd() * 3); await L.tapCell(p, x, y); await L.sleep(60); } }
  await p.click('[data-ba="place-go"]');
  const t0 = Date.now();
  for (let guard = 0; guard < 400 && Date.now() - t0 < (SC.maxMs || 420000); guard++) {
    const ok = await F.waitHero(p, { tries: 200, prefer: 'yes' });
    const m = await L.mode(p);
    if (!ok && m !== 'result') {
      const dump = await p.evaluate(() => { const S = Battle.S; const md = document.querySelector('.bt-modal'); return S ? { mode: Battle.UI.mode, busy: Battle.UI.busy, pick: Battle.UI.pick && Battle.UI.pick.type, modal: md && !md.hidden ? md.innerText.slice(0, 100) : null, sheet: !!document.querySelector('.bd-ov:not(.out)'), cur: S.order[S.turn], round: S.round, phase: S.phase, outcome: S.outcome, running: Battle.running, log: S.log.slice(-6).map(l => l.t) } : 'нет боя'; });
      rec.issues.push('HANG ' + JSON.stringify(dump)); await L.shot(p, `mk_${seed0}_hang`); break;
    }
    if (m === 'result' || !ok) break;
    rec.turns++; if (process.env.VERBOSE) console.error('ход', rec.turns, await p.evaluate(() => Battle.UI.turnUnit && (Battle.UI.turnUnit.name + ' р.' + Battle.S.round)));
    for (let a = 0; a < 7; a++) {
      if ((await L.mode(p)) !== 'hero') break;
      const info = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { opts: Battle.actionsFor(u).filter(o => o.enabled && o.cat !== 'flee').map(o => ({ id: o.id, cat: o.cat, label: o.label })), t: u.t, n: u.name }; });
      const r = rnd();
      let act = null;
      const by = c => info.opts.filter(o => c.includes(o.cat));
      if (r < .45 && by(['attack']).length) act = pickR(by(['attack']));
      else if (r < .6 && by(['skill']).length) act = pickR(by(['skill']));
      else if (r < .78 && by(['move']).length && info.t.move > 0) act = pickR(by(['move']));
      else if (r < .92 && by(['other', 'defend', 'item']).length) act = pickR(by(['other', 'defend', 'item']));
      else if (r < .94 && SC.flee) { act = { id: 'flee', cat: 'flee', label: 'flee' }; }
      if (!act) break;
      rec.acts[act.cat] = (rec.acts[act.cat] || 0) + 1;
      const catId = act.cat === 'defend' || act.cat === 'move' ? act.cat : act.cat === 'flee' ? 'flee' : act.cat;
      await F.dockClick(p, catId); await L.sleep(150);
      if (catId === 'move' || catId === 'defend' || catId === 'flee') { /* прямое действие */ }
      else { const el = await p.$(`.bt-opt[data-id="${act.id.replace(/"/g, '\\"')}"]:not(.off)`); if (!el) { await F.dockClick(p, catId); continue; } await el.click(); await L.sleep(200); }
      const log = []; const res = await driveOption(p, log);
      if (res === 'STUCK') { rec.issues.push(`STUCK на ${act.id} (${log.join(',')})`); await L.shot(p, `mk_${seed0}_stuck`); break; }
      const inv = await invariants(p, `ход${rec.turns}/${act.id}`); rec.issues.push(...inv);
    }
    if ((await L.mode(p)) === 'hero') { await F.dockClick(p, 'end'); await L.sleep(150); }
  }
  rec.outcome = await p.evaluate(() => Battle.S ? (Battle.S.outcome || 'идёт') : 'нет боя');
  rec.mode = await L.mode(p);
  if (rec.mode === 'result') { try { await p.waitForSelector('.bt-done:not([hidden])', { timeout: 15000 }); await p.click('.bt-done'); await L.sleep(800); } catch (e) { rec.issues.push('нет кнопки Готово'); } }
  rec.after = await p.evaluate(() => ({ battle: !!document.getElementById('battle'), enc: !!dgUi.enc, running: Battle.running, hp: state.party.map(c => c.hp + '/' + maxHp(c)), dead: state.party.map(c => !!c.dead) }));
  rec.errs = p.errs.slice(0, 8); rec.issues = [...new Set(rec.issues)].slice(0, 12);
  console.log(JSON.stringify(rec));
  await b.close();
})();
