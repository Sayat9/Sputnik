// Новые 8 класса 3 этажа (v126): незавершённый клинок (закалка, горячий/хрупкий), пепельный сыч (вихрь), заводной апельсин (взрыв), маятниковый страж (оборот); встречи зон.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const z = await p.evaluate(() => { state.party = [Object.assign(clone(state.example), { id: 'p0', example: false })]; newRun(); state.run.floor = 3; state.run.day = 5; f3();
    const ids = (x, y) => { const out = new Set(); for (let i = 0; i < 150; i++) { const e = genEncounterRaw(x, y, 5, 5); if (e) e.list.forEach(id => out.add(id)); } return [...out]; };
    return { fire: ids(3, 3), trap: ids(22, 7), ess: ['unfinished-blade', 'ash-owl', 'clockwork-orange', 'pendulum-guard'].every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id && m.floor === 3 && m.cls === 8)) }; });
  ok('4 новых монстра 8 класса с эссенциями', z.ess, z);
  ok('встречи: клинок и сыч в Пылающих землях, апельсин и маятник в Зоне ловушек', ['unfinished-blade', 'ash-owl'].every(i => z.fire.includes(i)) && ['clockwork-orange', 'pendulum-guard'].every(i => z.trap.includes(i)), z);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const t = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 5 }); c.base = { str: 16, dex: 8, con: 14, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: 'longsword' } }; delete c.bag; delete c.kit; delete c.hp; return c; };
    state.run = state.run || {}; state.run.rift = null; state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const S = B.newBattle({ list: ['clockwork-orange', 'pendulum-guard', 'unfinished-blade'], zone: 'stone', floor: 3 }); B.placeMonsters(S); S.phase = 'fight'; S.round = 1;
    const [org, pend, blade] = B.mons(), h = B.heroes()[0];
    // апельсин рядом с героем взрывается в начале хода
    const c = B.freeCellsNear(h, 1, org)[0]; org.x = c[0]; org.y = c[1]; const hp0 = h.hp; await B.P['body:clockwork-orange'].turnStartAsync(org); if (B.flushQueue) await B.flushQueue(); out.boom = !B.alive(org) && h.hp < hp0;
    // клинок: горячий — +1к4 огнём, остыв — уязвим к дробящему
    const ctx = { extra: [], atk: { kind: 'melee' }, tgt: h, mods: [] }; B.P['body:unfinished-blade'].attackMods(blade, ctx); out.hot = ctx.extra.length === 1; S.round = 4; out.brittle = B.P['body:unfinished-blade'].vulnerable(blade, { dt: 'bludgeon' });
    // закалка: подряд по одной цели +1, +2
    B.P['unfinished-blade'].onHitDealt(blade, { tgt: h, atk: { kind: 'melee' } }); B.P['unfinished-blade'].onHitDealt(blade, { tgt: h, atk: { kind: 'melee' } }); const c2 = { tgt: h, atk: { kind: 'melee' }, mods: [] }; B.P['unfinished-blade'].attackMods(blade, c2); out.stack = c2.dmgPlus;
    // маятник: режущий оборот
    const c3 = B.freeCellsNear(pend, 1, h)[0]; h.x = c3[0]; h.y = c3[1]; const hp1 = h.hp; for (let i = 0; i < 6 && h.hp === hp1; i++) await B.A['pendulum-guard'].run(pend, {}, { commit() {} }); out.spin = h.hp < hp1;
    // сыч: вихрь
    const S2 = B.newBattle({ list: ['ash-owl'], zone: 'stone', floor: 3 }); B.placeMonsters(S2); S2.phase = 'fight'; const owl = B.mons()[0]; await B.A['ash-owl'].run(owl, { cell: [3, 3] }, { commit() {} }); out.dust = (S2.dust || []).length === 1 && S2.dust[0].cells.length === 9;
    return out;
  });
  ok('заводной апельсин рядом с героем взрывается и погибает', t.boom, t);
  ok('незавершённый клинок: горячий +1к4 огнём, остыв — уязвим к дробящему; закалка +2 за 2 попадания подряд', t.hot && t.brittle && t.stack === 2, t);
  ok('маятниковый страж: режущий оборот ранит соседей', t.spin, t);
  ok('пепельный сыч: облако пепла 3×3', t.dust, t);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
