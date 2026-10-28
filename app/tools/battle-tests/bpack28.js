// Пакет 28.10: парные клинки, пика на 1 клетку, молния у мыши, варвар (щит/пика), окно броска (пропустить, броски монстров), настройки, подтверждение эссенции, возврат встречи.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true });
  const R = [], ok = (n, c, x) => { R.push(!!c); if (!c) console.log('  ✗', n, '—', x == null ? '' : JSON.stringify(x)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  await p.evaluate(() => { const g = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => { if (window.__nat != null && a instanceof Uint32Array) { a[0] = window.__nat; return a; } return g(a); }; });

  console.log('start A'); const A = await Promise.race([p.evaluate(async () => {
    const B = Battle, o = {}, c = state.party[0];
    B.cfg.fast = true;
    // парные клинки: одна атака в списке, вторая идёт сама по той же цели, обе с уроном ×0,6
    c.bag = []; c.equip = { main: { t: 'w', id: 'dagger' }, off: { t: 'w', id: 'dagger' } };
    B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); B.S.opts.autoHeroes = true;
    const h = B.heroes()[0], m = B.S.units.find(u => u.side === 'mon'); m.x = h.x; m.y = h.y - 1; m.hp = m.maxHp = 999;
    const ids = B.attacksOf(h).map(a => a.id); const hand = B.attacksOf(h).find(a => a.id === 'hand:dagger');
    o.ids = ids; o.twin = !!hand.twin; o.mult = [hand.dmgMult, hand.twinOff && hand.twinOff.dmgMult];
    let rolls = 0; const da = B.doAttack; B.doAttack = async (u, t, atk, op) => { rolls++; return { hit: true, nat: 10, dealt: 1, cancelled: false }; };
    const picker = B.UI.pickUnit; B.UI.pickUnit = async () => m;
    try { await B.runAttackBase(h, hand); } finally { B.doAttack = da; B.UI.pickUnit = picker; }
    o.attacks = rolls;
    // пика: досягаемость 1 клетка
    c.equip = { main: { t: 'w', id: 'pike' } };
    B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); const h2 = B.heroes()[0];
    o.pikeReach = B.heroAttacks(h2).find(a => a.id === 'hand:pike').reach;
    // громовая мышь — молния
    o.mouse = [MONSTERS.find(x => x.id === 'mouse').traits.find(t => t[2] === 'attacks')[1]];
    B.newBattle({ list: ['mouse'], zone: 'beast', floor: 1 }); const mu = B.S.units.find(u => u.side === 'mon'); o.mouseDt = B.attacksOf(mu)[0].dt;
    return o;
  }), new Promise((_, r) => setTimeout(() => r(new Error('A timeout')), 20000))]);
  ok('парные клинки: в списке одна атака «hand», второй рукой отдельно нет', A.twin && !A.ids.includes('off:dagger'), A.ids);
  ok('парные клинки: урон каждой атаки ×0,6', A.mult[0] === 0.6 && A.mult[1] === 0.6, A.mult);
  ok('парные клинки: две атаки за одно действие по одной цели', A.attacks === 2, A.attacks);
  ok('пика бьёт на 1 клетку', A.pikeReach === 1, A.pikeReach);
  ok('громовая мышь бьёт молнией', A.mouseDt === 'lightning' && /молнией/.test(A.mouse[0]), A);

  console.log('>>', '// варвар:');
  // варвар: щит+щит, ростовой щит+щит, пика в обеих руках
  const BR = await p.evaluate(() => {
    const c = state.party[0], out = {};
    const btns = (bag, equip, i) => { c.bag = bag; c.equip = equip; openHero(c.id); heroUi.tab = 'inv'; renderHero(); heroUi.sel = i; renderHero(); return [...document.querySelectorAll('#heroov [data-hx="equip"]')].map(b => b.textContent.trim() + (b.disabled ? '!' : '')); };
    out.shieldTower = btns([{ t: 'w', id: 'shield', qty: 1 }], { main: { t: 'w', id: 'tower-shield' } }, 0);
    out.pikeLeft = btns([{ t: 'w', id: 'pike', qty: 1 }], { main: { t: 'w', id: 'sword' }, off: { t: 'w', id: 'shield' } }, 0);
    document.querySelector('#heroov [data-hx="equip"][data-slot-to="off"]').click();
    out.after = [c.equip.main && c.equip.main.id, c.equip.off && c.equip.off.id, c.giantGrip];
    closeHero(); return out;
  });
  ok('варвар: щит можно к ростовому щиту, пику — в левую руку', BR.shieldTower.every(x => !x.endsWith('!')) && BR.pikeLeft.length === 2, BR);
  ok('варвар: пика в левой руке надевается («Великан»)', BR.after[1] === 'pike' && BR.after[0] === 'sword' && BR.after[2] === true, BR.after);

  console.log('>>', '// окно броска:');
  // окно броска: кнопка «Пропустить», броски монстров видны, настройка «пропускать»
  await p.evaluate(() => { state.party[0].equip = { main: { t: 'w', id: 'sword' } }; state.party[0].bag = []; });
  const D = await p.evaluate(async () => {
    const B = Battle, o = {}; B.cfg.fast = false;
    B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); B.S.opts.autoHeroes = false;
    B.Dice && (state.settings = state.settings || {}); state.settings.skipDice = false; state.settings.monDice = true;
    const h = B.heroes()[0];
    // игрок: окно с кнопкой «Пропустить» -> результат без ожидания
    B.UI.open();
    const ses = B.Dice.session(h, { title: 'Тест', sub: '' });
    const pr = ses.d20({ label: 'x', mods: [], cancel: false });
    await new Promise(r => setTimeout(r, 400));
    o.hasSkip = !!document.querySelector('.bd-skip:not([hidden])');
    document.querySelector('.bd-skip').click();
    const r = await Promise.race([pr.then(() => 'ready'), new Promise(r => setTimeout(() => r('late'), 100))]);
    o.resultShown = !!document.querySelector('.bd-res').textContent.trim();
    document.querySelector('.bd-ok').click(); await pr; ses.close(); o.skipResolved = (await pr).nat >= 1;
    await new Promise(r => setTimeout(r, 300));
    // монстр: окно открывается само и закрывается
    const mon = B.S.units.find(u => u.side === 'mon');
    const ms = B.session(mon, { title: 'Укус', sub: '' });
    const mp = ms.d20({ label: 'Бросок атаки', mods: [{ v: 3, l: 'атака' }], cancel: false });
    await new Promise(r => setTimeout(r, 300));
    o.monsterWindow = !!document.querySelector('.bd-ov.autoplay');
    const sk = document.querySelector('.bd-ov:not(.out) .bd-skip'); if (sk) sk.click();
    const mr = await mp; o.monsterRoll = mr.nat >= 1 && mr.auto === true;
    await ms.finish({ text: 'тест' });
    await new Promise(r => setTimeout(r, 200));
    o.closed = !document.querySelector('.bd-ov:not(.out)');
    // настройка: сразу результат, окон нет
    state.settings.skipDice = true;
    const s2 = B.session(h, { title: 'Тест', sub: '' }); const r2 = await s2.d20({ label: 'x', mods: [], cancel: false });
    o.skipSetting = r2.auto === true && !document.querySelector('.bd-ov');
    state.settings.skipDice = false;
    B.UI.close(); B.cfg.fast = true; return o;
  });
  ok('в окне броска есть «Пропустить»', D.hasSkip, D);
  ok('«Пропустить» сразу даёт результат', D.resultShown && D.skipResolved, D);
  ok('бросок монстра виден в окне, само бросается', D.monsterWindow && D.monsterRoll, D);
  ok('окно монстра закрывается само', D.closed, D);
  ok('настройка «Пропускать броски»: сразу результат без окна', D.skipSetting, D);

  console.log('>>', '// настройки на главном');
  // настройки на главном экране
  await p.evaluate(() => { state.run = null; location.hash = ''; rerender(); });
  await p.click('[data-action="settings"]');
  const S = await p.evaluate(() => ({ open: !document.getElementById('setov').hidden, txt: document.getElementById('setov').textContent }));
  ok('настройки: звук и пропуск бросков', S.open && /Звук/.test(S.txt) && /Пропускать броски/.test(S.txt), S);
  await p.click('[data-setk="sound"]'); await p.click('[data-setk="skipDice"]');
  ok('настройки сохраняются', await p.evaluate(() => state.settings.sound === true && state.settings.skipDice === true));
  await p.evaluate(() => { state.settings.skipDice = false; state.settings.sound = false; document.getElementById('setov').hidden = true; });

  console.log('>>', '// подтверждение эссенции');
  // подтверждение эссенции в меню героя
  const E = await p.evaluate(async () => {
    const c = state.party[0]; c.essences = []; c.level = 2; inventory().essStash = ['wolf'];
    openHero(c.id); heroUi.tab = 'skills'; renderHero();
    const bt = document.querySelector('#heroov [data-hx="ess-take"]'); if (!bt) return { nobtn: true, html: document.getElementById('heroov').textContent.slice(0, 200) };
    bt.click(); await new Promise(r => setTimeout(r, 200));
    const asked = !!document.querySelector('.mapov [data-yn="1"]'), before = (c.essences || []).length;
    document.querySelector('[data-yn="0"]').click(); await new Promise(r => setTimeout(r, 100));
    const afterNo = (c.essences || []).length;
    heroUi.tab = 'skills'; renderHero(); document.querySelector('#heroov [data-hx="ess-take"]').click(); await new Promise(r => setTimeout(r, 200));
    document.querySelector('[data-yn="1"]').click(); await new Promise(r => setTimeout(r, 200));
    const r = { asked, before, afterNo, afterYes: (c.essences || []).length }; closeHero(); return r;
  });
  ok('эссенция: окно подтверждения, «Отмена» не впитывает, «Впитать» впитывает', E.asked && E.before === 0 && E.afterNo === 0 && E.afterYes === 1, E);

  console.log('>>', '// встреча переживает');
  // встреча переживает перезапуск
  await p.evaluate(() => { state.encSnap = null; });
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  await L.startFightPage(p, { list: ['goblin'] }); await p.waitForTimeout(1500);
  ok('встреча записана для возврата после перезапуска', await p.evaluate(() => !!state.encSnap && state.encSnap.list.length === 1));

  ok('ошибок страницы нет', errs.length === 0, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
