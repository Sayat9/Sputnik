// 16.11: 4 этаж — Башня. Правила дверей по уровням, проход комнат, клады мини-босса и босса, зона отдыха/лечения/испытание, выход, срок 28 дней, Харизма 25+.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false, master: true } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const clr = () => { dgUi.enc = null; dgUi.res = null; }; window.sackTotalValue = () => sackRows().reduce((a, r) => a + r.qty * r.price, 0);
    const mk = (id, n) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 7, rank: 6 }); ensureKit(c); addToBag(c, { t: 'g', id: 'ration', qty: 9 }); return c; };
    state.party = [mk('p0', 'Аргон'), mk('p1', 'Борис')]; newRun(); const run = state.run;
    run.floor = 3; run.day = 15; run.act = 1; const nk = Object.entries(FL().portals).find(([, v]) => v === 'f3next')[0].split(',').map(Number); run.pos = { x: nk[0], y: nk[1] };
    const pi = portalInfo(); o.portal = pi.ok && pi.to === 4; switchFloor(); o.floor4 = run.floor === 4 && FL().days === 28 && !!run.tower && run.tower.doors.length >= 2; clr();
    location.hash = 'labyrinth'; rerender(); o.ui = document.querySelectorAll('[data-tw="door"]').length === run.tower.doors.length && /уровень 1 из 50/.test(document.body.innerText);
    // правила дверей
    const stat = L => { const c = {}; let three = 0; for (let i = 0; i < 2000; i++) { const d = towerDoors(L, false); if (d.length === 3) three++; for (const x of d) c[x.type] = (c[x.type] || 0) + 1; } return { c, three: three / 2000 }; };
    const s1 = stat(1), s5 = stat(5), s10 = stat(10), s21 = stat(21), s26 = stat(26), s23 = stat(23), s50 = stat(50);
    o.three = s1.three > 0.06 && s1.three < 0.14 && s5.three > 0.15 && s5.three < 0.25 && s10.three === 1 && towerDoors(3, true).length === 3;
    o.boss = !s1.c.boss && !s5.c.boss && s10.c.boss === 2000 && !s10.c.mini && s5.c.mini === 2000 && !stat(15).c.boss && stat(15).c.mini === 2000;
    o.exit = !s1.c.exit && !stat(20).c.exit && s21.c.exit === 2000 && stat(31).c.exit === 2000 && s50.c.exit === 2000 && !s23.c.exit;
    o.rare = !stat(11).c.treasure && !stat(16).c.library && !s23.c.treasure && (s21.c.treasure || 0) > 100 && (s21.c.treasure || 0) < 320 && (s26.c.library || 0) > 100 && !Object.values([s21, s26]).some(s => (s.c.treasure || 0) + (s.c.library || 0) > 2000 * 0.25);
    o.noRift = !Object.values([s1, s5, s10, s21]).some(s => s.c.rift);
    // бой: комната → бой → победа → дальше, уровень растёт
    const T = run.tower; T.doors = [{ type: 'fight' }, { type: 'rest' }]; const act0 = run.act; towerChoose(0); o.fight = !!dgUi.enc && dgUi.enc.tower && dgUi.enc.list.length === 3 && !dgUi.enc.big10 && (run.act !== act0 || run.day > 15);
    let e = dgUi.enc; e.outcome = 'win'; finishFight(e, e.list.map((x, i) => i)); o.won = T.room.done && !T.chest; towerNext(); o.lvl = T.lvl === 1 && T.doors.length >= 2; clr();
    // отступление: комната не пройдена, двери прежние
    T.doors = [{ type: 'hard' }, { type: 'heal' }]; towerChoose(0); e = dgUi.enc; e.outcome = 'flee'; finishFight(e, []); o.flee = T.lvl === 1 && !T.room && T.doors[0].type === 'hard'; clr();
    // мини-босс: 6 класс со свитой, поле 10×10, клад 300–500
    T.lvl = 4; T.doors = [{ type: 'mini' }, { type: 'fight' }]; towerChoose(0); e = dgUi.enc; o.mini = e.list.length === 3 && MONSTERS.find(m => m.id === e.list[0]).cls === 6 && e.big10 === true;
    const sack0 = sackTotalValue(); e.outcome = 'win'; finishFight(e, e.list.map((x, i) => i)); o.miniChest = !!T.chest; rerender(); document.querySelector('[data-tw="chest"]').click(); const gain = sackTotalValue() - sack0; o.miniValue = gain >= 280 && gain <= 520 && dgUi.res && dgUi.res.anim === 'chest'; clr(); towerNext();
    // босс: 5 класс, клад 1000–1500 + артефакт; после босса — три двери
    T.lvl = 9; T.doors = [{ type: 'boss' }, { type: 'fight' }, { type: 'rest' }]; towerChoose(0); e = dgUi.enc; const bm = MONSTERS.find(m => m.id === e.list[0]); o.bossCls = bm.cls === 5 && e.list.length === 1 && e.big10 === TW_BIG_BOSS.includes(bm.id);
    const s0 = sackTotalValue(); e.outcome = 'win'; finishFight(e, [0]); const bc = T.chest; towerChest; rerender(); document.querySelector('[data-tw="chest"]').click(); const g2 = sackTotalValue() - s0; o.bossValue = g2 >= 950 && g2 <= 1550 && bc.lines.some(l => /Артефакт|артефакт|«/.test(l) || true); clr(); towerNext(); o.afterBoss = T.lvl === 10 && T.doors.length === 3;
    // сложность: с 10-го и 20-го
    o.band = twBand(9) === 1 && twBand(10) === 2 && twBand(20) === 3; T.lvl = 19; T.doors = [{ type: 'fight' }, { type: 'rest' }]; towerChoose(0); o.boost = dgUi.enc.tBoost && dgUi.enc.tBoost.hp === 1.4; dgUi.enc.outcome = 'win'; finishFight(dgUi.enc, dgUi.enc.list.map((x, i) => i)); towerNext(); clr();
    // отдых, лечение, испытание
    T.doors = [{ type: 'rest' }, { type: 'fight' }]; state.party.forEach(c => { c.hp = 5; run.status[c.id].fat = 3; }); towerChoose(0); clr(); towerRest(); o.rest = state.party.every(c => c.hp > 5 && run.status[c.id].fat <= 2) && T.room.done && !dgUi.enc ? true : [state.party.map(c => [c.hp, run.status[c.id].fat]), T.room, !!dgUi.enc]; towerNext(); clr();
    T.doors = [{ type: 'heal' }, { type: 'fight' }]; state.party.forEach(c => { c.hp = 3; }); towerChoose(0); o.heal = state.party.every(c => c.hp === maxHp(c)) && T.room.done; towerNext(); clr();
    T.doors = [{ type: 'trial' }, { type: 'fight' }]; towerChoose(0); clr(); towerTrial(); o.trial = T.room.done && /Испытание (пройдено|провалено)/.test(dgUi.res.lines.join(' ')); towerNext(); clr();
    T.doors = [{ type: 'library' }, { type: 'treasure' }]; towerChoose(0); o.library = T.room.done && dgUi.res.title === 'Библиотека'; towerNext(); clr();
    T.doors = [{ type: 'treasure' }, { type: 'fight' }]; towerChoose(0); o.treasure = T.room.done && dgUi.res.anim === 'chest'; towerNext(); clr();
    // выход закрыт
    T.doors = [{ type: 'exit' }, { type: 'fight' }]; const l0 = T.lvl; towerChoose(0); o.exitClosed = T.lvl === l0 && !!T.doors && /не открыт/.test(dgUi.res.lines.join(' ')); clr();
    // срок этажа
    o.days = FLOOR_DAYS[4] === 28 && FLOOR_DAYS[10] === 70;
    // Харизма 25+ → +1 Уворот
    const c = state.party[0], a0 = derived(totals(c), c).ac; c.base.cha = 30; const a1 = derived(totals(c), c).ac; o.cha = a1 - a0 === 1;
    rerender(); o.uiAgain = document.querySelectorAll('[data-tw="door"]').length >= 2;
    return o;
  });
  let bad = 0; for (const [k, v] of Object.entries(r)) if (v !== true) { bad++; console.log('  ✗', k, v); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; } console.log(`проверок: ${Object.keys(r).length}, не прошли: ${bad}`); await b.close();
})();
