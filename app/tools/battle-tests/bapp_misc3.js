// Подсказки по месту, режим мастера (бестиарий закрыт), заставка вместо старого окна, список всех бросков на эссенцию, тень от стен, эффект способности монстра.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const A = await p.evaluate(() => {
    const out = {}, r = state.run;
    r.floor = 1; r.pos = { x: 0, y: 10 }; r.day = 2; r.act = 2; r.fs = {}; switchFloor(); r.floor = 2; r.variant = 'beast';
    const ids = (x, y) => tilePool(x, y).map(m => m.id).sort().join();
    out.swamp = ids(10, 9); out.thicket = ids(3, 8); out.cave = ids(0, 1); out.hills = ids(5, 4);
    out.f1 = (() => { r.floor = 1; delete r.variant; const l = tilePool(2, 2).length; r.floor = 2; r.variant = 'beast'; return l; })();
    return out;
  });
  ok('на 2 этаже в топи водятся только топевые (жаба, летучка), без волков', /swamp-toad/.test(A.swamp) && /bat/.test(A.swamp) && !/wolf/.test(A.swamp), A.swamp);
  ok('в чаще — звери чащи, в пещере — летучки и землекопы', /wolf/.test(A.thicket) && !/swamp-toad/.test(A.thicket) && /burrower/.test(A.cave) && !/wolf/.test(A.cave), JSON.stringify([A.thicket, A.cave]));
  ok('на 1 этаже подсказка по зоне (раньше работало)', A.f1 > 0);
  // режим мастера
  const M = await p.evaluate(async () => {
    const out = {}; state.settings.master = false; localStorage.removeItem('x');
    out.homeLib = /data-go="library"/.test(renderHome()) && !/data-go="bestiary"/.test(renderHome());
    query = 'гоблин'; document.body.insertAdjacentHTML('beforeend', '<div id="results"></div><div id="groups"></div>'); renderResults(); out.searchHidden = !/Монстр|Эссенция/.test(document.getElementById('results').innerHTML);
    document.getElementById('results').remove(); document.getElementById('groups').remove(); query = '';
    location.hash = 'bestiary'; await new Promise(r => setTimeout(r, 400)); out.redirect = location.hash === '#ref' && !document.getElementById('libov').hidden; closeLibrary();
    state.settings.master = true; out.homeBest = /data-go="bestiary"/.test(renderHome()); state.settings.master = false; location.hash = '';
    return out;
  });
  ok('без режима мастера: плитка «Монстры» ведёт в библиотеку, поиск не выдаёт монстров, вкладка бестиария открывает библиотеку', M.homeLib && M.searchHidden && M.redirect, JSON.stringify(M));
  ok('режим мастера возвращает полный бестиарий', M.homeBest);
  // заставка вместо старого окна, пока файлы боя грузятся
  const O = await p.evaluate(() => {
    const was = Battle.ready; Battle.ready = false; const e = { list: ['goblin'], tactical: true, title: 'x', raw: 5, n: 5, cause: 'event' }; dgUi.enc = e;
    const html = encounterOverlay(); Battle.ready = was; dgUi.enc = null;
    return { splash: /Бой начинается/.test(html), noOld: !/enc-ok|Монстры убегают|data-enc/.test(html) };
  });
  ok('пока бой грузится, вместо старого окна результатов — заставка', O.splash && O.noOld, JSON.stringify(O));
  // список бросков на эссенцию
  await p.evaluate(() => { state.run.floor = 1; state.party.forEach(c => { c.essences = []; c.equip.charm = null; delete c.equip.charm; });
    const orig = Battle.rnd; window.__o = orig; let i = 0; const seq = [11, 94, 49]; Battle.rnd = n => (n === 100 ? seq[Math.min(i++, seq.length - 1)] : orig(n)); });
  await L.startFightPage(p, { list: ['goblin', 'goblin', 'wolf'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  await p.evaluate(() => { const B = Battle; B.S.outcome = 'win'; B.S.killed.push(0, 1, 2); B.mons().forEach(m => { m.alive = false; m.hp = 0; }); Battle.UI.endTurn && Battle.UI.endTurn(); });
  for (let i = 0; i < 80 && !(await p.evaluate(() => !!document.querySelector('.bt-roll-res.ok, .bt-roll-res.no'))); i++) { await F.handleModal(p, 'yes'); await L.sleep(250); }
  const Rl = await p.evaluate(() => { const btn = document.querySelector('.bt-rolls-btn'); return { btn: !!btn && !btn.hidden, closed: document.querySelector('.bt-rolls').hidden, res: document.querySelector('.bt-roll-res').innerText }; });
  ok('под результатом есть стрелочка «все броски», список закрыт', Rl.btn && Rl.closed, JSON.stringify(Rl));
  await p.click('.bt-rolls-btn');
  const Rl2 = await p.evaluate(() => ({ open: !document.querySelector('.bt-rolls').hidden, rows: [...document.querySelectorAll('.bt-rollrow')].map(r => r.innerText.replace(/\s+/g, ' ')), shown: document.querySelectorAll('.bt-rollrow.shown').length }));
  ok('список раскрывается: 3 броска (по числу убитых), названия различимы, лучший отмечен', Rl2.open && Rl2.rows.length === 3 && /Гоблин 1/.test(Rl2.rows[0]) && /Гоблин 2/.test(Rl2.rows[1]) && Rl2.shown === 1, JSON.stringify(Rl2));
  ok('значения совпадают с выпавшими (12, 95, 50) и 95 отмечен как эссенция', /12/.test(Rl2.rows[0]) && /95/.test(Rl2.rows[1]) && /эссенция/.test(Rl2.rows[1]) && /нет/.test(Rl2.rows[2]), JSON.stringify(Rl2.rows));
  await p.evaluate(() => { Battle.rnd = window.__o; });
  // бросать эссенцию: статистика честности (6 % при 95+)
  const St = await p.evaluate(() => { let n = 0, w = 0; for (let i = 0; i < 20000; i++) { n++; if (1 + Battle.rnd(100) >= 95) w++; } return { share: w / n }; });
  ok('шанс эссенции 95+ из 100 примерно 6 %', St.share > 0.05 && St.share < 0.07, St.share);
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
