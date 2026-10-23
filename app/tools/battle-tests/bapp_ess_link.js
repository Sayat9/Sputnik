// Эссенции: название открывается при впитывании (свойства — нет); анализ в башне магов пишет в библиотеку; прочитанное в библиотеке открыто при получении.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: false });
  const r = await p.evaluate(() => {
    const out = {}; state.run = null; state.townUnlocked = true; state.journal = null; unlockJournal(9);
    const c = state.party[0]; c.essences = []; c.level = 3; state.inventory = null; essStash().push('goblin', 'wolf');
    out.nameHidden = essTitle('goblin') === 'Эссенция ??' && essFace('goblin').startsWith('data:');
    openHero('h0'); heroUi.tab = 'skills'; renderHero();
    out.cardHidden = /Эссенция \?\?/.test(document.querySelector('#heroov').innerText) && !/Эссенция гоблина/.test(document.querySelector('#heroov').innerText);
    document.querySelector('#heroov [data-hx="ess-take"][data-essid="goblin"]').click();
    out.nameKnown = essNameKnown('goblin') && essTitle('goblin') === ESSENCES.goblin.name;
    out.propsHidden = !essSeen('goblin', 'ess-stats') && !essSeen('goblin', 'ess-passive') && essActiveLevel('goblin') === 0;
    out.cardName = new RegExp(ESSENCES.goblin.name).test(document.querySelector('#heroov').innerText);
    out.stillHiddenOther = essTitle('wolf') === 'Эссенция ??';
    closeHero();
    // чтение в библиотеке открывает при получении
    seenKeys('wolf', ['ess-stats', 'ess-passive']);
    out.libToEss = essSeen('wolf', 'ess-stats') && essSeen('wolf', 'ess-passive') && !essSeen('wolf', 'ess-active') && essNameKnown('wolf');
    return out;
  });
  for (const [k, t] of Object.entries({ nameHidden: 'до впитывания название скрыто', cardHidden: 'в запасе «Эссенция ??»', nameKnown: 'после впитывания название известно', propsHidden: 'свойства всё ещё скрыты', cardName: 'карточка героя показывает название', stillHiddenOther: 'другая эссенция по-прежнему скрыта', libToEss: 'прочитанное в библиотеке открыто у эссенции' })) ok(t, r[k] === true, JSON.stringify(r));
  // башня магов → библиотека → эссенция
  await p.evaluate(() => { const c = state.party[0]; c.gold = 100; journal().known = {}; location.hash = 'town'; rerender(); });
  await p.click('[data-bld="tower"]'); await p.waitForSelector('[data-t="analyze"]'); await p.click('[data-t="analyze"]');
  const t = await p.evaluate(() => ({ lib: ['ess-stats', 'ess-passive', 'ess-active'].every(k => (journal().known.goblin || { revealed: [] }).revealed.includes(k)), seen: essSeen('goblin', 'ess-active') }));
  ok('анализ в башне пишет сведения в библиотеку и открывает эссенцию', t.lib && t.seen, JSON.stringify(t));
  await p.click('[data-t="close"]');
  // карточка монстра в библиотеке показывает открытые разделы эссенции
  const card = await p.evaluate(() => { openLibrary(); libUi.card = 'goblin'; renderLibrary(); const txt = document.querySelector('#libov').innerText; return { passive: new RegExp(ESSENCES.goblin.passive.name).test(txt) }; });
  ok('в справочнике видна пассивка гоблина', card.passive);
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
