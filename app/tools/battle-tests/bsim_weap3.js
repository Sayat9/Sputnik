// 12.11: автобои против каждого монстра игры отрядом с новым оружием (палочка, посох, цеп, моргенштерн, метательные кинжалы, стальные стрелы, артефакты):
// ищем исключения и нарушения (мана ниже нуля, герой вне поля, «NaN»), считаем, пользуются ли герои магией и кинжалами.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-weap2','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = { runs: 0, win: 0, issues: [], err: [], magic: 0, cross: 0, tdag: 0, flail: 0, steel: 0, byGroup: {} };
    const arts = Object.keys(ART_WEAPONS), pick = a => a[Math.floor(Math.random() * a.length)];
    const ent = a => (ART_WEAPONS[a] ? { t: 'w', id: ART_WEAPONS[a].base, art: a } : { t: 'w', id: a });
    const mk = (i, main, off, extra) => { const c = Object.assign(clone(state.example), { id: 'w' + i + Math.random().toString(36).slice(2, 5), example: false, name: 'Г' + i, race: pick(['human', 'dwarf', 'barbarian', 'fairy', 'gnome']), level: 4 });
      c.base = { str: 14, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }; c.equip = { main: ent(main) }; if (off) c.equip.off = ent(off); delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); (extra || []).forEach(e => addToBag(c, e)); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const mons = MONSTERS.filter(m => !m.dyn && !m.draft);
    let k = 0;
    for (const m of mons) {
      const a1 = arts[k++ % arts.length], a2 = arts[k++ % arts.length];
      state.party = [mk(0, k % 2 ? 'wand' : 'chain-wand', 'dagger'), mk(1, k % 3 ? 'staff' : 'meteor-staff'), mk(2, k % 2 ? 'flail' : 'binder-flail', 'shield', [{ t: 'g', id: k % 2 ? 'throw-dagger' : 'throw-dagger-steel', qty: 10 }]), mk(3, a1, null), mk(4, a2 === a1 ? 'morningstar' : a2, null, [{ t: 'g', id: 'arrow', qty: 10 }, { t: 'g', id: 'arrow-steel', qty: 10 }])];
      state.party.forEach(c => { const it = itemOf(c.equip.main); if (it && isTwoHandedWeapon(it)) delete c.equip.off; }); state.party[4].ammoPref = { bow: 'arrow-steel' };
      state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      try {
        const r = await B.sim({ list: [m.id, ...(m.cls >= 8 ? [m.id] : [])], zone: m.zone || 'goblin', floor: m.floor || 1, kind: 'hard', title: 't' }); const S = r.S; out.runs++;
        if (S.outcome === 'win') out.win++;
        const g = monCat(m); (out.byGroup[g] ||= [0, 0])[0]++; if (S.outcome === 'win') out.byGroup[g][1]++;
        if (r.error) out.err.push(m.id + ': ' + r.error);
        for (const u of S.units) { if (u.hero && (u.mp < 0 || Number.isNaN(u.mp) || Number.isNaN(u.hp))) out.issues.push(`${m.id}: мана/ОЗ героя ${u.mp}/${u.hp}`); if (!u.gone && !u.fled && !u.escaped && B.alive(u) && !B.inB(u.x, u.y)) out.issues.push(`${m.id}: ${u.name} вне поля ${u.x},${u.y}`); }
        for (const l of S.log) { const t = l.t; if (/NaN|undefined/.test(t)) out.issues.push(`${m.id}: журнал «${t.slice(0, 80)}»`); if (/Магический снаряд|Луч посоха/.test(t)) out.magic++; if (/Крест/.test(t)) out.cross++; if (/Бросок (стального )?кинжала/.test(t)) out.tdag++; if (/Цеп|цеп/.test(t)) out.flail++; if (/стальная стрела/.test(t)) out.steel++; }
      } catch (e) { out.err.push(m.id + ' (' + a1 + ', ' + a2 + '): ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')); }
      B.S = null;
    }
    return out;
  });
  console.log(JSON.stringify({ runs: rep.runs, win: rep.win, magic: rep.magic, cross: rep.cross, tdag: rep.tdag, flail: rep.flail, byGroup: rep.byGroup }));
  if (rep.err.length) console.log('ИСКЛЮЧЕНИЯ:\n' + rep.err.slice(0, 20).join('\n'));
  if (rep.issues.length) console.log('НАРУШЕНИЯ:\n' + [...new Set(rep.issues)].slice(0, 20).join('\n'));
  if (errs.length) console.log('ОШИБКИ СТРАНИЦЫ:\n' + [...new Set(errs)].slice(0, 10).join('\n'));
  console.log(`bsim_weap3: боёв ${rep.runs}, исключений ${rep.err.length}, нарушений ${rep.issues.length}, ошибок страницы ${errs.length}`);
  await b.close(); process.exit(rep.err.length || rep.issues.length || errs.length ? 1 : 0);
})();
