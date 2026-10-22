// Интерфейс: подбор оружия на своей клетке, путевые точки при движении, окно клетки (долгое нажатие), призванные существа, зоны, тела.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const W = +process.env.W || 400, H = +process.env.H || 860;
(async () => {
  const { b, p } = await L.launch(W, H, { dpr: 2 });
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'beast', 'archer'], autoEnd: false });
  await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place');
  await p.click('[data-ba="place-go"]');
  await F.waitHero(p);
  const hold = async (x, y, ms = 650) => { const c = await L.cellXY(p, x, y); await p.mouse.move(c.x, c.y); await p.mouse.down(); await L.sleep(ms); await p.mouse.up(); await L.sleep(150); };
  const modalText = () => p.evaluate(() => { const m = document.querySelector('.bt-modal'); return m && !m.hidden ? m.innerText.replace(/\n+/g, ' / ') : ''; });
  const closeModal = async () => { const x = await p.$('.bt-modal [data-m="close"], .bt-modal [data-m="no"]'); if (x) await x.click(); await L.sleep(150); };
  // чистое поле, герой на (1,5), враг далеко
  const prep = async (o = {}) => p.evaluate(({ o }) => {
    const B = Battle, S = B.S, u = B.UI.turnUnit;
    for (const row of S.cells) row.fill(''); S.objs.length = 0; S.drops.length = 0; S.zones.length = 0; S.bodies.length = 0;
    B.heroes().forEach((h, i) => { h.x = 6; h.y = 6 - i; }); const m = B.mons()[0]; m.x = 6; m.y = 0; m.hp = m.maxHp = 300;
    u.x = o.x != null ? o.x : 1; u.y = o.y != null ? o.y : 5; u.t.move = B.speedOf(u); u.t.action = 1; u.t.bonus = 1; u.t.react = 1;
    B.UI.refreshNow(); B.UI.renderPanel();
    return { id: u.id, name: u.name, speed: B.speedOf(u) };
  }, { o });

  /* ===== 1. долгое нажатие вне выбора: эффекты клетки ===== */
  let info = await prep();
  await p.evaluate(() => { Battle.S.cells[3][3] = 'thorns'; Battle.S.cells[3][4] = 'puddle'; Battle.S.objs.push({ id: 'tt', kind: 'trap', x: 2, y: 3, dc: 12, hidden: false, owner: 'mon', dmg: '1к6', dt: 'pierce' }); Battle.UI.refreshNow(); });
  await hold(3, 3);
  let t = await modalText(); ok('зажатие пустой клетки с зарослями: окно с названием и правилом', /Колючие заросли/i.test(t) && /Труднопроходны/i.test(t) && /Клетка 4:4/i.test(t), t.slice(0, 200));
  await L.shot(p, '210_cellinfo_thorns'); await closeModal();
  await hold(4, 3); t = await modalText(); ok('вода: промок, холод и молния', /Лужа/i.test(t) && /Холод и молния/i.test(t), t.slice(0, 200)); await closeModal();
  await hold(2, 3); t = await modalText(); ok('ловушка видна: Сл и урон', /Ловушка/i.test(t) && /Сл 12/.test(t), t.slice(0, 200)); await closeModal();
  await hold(0, 0); t = await modalText(); ok('пустая земля: «Ровная земля» без подсказок про монстров', /Ровная земля/i.test(t) && !/Рыхлый грунт|закопаться/i.test(t), t.slice(0, 200)); await closeModal();
  // клетка с бойцом: окно бойца и справа сноска с эффектом поля
  await p.evaluate(() => { const u = Battle.UI.turnUnit; u.x = 3; u.y = 3; Battle.UI.refreshNow(); });
  await hold(3, 3);
  const lay = await p.evaluate(() => { const w = document.querySelector('.bt-insp-wrap'); if (!w) return null; const d = w.querySelector('.bt-dlg').getBoundingClientRect(), n = w.querySelector('.bt-fieldnote'); const r = n && n.getBoundingClientRect(); return { dlg: [d.left, d.right], note: r && [r.left, r.right], txt: n && n.innerText.replace(/\n+/g, ' / '), vw: innerWidth }; });
  ok('на клетке боец: окно бойца и справа сноска поля', lay && lay.note && lay.note[0] >= lay.dlg[1] - 1 && /Колючие заросли/i.test(lay.txt), JSON.stringify(lay));
  ok('сноска не вылезает за экран', lay && lay.note && lay.note[1] <= lay.vw + 1, JSON.stringify(lay));
  await L.shot(p, '211_cellinfo_unit'); await closeModal();
  // обычное касание по бойцу — окно бойца без сноски
  { const c = await L.cellXY(p, 3, 3); await p.mouse.click(c.x, c.y); await L.sleep(200); }
  ok('обычное касание: окно без сноски', await p.evaluate(() => !!document.querySelector('.bt-modal .bt-dlg.insp') && !document.querySelector('.bt-fieldnote')));
  await closeModal();

  /* ===== 2. путевые точки ===== */
  info = await prep({ x: 1, y: 5 });
  await p.evaluate(() => { Battle.S.objs.push({ id: 'tr', kind: 'trap', x: 3, y: 5, dc: 12, hidden: false, owner: 'mon', dmg: '1к6', dt: 'pierce' }); window.__vis = []; const o = Battle.UI.animMove; Battle.UI.animMove = async (u, from, to) => { window.__vis.push(to); return o.call(Battle.UI, u, from, to); }; Battle.UI.refreshNow(); });
  await L.sleep(100); await p.click('[data-ba="dock"][data-id="move"]'); await L.sleep(300);
  ok('начался выбор движения', await p.evaluate(() => !!Battle.UI.pick && Battle.UI.pick.type === 'move'));
  await hold(3, 4);
  let ways = await p.evaluate(() => (Battle.UI.pathWays || []).map(w => w.join(',')));
  ok('зажатие поставило путевую точку (3,4)', ways.join() === '3,4', ways.join());
  ok('в панели подсказка про точки и кнопка «Снять точки»', await p.evaluate(() => /Точек: 1/.test(document.querySelector('.bt-prompt').innerText) && !!document.querySelector('[data-ba="pick-clear"]')));
  await L.shot(p, '212_waypoint_set');
  { const c = await L.cellXY(p, 5, 5); await p.mouse.click(c.x, c.y); await L.sleep(250); }
  const prompt = await p.evaluate(() => document.querySelector('.bt-prompt p').innerText);
  ok('выбран конец (5,5): цена 4 клетки через точку, без ловушки на пути', /Идти на 4 кл\./.test(prompt) && !/ловушка/.test(prompt), prompt);
  await L.shot(p, '213_waypoint_path');
  { const c = await L.cellXY(p, 5, 5); await p.mouse.click(c.x, c.y); await L.sleep(900); }
  const res = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { pos: [u.x, u.y], vis: window.__vis.map(v => v.join(',')), trap: Battle.S.objs.some(o => o.id === 'tr'), hp: u.hp, maxHp: u.maxHp, move: u.t.move }; });
  ok('герой дошёл до (5,5), прошёл (3,4), ловушку обошёл', res.pos.join() === '5,5' && res.vis.includes('3,4') && !res.vis.includes('3,5') && res.trap && res.hp === res.maxHp, JSON.stringify(res));
  ok('движение потрачено по длине маршрута (4 клетки)', res.move === info.speed - 4, res.move);
  // без точки кратчайший путь задел бы ловушку (предупреждение)
  info = await prep({ x: 1, y: 5 });
  await p.evaluate(() => { Battle.S.objs.push({ id: 'tr', kind: 'trap', x: 3, y: 5, dc: 12, hidden: false, owner: 'mon', dmg: '1к6', dt: 'pierce' }); Battle.UI.refreshNow(); });
  await p.click('[data-ba="dock"][data-id="move"]'); await L.sleep(300);
  { const c = await L.cellXY(p, 5, 5); await p.mouse.click(c.x, c.y); await L.sleep(250); }
  ok('кратчайший путь по ловушке: предупреждение «ловушка»', /ловушка/.test(await p.evaluate(() => document.querySelector('.bt-prompt p').innerText)));
  // несколько точек и снятие повторным зажатием
  await hold(2, 4); await hold(4, 4); ways = await p.evaluate(() => (Battle.UI.pathWays || []).map(w => w.join(',')));
  ok('две точки по порядку', ways.join('|') === '2,4|4,4', ways.join('|'));
  await hold(2, 4); ways = await p.evaluate(() => (Battle.UI.pathWays || []).map(w => w.join(',')));
  ok('повторное зажатие снимает точку', ways.join('|') === '4,4', ways.join('|'));
  await hold(2, 4); await p.click('[data-ba="pick-clear"]'); await L.sleep(150); ways = await p.evaluate(() => (Battle.UI.pathWays || []));
  ok('«Снять точки» убирает все', ways.length === 0);
  await hold(6, 0); ok('слишком далёкая точка не ставится', (await p.evaluate(() => (Battle.UI.pathWays || []).length)) === 0);
  await p.evaluate(() => Battle.UI.pick && Battle.UI.pick.cancel()); await L.sleep(200);
  ok('после отмены метки пути сняты', await p.evaluate(() => !(Battle.UI.pathWays && Battle.UI.pathWays.length) && !document.querySelector('.bt-pathsvg').innerHTML.trim()));
  await p.evaluate(() => { const B = Battle; if (B.__restore) B.__restore(); });

  /* ===== 3. подбор оружия ===== */
  info = await prep({ x: 2, y: 5 });
  await p.evaluate(() => { const B = Battle, u = B.UI.turnUnit; const w = u.hero.equip.main; B.S.drops.push({ kind: 'weapon', hero: u.hero.id, slot: 'main', item: w, x: 2, y: 4 }); u.disarmed = true; B.UI.refreshNow(); B.UI.renderPanel(); });
  ok('копьё лежит рядом, но не под героем: кнопки подбора нет', await p.evaluate(() => !document.querySelector('.bt-pickup') && !Battle.actionsFor(Battle.UI.turnUnit).some(o => o.id === 'pickup')));
  await p.click('[data-ba="dock"][data-id="move"]'); await L.sleep(250);
  { const c = await L.cellXY(p, 2, 4); await p.mouse.click(c.x, c.y); await L.sleep(250); await p.mouse.click(c.x, c.y); await L.sleep(900); }
  const q1 = await modalText();
  ok('вошёл на клетку с оружием: запрос «Подобрать оружие?»', /Подобрать оружие/.test(q1), q1);
  await L.shot(p, '214_pickup_prompt');
  await p.click('.bt-modal [data-m="yes"]'); await L.sleep(400);
  const got = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { dis: u.disarmed, drops: Battle.S.drops.length, act: u.t.action, bonus: u.t.bonus }; });
  ok('подобрал: оружие в руке, на земле пусто, действия не тронуты', !got.dis && got.drops === 0 && got.act === 1 && got.bonus === 1, JSON.stringify(got));
  // отказ от запроса и подбор кнопкой
  await p.evaluate(() => { const B = Battle, u = B.UI.turnUnit; B.S.drops.push({ kind: 'weapon', hero: u.hero.id, slot: 'main', item: u.hero.equip.main, x: u.x, y: u.y }); u.disarmed = true; B.UI.refreshNow(); B.UI.renderPanel(); });
  ok('стоит на своём оружии: всплывает кнопка «Подобрать» (свободное действие)', await p.evaluate(() => { const b = document.querySelector('.bt-pickup'); return !!b && /Подобрать/.test(b.innerText) && /свободное/.test(b.innerText); }));
  await L.shot(p, '215_pickup_button');
  await p.click('.bt-pickup'); await L.sleep(300);
  const got2 = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { dis: u.disarmed, drops: Battle.S.drops.length, act: u.t.action, popup: !!document.querySelector('.bt-pickup') }; });
  ok('кнопка подобрала оружие, действие осталось, кнопка исчезла', !got2.dis && got2.drops === 0 && got2.act === 1 && !got2.popup, JSON.stringify(got2));
  // чужое оружие не подобрать
  await p.evaluate(() => { const B = Battle, u = B.UI.turnUnit; B.S.drops.push({ kind: 'weapon', hero: 'someone-else', slot: 'main', item: { t: 'w', id: 'spear' }, x: u.x, y: u.y }); B.UI.renderPanel(); });
  ok('оружие товарища под героем не подбирается', await p.evaluate(() => !document.querySelector('.bt-pickup')));

  /* ===== 4. призванные существа, зоны, тела, иллюзии ===== */
  info = await prep({ x: 3, y: 5 });
  await p.evaluate(() => {
    const B = Battle, S = B.S, u = B.UI.turnUnit;
    window.__dbl = B.makeDouble(u, [4, 5]);
    const w = B.spawnWolves(u, 2);
    B.addZone({ kind: 'swarm', owner: B.mons()[0].id, cells: [[1, 1], [2, 1], [1, 2], [2, 2]], until: 99, dc: 12 });
    B.addZone({ kind: 'dust', owner: u.id, follow: u.id, radius: 1, until: 99, dc: 12 });
    S.bodies.push({ id: 'x', x: 5, y: 2, name: 'Гоблин', eaten: false });
    S.objs.push({ id: 'ill', kind: 'illusion', x: 5, y: 3, owner: 'hero', by: u.id, until: 99 });
    B.addStatus(u, 'underground', { k: Infinity });
    B.UI.refreshNow();
  });
  await L.sleep(200);
  const cnt = await p.evaluate(() => ({ dbl: document.querySelectorAll('.bt-token.k-double').length, wolf: document.querySelectorAll('.bt-token.k-wolf').length, ghost: document.querySelectorAll('.bt-token.ghost').length, swarm: document.querySelectorAll('.bt-zcell.k-swarm').length, dust: document.querySelectorAll('.bt-zcell.k-dust').length, body: document.querySelectorAll('.bt-obj.body').length, ill: document.querySelectorAll('.bt-obj.illusion').length, under: document.querySelectorAll('.bt-token.under').length, badge: [...document.querySelectorAll('.bt-token.summon .bt-name')].map(e => e.textContent).join('') }));
  ok('двойник, 2 призрачных волка, рой, пыль, тело, иллюзия, закопавшийся нарисованы', cnt.dbl === 1 && cnt.wolf === 2 && cnt.ghost === 2 && cnt.swarm === 4 && cnt.dust >= 4 && cnt.body === 1 && cnt.ill === 1 && cnt.under === 1, JSON.stringify(cnt));
  ok('на призванных значки Д и В', /Д/.test(cnt.badge) && /В/.test(cnt.badge), cnt.badge);
  await L.shot(p, '216_summons_zones');
  // окно призванного существа без ошибок
  { const c = await L.cellXY(p, 4, 5); await p.mouse.click(c.x, c.y); await L.sleep(250); }
  const it = await modalText(); ok('окно двойника: «Двойник», 1 ОЗ, вполсилы', /Двойник/i.test(it) && /вполсилы/.test(it), it.slice(0, 220)); await L.shot(p, '217_double_inspect'); await closeModal();
  await hold(1, 1); t = await modalText(); ok('зажатие клетки с роем: описание роя', /Рой паучат/i.test(t) && /2к4/.test(t), t.slice(0, 200)); await closeModal();
  await hold(5, 2); t = await modalText(); ok('зажатие клетки с телом: «Павший»', /Павший/i.test(t), t.slice(0, 200)); await closeModal();
  // ход закопавшегося: действий нет
  const dead = await p.evaluate(() => Battle.actionsFor(Battle.UI.turnUnit).filter(o => o.enabled).length);
  ok('закопавшийся не может действовать', dead === 0, dead);
  await p.evaluate(() => Battle.UI.endTurn && Battle.UI.endTurn());
  console.log('errs:', p.errs.length ? p.errs.slice(0, 6) : 'нет');
  const bad = R.filter(r => !r.ok);
  console.log(`проверок: ${R.length}, не прошли: ${bad.length}`);
  await b.close();
})();
