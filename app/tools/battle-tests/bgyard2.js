// Кладбище прошлого, часть 2 (13.11): ночь везде, караул, склеп, свет, церковь, дом старосты, Азик, сундук → выход, выхода до стража нет.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && /rift|gy /.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false, master: true } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const clr = () => { dgUi.enc = null; dgUi.res = null; dgUi.rroll = null; }, wait = ms => new Promise(r => setTimeout(r, ms));
    const mk = (id, n) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 5, rank: 7 }); ensureKit(c); addToBag(c, { t: 'g', id: 'shovel', qty: 1 }); addToBag(c, { t: 'g', id: 'ration', qty: 9 }); return c; };
    state.party = [mk('p0', 'Аргон'), mk('p1', 'Борис')]; newRun(); const run = state.run;
    run.floor = 2; run.variant = 'undead'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); const tiles = Object.keys(run.riftsF2.tiles); clr();
    const [tx, ty] = tiles[0].split(',').map(Number); run.pos = { x: tx, y: ty }; riftEnter(); const R = run.rift; location.hash = 'labyrinth';
    await wait(400); let n = 0, third = ''; for (let i = 0; i < 4; i++) { const d = document.getElementById('vn-dlg'); if (!d) break; n++; third = d.innerText; d.click(); await wait(250); } clr();
    o.elder3 = n === 3 && /на самом севере деревни/.test(third);
    rerender(); o.noExit = !document.querySelector('[data-rift="exit"]');
    o.layout = R.map['1,11'] === 'elder' && R.map['0,0'] === 'crypt' && R.map['14,0'] === 'cathedral';
    const win = (ids) => { const e = dgUi.enc; e.outcome = 'win'; finishFight(e, e.list.map((id, i) => i)); };
    const fightIds = () => dgUi.enc ? dgUi.enc.list.slice() : null;
    // стены: склеп и церковь не реагируют
    R.pos = { x: 4, y: 2 }; riftMove(3, 2); o.wall = R.pos.x === 4 && !dgUi.res && !dgUi.enc; o.noCryptBtn = !/gy-crypt/.test(gyBar(R, 4, 2));
    R.pos = { x: 11, y: 1 }; o.noChurchBtn = !/gy-church/.test(gyBar(R, 11, 1));
    // дом старосты днём: три совета по кругу, действие тратится
    R.pos = { x: 1, y: 11 }; R.phase = 'day'; R.pt = 0; const hints = []; for (let i = 0; i < 4; i++) { gyElder(); hints.push(dgUi.res.lines[0]); clr(); }
    o.hints = /могилы светятся/.test(hints[0]) && /сама смерть/.test(hints[1]) && /в склепе/.test(hints[2]) && hints[3] === hints[0] && R.pt === 4;
    R.phase = 'night'; o.elderNightBtn = !/gy-elder/.test(gyBar(R, 1, 11));
    // ночь: монстры в деревне и полях, в деревне тяжелее
    const rate = (from, to, t) => { let f = 0, c7 = 0, amb = 0; for (let i = 0; i < 400; i++) { R.phase = 'night'; R.pt = 0; R.ncl = {}; R.pos = { x: from[0], y: from[1] }; riftMove(to[0], to[1]); if (dgUi.enc) { f++; if (dgUi.enc.ambush) amb++; if (dgUi.enc.list.some(id => MONSTERS.find(m => m.id === id).cls === 7)) c7++; } clr(); } return { f, c7, amb }; };
    const vil = rate([2, 13], [2, 12]), fld = rate([4, 13], [5, 13]), grv = (() => { let f = 0, c7 = 0; for (let i = 0; i < 400; i++) { R.phase = 'night'; R.pt = 0; R.ncl = {}; R.graves = [{ x: 0, y: 0, dug: false }]; R.pos = { x: 9, y: 4 }; riftMove(10, 4); if (dgUi.enc) { f++; if (dgUi.enc.list.some(id => MONSTERS.find(m => m.id === id).cls === 7)) c7++; } clr(); } return { f, c7 }; })(); R.graves = [];
    o.nightRates = { vil, fld, grv }; o.nightEverywhere = vil.f > 300 && fld.f > 250 && vil.c7 > grv.c7 && vil.f > grv.f;
    R.phase = 'day'; R.pt = 0; R.ncl = {}; let dayF = 0; for (let i = 0; i < 60; i++) { R.phase = 'day'; R.pt = 0; R.pos = { x: 2, y: 13 }; riftMove(2, 12); if (dgUi.enc) dayF++; clr(); } o.dayVillageQuiet = dayF === 0;
    // привал: с караульным реже и не врасплох; усталость после нападения — вдвое меньше
    const restStat = guard => { let f = 0, amb = 0, halfOk = true; for (let i = 0; i < 300; i++) { R.phase = 'night'; R.pt = 0; R.pos = { x: 2, y: 12 }; state.party.forEach(c => { run.status[c.id].fat = 4; c.hp = 5; }); riftRest(guard); if (dgUi.enc) { f++; if (dgUi.enc.ambush) amb++; const fs = state.party.map(c => run.status[c.id].fat).sort(); if (guard ? !(fs[0] === 3 && fs[1] === 4) : !(fs[0] === 3 && fs[1] === 3)) halfOk = false; } else { const fs = state.party.map(c => run.status[c.id].fat).sort(); if (guard ? !(fs[0] === 2 && fs[1] === 4) : !(fs[0] === 2 && fs[1] === 2)) halfOk = false; } clr(); } return { f, amb, halfOk }; };
    const rg = restStat(true), rn = restStat(false); o.rest = { rg, rn }; o.restOk = rn.f > rg.f * 1.4 && rn.amb === rn.f && rg.amb === 0 && rg.halfOk && rn.halfOk;
    state.party.forEach(c => { run.status[c.id].fat = 0; c.hp = maxHp(c); });
    // светящаяся могила → склеп
    R.phase = 'night'; R.graves = [{ x: 8, y: 5, name: GY_GRAVES[0], read: false, dug: false }]; R.pos = { x: 8, y: 5 }; gyRead(); clr(); o.readOnlyNoCrypt = !gyCryptOpen(R);
    gyDig(); o.digFight = !!dgUi.enc && dgUi.enc.gyGrave; win(); clr(); o.cryptOpen = gyCryptOpen(R);
    R.pos = { x: 4, y: 2 }; rerender(); o.cryptBtn = !!document.querySelector('[data-rift="gy-crypt"]');
    run.light = false; gySubEnter('crypt'); o.inCrypt = R.zone === 'crypt' && R.w === 5 && R.h === 5 && R.pos.x === 2 && R.pos.y === 4 && gyDark(R); clr(); rerender();
    o.cryptUi = !!document.querySelector('[data-rift="gy-leave"]') && !document.querySelector('[data-rift="gy-coffin"]');
    R.pos = { x: 2, y: 3 }; R.cleared = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`${i % 5},${Math.floor(i / 5)}`, true])); R.subs.crypt.cleared = R.cleared; riftMove(2, 2); clr(); rerender(); o.coffinBtn = !!document.querySelector('[data-rift="gy-coffin"]');
    gyCoffin(); o.priestFight = fightIds() && fightIds()[0] === 'buried-priest' && dgUi.enc.dark === true; win();
    o.cryptChest = !!dgUi.res && dgUi.res.anim === 'chest' && /Ключ от церкви/.test(dgUi.res.lines.join(' ')) && R.churchKey && R.cryptDone && !dgUi.res.riftOut; rerender(); o.chestAnim = !!document.querySelector('.chest-anim .ch-lid'); clr();
    R.pos = { x: 2, y: 4 }; gySubLeave(); o.leftCrypt = !R.zone && R.w === 15 && R.pos.x === 4 && R.pos.y === 2 && gyTile(R, 0, 14) === 'tavern';
    o.glow = !!R.glow && R.glow.left === 3 && gyTile(R, R.glow.x, R.glow.y) === 'grave' && /Свет на кладбище/.test(dgUi.res.title); clr();
    const g0 = { ...R.glow }; gyAdvance(1); gyAdvance(1); o.glow2 = R.glow && R.glow.left === 1; gyAdvance(1); o.glowGone = !R.glow;
    R.glow = { x: 6, y: 3, left: 3 }; R.pos = { x: 5, y: 3 }; rerender(); o.glowMark = riftMarkOf(R, 6, 3, false, false) === 'gy_glow'; riftMove(6, 3); o.spirit = fightIds() && fightIds()[0] === 'lesser-death' && dgUi.enc.gySpirit; win(); clr(); o.spiritDead = R.spiritDead;
    // церковь днём: пусто, осмотр; ночью — монстры и страж
    R.pos = { x: 11, y: 1 }; R.phase = 'day'; R.pt = 0; rerender(); o.churchBtn = !!document.querySelector('[data-rift="gy-church"]'); gySubEnter('church'); clr();
    o.inChurch = R.zone === 'church' && R.w === 3 && R.h === 7; let dayCh = 0; for (const y of [5, 4, 3, 2, 1, 0]) { R.phase = 'day'; R.pt = 0; riftMove(1, y); if (dgUi.enc) dayCh++; clr(); } o.churchDayEmpty = dayCh === 0 && R.pos.y === 0 && !R.bossDead;
    rerender(); o.exploreBtn = !!document.querySelector('[data-rift="gy-explore"]:not([disabled])') && !document.querySelector('[data-rift="gy-altar"]') && !document.querySelector('[data-rift="gy-dig"]');
    gyExplore(); o.explored = !!dgUi.res && /Осмотр церкви/.test(dgUi.res.title); clr(); gyExplore(); o.exploreOnce = !dgUi.res;
    let nightCh = 0, own = true; for (let i = 0; i < 80; i++) { R.phase = 'night'; R.pt = 0; R.ncl = {}; R.pos = { x: 1, y: 4 }; riftMove(1, 3); if (dgUi.enc) { nightCh++; if (!dgUi.enc.list.every(id => [...GY_CHURCH[9], ...GY_CHURCH[8], ...GY_CHURCH[7]].includes(id))) own = false; } clr(); } o.churchNight = nightCh > 40 && own;
    R.phase = 'night'; R.pt = 0; R.pos = { x: 1, y: 1 }; riftMove(1, 0); o.boss = fightIds() && fightIds()[0] === 'night-abbot' && dgUi.enc.gyBoss && dgUi.enc.dark === true && dgUi.enc.big10 === true;
    return o;
  });
  // победа над стражем: сундук открывается сам, «Готово» выбрасывает из разлома
  const r2 = await p.evaluate(async () => { const o = {}, run = state.run, R = run.rift; const e = dgUi.enc; e.outcome = 'win'; finishFight(e, e.list.map((id, i) => i)); saveChar(); rerender();
    o.autoChest = !!dgUi.res && dgUi.res.anim === 'chest' && dgUi.res.riftOut === true && R.bossDead && R.chestOpen && !!document.querySelector('.chest-anim'); return o; });
  await p.click('[data-dg="res-done"]'); await p.waitForTimeout(300);
  const r3 = await p.evaluate(() => ({ out: !state.run.rift && /Выход из разлома/.test(dgUi.res ? dgUi.res.title : ''), lib: !!(journal().riftsDone || {}).gyard, days: state.run.day }));
  // секретный босс и книга
  const r4 = await p.evaluate(async () => { const o = {}, run = state.run; dgUi.res = null; run.day = 10; run.act = 1; run.riftsF2 = null; riftSync(); const k = Object.keys(run.riftsF2.tiles)[0].split(',').map(Number); run.pos = { x: k[0], y: k[1] }; dgUi.res = null; riftEnter(); const R = run.rift; await new Promise(r => setTimeout(r, 300)); for (let i = 0; i < 4; i++) { const d = document.getElementById('vn-dlg'); if (d) d.click(); await new Promise(r => setTimeout(r, 200)); } dgUi.res = null;
    R.graves = GY_GRAVES.map((n, i) => ({ x: 8 + i, y: 5, name: n, read: true, dug: i < 2 })); R.phase = 'night'; R.pos = { x: 1, y: 12 }; R.ncl = { '1,11': true }; riftMove(1, 11); o.notYet = !dgUi.enc || !dgUi.enc.gyAzik; dgUi.enc = null; dgUi.res = null; dgUi.rroll = null;
    R.graves[2].dug = true; R.phase = 'night'; R.pt = 0; R.pos = { x: 1, y: 12 }; riftMove(1, 11); o.azik = !!dgUi.enc && dgUi.enc.gyAzik && dgUi.enc.list[0] === 'azik-lich' && dgUi.enc.dialog && dgUi.enc.dialog.start === 'azik-start';
    const e = dgUi.enc; e.outcome = 'win'; finishFight(e, [0]); o.book = state.party.some(c => (c.bag || []).some(x => x.id === 'eternal-secrets')) && R.azikDead && !R.bossDead; dgUi.res = null;
    const c = state.party.find(c => (c.bag || []).some(x => x.id === 'eternal-secrets')); o.wis0 = totals(c).wis.total; o.cid = c.id; o.idx = c.bag.findIndex(x => x.id === 'eternal-secrets'); return o; });
  await p.evaluate(({ cid, idx }) => { openHero(cid); heroUi.tab = 'inv'; heroUi.sel = idx; renderHero(); }, r4); await p.waitForTimeout(200);
  const hasBtn = await p.evaluate(() => !!document.querySelector('[data-hx="eternal"]')); if (hasBtn) { await p.click('[data-hx="eternal"]'); await p.waitForTimeout(200); await p.click('[data-yn="1"]'); await p.waitForTimeout(300); }
  const r5 = await p.evaluate(({ cid, wis0 }) => { const c = state.party.find(x => x.id === cid); const o = { wis: totals(c).wis.total === wis0 + 2, gone: !(c.bag || []).some(x => x.id === 'eternal-secrets'), flag: !!(c.flagsPerm || {}).eternal }; addToBag(c, { t: 'g', id: 'eternal-secrets', qty: 1 }); heroUi.sel = c.bag.findIndex(x => x.id === 'eternal-secrets'); renderHero(); o.second = !!document.querySelector('[data-hx="eternal"][disabled]'); return o; }, r4);
  const all = { ...r, ...r2, ...r3, ...r4, hasBtn, ...r5 }; let bad = 0, n = 0;
  for (const [k, v] of Object.entries(all)) { if (typeof v !== 'boolean') continue; n++; if (!v) { bad++; console.log('  ✗', k); } }
  if (bad) console.log(JSON.stringify({ nightRates: all.nightRates, rest: all.rest, days: all.days }));
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad++; }
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
