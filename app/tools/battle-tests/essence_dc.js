// Сл активок обоих этажей: сравниваем число «против Сл N» в журнале с формулой из текста эссенции (8 + БМ + мод. характеристики).
// Герою даётся нужное оружие (копьё, рапира, булава…), запускается активка через useActive с авто-выбором целей. node essence_dc.js [id,id]
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle'];
const ONLY = (process.argv[2] || '').split(',').filter(Boolean);
const GEAR = { 'hobgoblin-brute': { main: 'mace' }, 'horned-hare': { main: 'spear' }, blackwing: { main: 'spear' }, 'goblin-assassin': { main: 'rapier' }, 'hobgoblin-thrower': { main: 'sword', bag: ['spear', 'spear'] }, 'bone-knight': { main: 'sword' }, 'hobgoblin-driver': { main: 'spear' }, wolf: { main: 'sword' } };
const FAR = ['bone-hound'];                    // враги не рядом: способность — сближение
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const out = await p.evaluate(async ({ GEAR, ONLY, FAR }) => {
    const ABIL = { 'Сил': 'str', 'Лов': 'dex', 'Тел': 'con', 'Инт': 'int', 'Мдр': 'wis', 'Хар': 'cha' };
    const res = [];
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const ids = Object.keys(ESSENCES).filter(id => (!ONLY.length || ONLY.includes(id)) && MONSTERS.some(m => m.essence === id));
    for (const id of ids) {
      const A = Battle.A[id]; if (!A || A.time === 'reaction') { res.push({ id, note: 'реакция/нет активки' }); continue; }
      const eb = ESSENCES[id].active;
      const m = eb.text.match(/Сл\s*8\s*\+\s*БМ\s*\+\s*мод\.?\s*([А-Яа-я]{3})/);
      const c = Object.assign(clone(state.example), { id: 'dc1', example: false, name: 'Т', race: 'human', level: 1 });
      c.base = { str: 14, dex: 16, con: 12, int: 10, wis: 10, cha: 10 };
      const g = GEAR[id] || {};
      c.equip = { main: { t: 'w', id: g.main || (/archer/.test(id) ? 'shortbow' : (id === 'goblin-sword' ? 'sword' : 'spear')) } }; delete c.bag; delete c.kit; delete c.hp; c.essences = [id]; ensureKit(c); addToBag(c, { t: 'g', id: 'arrow', qty: 10 }); for (const w of g.bag || []) addToBag(c, { t: 'w', id: w }); c.mp = 99;
      state.party = [c]; state.run.status = { dc1: { fat: 0, sat: 3, starve: 0, awake: 0 } };
      const S = Battle.newBattle({ list: ['goblin', 'goblin'], zone: 'goblin' }); S.opts.autoHeroes = true; S.dark = false;
      for (const row of S.cells) row.fill(''); S.objs.length = 0;
      const u = Battle.heroes()[0], ms = Battle.mons();
      u.x = 3; u.y = 4; ms[0].x = 3; ms[0].y = FAR.includes(id) ? 0 : 3; ms[1].x = 2; ms[1].y = FAR.includes(id) ? 0 : 3; for (const mm of ms) { mm.maxHp = mm.hp = 500; mm.ac = 5; }
      Battle.startTurn && await Battle.startTurn(u);
      let spec; try { spec = A.tgt ? A.tgt(u) : { type: 'self' }; } catch (e) { res.push({ id, note: 'tgt: ' + e.message }); Battle.S = null; continue; }
      const picks = {};
      if (spec.type === 'unit') picks.unit = ms[0]; else if (spec.type === 'units') picks.units = ms.slice(0, 2); else if (spec.type === 'area') picks.units = spec.units.map(i => Battle.byId(i)); else if (spec.type === 'cell') picks.cell = spec.cells[0]; else if (spec.type === 'cube') picks.cell = spec.anchors[0];
      const mp0 = u.mp, before = S.log.length;
      let ok; try { ok = await Battle.useActive(u, id, picks); } catch (e) { res.push({ id, note: 'ИСКЛЮЧЕНИЕ ' + e.message }); Battle.S = null; continue; }
      const lines = S.log.slice(before).map(l => l.t);
      const dcs = [...new Set(lines.join(' ').match(/против Сл (\d+)/g) || [])].map(s => +s.replace(/\D/g, ''));
      const expect = m ? 8 + u.pb + Math.floor((u.abil[ABIL[m[1]]] - 10) / 2) : null;
      res.push({ id, name: eb.name, formula: m ? m[0] : 'нет формулы в тексте', expect, observed: dcs, ok, mp: `${mp0 - u.mp}/${eb.mana}`, time: A.time, spent: JSON.stringify({ a: u.t.action, b: u.t.bonus }), sample: lines.slice(0, 3).join(' | ').slice(0, 170) });
      Battle.S = null;
    }
    return res;
  }, { GEAR, ONLY, FAR });
  for (const r of out) { if (r.note) { console.log(r.id.padEnd(17), r.note); continue; } const flag = (r.expect != null && r.observed.length && !r.observed.every(d => d === r.expect) ? '  <-- Сл НЕ СОВПАДАЕТ' : '') + (r.mp.split('/')[0] !== r.mp.split('/')[1] ? '  <-- МАНА НЕ СОВПАДАЕТ' : ''); console.log(r.id.padEnd(17), `маны ${r.mp}`.padEnd(10), `время ${r.time}`.padEnd(14), `Сл ожид ${r.expect} / факт ${JSON.stringify(r.observed)}`.padEnd(32), r.formula.padEnd(24), flag); if (r.expect != null && !r.observed.length) console.log('    (броска Сл в журнале нет — это ловушка/зона/эффект без немедленного спасброска?)  журнал:', r.sample); }
  console.log('errs', errs.slice(0, 5));
  await b.close();
})();
