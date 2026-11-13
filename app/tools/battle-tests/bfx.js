// 12.11: анимации атак, числа урона/лечения/маны, настройки (шестерёнка), меню, режим разработчика.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const SHOTS = process.env.SHOTS || '/tmp/battle-shots';
(async () => {
  const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: false });
  // --- меню и настройки
  await p.evaluate(() => { location.hash = ''; }); await L.sleep(300);
  const nav = await p.evaluate(() => [...document.querySelectorAll('nav.tabs button')].map(x => x.textContent.trim()));
  ok('нижняя панель: Игра, Герои, Справочник, Меню', nav.join('|') === 'Игра|Герои|Справочник|Меню', nav);
  ok('на главной шестерёнка вместо кнопки «Настройки»', await p.evaluate(() => !!document.querySelector('.fx-home .gear-btn[data-action="settings"]') && ![...document.querySelectorAll('.fx-home .fx-btn')].some(x => /Настройки/.test(x.textContent))));
  await p.screenshot({ path: SHOTS + '/fx-home.png' });
  await p.click('#tab-menu'); await L.sleep(200);
  const M = await p.evaluate(() => { const ov = document.getElementById('menuov'), pn = ov.querySelector('.panel').getBoundingClientRect(); return { open: !ov.hidden, gear: !!ov.querySelector('.gear-btn'), items: [...ov.querySelectorAll('.fx-btn')].map(x => x.textContent.trim()), inside: pn.left >= 0 && pn.right <= innerWidth && pn.top >= 0 && pn.bottom <= innerHeight }; });
  ok('меню открыто, в нём шестерёнка, окно в пределах экрана', M.open && M.gear && M.inside, M);
  await p.screenshot({ path: SHOTS + '/fx-menu.png' });
  await p.click('#menuov .gear-btn'); await L.sleep(250);
  const S1 = await p.evaluate(() => { const ov = document.getElementById('setov'); return { open: ov && !ov.hidden, menuClosed: document.getElementById('menuov').hidden, rows: [...ov.querySelectorAll('button')].map(x => x.querySelector('b') ? x.querySelector('b').textContent : x.textContent) }; });
  ok('шестерёнка открывает настройки (меню закрылось)', S1.open && S1.menuClosed, S1);
  ok('в настройках: анимации, числа, режим разработчика', S1.rows.some(x => /Анимации: вкл/.test(x)) && S1.rows.some(x => /Числа над бойцами: вкл/.test(x)) && S1.rows.some(x => /Режим разработчика: вкл/.test(x)), S1.rows);
  await p.screenshot({ path: SHOTS + '/fx-settings.png' });
  await p.click('[data-setm="dev"]'); await L.sleep(300);
  const S2 = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#setov button b')].map(x => x.textContent), cls: document.body.classList.contains('dev-off'), master: masterOn(), tact: settings().tactical }));
  ok('режим разработчика выкл: настройки ведущего скрыты, особые функции отключены', S2.cls && !S2.master && !S2.rows.some(x => /Тактический|Режим мастера/.test(x)) && S2.rows.some(x => /Режим разработчика: выкл/.test(x)), S2);
  await p.click('[data-setx="close"]'); await L.sleep(100);
  await p.evaluate(() => { location.hash = 'labyrinth'; }); await L.sleep(400);
  ok('в лабиринте нет меню мастера «⋯»', await p.evaluate(() => !document.querySelector('[data-dg="gm"]')));
  await p.evaluate(() => { openHero(state.party[0].id); }); await L.sleep(300);
  const H = await p.evaluate(() => { const vis = s => [...document.querySelectorAll(s)].some(x => x.offsetParent !== null); const hp0 = state.party[0].hp; const b = document.querySelector('[data-hx="hp"]'); if (b) b.click(); return { hpBtns: vis('[data-hx="hp"]'), mp: vis('[data-hx="mp"]'), same: state.party[0].hp === hp0 }; });
  ok('в окне героя нет кнопок правки ОЗ и маны, нажатие ничего не меняет', !H.hpBtns && !H.mp && H.same, H);
  await p.evaluate(() => { closeHero && closeHero(); settings().dev = true; saveChar(); devSync(); rerender(); }); await L.sleep(300);
  ok('режим разработчика вкл: меню мастера вернулось', await p.evaluate(() => !!document.querySelector('[data-dg="gm"]')));
  // --- бой: анимации и числа
  await L.startFightPage(p, { list: ['goblin', 'dire-wolf'], zone: 'goblin' }); await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const kinds = await p.evaluate(() => { const B = Battle, h = B.heroes()[0], [g, w] = B.mons(); const st = (att, atk) => B.UI.strikeStyle(att, atk);
    const mk = id => { h.hero.equip.main = { t: 'w', id }; return B.heroAttacks(h)[0]; };
    return { sword: st(h, mk('sword')), great: st(h, mk('greatsword')), axe: st(h, mk('greataxe')), spear: st(h, mk('spear')), dagger: st(h, mk('dagger')), mace: st(h, mk('mace')), flail: st(h, mk('flail')), wand: st(h, mk('wand')), bow: st(h, mk('shortbow')),
      wolf: w.atk.map(a => a.n + ':' + st(w, a)), gob: g.atk.map(a => a.n + ':' + st(g, a)), fist: st(h, B.heroAttacks(h).find(a => a.id === 'fist')) }; });
  ok('вид анимации по оружию: меч, двуручный, секира, копьё, кинжал, булава, цеп, палочка, лук', kinds.sword === 'slash' && kinds.great === 'sweep' && kinds.axe === 'chop' && kinds.spear === 'thrust' && kinds.dagger === 'stab' && kinds.mace === 'blunt' && kinds.flail === 'chain' && kinds.wand === 'magic' && kinds.bow === 'arrow' && kinds.fist === 'punch', kinds);
  ok('у волка — клыки', kinds.wolf.some(x => /bite/.test(x)), kinds.wolf);
  // кадр «на 300-й миллисекунде»: анимации останавливаются стилем, чтобы снимок не зависел от скорости браузера
  const shot = async (name, fn, at = 0.3) => { await p.evaluate(at => { let st = document.getElementById('fxfreeze'); if (!st) { st = document.createElement('style'); st.id = 'fxfreeze'; document.head.appendChild(st); } st.textContent = `.bt-strike *, .bt-boom *, .bt-float, .bt-crosscell { animation-play-state: paused !important; animation-delay: -${at}s !important; }`; }, at); await p.evaluate(fn); await L.sleep(120); await p.screenshot({ path: `${SHOTS}/fx-${name}.png` }); await p.evaluate(() => { document.getElementById('fxfreeze').textContent = ''; }); await L.sleep(1100); };
  await p.evaluate(() => { const B = Battle, hs = B.heroes(), ms = B.mons(); hs[0].x = 2; hs[0].y = 4; hs[1].x = 4; hs[1].y = 5; hs[2].x = 5; hs[2].y = 4; ms[0].x = 2; ms[0].y = 3; ms[1].x = 5; ms[1].y = 2; B.UI.refreshNow(); window.__fx = (style, a, t, extra) => B.UI.fxStrike(a, t, Object.assign({ kind: 'melee', dt: 'slash', n: style }, extra || {})); });
  const count = () => p.evaluate(() => document.querySelectorAll('.bt-strike').length);
  await p.evaluate(() => { const B = Battle; window.__ms = B.UI.fxStrike(B.heroes()[0], B.mons()[0], { kind: 'melee', dt: 'slash', w: { id: 'sword' }, n: 'Меч' }); }); await L.sleep(60);
  ok('вспышка удара появилась на поле и короче секунды', (await count()) === 1 && (await p.evaluate(() => window.__ms)) < 1000, await count());
  await L.sleep(1150); ok('вспышка сама исчезла', (await count()) === 0);
  await shot('slash', () => { const B = Battle; B.UI.fxStrike(B.heroes()[0], B.mons()[0], { kind: 'melee', dt: 'slash', w: { id: 'greatsword' } }); B.UI.fxStrike(B.mons()[1], B.heroes()[2], { kind: 'melee', dt: 'pierce', n: 'Укус' }); });
  await shot('claws', () => { const B = Battle; B.UI.fxStrike(B.mons()[0], B.heroes()[0], { kind: 'melee', dt: 'slash', n: 'Когти' }); B.UI.fxStrike(B.heroes()[2], B.mons()[1], { kind: 'melee', dt: 'bludgeon', w: { id: 'mace' } }); });
  await shot('thrust', () => { const B = Battle; B.UI.fxStrike(B.heroes()[0], B.mons()[0], { kind: 'melee', dt: 'pierce', w: { id: 'spear' } }); B.UI.fxStrike(B.heroes()[2], B.mons()[1], { kind: 'melee', dt: 'bludgeon', w: { id: 'flail' } }); }, 0.25);
  await shot('nums', () => { const B = Battle, h = B.heroes()[0], m = B.mons()[0]; B.UI.fxHit(m, 7, 'slash', false); B.UI.fxHit(h, 4, 'pierce', true); B.UI.fxHeal(B.heroes()[1], 5); B.UI.fxMana(B.heroes()[2], 3); B.UI.fxMana(B.heroes()[2], -2); }, 0.5);
  await shot('boom', () => { const B = Battle; B.UI.fxBoom(3, 3, 1); B.UI.fxStrike(B.heroes()[1], B.mons()[1], { kind: 'ranged', dt: 'arcane', magic: true, range: [6, 6] }); }, 0.22);
  // числа
  await p.evaluate(() => { const B = Battle, h = B.heroes()[0], m = B.mons()[0]; B.UI.fxHit(m, 7, 'slash', false); B.UI.fxHit(h, 4, 'pierce', false); B.UI.fxHeal(B.heroes()[1], 5); B.setMp(B.heroes()[2], B.heroes()[2].mp - 3); }); await L.sleep(250);
  const N1 = await p.evaluate(() => [...document.querySelectorAll('.bt-float.num')].map(x => ({ t: x.textContent, c: getComputedStyle(x).color, cls: x.className })));
  const has = (re, t) => N1.some(x => re.test(x.cls) && x.t === t);
  ok('числа: урон по монстру и герою, зелёное лечение, синяя мана', has(/dmg/, '−7') && has(/dmg/, '−4') && has(/heal/, '+5') && has(/mana/, '−3'), N1);
  const col = c => c.match(/\d+/g).map(Number); const heal = N1.find(x => /heal/.test(x.cls)), mana = N1.find(x => /mana/.test(x.cls)), dmg = N1.find(x => /dmg/.test(x.cls));
  ok('цвета: урон красный, лечение зелёное, мана синяя', dmg && col(dmg.c)[0] > col(dmg.c)[2] && heal && col(heal.c)[1] > col(heal.c)[0] && mana && col(mana.c)[2] > col(mana.c)[0], [dmg && dmg.c, heal && heal.c, mana && mana.c]);
  const inside = await p.evaluate(() => { const bd = document.querySelector('.bt-board').getBoundingClientRect(); return [...document.querySelectorAll('.bt-float')].every(x => { const r = x.getBoundingClientRect(); return r.left >= bd.left - 2 && r.right <= bd.right + 2; }); });
  ok('числа не выходят за края поля', inside);
  await L.sleep(1500);
  // выключатели
  await p.evaluate(() => { state.settings.dmgNums = false; state.settings.anim = false; const B = Battle; B.UI.fxHit(B.mons()[0], 3, 'slash', false); B.UI.fxHeal(B.heroes()[0], 2); window.__ms = B.UI.fxStrike(B.heroes()[0], B.mons()[0], { kind: 'melee', dt: 'slash', w: { id: 'sword' } }); B.UI.fxBoom(3, 3, 1); }); await L.sleep(120);
  ok('настройки выключены: ни чисел, ни анимаций', await p.evaluate(() => !document.querySelector('.bt-float.num') && !document.querySelector('.bt-strike') && !document.querySelector('.bt-boom') && window.__ms === 0));
  await p.evaluate(() => { state.settings.dmgNums = true; state.settings.anim = true; });
  console.log(errs.length ? 'ОШИБКИ: ' + errs.join('\n') : 'ошибок страницы нет'); console.log(`bfx: ${n - bad}/${n}`);
  await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
