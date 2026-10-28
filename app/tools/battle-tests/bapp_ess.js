// Эссенции: сведения «??» до открытия библиотекой/применения; выбор при выпадении (впитать/сохранить/оставить); выбрасывание вещей; ночная группа.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const r = await p.evaluate(() => {
    const out = {}, c = state.party[0]; c.essences = ['goblin']; const j = journal(); delete (j.essUsed || {}).goblin; j.known.goblin = j.known.goblin || { revealed: [] }; j.known.goblin.revealed = [];
    const txt = () => { const d = document.createElement('div'); d.innerHTML = essCard('goblin'); return d.innerText; };
    out.hidden = essCard('goblin');
    (j.essUsed ||= {}).goblin = true; out.used = essCard('goblin');
    j.known.goblin.revealed = ['ess-stats', 'ess-passive', 'ess-active']; out.full = essCard('goblin');
    j.known.goblin.revealed = []; delete j.essUsed.goblin;
    // выбрасывание
    c.bag = []; addToBag(c, { t: 'g', id: 'ration', qty: 4 }); c.equip.main = { t: 'w', id: 'sword' };
    openHero(c.id); heroUi.tab = 'inv'; heroUi.sel = 0; renderHero(); out.dropAllBtn = !!document.querySelector('[data-hx="drop-all"]');
    document.querySelector('[data-hx="drop-all"]').click(); out.afterDropAll = c.bag.length;
    heroUi.sel = null; heroUi.slot = 'main'; renderHero(); out.dropEqBtn = !!document.querySelector('[data-hx="drop-eq"]');
    document.querySelector('[data-hx="drop-eq"]').click(); out.afterDropEq = !!c.equip.main;
    // ночная группа
    state.run.floor = 1; state.run.cleared = {}; const k = '5,3'; state.run.day = 5; state.run.act = 1;
    const sizes = { quiet: [], old: [] };
    for (let i = 0; i < 80; i++) { state.run.cleared[k] = absAct(state.run); sizes.quiet.push(genEncounter(5, 3, 5, 3, false, true).list.length); state.run.cleared[k] = 0; state.run.day = 9; sizes.old.push(genEncounter(5, 3, 9, 3, false, true).list.length); state.run.day = 5; }
    out.quietMax = Math.max(...sizes.quiet); out.oldMax = Math.max(...sizes.old);
    out.portalSafe = (() => { state.run.floor = 2; state.run.variant = 'goblin'; return genEncounter(0, 10, 5, 3, false, true); })();
    return out;
  });
  ok('карточка эссенции: всё «??»', /\?\? \(П\)/.test(r.hidden) && /\?\? \(А\)/.test(r.hidden) && /класс · \?\?/.test(r.hidden), r.hidden.slice(0, 300));
  ok('после применения: название, мана, урон; эффекты «??»', /Остальные эффекты: \?\?/.test(r.used) && /маны/.test(r.used) && !/\?\? \(А\)/.test(r.used), r.used.slice(-250));
  ok('библиотека открыла разделы — видно всё', !/\?\?/.test(r.full), r.full.slice(0, 300));
  ok('«Выбросить все» у стопки, стопка исчезла', r.dropAllBtn && r.afterDropAll === 0);
  ok('надетое можно выбросить', r.dropEqBtn && r.afterDropEq === false);
  ok('ночью на зачищенном ≤ 2 дней назад группа ≤ 2', r.quietMax <= 2, r.quietMax);
  ok('на старом тайле ночная группа полная (до 3)', r.oldMax >= 3, r.oldMax);
  ok('безопасная клетка: никого', r.portalSafe === null);
  // выбор эссенции после боя
  await p.evaluate(() => { state.run.floor = 1; state.party.forEach(c => { c.essences = []; }); });
  await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  await p.evaluate(() => { const B = Battle; B.S.forceWins = ['goblin']; B.S.outcome = 'win'; B.S.killed.push(0); B.mons().forEach(m => { m.alive = false; m.hp = 0; }); });
  await p.evaluate(() => { Battle.UI.endTurn && Battle.UI.endTurn(); });
  let seen = false; for (let i = 0; i < 80 && !seen; i++) { seen = await p.evaluate(() => !!document.querySelector('[data-ec="absorb"]')); if (!seen) { await F.handleModal(p, 'yes'); await L.sleep(250); } }
  ok('после боя три выбора: впитать, сохранить (серая), оставить', seen && await p.evaluate(() => !!document.querySelector('[data-ec="keep"][disabled]') && !!document.querySelector('[data-ec="leave"]')));
  if (seen) {
    await p.evaluate(() => document.querySelector('[data-ec="absorb"]').click()); await L.sleep(200);
    const heroes = await p.evaluate(() => [...document.querySelectorAll('[data-eh]')].map(e => e.innerText));
    ok('впитать → выбор героя', heroes.length === 2, heroes.join('|'));
    await p.evaluate(() => document.querySelector('[data-eh]:not([disabled])').click()); await L.sleep(300); await p.evaluate(() => { const y = document.querySelector('[data-yn="1"]'); if (y) y.click(); }); await L.sleep(300);
    ok('эссенция у героя', await p.evaluate(() => state.party.some(c => (c.essences || []).includes('goblin'))));
    await L.sleep(300); const dn = await p.$('.bt-done'); if (dn) await dn.click(); await L.sleep(500);
  }
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет');
  ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
