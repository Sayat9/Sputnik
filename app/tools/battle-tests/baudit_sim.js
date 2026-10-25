// Аудит по настоящим боям: оборачиваем useActive и смотрим, сколько героев пострадало от способности монстра и на каком расстоянии.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
const N = +process.argv[2] || 150;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async ({ N }) => {
    const B = Battle; B.cfg.fast = true; const stats = {}, bad = [];
    const mk = i => { const c = Object.assign(clone(state.example), { id: "a" + i + Math.random().toString(36).slice(2, 4), example: false, name: "Г" + i, race: "human", level: 2 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; c.equip = { main: { t: "w", id: "sword" } }; ensureKit(c); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const orig = B.useActive;
    B.useActive = async function (u, id, picks, o) {
      if (u.side !== "mon") return orig.call(this, u, id, picks, o);
      const hs = B.heroes(), sn = () => hs.map(h => ({ hp: h.hp, c: h.conds.map(c => c.id).sort().join(), x: h.x, y: h.y }));
      const before = sn(), pos = [u.x, u.y, u.size]; const A = B.A[id]; let spec = null; try { spec = A.tgt ? A.tgt(u) : { type: "self" }; } catch (e) {}
      const r = await orig.call(this, u, id, picks, o);
      const after = sn(), aff = hs.map((h, i) => (after[i].hp !== before[i].hp || after[i].c !== before[i].c) ? Math.max(Math.abs(before[i].x - pos[0] - (pos[2] > 1 ? 0.5 : 0)), Math.abs(before[i].y - pos[1] - (pos[2] > 1 ? 0.5 : 0))) : null).filter(d => d !== null);
      const t = spec ? spec.type : "?"; const s = stats[id] ||= { uses: 0, type: t, max: 0, multi: 0, far: 0 };
      s.uses++; s.max = Math.max(s.max, aff.length); if (aff.length > 1) s.multi++;
      if ((t === "unit") && aff.length > 1) bad.push(`${id}: unit-способность задела ${aff.length} героев (расстояния ${aff.join(",")})`);
      return r;
    };
    for (let i = 0; i < N; i++) {
      const n = 3 + Math.floor(Math.random() * 3); state.party = Array.from({ length: n }, (_, k) => mk(k)); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      const pool = MONSTERS.filter(m => !m.draft && m.essence && B.A[m.essence] && (m.floor === 1 || m.floor === 2));
      const m = pool[Math.floor(Math.random() * pool.length)], cnt = m.cls <= 8 ? 1 : 1 + Math.floor(Math.random() * 3);
      const ev = { list: Array(cnt).fill(m.id), zone: m.zone || "goblin", floor: m.floor || 1, kind: "hard", title: "аудит" };
      try { await B.sim(ev); } catch (e) { bad.push("ERR " + m.id + " " + String(e).slice(0, 80)); }
      B.S = null;
    }
    B.useActive = orig;
    return { stats, bad: [...new Set(bad)].slice(0, 30) };
  }, { N });
  const multi = Object.entries(rep.stats).filter(([, s]) => s.multi).map(([id, s]) => `${id}[${s.type}] uses=${s.uses} multi=${s.multi} max=${s.max}`);
  console.log('Способности с >1 пострадавшим героем:\n ' + multi.join('\n '));
  console.log('\nПодозрительные:\n ' + (rep.bad.join('\n ') || 'нет'));
  console.log('page errors:', [...new Set(errs)].slice(0, 6)); await b.close();
})();
