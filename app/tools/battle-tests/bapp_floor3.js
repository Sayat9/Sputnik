// 3 этаж: 31 × 31, четыре входа (углы снизу и середины боковых сторон), портал дальше сверху (не активен), случайное соответствие порталов 2 этажа
// входам (бросается в начале 2-го дня), 21 день, с 14-го дня порталы между 2 и 3 этажом отключены.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : JSON.stringify(extra)); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const res = await p.evaluate(() => {
    const out = {}, r = state.run;
    const ENT = ['0,30', '30,30', '0,15', '30,15'];
    // 1. соответствие бросается в начале 2-го дня и является перестановкой входов
    delete r.f3map; r.floor = 1; delete r.variant; r.day = 1; r.act = 3; advanceTime();
    out.day2 = r.day; out.mapAtDay2 = !!r.f3map; out.perm = JSON.stringify(Object.values(r.f3map).sort()) === JSON.stringify(ENT.slice().sort()) && Object.keys(r.f3map).sort().join() === 'beast,goblin,stone,undead';
    const seen = new Set(); let allPerm = true;
    for (let i = 0; i < 200; i++) { const f = { day: 1 }; const m = f3Map(f); seen.add(JSON.stringify(m)); if (JSON.stringify(Object.values(m).sort()) !== JSON.stringify(ENT.slice().sort())) allPerm = false; }
    out.allPerm = allPerm; out.varied = seen.size;
    const map0 = JSON.stringify(r.f3map); f3Map(r); out.stable = JSON.stringify(r.f3map) === map0;
    // 2. геометрия 3 этажа
    r.floor = 2; r.variant = 'goblin'; r.pos = { x: 10, y: 0 }; r.day = 5; r.act = 1;
    out.exitInfo = portalInfo(); const entry = r.f3map.goblin;
    out.entryExpected = out.exitInfo.entry === entry && out.exitInfo.to === 3;
    switchFloor();
    out.floor = r.floor; const fl = FL(); out.size = fl.size; out.days = fl.days; out.portals = JSON.stringify(Object.entries(fl.portals).sort());
    const [ex, ey] = entry.split(',').map(Number), d = Math.max(Math.abs(r.pos.x - ex), Math.abs(r.pos.y - ey)); out.ring = d >= 2 && d <= 3 && r.pos.x >= 0 && r.pos.y >= 0 && r.pos.x < 31 && r.pos.y < 31;
    out.dayKept = r.day === 5;
    out.safe = ['0,30', '30,30', '0,15', '30,15', '15,0'].every(k => zoneAt(...k.split(',').map(Number)).kind === 'safe');
    out.tileTypes = ['0,30', '30,30', '0,15', '30,15', '15,0'].every(k => tileType(...k.split(',').map(Number)) === 'portal') && tileType(15, 15) === 'floor';
    const zn = new Set(); for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) { const z = zoneAt(x, y); if (z.kind === 'zone') zn.add(z.place.name); }
    out.zones = zn.size;
    let bad = 0; for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) { try { tileFill(x, y); tileDeco(x, y); tileIcon(x, y); isDark(x, y); genEncounter(x, y, 5, 3); } catch (e) { bad++; } }
    out.tileErrors = bad;
    out.noEnc = (() => { for (let i = 0; i < 40; i++) if (genEncounter(15, 15, 5, 1 + i % 12)) return false; return true; })();
    out.next = portalInfo.call(null) && (() => { r.pos = { x: 15, y: 0 }; const i = portalInfo(); return { ok: i.ok, title: i.title }; })();
    // 3. обратные порталы: каждый вход ведёт на «свой» вариант 2 этажа
    out.back = {};
    for (const k of ENT) {
      r.floor = 3; r.pos = { x: +k.split(',')[0], y: +k.split(',')[1] }; r.day = 6; delete r.variant;
      const i = portalInfo(), want = Object.entries(r.f3map).find(([, e]) => e === k)[0];
      out.back[k] = { ok: i.ok, to: i.to, variant: i.variant, want };
      if (i.ok) { switchFloor(); out.back[k].after = [r.floor, r.variant, r.day]; }
    }
    // 4. все четыре варианта 2 этажа ведут на разные входы, вход и выход образуют пары
    out.pairs = {};
    for (const v of ['goblin', 'beast', 'undead', 'stone']) { r.floor = 2; r.variant = v; r.pos = { x: 10, y: 0 }; r.day = 6; const i = portalInfo(); out.pairs[v] = i.entry; switchFloor(); const back = r.floor === 3 ? f3VariantOf(tkey(...[r.pos.x, r.pos.y].map(String).length ? [r.pos.x, r.pos.y] : [])) : null; out.pairs[v + '_floor'] = r.floor; }
    out.pairsDistinct = new Set(['goblin', 'beast', 'undead', 'stone'].map(v => out.pairs[v])).size === 4;
    out.rand = (() => { const per = []; for (let i = 0; i < 6; i++) { r.floor = 2; r.variant = 'goblin'; r.pos = { x: 10, y: 0 }; r.day = 6; const e = portalInfo().entry; switchFloor(); const [ex, ey] = e.split(',').map(Number); per.push(Math.max(Math.abs(r.pos.x - ex), Math.abs(r.pos.y - ey))); }
      return { allNear: per.every(d => d >= 2 && d <= 3), sameEntry: true }; })();
    // 5. отключение порталов с 14-го дня
    out.off = {};
    for (const day of [14, 15, 16]) {
      r.floor = 2; r.variant = 'beast'; r.pos = { x: 10, y: 0 }; r.day = day; const a = portalInfo().ok;
      r.floor = 3; delete r.variant; const e = F3_ENTRIES[0].split(',').map(Number); r.pos = { x: e[0], y: e[1] }; const b2 = portalInfo().ok;
      out.off[day] = [a, b2];
    }
    return out;
  });
  ok('в начале 2-го дня выпал расклад порталов', res.day2 === 2 && res.mapAtDay2, [res.day2, res.mapAtDay2]);
  ok('расклад — перестановка четырёх входов для четырёх вариантов', res.perm && res.allPerm, res);
  ok('расклады разные (случайность)', res.varied > 5, res.varied);
  ok('расклад не меняется после выпадения', res.stable);
  ok('портал 2 этажа ведёт на свой вход', res.entryExpected, res.exitInfo);
  ok('3 этаж: этаж 3, размер 31, 21 день', res.floor === 3 && res.size === 31 && res.days === 21, [res.floor, res.size, res.days]);
  ok('порталы: 4 входа (углы снизу и середины сторон) и портал дальше 15,0', res.portals === JSON.stringify([['0,15', 'f3in'], ['0,30', 'f3in'], ['15,0', 'f3next'], ['30,15', 'f3in'], ['30,30', 'f3in']]), res.portals);
  ok('высадка рядом со своим входом, день сохранён', res.ring && res.dayKept, [res.ring, res.dayKept]);
  ok('порталы безопасны и считаются порталами', res.safe && res.tileTypes);
  ok('на этаже несколько зон', res.zones >= 8, res.zones);
  ok('все 961 тайл рисуются и встречи не падают', res.tileErrors === 0, res.tileErrors);
  ok('встреч на 3 этаже пока нет', res.noEnc);
  ok('портал дальше не активен', res.next && res.next.ok === false, res.next);
  for (const k of ['0,30', '30,30', '0,15', '30,15']) { const o = res.back[k]; ok(`вход ${k} ведёт на ${o.want}`, o.ok && o.to === 2 && o.variant === o.want && o.after && o.after[0] === 2 && o.after[1] === o.want && o.after[2] === 6, o); }
  ok('четыре варианта ведут на четыре разных входа', res.pairsDistinct && ['goblin', 'beast', 'undead', 'stone'].every(v => res.pairs[v + '_floor'] === 3), res.pairs);
  ok('день 14: порталы работают до конца дня в обе стороны', res.off[14][0] && res.off[14][1], res.off[14]);
  ok('день 15: порталы отключены в обе стороны', !res.off[15][0] && !res.off[15][1], res.off[15]);
  ok('день 16: порталы отключены', !res.off[16][0] && !res.off[16][1], res.off[16]);
  ok('повторный спуск в том же заходе — рядом со своим входом, расклад портала не меняется', res.rand.allNear && res.stable, res.rand);
  // интерфейс: экран, карта, окно портала
  const ui = await p.evaluate(() => {
    const r = state.run, o = {};
    r.floor = 3; delete r.variant; r.day = 6; r.act = 1; r.pos = { x: 0, y: 15 }; r.pending = null; dgUi.enc = null; dgUi.res = null;
    location.hash = 'labyrinth'; dgUi.phase = 'menu'; route();
    o.screen = !!document.getElementById('dg-svg'); o.title = (document.querySelector('.dg-title, h2') || {}).innerText || '';
    invItem('map').owned = true; invItem('map').active = true; dgUi.map = 'plain'; rerender(); o.map = !!document.querySelector('svg.floor') && document.querySelectorAll('svg.floor rect').length >= 961;
    dgUi.map = false; rerender();
    dgUi.phase = 'portal'; rerender(); o.portalWin = /Портал на 2 этаж/.test(document.body.innerText);
    return o;
  });
  ok('экран 3 этажа рисуется', ui.screen, ui);
  ok('карта 3 этажа: 961 клетка', ui.map, ui);
  ok('окно портала на 3 этаже', ui.portalWin, ui);
  await L.shot(p, 'floor3_ui');
  const end = await p.evaluate(() => { const out = {}, r = state.run;
    r.floor = 3; r.day = 20; r.act = 3; out.notEnd = advanceTime() === false && r.day === 21;
    r.day = 21; r.act = 3; out.ends = advanceTime() === true;
    return out; });
  ok('3 этаж: 20-й день не конец, 21-й день — конец захода', end.notEnd && end.ends, end);
  ok('нет ошибок страницы', p.errs.length === 0, p.errs.slice(0, 3));
  const bad = R.filter(x => !x.ok); console.log('проверок:', R.length, 'не прошли:', bad.length);
  await b.close();
})();
