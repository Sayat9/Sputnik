// Алтарь 1 этажа (v125): кнопка «Взаимодействовать» внизу меню (серая вне периода разломов), пожертвование 5 камней; 4 камня 9 класса одной зоны + 1 камень 8 класса той же зоны — разлом её темы.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 880 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(600);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const r = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 5, rank: 7 })]; newRun(); const run = state.run; run.floor = 1; run.arrive = false;
    const c = Math.floor(FLOOR1.size / 2); run.pos = { x: c, y: c }; run.day = 2; run.act = 1; location.hash = 'labyrinth'; dgUi.phase = 'menu'; route();
    const o = {}; const btn = () => document.querySelector('[data-dg="altar"]'); o.greyBefore = !!btn() && btn().disabled;
    run.day = 3; riftSync(); dgUi.res = null; rerender(); o.litNow = !!btn() && !btn().disabled;
    const last = [...document.querySelectorAll('.dg-menu .fx-btn')].pop(); o.isLast = last && last.dataset.dg === 'altar';
    const give = (pick) => { state.sack = { items: {}, mig: true, mig2: true }; for (const [mon, cls, q] of pick) state.sack.items['m:' + mon] = { mon, cls, qty: q }; dgUi.altar = { pick: {} }; for (const [mon, , , take] of pick) dgUi.altar.pick['m:' + mon] = take; altarGive(); const res = dgUi.res; dgUi.res = null; return res; };
    // неправильная комбинация: камни уходят, разлома нет
    const bad1 = give([['goblin', 9, 2, 2], ['wolf', 9, 2, 2], ['hobgoblin', 8, 1, 1]]); o.wrong = !(run.riftsF1.tiles[altarKey()]) && /молчит/.test(bad1.lines.join(' ')) && !Object.keys(state.sack.items).length;
    // правильная: 4 гоблина 9 класса + хобгоблин 8 → шахта
    const good = give([['goblin', 9, 2, 1], ['goblin-archer', 9, 1, 1], ['goblin-sword', 9, 1, 1], ['goblin-spear', 9, 1, 1], ['hobgoblin', 8, 1, 1]]);
    o.theme = run.riftsF1.tiles[altarKey()] && run.riftsF1.tiles[altarKey()].id; o.anim = good && good.anim === 'rift';
    o.enter = spButtons().map(x => x.id).includes('rift-enter');
    // остальные темы по зонам
    const zoneOf = z => { delete run.riftsF1.tiles[altarKey()]; const m9 = MONSTERS.filter(m => m.floor === 1 && m.cls === 9 && m.zone === z && !m.rift).map(m => m.id); const m8 = MONSTERS.find(m => m.cls === 8 && m.zone === z && m.floor === 2 && !m.rift).id; give([[m9[0], 9, 4, 4], [m8, 8, 1, 1]]); return run.riftsF1.tiles[altarKey()] && run.riftsF1.tiles[altarKey()].id; };
    o.beast = zoneOf('beast'); o.undead = zoneOf('undead'); o.stone = zoneOf('stone');
    // окно: кнопки
    delete run.riftsF1.tiles[altarKey()]; state.sack = { items: { 'm:goblin': { mon: 'goblin', cls: 9, qty: 3 } }, mig: true, mig2: true }; dgUi.altar = { pick: {} }; rerender();
    o.ui = !!document.querySelector('[data-altar="give"][disabled]') && !!document.querySelector('[data-altar="cancel"]') && document.querySelectorAll('.altar-row').length === 1;
    return o;
  });
  ok('кнопка «Взаимодействовать» на алтаре: серая вне периода разломов, горит в период, внизу меню', r.greyBefore && r.litNow && r.isLast, r);
  ok('неверная комбинация: камни уходят, разлом не открывается', r.wrong, r);
  ok('4 камня гоблинов 9 класса + хобгоблин 8 — разлом шахты, анимация, «Войти в разлом»', r.theme === 'mine' && r.anim && r.enter, r);
  ok('звери → Ледяной грот, нежить → Кровавая крепость, элементали → Зыбучие пески', r.beast === 'ice' && r.undead === 'blood' && r.stone === 'sand', r);
  ok('окно алтаря: ничего не выбрано, «Пожертвовать» заблокировано до 5 камней, есть «Отменить»', r.ui, r);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
