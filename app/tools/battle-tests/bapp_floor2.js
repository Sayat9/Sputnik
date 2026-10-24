// 2 этаж: переход через порталы, общие дни, зоны, встречи по местам, статблоки монстров, возврат на 1 этаж, ночной шанс.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const res = await p.evaluate(() => {
    const out = {}, r = state.run;
    for (const [portal, want] of [['0,0', 'goblin'], ['0,10', 'beast'], ['10,0', 'undead']]) {
      // вернуться на 1 этаж и встать на портал
      if (r.floor === 2) { r.pos = { x: 0, y: 10 }; switchFloor(); }
      const [x, y] = portal.split(',').map(Number); r.floor = 1; delete r.variant; r.pos = { x, y }; r.day = 3; r.act = 2;
      out[portal] = {};
      const pi = portalInfo(); out[portal].info = !!pi.ok && pi.to === 2;
      switchFloor();
      out[portal].floor = r.floor; out[portal].variant = r.variant; out[portal].day = r.day; out[portal].days = FL().days;
      const near = Math.max(Math.abs(r.pos.x - 0), Math.abs(r.pos.y - 10)); out[portal].ring = near >= 2 && near <= 3;
      out[portal].safeEntry = zoneAt(0, 10).kind === 'safe' && zoneAt(10, 0).kind === 'safe' && zoneAt(5, 5).kind === 'zone';
      out[portal].dark = [isDark(0, 0), isDark(5, 5)];
      // встречи: каждый тайл, много бросков
      const bad = []; let seen = new Set();
      for (let yy = 0; yy < 11; yy++) for (let xx = 0; xx < 11; xx++) { if (zoneAt(xx, yy).kind === 'safe') continue; for (let k = 0; k < 6; k++) { const day = 1 + (k * 3), enc = genEncounter(xx, yy, day, 1 + (k * 4) % 12, false); if (!enc || !enc.list.length) { bad.push('пусто ' + xx + ',' + yy); continue; } if (enc.list.length > 5) bad.push('группа >5'); for (const id of enc.list) { const m = MONSTERS.find(q => q.id === id); seen.add(id); if (!m || !m.abil || !m.traits.some(t => t[2] === 'attacks')) bad.push('нет статблока: ' + id); } } }
      out[portal].bad = bad.slice(0, 5); out[portal].kinds = seen.size;
      out[portal].render = (() => { try { location.hash = 'labyrinth'; r.pending = null; dgUi.enc = null; route(); return !!document.getElementById('dg-svg'); } catch (e) { return String(e); } })();
      out[portal].clock = document.querySelector('.dg-clock b') ? document.querySelector('.dg-clock b').innerText.replace(/\s+/g, '') : '';
    }
    // возврат и сроки
    r.pos = { x: 0, y: 10 }; r.day = 5; let pi = portalInfo(); out.back5 = pi.ok && pi.to === 1; switchFloor(); out.afterBack = r.floor;
    r.floor = 1; r.pos = { x: 0, y: 0 }; r.day = 8; out.late = portalInfo().ok; // после срока 1 этажа
    r.floor = 2; r.variant = 'goblin'; r.pos = { x: 0, y: 10 }; r.day = 9; out.noBack = portalInfo().ok;
    r.pos = { x: 10, y: 0 }; out.exit = portalInfo().ok;
    out.stonePortal = (() => { r.floor = 1; delete r.variant; r.pos = { x: 10, y: 10 }; r.day = 2; return portalInfo().ok; })();
    return out;
  });
  for (const k of ['0,0', '0,10', '10,0']) { const o = res[k]; ok(`портал ${k}: вход разрешён`, o.info); ok(`${k}: 2 этаж, вариант ${o.variant}, день сохранён (3), срок 14`, o.floor === 2 && o.day === 3 && o.days === 14, JSON.stringify(o)); ok(`${k}: старт в 2–3 полосе от входа`, o.ring); ok(`${k}: порталы безопасны, остальное зона`, o.safeEntry); ok(`${k}: встречи по всем местам корректны`, !o.bad.length && o.kinds >= 6, JSON.stringify(o.bad) + ' видов ' + o.kinds); ok(`${k}: карта рисуется, часы дней`, o.render === true && /3\/14/.test(o.clock), o.render + ' ' + o.clock); }
  ok('вариант по порталу: гоблины, звери, нежить', res['0,0'].variant === 'goblin' && res['0,10'].variant === 'beast' && res['10,0'].variant === 'undead');
  ok('тьма только в пещере/склепе (угол 0,0)', res['0,0'].dark[0] === false && res['0,10'].dark[0] === true && res['10,0'].dark[0] === true && res['0,10'].dark[1] === false);
  ok('назад на 1 этаж до конца 7-го дня можно', res.back5 && res.afterBack === 1);
  ok('после 7-го дня на 1 этаж нельзя', res.noBack === false);
  ok('вход на 2 этаж после срока 1 этажа нельзя', res.late === false);
  ok('выход на 3 этаж пока закрыт; каменный портал ведёт в Кристальный разлом', res.exit === false && res.stonePortal === true);
  // ночной шанс
  const n = await p.evaluate(() => { const rr = state.run; rr.floor = 1; rr.pos = { x: 5, y: 3 }; const orig = window.askRoll; let hit = 0; window.askRoll = () => { hit++; }; const tab = {}; for (const [day, guard, gf] of [[2, 'rest-noguard', 0], [4, 'rest', 0], [4, 'rest', 1], [4, 'rest-noguard', 0], [9, 'rest-noguard', 0]]) { rr.day = day; hit = 0; for (let i = 0; i < 3000; i++) rollEncounter(guard === 'rest' ? 'rest' : 'rest-noguard', gf); tab[day + guard + gf] = hit / 3000; } window.askRoll = orig; return tab; });
  ok('дни 1–3: ночных встреч нет совсем', n['2rest-noguard0'] === 0, JSON.stringify(n));
  ok('караульный без усталости: встреч нет', n['4rest0'] === 0, JSON.stringify(n));
  ok('караульный с усталостью: шанс есть', n['4rest1'] > 0.01 && n['4rest1'] < 0.12, JSON.stringify(n));
  ok('без караула шанс вдвое выше', n['4rest-noguard0'] > n['4rest1'], JSON.stringify(n));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет');
  ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
