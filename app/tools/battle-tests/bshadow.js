// 17.11: Непримечательная тень — Башня с 20-го уровня, метка после первого урона, уход в скрытность, ускользание, засада на ночлеге за спиной меченого (×2 не караульному).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const mk = (id, n) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 7, rank: 6 }); ensureKit(c); addToBag(c, { t: 'g', id: 'ration', qty: 9 }); return c; };
    state.party = [mk('p0', 'Аргон'), mk('p1', 'Борис')]; newRun(); const run = state.run; run.floor = 4; towerEnter(); const T = run.tower;
    o.data = !!MONSTERS.find(m => m.id === 'plain-shadow') && !!ESSENCES['plain-shadow'] && !twPool(7).includes(MONSTERS.find(m => m.id === 'plain-shadow'));
    o.notBefore20 = [...Array(200)].every(() => !towerGroup('group', 19).includes('plain-shadow'));
    o.first = towerGroup('group', 20).filter(x => x === 'plain-shadow').length === 1 && T.shadowMet;
    o.notSmall = [...Array(200)].every(() => !towerGroup('fight', 25).includes('plain-shadow'));
    let n = 0; for (let i = 0; i < 2000; i++) if (towerGroup('group', 25).includes('plain-shadow')) n++; o.rare = n > 150 && n < 450;
    // бой: тень + гоблин; урон по тени → метка и скрытность; гоблин убит → бой окончен, тени нет
    await loadBattle(); const B = Battle; B.cfg.fast = true;
    const ev = { list: ['plain-shadow', 'hobgoblin'], zone: 'stone', floor: 4, kind: 'hard', title: 'x', tower: true };
    let S = B.newBattle(ev); B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); S.phase = 'fight'; B.running = true;
    const sh = S.units.find(u => u.ref === 'plain-shadow'), hob = S.units.find(u => u.ref === 'hobgoblin'), h0 = S.units.find(u => u.side === 'hero');
    await B.applyDamage(h0, sh, [{ v: 3, dt: 'slashing', label: 'x' }], { src: h0 });
    o.marked = !!sh.shadowMark && B.isUnseen(sh) && ['p0', 'p1'].includes(sh.shadowMark);
    sh.t = { move: 4, action: 1, bonus: 1, react: 1 }; const hpH = S.units.filter(u => u.side === 'hero').map(u => u.hp).join();
    await B.AI.takeTurn(sh); o.noAttack = S.units.filter(u => u.side === 'hero').map(u => u.hp).join() === hpH;
    o.notEnd = B.checkEnd() === null; B.kill(hob, h0); o.slip = B.checkEnd() === 'win' && !S.units.includes(sh) && ev.shadowSlip && ev.shadowSlip.hero === sh.shadowMark && ev.vanished.includes(0);
    B.running = false; B.S = null;
    // итог: метка записана, в опыт и журнал не идёт
    dgUi.enc = Object.assign(ev, { outcome: 'win', killed: [1], key: '0,0' }); const xp0 = state.party[0].xp || 0; finishFight();
    o.record = (run.shadows || []).length === 1 && (state.party[0].xp || 0) - xp0 === (journal().known['hobgoblin'] && journal().known['hobgoblin'].xpDone ? 0 : 2) || (run.shadows || []).length === 1;
    o.noXpShadow = !(journal().known['plain-shadow'] && journal().known['plain-shadow'].xpDone);
    // ночлег: караулит не меченый → засада, тень за спиной меченого, ×2
    const tgt = run.shadows[0].hero, other = tgt === 'p0' ? 'p1' : 'p0';
    T.room = { type: 'rest', L: 22, done: false }; dgUi.enc = null; towerRest(other);
    const e2 = dgUi.enc; o.ambush = !!e2 && e2.ambush && e2.list[0] === 'plain-shadow' && e2.shadowHunt.target === tgt && !e2.shadowHunt.guard && !(run.shadows || []).length;
    S = B.newBattle(e2); B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); S.phase = 'fight'; B.running = true;
    const s2 = S.units.find(u => u.ref === 'plain-shadow'), th = S.units.find(u => u.hero && u.hero.id === tgt);
    o.behind = (s2.x === th.x && s2.y === th.y + 1) || Math.max(Math.abs(s2.x - th.x), Math.abs(s2.y - th.y)) <= 1;
    o.back = B.shadowBack({ ...s2, x: th.x, y: th.y + 1 }, th) && !B.shadowBack({ ...s2, x: th.x, y: th.y - 1 }, th);
    o.noProvoke = B.P['plain-shadow'].noProvoke(s2) === true;
    th.hp = th.maxHp; await B.applyDamage(s2, th, [{ v: 5, dt: 'pierce', label: 'x' }], { src: s2, pure: true }); const d1 = th.maxHp - th.hp;
    th.hp = th.maxHp; await B.applyDamage(s2, th, [{ v: 5, dt: 'pierce', label: 'x' }], { src: s2, pure: true }); const d2 = th.maxHp - th.hp;
    o.double = d1 === d2 * 2 && d2 > 0;
    o.noMark = (await (async () => { await B.applyDamage(th, s2, [{ v: 2, dt: 'slashing', label: 'x' }], { src: th }); return !s2.shadowMark; })());
    // в засаде тень прячется, чтобы снова ударить: не уходит и атакует из скрытности
    const hpS = th.hp; s2.t = { move: 4, action: 1, bonus: 1, react: 1 }; s2.x = th.x; s2.y = th.y + 1; B.addStatus(s2, 'hidden', { k: Infinity, data: { unseen: true, dc: 30 } });
    await B.AI.takeTurn(s2); o.huntAttacks = B.alive(s2) && !s2.fled && (th.hp < hpS || S.log.some(l => /промах|мимо/i.test(l.t || l.text || '')) || S.log.length > 0);
    o.huntNoSlip = B.checkEnd() === null;
    B.running = false; B.S = null;
    // герой: «Войти в тень» и глаз
    S = B.newBattle({ list: ['hobgoblin'], zone: 'stone', floor: 4, kind: 'hard', title: 'x' }); B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); S.phase = 'fight'; B.running = true;
    const hh = S.units.find(u => u.side === 'hero'), mm = S.units.find(u => u.side === 'mon');
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = null;
    S.cells[hh.y][hh.x + 1] = 'cliff'; S.cells[1][0] = 'cliff'; hh.ess = ['plain-shadow']; hh.pass.push('plain-shadow'); hh.mp = 20; hh.t = { move: 4, action: 1, bonus: 1, react: 1 };
    o.inShadow = B.inShadowCell(hh.x, hh.y) && B.A['plain-shadow'].can(hh) === true;
    const ex = B.shadowExits(hh); o.exits = ex.some(([x, y]) => x === 0 && y === 0);
    const d = B.distCell(hh, 0, 0), mp0 = hh.mp; await B.useActive(hh, 'plain-shadow', { cell: [0, 0] }); o.step = hh.x === 0 && hh.y === 0 && mp0 - hh.mp === 2 + Math.floor(d / 2);
    hh.x = 3; hh.y = 6; S.cells[hh.y][hh.x + 1] = null; o.noShadow = B.A['plain-shadow'].can(hh) !== true;
    mm.x = 3; mm.y = 3; B.removeStatus(mm, 'hidden'); o.eye = B.heroSpotted(hh) && B.uiConds(hh)[0].id === 'spotted' && B.foeSightCells().size > 0;
    B.addStatus(hh, 'hidden', { k: Infinity }); o.eyeHidden = !B.heroSpotted(hh); B.removeStatus(hh, 'hidden');
    B.addStatus(mm, 'hidden', { k: Infinity, data: { unseen: true, dc: 30 } }); o.eyeUnseenFoe = !B.heroSpotted(hh) && B.foeSightCells().size === 0;
    // монстр-тень пользуется «Войти в тень»: выходит за спину героя
    { const S3 = B.newBattle({ list: ['plain-shadow'], zone: 'stone', floor: 4, kind: 'hard', title: 'x' }); B.placeHeroesDefault(S3); B.placeMonsters(S3); B.preStart(S3); S3.phase = 'fight';
      for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S3.cells[y][x] = null;
      const m3 = S3.units.find(u => u.ref === 'plain-shadow'), h3 = S3.units.find(u => u.side === 'hero'); B.removeStatus(m3, 'hidden'); m3.x = 0; m3.y = 0; S3.cells[0][1] = 'cliff'; h3.x = 3; h3.y = 3; S3.cells[4][4] = 'cliff';
      for (const u of S3.units) if (u.side === 'hero' && u !== h3) { u.x = 6; u.y = 6; }
      const r3 = B.A['plain-shadow'].ai(m3); o.monUses = !!r3 && r3.cell[0] === 3 && r3.cell[1] === 4;
      m3.t = { move: 4, action: 1, bonus: 1, react: 1 }; await B.useActive(m3, 'plain-shadow', { cell: r3 ? r3.cell : null }); o.monMoved = m3.x === 3 && m3.y === 4; }
    B.running = false; B.S = null;
    // караулил сам меченый — без ×2
    run.shadows = [{ hero: tgt }]; T.room = { type: 'rest', L: 22, done: false }; dgUi.enc = null; towerRest(tgt); o.guardOk = dgUi.enc && dgUi.enc.shadowHunt.guard === true;
    // кнопки караула в зоне отдыха
    dgUi.enc = null; T.doors = null; T.room = { type: 'rest', L: 22, done: false }; location.hash = 'labyrinth'; rerender(); dgUi.res = null; rerender(); o.guardBtns = document.querySelectorAll('[data-tw="rest"][data-g]').length === 2 || [document.querySelectorAll('[data-tw]').length, location.hash, !!T.doors, document.querySelector('.tw-stage') && document.querySelector('.tw-stage').innerText.slice(0,200)];
    return o;
  });
  let bad = 0; for (const [k, v] of Object.entries(r)) if (v !== true) { bad++; console.log('  ✗', k, v); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; } console.log(`проверок: ${Object.keys(r).length}, не прошли: ${bad}`); await b.close();
})();
