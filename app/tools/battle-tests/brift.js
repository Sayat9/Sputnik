// Кристальный разлом: монстры и их эссенции в бою (автобои, исключения, ключевые механики)
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push({ n, ok: !!c }); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + (x == null ? '' : x)); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = { bad: [], used: {}, n: 0 };
    const mk = (i, main, off) => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: i % 2 ? 'barbarian' : 'human', level: 1 }); c.base = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }; c.equip = { main: { t: 'w', id: main } }; if (off) c.equip.off = { t: 'w', id: off }; delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 2, pos: { x: 5, y: 5 }, status: {}, light: false };
    const NEW = ['drop','dust-whirl','magma-hound','crystalloid','lake-spirit','magma-golem','deep-serpent','crystal-colossus','storm-spirit','rift-heart'];
    out.names = NEW.map(id => { const m = MONSTERS.find(x => x.id === id); return m ? [id, m.name, m.cls, m.floor, m.hp, m.ac, (m.traits || []).length] : [id, null]; });
    for (const id of NEW) for (let rep = 0; rep < 6; rep++) {
      state.party = [mk(0, 'sword', 'shield'), mk(1, 'greatsword'), mk(2, 'shortbow', 'dagger'), mk(3, 'spear', 'shield')]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      const cls = MONSTERS.find(m => m.id === id).cls;
      const list = id === 'drop' || id === 'dust-whirl' ? [id, id, id] : id === 'magma-hound' ? [id, id] : [id];
      try { const r = await B.sim({ list, zone: 'stone', floor: 2, kind: 'hard', title: 't' }); out.n++; if (!r.outcome) out.bad.push(id + ': нет исхода');
        for (const u of r.S.units) { if (!(u.hp >= 0) || u.hp > u.maxHp) out.bad.push(id + ': ОЗ ' + u.hp); if (Object.keys(u.used || {}).length) out.used[id] = (out.used[id] || 0) + 1; }
        B.S = null; } catch (e) { out.bad.push(id + ': ' + (e && e.message)); B.S = null; }
    }
    return out;
  });
  ok('все 10 монстров есть и с характеристиками', o.names.every(n => n[1] && n[3] === 2 && n[4] !== '—' && n[6] > 0), JSON.stringify(o.names));
  ok('автобои без ошибок: ' + o.n, o.bad.length === 0, o.bad.slice(0, 6).join(' | '));
  ok('способности эссенций применяются в боях', Object.keys(o.used).length >= 6, JSON.stringify(o.used));
  ok('нет ошибок страницы', errs.length === 0, errs.join('|'));
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
