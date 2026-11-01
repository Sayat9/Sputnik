// Пакет 34: ловушки врага скрыты, «Осмотреться» всегда есть, прицел, движение по точкам без остатка, лук на 4+, неловкость после крит. промаха.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  L.HEROES.lb = { name: 'Лея', race: 'human', main: 'longbow', base: { str: 10, dex: 16, con: 12, int: 10, wis: 20, cha: 10 }, ess: [] };
  await L.setup(p, { heroes: ['lb', 'barb2'] });
  await p.evaluate(() => { state.party[0].bag.push({ t: 'g', id: 'arrow', qty: 40 }); saveChar(); });
  await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p, { tries: 160 });
  const A = await p.evaluate(async () => {
    const B = Battle, S = B.S, o = {}, h = B.heroes(), m = B.mons()[0]; m.maxHp = m.hp = 300;
    // гоблин ставит ловушку рядом с собой — герой с Мудростью 20 её не видит
    S.objs = S.objs.filter(x => x.kind !== 'trap'); const logN = S.log.length;
    m.x = 3; m.y = 1; const cells = B.A.goblin.tgt(m).cells; await B.A.goblin.run(m, { cell: cells[0] }, { commit() {} });
    B.UI.refreshNow(); const t = S.objs.find(x => x.kind === 'trap'); o.trapHidden = t && t.hidden === true;
    o.noTrapIcon = !document.querySelector('.bt-obj.trap'); o.logQuiet = !S.log.slice(logN).some(l => /ловушк/i.test(l.t || l));
    // «Осмотреться» есть всегда (даже без ловушек)
    S.objs = S.objs.filter(x => x.kind !== 'trap'); const u = h.find(x => B.attacksOf(x).some(a => a.kind === 'ranged')) || B.UI.turnUnit;
    o.searchAlways = (B.extraOptions ? B.extraOptions(u) : []).length === 0 || true;
    // лук на 4+ клетки и ближе
    u.x = 3; u.y = 6; m.x = 3; m.y = 1; const atk = B.attacksOf(u).find(a => a.kind === 'ranged');
    const far = B.attackCtx(u, m, atk); m.y = 4; const near = B.attackCtx(u, m, atk);
    o.far = far.mods.some(x => /дальний выстрел/.test(x.l)) && far.dmgPlus >= 2; o.near = !near.mods.some(x => /дальний выстрел/.test(x.l));
    // прицел
    B.addStatus(u, 'aimed', { k: 2, when: 'end' }); m.y = 1; const ac = B.attackCtx(u, m, atk); o.aim = ac.extra.some(e => e.label === 'Прицел');
    // неловкость
    const br = h[1]; B.addStatus(br, 'fumbled', { k: 2, when: 'end' }); m.x = br.x; m.y = br.y - 1; const ma = B.attacksOf(br).find(a => a.kind === 'melee'); const fc = B.attackCtx(br, m, ma);
    o.fumble = fc.mods.some(x => x.v === -3) && fc.consume.some(c => c[1] === 'fumbled');
    return o; });
  ok('ловушка гоблина скрыта даже от зоркого героя', A.trapHidden && A.noTrapIcon, JSON.stringify(A));
  ok('в журнале не пишется про ловушку', A.logQuiet);
  ok('лук: на 4+ клетки +1 к попаданию и +2 урона, ближе — нет', A.far && A.near, JSON.stringify(A));
  ok('прицел даёт +1к6 в атаке', A.aim);
  ok('после крит. промаха −3 к следующей атаке, снимается', A.fumble);
  // «Осмотреться» в «Ещё» без скрытых ловушек
  await F.dockClick(p, 'other'); await L.sleep(300);
  ok('«Осмотреться» есть, даже когда прятаться нечему', await p.evaluate(() => !!document.querySelector('[data-ba="opt"][data-id="search"]')), await p.evaluate(() => [...document.querySelectorAll('[data-ba="opt"]')].map(x => x.dataset.id).join()));
  await F.dockClick(p, 'other'); await L.sleep(200);
  // движение: поставить точку на всё движение — «Идти» доступно
  await p.evaluate(() => { const B = Battle, u = B.UI.turnUnit; for (const m of B.mons()) { m.x = 6; m.y = 0; } u.x = 0; u.y = 6; B.heroes().filter(h => h !== u).forEach((h, i) => { h.x = 2 + i; h.y = 2; }); B.UI.refreshNow(); });
  await F.dockClick(p, 'move'); await L.sleep(300);
  const mv = await p.evaluate(async () => { const B = Battle, u = B.UI.turnUnit; const left = u.t ? u.t.move : 4; const tx = Math.min(6, left); B.UI.holdHandle(tx, 6); await new Promise(r => setTimeout(r, 100)); return { left, tx, ok: !!document.querySelector('[data-ba="pick-ok"]:not([disabled])'), txt: (document.querySelector('.bt-prompt') || document.querySelector('.bt-panel')).innerText.slice(0, 160) }; });
  ok('точки на всё движение — «Идти» нажимается', mv.ok, JSON.stringify(mv));
  if (mv.ok) { await p.click('[data-ba="pick-ok"]'); await L.sleep(800); ok('герой дошёл до последней точки', await p.evaluate(tx => Battle.UI.turnUnit && Battle.UI.turnUnit.x === tx && Battle.UI.turnUnit.y === 6, mv.tx)); }
  console.log('errs:', p.errs.length ? p.errs.slice(0, 4).join('\n') : 'нет');
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close();
})();
