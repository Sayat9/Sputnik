// 09.11: удары реакцией не срабатывают по невидимке (атака по возможности, вход в зону — Упор пики / Встречный удар, прямой doAttack с reaction).
const L = require('./bui_lib.js'); const F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true }); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'] });
  await L.startFightPage(p, { list: ['goblin', 'goblin'] });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const R = await p.evaluate(async () => { const B = Battle; B.cfg.fast = true; const h = B.heroes()[0], m = B.mons()[0];
    let asked = 0; B.promptReaction = async () => { asked++; return true; }; B.promptOpportunity = async () => { asked++; return true; };
    B.addStatus(m, 'hidden', { k: Infinity, data: { invis: true } }); for (const u of B.S.units) if (u !== h && u !== m) { u.x = 0; u.y = 0; } h.x = 2; h.y = 3; B.S.objs = []; B.S.terrain = B.S.terrain && {};
    const cnt = () => B.S.log.length; const r = {};
    // прямой удар реакцией
    h.t.react = 1; const l0 = cnt(); const res = await B.doAttack(h, m, B.meleeAttackOf(h), { reaction: true, cancelable: false });
    r.direct = res && res.skipped === true; r.hp0 = m.hp;
    // атака по возможности: невидимка уходит от героя
    m.x = h.x + 1; m.y = h.y; h.t.react = 1; const hp = m.hp;
    const path = [[h.x + 2, h.y]]; if (B.canStand(m, path[0][0], path[0][1])) { await B.moveAlong(m, path); r.opp = h.t.react === 1 && m.hp === hp; } else r.opp = 'skip';
    // вход в зону: проверяем onEnter через пассивку с reactEnter
    let called = 0; B.P.__t = { reactEnter: async () => { called++; } }; h.pass.push('__t'); h.t.react = 1;
    m.x = h.x + 2; m.y = h.y; if (B.canStand(m, h.x + 1, h.y)) await B.moveAlong(m, [[h.x + 1, h.y]], { noProvoke: true });
    r.enter = called === 0;
    B.removeStatus(m, 'hidden'); m.x = h.x + 2; m.y = h.y; h.t.react = 1; if (B.canStand(m, h.x + 1, h.y)) await B.moveAlong(m, [[h.x + 1, h.y]], { noProvoke: true });
    r.enterVisible = called === 1; r.asked = asked;
    return r; });
  ok('прямой удар реакцией по невидимке отменён', R.direct, R);
  ok('атаки по возможности по невидимке нет', R.opp === true || R.opp === 'skip', R);
  ok('реакции на вход в зону невидимку не замечают', R.enter, R);
  ok('видимого — замечают', R.enterVisible, R);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
