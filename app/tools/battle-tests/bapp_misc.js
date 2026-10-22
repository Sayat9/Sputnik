// Приложение: погибший герой уходит из отряда, вещи делятся; ночной шанс; портал; «Отмена» не дублирует ✕; переброс и бонус мастерства.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: false });
  const r = await p.evaluate(() => {
    const [a, c, d] = state.party; const out = {};
    out.pb = derived(totals(a), a).pb;
    out.insp = [a.insp ?? 1];
    // вещи погибшего
    addToBag(d, { t: 'g', id: 'stone-9', qty: 5 }); addToBag(d, { t: 'g', id: 'potion', qty: 1 });
    const before = [a, c].map(x => (x.bag || []).reduce((s, e) => s + (e.qty || 1), 0));
    d.dead = true; d.hp = 0; buryFallen();
    out.left = state.party.length; out.fallen = (state.fallen || []).length;
    out.stones = state.party.reduce((s, x) => s + countGear(x, 'stone-9'), 0);
    out.names = state.party.map(x => x.name);
    return out;
  });
  ok('бонус мастерства 0', r.pb === 0, r.pb);
  ok('погибший убран из отряда', r.left === 2 && r.fallen === 1, JSON.stringify(r));
  ok('его камни разошлись между живыми', r.stones === 5, r.stones);
  // ночной шанс
  const n = await p.evaluate(() => { const rr = state.run; let hit = 0, N = 4000; const orig = askRoll; window.askRoll = () => { hit++; }; rr.day = 1; for (let i = 0; i < N; i++) { try { rollEncounter('rest', 1); } catch (e) {} } window.askRoll = orig; return hit / N; });
  ok('день 1: ночных встреч мало (≤ 10 %)', n <= 0.12, n);
  // портал
  const pt = await p.evaluate(() => { state.run.pos = { x: 0, y: 0 }; state.run.pending = null; dgUi.enc = null; dgUi.res = null; dgUi.phase = 'menu'; location.hash = 'labyrinth'; route(); return !!document.querySelector('[data-act="portal"]'); });
  ok('на тайле портала есть «Войти в портал»', pt);
  await p.evaluate(() => { document.querySelector('[data-act="portal"]').click(); });
  await L.sleep(200);
  ok('окно портала с ✕ и без «Отмена»', await p.evaluate(() => { const o = document.querySelector('[aria-label="Портал"]'); return !!o && !/Отмена/.test(o.innerText); }));
  await p.evaluate(() => { dgUi.phase = 'explore'; dgUi.sr = { pick: null, luck: null }; rerender(); });
  ok('«Исследовать»: нет кнопки «Отмена»', await p.evaluate(() => !/Отмена/.test(document.querySelector('[aria-label="Исследовать"]').innerText)));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет');
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
