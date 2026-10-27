// Прочность: окно «Отдых» — блок «Починка снаряжения» (выбор мастера, набор, усталость дварфа, план, удаление, подтверждение), зажатие предмета, полоса героя.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true });
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : JSON.stringify(extra)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'dwarf', 'archer'], autoEnd: false, tactical: false });
  await p.evaluate(() => {
    const r = state.run, [hum, dw, ar] = state.party;
    r.day = 2; r.act = 1; location.hash = 'labyrinth'; rerender();
    state.party.forEach(c => { c.bag = []; c.equip = {}; addToBag(c, { t: 'g', id: 'ration', qty: 6 }); });
    hum.equip = { main: { t: 'w', id: 'sword', dur: 2 }, body: { t: 'a', id: 'leather', dur: 1 } };
    dw.equip = { main: { t: 'w', id: 'warhammer', dur: 1 }, off: { t: 'w', id: 'shield', dur: 0, broken: true } };
    ar.equip = { main: { t: 'w', id: 'shortbow', steel: true, dur: 20 } };
    addToBag(hum, { t: 'g', id: 'repair-kit', qty: 5 }); addToBag(ar, { t: 'g', id: 'repair-kit-pro', qty: 1 });
    dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 1])), ng: false }; rerender();
  });
  await p.waitForSelector('.rep-box');
  await L.shot(p, 'dur-rest-1');
  const html0 = await p.evaluate(() => document.querySelector('.rep-box').textContent.replace(/\s+/g, ' '));
  ok('блок виден, перечислены наборы', /Починка снаряжения/.test(html0) && /ремонтный набор ×5/.test(html0) && /продвинутый набор ×1/.test(html0), html0);
  ok('в списке повреждённых нет целых вещей (пять повреждённых вещей: меч, кожанка, молот, щит, лук 20/30)', await p.evaluate(() => document.querySelectorAll('.rep-row').length === 5), await p.evaluate(() => document.querySelectorAll('.rep-row').length));
  ok('по умолчанию чинит дварф (2 хода)', await p.evaluate(() => dgUi.rest.fixBy === state.party[1].id && /ходов у Торин: 0\/2/.test(document.querySelector('.rep-box').textContent)));

  // добавить 2 починки дварфа: чужая кожанка и свой сломанный щит
  const rows = () => p.evaluate(() => [...document.querySelectorAll('.rep-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  const addBtn = (hid, src, tool) => `.rep-row [data-dg="fix-add"][data-hid="${hid}"][data-src="${src}"][data-tool="${tool}"]`;
  await p.click(addBtn('h0', 'eq:body', 'repair-kit'));
  await p.click(addBtn('h1', 'eq:off', 'repair-kit'));
  const st1 = await p.evaluate(() => ({ n: dgUi.rest.fix.length, plan: document.querySelectorAll('.rep-plan li').length, dis: [...document.querySelectorAll('.rep-row [data-dg="fix-add"]')].every(b => b.disabled) }));
  ok('две починки в плане, дальше кнопки недоступны (дварф: 2 хода)', st1.n === 2 && st1.plan === 2 && st1.dis, st1);
  // усталость на починку +1 → ещё 2 хода
  await p.click('[data-dg="fix-fat"][data-d="1"]');
  const st2 = await p.evaluate(() => ({ fu: dgUi.rest.fixFat.h1, off: [...document.querySelectorAll('.rep-row [data-dg="fix-add"]')].filter(b => !b.disabled).length, txt: document.querySelector('.rep-fat').textContent.replace(/\s+/g, ' ') }));
  ok('усталость на починку 1: четыре хода, подпись «без снятия усталости»', st2.fu === 1 && st2.off > 0 && /без снятия усталости/.test(st2.txt), st2);
  await p.click(addBtn('h2', 'eq:main', 'repair-kit-pro'));
  ok('продвинутый набор у лучницы добавлен в план', await p.evaluate(() => dgUi.rest.fix.length === 3 && dgUi.rest.fix[2].tool === 'repair-kit-pro'));
  // убрать вторую починку
  await p.click('[data-dg="fix-del"][data-i="1"]');
  ok('удаление из плана', await p.evaluate(() => dgUi.rest.fix.length === 2 && !dgUi.rest.fix.some(o => o.src === 'eq:off')));
  // смена мастера на обычного героя: у него 1 ход
  await p.click('[data-dg="fix-by"][data-id="h0"]');
  const st3 = await p.evaluate(() => ({ by: dgUi.rest.fixBy, txt: document.querySelector('.rep-box .rep-h').textContent.replace(/\s+/g, ' '), noFat: !document.querySelector('.rep-fat') }));
  ok('смена мастера на обычного: ходов 1, блока усталости нет', st3.by === 'h0' && /ходов у Грок: 0\/1/.test(st3.txt) && st3.noFat, st3);
  await p.click('[data-dg="fix-by"][data-id="h1"]');
  await L.shot(p, 'dur-rest-2');
  // отдых: выполнить
  const before = await p.evaluate(() => ({ lea: state.party[0].equip.body.dur, bow: state.party[2].equip.main.dur, fat: state.run.status.h1.fat }));
  await p.click('[data-dg="rest-go"]');
  const after = await p.evaluate(() => ({ lea: state.party[0].equip.body.dur, bow: state.party[2].equip.main.dur, fat: state.run.status.h1.fat, kits: state.party.reduce((a, c) => a + countGear(c, 'repair-kit'), 0), pro: state.party.reduce((a, c) => a + countGear(c, 'repair-kit-pro'), 0), log: (state.run.log || []).slice(-8).map(x => x.t).join(' | ') }));
  ok('чужая кожанка +5 дварфом, лук +15 дварфом (20 → 30 по максимуму стали)', before.lea === 1 && after.lea === 6 && after.bow === 30, [before, after]);
  ok('наборы израсходованы: 4 из 5 и 0 продвинутых', after.kits === 4 && after.pro === 0, after);
  ok('усталость дварфа: сон её не снял (потрачена 1 на починку)', after.fat === before.fat, [before.fat, after.fat]);
  ok('в журнале есть строка про починку', /чинит/.test(after.log), after.log);

  // зажатие предмета: окно с прочностью
  const info = await p.evaluate(() => { const c = state.party[0]; showItemInfo(c.equip.main, c); const t = document.getElementById('iteminfo').textContent; document.getElementById('iteminfo').hidden = true; return t; });
  ok('окно предмета: «Прочность 2/10»', /Прочность:?\s*2\/10/.test(info), info);
  ok('ошибок страницы нет', errs.length === 0, errs);
  const bad = R.filter(r => !r.ok).length; console.log(`${R.length - bad}/${R.length} проверок`);
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
