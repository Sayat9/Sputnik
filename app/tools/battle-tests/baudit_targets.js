// Аудит целей способностей монстров: для каждой активки монстра, которая применяется ИИ, ставим 4 героя на разные расстояния
// и смотрим, сколько из них пострадало (урон или новый статус) и на каком расстоянии.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async () => {
    const out = [], B = Battle; B.cfg.fast = true;
    const mk = i => { const c = Object.assign(clone(state.example), { id: "a" + i, example: false, name: "Г" + i, race: "human", level: 2 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; c.equip = { main: { t: "w", id: "sword" } }; ensureKit(c); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const mons = MONSTERS.filter(m => !m.draft && m.essence && B.A && B.A[m.essence]);
    for (const m of mons) {
      const id = m.essence, A = B.A[id];
      if (A.time === "reaction") continue;
      for (let rep = 0; rep < 3; rep++) {
        try {
          state.party = [0, 1, 2, 3].map(mk); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
          const ev = { list: [m.id], zone: m.zone || "goblin", floor: m.floor || 1, kind: "hard", title: "аудит" };
          const S = B.newBattle(ev); S.opts.autoHeroes = true; B.placeMonsters(S); B.preStart(S);
          B.rollInitiative(); S.phase = "fight";
          const u = B.mons()[0]; if (!u) continue;
          u.x = 3; u.y = 1; u.hp = u.maxHp;
          const hs = B.heroes(); const spots = [[3, 2], [1, 3], [5, 5], [0, 6]];       // 1, 2, 4, 5–6 клеток
          hs.forEach((h, i) => { h.x = spots[i][0]; h.y = spots[i][1]; h.hp = h.maxHp; });
          for (const o of S.objs) o.hidden = false;
          const snap = () => hs.map(h => ({ hp: h.hp, c: h.conds.map(c => c.id).sort().join(), x: h.x, y: h.y }));
          const before = snap(), logN = S.log.length;
          const picksAI = A.ai ? A.ai(u) : null;
          if (!picksAI) { out.push({ id, mon: m.id, note: "ИИ не применяет (A.ai пуст)" }); break; }
          const picks = { unit: picksAI.unit, units: picksAI.units, cell: picksAI.cell };
          if (picksAI.attackAbility) picks.unit = picksAI.targets && picksAI.targets[0];
          S.curId = u.id; u.t = { move: 4, action: 1, bonus: 1, react: 1 };
          let err = null; try { await B.useActive(u, id, picks); } catch (e) { err = String(e).slice(0, 100); }
          const after = snap();
          const hit = hs.map((h, i) => (after[i].hp !== before[i].hp || after[i].c !== before[i].c || after[i].x !== before[i].x || after[i].y !== before[i].y) ? Math.max(Math.abs(spots[i][0] - u.x), Math.abs(spots[i][1] - u.y)) : null).filter(d => d !== null);
          const lines = S.log.slice(logN).map(l => (typeof l === 'string' ? l : l.t || l.text || JSON.stringify(l)).slice(0, 110)); out.push({ id, mon: m.id, lines, spec: JSON.stringify(A.tgt ? A.tgt(u) : "self").slice(0, 90), hit: hit.join(","), n: hit.length, err });
        } catch (e) { out.push({ id, mon: m.id, err: String(e).slice(0, 120) }); }
        finally { B.S = null; }
      }
    }
    return out;
  });
  const by = {}; for (const r of rep) { (by[r.id] ||= []).push(r); }
  for (const [id, rs] of Object.entries(by)) { if (process.argv[2] && !process.argv[2].split(',').includes(id)) continue; console.log(id.padEnd(22), rs[0].spec || rs[0].note || '', '| n:', rs.map(r => r.n ?? '-').join('/'), '| dist:', rs.map(r => r.hit || '').join(' / '), rs.find(r => r.err) ? '| ERR ' + rs.find(r => r.err).err : ''); if (process.argv[2]) console.log('   ', (rs[0].lines || []).join('\n    ')); }
  console.log('page errors:', [...new Set(errs)].slice(0, 6));
  await b.close();
})();
