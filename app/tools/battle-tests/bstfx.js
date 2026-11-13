// 13.11: анимации состояний на фишке (яд, кровь, огонь, оглушение, сбит с ног, страх, холод, путы…): слои, сочетание нескольких, устойчивость к перерисовке, выключатель.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const SHOTS = process.env.SHOTS || '/tmp/battle-shots';
(async () => {
  const { b, p } = await L.launch(400, 860, { dpr: 2 }); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: false });
  await L.startFightPage(p, { list: ['goblin', 'dire-wolf', 'dark-bear'], zone: 'goblin' }); await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  await p.evaluate(() => { const B = Battle, hs = B.heroes(), ms = B.mons(); hs[0].x = 1; hs[0].y = 4; hs[1].x = 3; hs[1].y = 4; hs[2].x = 5; hs[2].y = 4; ms[0].x = 1; ms[0].y = 2; ms[1].x = 3; ms[1].y = 2; ms[2].x = 4; ms[2].y = 1;
    for (const u of B.units()) u.conds = u.conds.filter(c => c.id !== 'hidden');
    const add = (u, id) => B.addStatus(u, id, { k: Infinity });
    add(hs[0], 'poisoned'); add(hs[1], 'bleeding'); ['poisoned', 'bleeding', 'burning', 'stunned'].forEach(id => add(hs[2], id));
    add(ms[0], 'prone'); ['frightened', 'restrained', 'slowed'].forEach(id => add(ms[1], id)); ['prone', 'poisoned', 'blinded', 'wet', 'sleepy', 'weakened'].forEach(id => add(ms[2], id)); B.UI.refreshNow(); });
  await L.sleep(300);
  const tok = id => `.bt-token[data-id="${id}"]`;
  const S = await p.evaluate(() => { const B = Battle, hs = B.heroes(), ms = B.mons(), q = u => document.querySelector(`.bt-token[data-id="${u.id}"]`);
    const kinds = u => [...q(u).querySelectorAll('.bt-stfx .sf')].map(x => x.className.replace('sf sf-', ''));
    return { h0: kinds(hs[0]), h1: kinds(hs[1]), h2: kinds(hs[2]), m0: kinds(ms[0]), m0cls: q(ms[0]).className, m1: kinds(ms[1]), m1cls: q(ms[1]).className, m2: kinds(ms[2]), m2cls: q(ms[2]).className }; });
  ok('отравление — зелёный слой, кровотечение — красный', S.h0.join() === 'poison' && S.h1.join() === 'bleed', S);
  ok('четыре состояния сразу — четыре слоя, каждый свой', S.h2.join() === 'poison,bleed,burn,stun', S.h2);
  ok('сбит с ног — фишка лежит', / sfx-prone/.test(S.m0cls) && S.m0.length === 0, [S.m0cls, S.m0]);
  ok('страх (дрожь) + путы + холод вместе', / sfx-fear/.test(S.m1cls) && S.m1.join() === 'cold,held', [S.m1cls, S.m1]);
  ok('шесть состояний на большом монстре: все слои и «лежит»', S.m2.join() === 'weak,wet,poison,blind,sleep' && / sfx-prone/.test(S.m2cls), [S.m2, S.m2cls]);
  // цвета и разнесение вспышек по времени
  const C = await p.evaluate(() => { const B = Battle, h = B.heroes()[2], el = document.querySelector(`.bt-token[data-id="${h.id}"]`); const g = k => getComputedStyle(el.querySelector('.sf-' + k + ' u')); return { pd: g('poison').animationDelay, bd: g('bleed').animationDelay, ps: g('poison').boxShadow, bs: g('bleed').boxShadow, clip: getComputedStyle(el.querySelector('.sf-poison')).overflow }; });
  ok('вспышки яда и крови разнесены по времени, цвета зелёный и красный', C.pd !== C.bd && /rgba?\(110, 230, 60/.test(C.ps) && /rgba?\(220, 30, 30/.test(C.bs), C);
  // перерисовка не перезапускает анимацию: узлы слоёв те же
  const same = await p.evaluate(async () => { const B = Battle, h = B.heroes()[2], q = () => document.querySelector(`.bt-token[data-id="${h.id}"] .sf-poison`); const a = q(); a.__mark = 1; for (let i = 0; i < 5; i++) B.UI.refreshNow(); await new Promise(r => setTimeout(r, 60)); return q() === a && q().__mark === 1; });
  ok('перерисовка поля не сбрасывает анимации (слои не пересоздаются)', same);
  // ничего не вылезает за поле
  const inside = await p.evaluate(() => { const bd = document.querySelector('.bt-board').getBoundingClientRect(); return [...document.querySelectorAll('.bt-stfx .sf u, .bt-stfx .sf')].every(x => { const r = x.getBoundingClientRect(); return r.left >= bd.left - 8 && r.right <= bd.right + 8 && r.top >= bd.top - 8; }); });
  ok('эффекты не выходят за поле', inside);
  await p.evaluate(() => { let st = document.createElement('style'); st.id = 'fz'; st.textContent = `.bt-stfx .sf u { animation-delay: -0.3s !important; animation-play-state: paused !important; } .bt-stfx .sf b { animation-delay: -0.5s !important; animation-play-state: paused !important; }`; document.head.appendChild(st); });
  await L.sleep(150); const bd = await p.evaluate(() => { const r = document.querySelector('.bt-board').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  await p.screenshot({ path: SHOTS + '/stfx.png', clip: bd }); await p.evaluate(() => document.getElementById('fz').remove());
  // удар и число поверх состояний: тряска и вспышка работают, слои на месте
  const hit = await p.evaluate(async () => { const B = Battle, h = B.heroes()[2], el = document.querySelector(`.bt-token[data-id="${h.id}"]`); B.UI.fxStrike(B.mons()[1], h, { kind: 'melee', dt: 'slash', n: 'Когти' }); B.UI.fxHit(h, 3, 'slash', false); await new Promise(r => setTimeout(r, 80));
    return { shake: el.classList.contains('shake'), strike: !!document.querySelector('.bt-strike'), num: !!document.querySelector('.bt-float.num'), layers: el.querySelectorAll('.bt-stfx .sf').length }; });
  ok('удар по фишке с состояниями: тряска, вспышка удара и число — всё вместе', hit.shake && hit.strike && hit.num && hit.layers === 4, hit);
  // снятие состояния убирает только его слой
  const rem = await p.evaluate(() => { const B = Battle, h = B.heroes()[2], q = () => [...document.querySelectorAll(`.bt-token[data-id="${h.id}"] .bt-stfx .sf`)].map(x => x.className.replace('sf sf-', '')); B.removeStatus(h, 'bleeding'); B.UI.refreshNow(); const a = q(); B.removeStatus(B.mons()[0], 'prone'); B.UI.refreshNow(); return { a, prone: / sfx-prone/.test(document.querySelector(`.bt-token[data-id="${B.mons()[0].id}"]`).className) }; });
  ok('состояние снято — исчез только его слой; встал — фишка поднялась', rem.a.join() === 'poison,burn,stun' && !rem.prone, rem);
  // погибший и выключатель
  const off = await p.evaluate(() => { const B = Battle; state.settings.anim = false; B.UI.refreshNow(); const vis = [...document.querySelectorAll('.bt-stfx')].some(x => getComputedStyle(x).display !== 'none'); state.settings.anim = true; B.UI.refreshNow(); const vis2 = [...document.querySelectorAll('.bt-stfx')].some(x => getComputedStyle(x).display !== 'none'); return { vis, vis2 }; });
  ok('настройка «Анимации» выключает и включает эффекты состояний', !off.vis && off.vis2, off);
  // настоящий бой: яд от атаки появляется на фишке сам
  const live = await p.evaluate(async () => { const B = Battle, h = B.heroes()[0], m = B.mons()[1]; B.removeStatus(h, 'poisoned'); B.UI.refreshNow(); const none = !document.querySelector(`.bt-token[data-id="${h.id}"] .sf-poison`); B.addStatus(h, 'poisoned', { k: 3, when: 'end' }); B.UI.refresh(); await new Promise(r => setTimeout(r, 200)); return { none, has: !!document.querySelector(`.bt-token[data-id="${h.id}"] .sf-poison`) }; });
  ok('состояние, полученное в бою, сразу видно на фишке', live.none && live.has, live);
  console.log(errs.length ? 'ОШИБКИ: ' + errs.join('\n') : 'ошибок страницы нет'); console.log(`bstfx: ${n - bad}/${n}`);
  await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
