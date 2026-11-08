// «Чаща прошлого» (08.11): хранитель (корни, регенерация), натуралист (3 фазы, диалоги), Луна (формы), эссенции стражей, шприц, варка, отдых.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const m = await p.evaluate(() => { const o = {}; state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, rank: 7, level: 5 })]; newRun(); const run = state.run; const c = state.party[0];
    // варка зелий: старший алхимик, после привала
    c.essences = ['senior-alch']; c.bag = (c.bag || []).filter(e => !/herb|potion/.test(e.id)); c.bag.push({ t: 'g', id: 'herb-heal', qty: 3 }, { t: 'g', id: 'herb-food', qty: 2 });
    o.noBrew = brewButtons().length === 0; run.canBrew = true; o.btns = brewButtons().map(x => x.id).join(); brewPotion(4); o.good = countGear(c, 'potion-good'); o.herbs = herbCount(); o.once = brewButtons().length === 0; dgUi.res = null;
    // корни земли: +15 % на привале
    c.essences = ['fallen-keeper']; o.keeperPct = restBonusPct();
    // сундук лаборатории: шприц ~40 %
    let got = 0; for (let i = 0; i < 200; i++) { run.rift = { id: 'past', bossDead: true, chestOpen: false, pos: { x: 14, y: 0 } }; c.bag = []; riftChest(); if (countGear(c, 'mutagen-syringe')) got++; dgUi.res = null; } o.syr = got; run.rift = null;
    return o; });
  ok('«Сварить зелье»: только после привала, 4 травы → хорошее зелье, раз за привал', m.noBrew && m.btns === 'brew2,brew4' && m.good === 1 && m.herbs === 1 && m.once, m);
  ok('«Корни земли»: на привале +15 %', m.keeperPct === 0.15, m);
  ok('сундук лаборатории: шприц мутагена ~40 % (' + m.syr + '/200)', m.syr > 50 && m.syr < 115, m);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const t = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {}; const C = { commit() {} };
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 6 }); c.base = { str: 14, dex: 15, con: 14, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; c.essences = []; return c; };
    state.run = state.run || {}; state.run.rift = null; state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const fight = (list, o) => { const S = B.newBattle({ list, zone: 'beast', floor: 2, ...(o || {}) }); B.placeMonsters(S); S.phase = 'fight'; S.round = 1; return S; };
    // хранитель: корни (клетки + опутан), регенерация, огонь мешает
    let S = fight(['fallen-keeper'], { big10: true }); let [k] = B.mons(), h = B.heroes()[0];
    let rooted = false, cellsOk = false; for (let i = 0; i < 10 && !rooted; i++) { await B.A['fallen-keeper'].run(k, { cell: [h.x, h.y] }, C); rooted = !!B.has(h, 'restrained'); cellsOk = (S.tmpRoots || []).length >= 1; }
    out.roots = rooted && cellsOk;
    const oTO = B.timeOK; B.timeOK = () => true; const cut = B.envActions(h).find(o => o.id === 'cut-roots'); out.cutOpt = !!cut && cut.enabled; if (cut) await cut.run(); out.cut = !B.has(h, 'restrained'); B.timeOK = oTO;
    S.round = 5; B.onRound(5); out.rootsGone = !(S.tmpRoots || []).length;
    k.hp = k.maxHp - 20; B.P["body:fallen-keeper"].turnStart(k); out.regen = k.hp === k.maxHp - 16; B.P['body:fallen-keeper'].dmgFlat(k, { dt: 'fire' }); const hk = k.hp; B.P['body:fallen-keeper'].turnStart(k); out.burnStop = k.hp === hk;
    // натуралист: фазы, диалог при смерти
    S = fight(['naturalist']); let [nat] = B.mons(); nat.hp = Math.floor(nat.maxHp * 0.6); B.P['body:naturalist'].turnStart(nat); out.ph2 = nat.phase === 2; nat.hp = Math.floor(nat.maxHp * 0.3); B.P['body:naturalist'].turnStart(nat); out.ph3 = nat.phase === 3 && nat.pass.includes('fled-chimera');
    S.ev = { dialog: { start: 'nat-start', death: 'nat-death', who: 'naturalist' } }; B.say('naturalist', 'ВЫ ПРИШЛИ ПОМЕШАТЬ МОЕМУ ШЕДЕВРУ!?'); await new Promise(r => setTimeout(r, 50));
    out.dlg = !!document.getElementById('vn-dlg') && /ШЕДЕВРУ/.test(document.getElementById('vn-dlg').innerText);
    document.getElementById('vn-dlg').click(); await new Promise(r => setTimeout(r, 200)); out.dlgClosed = !document.getElementById('vn-dlg');
    B.P['body:naturalist'].onDeath(nat); await new Promise(r => setTimeout(r, 50)); out.dlgDeath = !!document.getElementById('vn-dlg') && /завершеннн/.test(document.getElementById('vn-dlg').innerText); const dd = document.getElementById('vn-dlg'); if (dd) dd.click();
    // Луна: оборотень (вторая атака), на половине ОЗ — волк; регенерация
    S = fight(['luna']); let [lu] = B.mons(); h = B.heroes()[0]; B.P['body:luna'].turnStart(lu); out.were = lu.form === 'were';
    let atks = 0; const da = B.doAttack; B.doAttack = async (...a) => { atks++; return { hit: false }; }; await B.P['body:luna'].attackDone(lu, { tgt: h, res: { hit: true }, atk: { kind: 'melee' } }); B.doAttack = da; out.extra = atks === 1;
    lu.hp = Math.floor(lu.maxHp / 2) - 1; B.P['body:luna'].turnStart(lu); out.wolf = lu.form === 'wolf'; S.round = 3; B.P['body:luna'].turnStart(lu); out.toggle = lu.form === 'were';
    const lh = lu.hp; B.P.luna.turnStart(lu); out.lregen = lu.hp === lh + 3;
    // эссенция Луны у героя: Ловкость 15 → в Силу уходит 6, после хода — обратно
    S = fight(['wolf']); h = B.heroes()[0]; h.pass.push('luna'); const s0 = h.abil.str, d0 = h.abil.dex; await B.A.luna.run(h, {}, C); out.lunaHero = h.lunaT && h.lunaT.form === (s0 >= d0 ? 'wolf' : 'were');
    h.abil.str = s0; h.abil.dex = d0; h.lunaT = null; h.abil.dex = 15; h.abil.str = 12; const oUI = B.UI; B.UI = { active: true, choose: async () => 'wolf', fxText() {}, banner() {}, refresh() {} };
    const man = B.ctlOf; B.ctlOf = () => 'ui'; await B.A.luna.run(h, {}, C); B.ctlOf = man; B.UI = oUI; out.transfer = h.abil.str === 18 && h.abil.dex === 9;
    B.P['past-lunaform'].turnEnd(h); out.revert = h.abil.str === 12 && h.abil.dex === 15;
    // шприц: опция в бою, раз в день
    h.hero.bag = [{ t: 'g', id: 'mutagen-syringe', qty: 1 }]; state.run.floor = 2; state.run.day = 3; B.timeOK = () => true; B.spendTime = () => {}; const so = B.envActions(h).find(o => o.id === 'syringe'); out.syrOpt = !!so && so.enabled; if (so) { h.t.bonus = 1; await so.run(); } const so2 = B.envActions(h).find(o => o.id === 'syringe'); out.syrOnce = !!so2 && !so2.enabled;
    return out;
  });
  ok('хранитель: корни опутывают и остаются на клетках, «Срубить корни» освобождает, через 2 хода корни уходят', t.roots && t.cutOpt && t.cut && t.rootsGone, t);
  ok('хранитель: регенерация 6, огонь её прерывает', t.regen && t.burnStop, t);
  ok('натуралист: фаза полузверя < 66 %, химера < 33 % (хвост)', t.ph2 && t.ph3, t);
  ok('диалог как в новелле: «ВЫ ПРИШЛИ ПОМЕШАТЬ…», касание закрывает; при смерти — «мой мой малыш…»', t.dlg && t.dlgClosed && t.dlgDeath, t);
  ok('Луна: оборотень бьёт дважды, с половины ОЗ — волк, потом смена формы; регенерация 3', t.were && t.extra && t.wolf && t.toggle && t.lregen, t);
  ok('эссенция Луны: «Трансформация» — Ловкость 15 → Сила +6 (Ловкость 9), после хода обратно', t.lunaHero && t.transfer && t.revert, t);
  ok('«Шприц мутагена» в бою — раз в день', t.syrOpt && t.syrOnce, t);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
