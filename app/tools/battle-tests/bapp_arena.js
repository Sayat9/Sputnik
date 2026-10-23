// Арена (ставки и бой отряда), запрет ночлега после арены, цены эссенций: башня 1/3, церковь полная, гильдия.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: true, level: 3 });
  await p.evaluate(async () => { await loadBattle(); state.run = null; state.townUnlocked = true; state.journal = null; unlockJournal(9); state.arena = null; state.quests = null; state.party.forEach(c => { c.gold = 100; c.bag = []; c.carry = { sat: 3, starve: 0, awake: 0, fat: 0 }; c.hp = maxHp(c); }); location.hash = 'town'; rerender(); });
  // --- ставки
  await p.click('[data-bld="arena"]'); await p.waitForSelector('.tw-bout');
  const info = await p.evaluate(() => ({ bouts: document.querySelectorAll('.tw-bout').length, fighters: document.querySelectorAll('.tw-fighter').length, texts: [...document.querySelectorAll('.tw-fighter')].every(f => /9 класс/.test(f.innerText) && f.querySelector('b').innerText.length > 2), odds: state.arena.bouts.every(x => x.oa >= 1.1 && x.ob >= 1.1 && x.oa <= 8 && x.ob <= 8), cls: state.arena.bouts.every(x => MONSTERS.find(m => m.id === x.a).cls === MONSTERS.find(m => m.id === x.b).cls && x.a !== x.b) }));
  ok('3 боя, видны имя и класс бойцов', info.bouts === 3 && info.fighters === 6 && info.texts, JSON.stringify(info)); ok('коэффициенты в разумных пределах, бойцы одного класса', info.odds && info.cls);
  await L.shot(p, 'arena-bets');
  const g0 = await p.evaluate(() => partyGold());
  await p.click('.tw-fighter[data-i="0"][data-s="a"]'); await p.click('[data-t="achip"][data-n="10"]');
  await p.evaluate(() => { window.__r = Math.random; Math.random = () => 0; });          // сторона A побеждает
  await p.click('[data-t="abet"]'); await p.evaluate(() => { Math.random = window.__r; });
  const w = await p.evaluate(() => { const b = state.arena.bouts[0]; return { res: b.res, gold: partyGold(), odds: b.oa }; });
  ok('ставка на победителя: выигрыш = ставка × коэффициент', w.res && w.res.win === 'a' && w.gold === 300 - 10 + Math.floor(10 * w.odds) - 300 + 300, JSON.stringify(w) + g0);
  await p.click('.tw-fighter[data-i="1"][data-s="a"]'); await p.click('[data-t="achip"][data-n="5"]');
  await p.evaluate(() => { window.__r = Math.random; Math.random = () => 0.999999; });        // побеждает B
  await p.click('[data-t="abet"]'); await p.evaluate(() => { Math.random = window.__r; });
  const l = await p.evaluate(() => ({ res: state.arena.bouts[1].res, gold: partyGold() }));
  ok('ставка на проигравшего сгорает', l.res && l.res.win === 'b' && l.res.pay === 0 && l.gold === w.gold - 5, JSON.stringify(l));
  ok('сыгранный бой нельзя ставить повторно', await p.evaluate(() => document.querySelector('.tw-fighter[data-i="1"][data-s="a"]').disabled));
  await p.click('[data-t="close"]');
  ok('ставки = 1 городское действие за визит', await p.evaluate(() => townClock().t >= 1));
  // --- бой отряда: награда, лута нет, эссенцию забирают
  await p.evaluate(() => { state.party.forEach(c => { c.gold = 0; c.bag = []; c.hp = maxHp(c); }); essStash().length = 0; });
  const F = await p.evaluate(async () => {
    const out = {}; Battle.cfg.fast = true;
    const list = ['goblin', 'wolf', 'bat']; const ev = { kind: 'hard', title: 'Арена', arena: true, list, zone: 'goblin', floor: 1, key: 'arena', outcome: null, killed: [], turn: 0, round: 1, tactical: true, border: false, cause: 'arena', raw: 0, n: 0 };
    ev.init = rollInitiative(list, false);
    const S = await Battle.start(ev, { sim: true, autoHeroes: true });
    out.killed = S.killed.length; out.outcome = S.outcome;
    S.forceWins = ['goblin'];                                         // выпала эссенция
    const hero0 = Battle.heroes()[0]; hero0.hp = 0; hero0.dead = true;  // погиб — на арене поднимают
    const trips0 = townClock().trips;
    await Battle.End.run(S);
    out.gold = partyGold(); out.stones = state.party.reduce((a, c) => a + (c.bag || []).filter(e => /stone/.test(e.id)).length, 0);
    out.stash = essStash().length; out.alive = state.party.every(c => !c.dead && c.hp >= 1); out.lock = state.arenaLock === true;
    out.fat = state.party.map(c => c.carry.fat);
    out.finds = state.party.reduce((a, c) => a + (c.bag || []).length, 0);
    return out;
  });
  ok('бой отряда закончился, убиты: ' + F.killed, F.killed >= 1, JSON.stringify(F));
  ok('арена платит 3 за убитого + 20 % цены эссенции (10)', F.gold === F.killed * 3 + 10, JSON.stringify(F)); ok('лута нет: ни камней, ни находок, эссенция не в запасе', F.stones === 0 && F.stash === 0 && F.finds === 0, JSON.stringify(F));
  ok('павших поднимают с 1 ОЗ', F.alive); ok('усталость +1 каждому', F.fat.every(f => f === 1), JSON.stringify(F.fat)); ok('ночлег закрыт до следующего спуска', F.lock);
  await p.waitForTimeout(900);
  ok('после боя арена открывается снова с итогом', await p.evaluate(() => !document.getElementById('townov').hidden && /Бой окончен/.test(document.getElementById('townov').innerText)));
  await p.click('[data-t="close"]');
  // --- таверна закрыта для сна
  await p.evaluate(() => { location.hash = 'town'; rerender(); }); await p.click('[data-bld="tavern"]'); await p.waitForSelector('.tw-rows');
  ok('кнопки «Сон» отключены, еда доступна', await p.evaluate(() => [...document.querySelectorAll('[data-k="sleep"]')].every(x => x.disabled) && [...document.querySelectorAll('[data-k="food"]')].every(x => !x.disabled) && /не успеют зажить/.test(document.querySelector('.tw-panel').innerText)));
  await p.click('[data-t="tv-all"]'); const hp0 = await p.evaluate(() => state.party.map(c => hpOf(c))); await p.click('[data-t="tv-pay"]');
  ok('«Всем еда» кормит, но не лечит и не снимает усталость', await p.evaluate(h => state.party.every((c, i) => c.carry.sat === 9 && c.carry.fat === 1 && hpOf(c) === h[i]), hp0));
  await p.click('[data-t="close"]');
  await p.evaluate(() => { location.hash = 'town'; newRun(); }); ok('новый спуск снимает запрет', await p.evaluate(() => !state.arenaLock));
  // --- цены эссенций
  const P = await p.evaluate(() => ({ g: essPrice('goblin'), base9: essBasePrice('goblin'), base8: essBasePrice('dark-bear'), base7: essBasePrice('goblin-king'), rare: essPrice('goblin-archer'), tower: Math.round(essPrice('goblin') / 3) }));
  ok('цена эссенции 9 класса — 50, у редких вдвое', P.g === 50 && P.base9 === 50 && P.rare === 100, JSON.stringify(P)); ok('8 и 7 класс по отношению цен камней (250, 1000)', P.base8 === 250 && P.base7 === 1000, JSON.stringify(P));
  await p.evaluate(() => { state.run = null; location.hash = 'town'; const c = state.party[0]; c.essences = ['goblin']; c.level = 3; c.gold = 200; c.purged = 0; state.journal.known = {}; state.journal.essNamed = {}; rerender(); });
  await p.click('[data-bld="tower"]'); await p.waitForSelector('[data-t="analyze"]');
  ok('анализ в башне — треть цены эссенции (17)', await p.evaluate(() => document.querySelector('[data-t="analyze"]').innerText.trim() === '17'));
  await p.click('[data-t="analyze"]'); ok('списано 17, свойства раскрыты', await p.evaluate(() => state.party[0].gold === 183 && essSeen('goblin', 'ess-active')));
  await p.click('[data-t="close"]');
  await p.click('[data-bld="church"]'); await p.waitForSelector('[data-t="purge"]');
  ok('удаление в церкви — полная цена обычной эссенции (50)', await p.evaluate(() => /50/.test(document.querySelector('[data-t="purge"]').innerText)));
  await p.click('[data-t="purge"]'); await p.click('[data-t="purge"]');
  ok('эссенция удалена, списано 50, скрытый счётчик +1', await p.evaluate(() => state.party[0].essences.length === 0 && state.party[0].gold === 133 && state.party[0].purged === 1));
  ok('счётчик удалённых игроку не показывается', await p.evaluate(() => !/удал.+: ?1|purged/i.test(document.querySelector('.tw-panel').innerText.replace(/Удалить/g, ''))));
  await p.click('[data-t="close"]');
  // --- гильдия: дорого, места обитания и особенно детали эссенции
  const G = await p.evaluate(() => { const m = MONSTERS.find(x => x.id === 'goblin'); return { area: 30, ess: 45 + 60 + 80 }; });
  await p.evaluate(() => { state.party[0].gold = 500; state.journal.known = { goblin: { revealed: [], added: '' } }; rerender(); });
  await p.click('[data-bld="guild"]'); await p.waitForSelector('.mon-grid'); await p.click('.mon-grid .mbox'); await p.waitForSelector('.tw-rows');
  const prices = await p.evaluate(() => [...document.querySelectorAll('.tw-rows .tw-row')].map(r => ({ t: r.querySelector('b').innerText, p: +(r.querySelector('[data-t="gbuy"]') || { innerText: '0' }).innerText })));
  const by = k => (prices.find(x => x.t.includes(k)) || {}).p;
  ok('места обитания дороже обычных сведений, детали эссенции ещё дороже', by('Места') > by('Тип') && by('Активн') > by('Места') && by('Пассивная') > by('Места') && by('Статы') > by('Места'), JSON.stringify(prices));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
