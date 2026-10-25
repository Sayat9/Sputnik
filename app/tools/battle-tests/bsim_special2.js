// Вороны: последняя ворона паникует и улетает (исход «Монстры убегают»); чернокрыл зовёт подкрепление каждые 3 раунда; часовня и ярусы без ошибок.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const out = await p.evaluate(async () => {
    const B = Battle, R = [], ok = (name, cond, extra) => R.push({ name, ok: !!cond, extra: extra == null ? '' : String(extra) });
    state.run = state.run || { floor: 2, pos: { x: 5, y: 5 }, status: {}, light: false };
    const mk = (i, o = {}) => { const c = Object.assign(clone(state.example), { id: 'e' + i, example: false, name: 'Г' + i, race: 'human', level: 2 }); c.base = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 12 }; Object.assign(c, o); return c; };
    const party = () => { const hs = [mk(1, { main: 'sword' }), mk(2), mk(3)]; state.party = hs; state.run.status = {}; hs.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; c.hp = maxHp(c); }); return hs; };
    B.cfg.fast = true;
    let retreat = 0, wins = 0, other = 0, bad = [];
    for (let i = 0; i < 12; i++) {
      party();
      try {
        const S = await B.start({ list: ['crow', 'crow', 'crow', 'crow'], zone: 'beast', floor: 2, sp: { k: 'nest' }, killed: [] }, { sim: true, autoHeroes: true });
        if (S.outcome === 'retreat') retreat++; else if (S.outcome === 'win') wins++; else other++;
      } catch (e) { bad.push('nest: ' + (e && e.message)); }
    }
    ok('гнездо: бои заканчиваются без ошибок', bad.length === 0, bad.join('|'));
    ok('гнездо: последняя ворона хотя бы иногда улетает', retreat > 0, `retreat ${retreat}, win ${wins}, другое ${other}`);
    let add = 0, n = 0;
    for (let i = 0; i < 6; i++) {
      party();
      try {
        const S = await B.start({ list: ['blackwing', 'crow', 'crow', 'crow', 'crow'], zone: 'beast', floor: 2, sp: { k: 'blackwing' }, killed: [] }, { sim: true, autoHeroes: true });
        n++; add += S.log.filter(l => /Прилетают новые вороны/.test(l.t)).length; if (!S.outcome) bad.push('bw: нет исхода');
      } catch (e) { bad.push('bw: ' + (e && e.message)); }
    }
    ok('чернокрыл: бои без ошибок', bad.length === 0, bad.join('|'));
    ok('чернокрыл: подкрепление прилетает', add > 0, `событий ${add} за ${n} боёв`);
    for (const list of [['grey-shade', 'morok', 'morok'], ['whisperer', 'morok'], ['mirror-dead', 'grey-shade'], ['faceless-ringer'], ['corpse-eater', 'ghoul', 'ghoul'], ['giant-mole'], ['dark-bear']]) {
      party();
      try { const S = await B.start({ list, zone: list[0] === 'giant-mole' || list[0] === 'dark-bear' ? 'beast' : 'undead', floor: 2, killed: [] }, { sim: true, autoHeroes: true }); ok('ярус ' + list.join('+') + ': есть исход', !!S.outcome); } catch (e) { ok('ярус ' + list.join('+'), false, e && e.message); }
    }
    // --- туман часовни: видно только на 2 клетки (3 м); полное укрытие — клетки за ним непрозрачны
    {
      party(); const hs = state.party; const S = B.newBattle({ list: ['grey-shade', 'morok'], zone: 'undead', floor: 2, fog: 2 });
      for (const row of S.cells) row.fill(''); S.objs.length = 0; S.phase = 'fight';
      const H = B.heroes()[0], M = B.mons(); H.x = 3; H.y = 6; M[0].x = 3; M[0].y = 4; M[1].x = 3; M[1].y = 1;
      for (const h of B.heroes()) { if (h !== H) { h.x = 0; h.y = 6; } }
      ok('туман: S.fog = 2', S.fog === 2);
      ok('туман: монстр в 2 клетках виден', B.seenByParty(M[0]) === true);
      ok('туман: монстр в 5 клетках не виден', B.seenByParty(M[1]) === false);
      const v = B.visionCells(); ok('туман: клетка в 2 шагах видна, в 4 — нет', v.has('3,4') && !v.has('3,2'), v.size);
      S.fog = 0; ok('без тумана дальний монстр виден', B.seenByParty(M[1]) === true);
      S.cells[3][3] = 'palisade'; for (const h of B.heroes()) { h.x = 3; h.y = 6; } M[1].y = 1; const v2 = B.visionCells();
      ok('частокол: клетки прямо за ним не видны, перед ним видны', !v2.has('3,2') && !v2.has('3,1') && v2.has('3,4'));
      ok('частокол: монстр за ним не виден', B.seenByParty(M[1]) === false);
    }
    return R;
  });
  const bad = out.filter(r => !r.ok);
  console.log(`проверок: ${out.length}, не прошли: ${bad.length}`); for (const r of bad) console.log('  ✗', r.name, '—', r.extra);
  console.log('page errors:', [...new Set(errs)].slice(0, 6));
  await b.close(); process.exit(bad.length || errs.length ? 1 : 0);
})();
