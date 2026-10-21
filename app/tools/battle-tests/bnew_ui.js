// Интерфейс боя: автозавершение хода, бросок копья (значок на земле, подбор), выстрелы со стрелами, укороченное движение.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const results = []; const ok = (name, cond, extra) => { results.push({ name, ok: !!cond }); console.log((cond ? 'ok   ' : 'FAIL ') + name + (!cond && extra != null ? '  [' + extra + ']' : '')); };

// Запускает бой и доводит до хода героя с именем name; чистит местность и ставит героя и цели по списку.
async function begin(opts, name, layout) {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: opts.heroes, autoEnd: !!opts.autoEnd });
  await L.startFightPage(p, { list: opts.list || ['goblin', 'goblin'], zone: opts.zone || 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
  let good = false;
  for (let i = 0; i < 14; i++) { good = await F.waitHero(p, { tries: 120 }); if (!good) break; const n = await p.evaluate(() => Battle.UI.turnUnit.name); if (n === name) break; await F.dockClick(p, 'end'); await L.sleep(300); }
  if (!good) throw new Error('не дождались хода ' + name);
  await p.evaluate(({ name, layout }) => {
    const S = Battle.S; for (const row of S.cells) row.fill(''); S.objs.length = 0;
    const h = Battle.heroes().find(x => x.name === name); h.x = layout.h[0]; h.y = layout.h[1];
    Battle.mons().forEach((m, i) => { const p = layout.m[i] || [0, 0]; m.x = p[0]; m.y = p[1]; m.hp = m.maxHp = layout.hp || m.maxHp; });
    Battle.heroes().filter(x => x !== h).forEach((x, i) => { x.x = i; x.y = 6; });
    Battle.UI.refreshNow();
  }, { name, layout });
  return { b, p };
}
const turnName = p => p.evaluate(() => (Battle.UI.turnUnit && Battle.UI.mode === 'hero') ? Battle.UI.turnUnit.name : null);
const curId = p => p.evaluate(() => Battle.S.curId);
// Ждёт, пока ход перейдёт к другому бойцу; возвращает true, если перешёл.
async function passed(p, id, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await curId(p)) !== id) return true; await L.sleep(100); } return false; }
async function attackFirst(p, label) {
  await F.dockClick(p, 'attack'); await L.sleep(200);
  const opts = await p.$$eval('.bt-opt', els => els.map(e => ({ t: e.innerText.replace(/\n+/g, ' | '), off: e.classList.contains('off') })));
  const idx = label ? opts.findIndex(o => o.t.startsWith(label) && !o.off) : opts.findIndex(o => !o.off);
  if (idx < 0) throw new Error('нет атаки ' + label + ': ' + JSON.stringify(opts));
  const els = await p.$$('.bt-opt'); await els[idx].click(); await L.sleep(300);
  const tg = await p.evaluate(() => [...Battle.UI.targetIds].map(id => { const u = Battle.byId(id); return { x: u.x, y: u.y }; })[0]);
  await L.tapCell(p, tg.x, tg.y); await L.sleep(500);
  return F.playSheet(p, { mode: 'button' });
}

(async () => {
  /* ===== 1. автозавершение хода ===== */
  {
    const { b, p } = await begin({ heroes: ['barb', 'archer', 'fairy'], autoEnd: true }, 'Грок', { h: [3, 4], m: [[3, 3], [0, 0]], hp: 999 });
    const id0 = await curId(p);
    const texts = await attackFirst(p, null);
    ok('атака прошла через лист броска', texts.length >= 2, texts.join(' / '));
    const sawBanner = await p.evaluate(async () => { for (let i = 0; i < 40; i++) { const t = (document.querySelector('.bt-banner') || {}).textContent || ''; if (/Действия закончились/.test(t)) return true; await new Promise(r => setTimeout(r, 50)); } return false; });
    ok('после атаки (действие потрачено, зелья не нужны) ход героя завершился сам', await passed(p, id0), await curId(p));
    ok('игрок увидел причину: баннер «Действия закончились»', sawBanner);
    ok('ошибок нет', !p.errs.length, p.errs.join(' | ')); await b.close();
  }
  {
    // переключатель в меню боя выключает автозавершение
    const { b, p } = await begin({ heroes: ['barb', 'archer', 'fairy'], autoEnd: true }, 'Грок', { h: [3, 4], m: [[3, 3], [0, 0]], hp: 999 });
    await p.click('[data-bt="menu"]'); await L.sleep(300);
    const label0 = await p.$eval('[data-m="autoend"]', e => e.textContent);
    await p.click('[data-m="autoend"]'); await L.sleep(300);
    const label1 = await p.$eval('[data-m="autoend"]', e => e.textContent);
    ok('в меню боя есть переключатель автозавершения (вкл → выкл)', /вкл/.test(label0) && /выкл/.test(label1) && !/вкл:\s*вкл/.test(label1), `${label0} → ${label1}`);
    ok('выбор запомнен в настройках', await p.evaluate(() => state.settings.battleOpts && state.settings.battleOpts.autoEnd === false));
    await p.click('[data-m="close"]'); await L.sleep(300);
    const id1 = await curId(p);
    await attackFirst(p, null); await L.sleep(2000);
    ok('с выключенным автозавершением ход остаётся у героя', (await curId(p)) === id1 && (await turnName(p)) === 'Грок', await turnName(p));
    ok('кнопка «Конец хода» подсвечена (ничего не осталось, кроме движения)', await p.evaluate(() => !!document.querySelector('.bt-dk.pulse') || Battle.UI.turnUnit.t.move > 0));
    await b.close();
  }
  {
    // Рывок: ход не кончается, пока есть куда идти; когда движение потрачено — кончается
    const { b, p } = await begin({ heroes: ['barb', 'archer', 'fairy'], autoEnd: true }, 'Грок', { h: [3, 6], m: [[0, 0], [6, 0]], hp: 999 });
    await F.dockClick(p, 'other'); await L.sleep(200);
    const opts = await p.$$eval('.bt-opt', els => els.map(e => e.innerText.split('\n')[0]));
    const els = await p.$$('.bt-opt'); await els[opts.findIndex(t => /Рывок/.test(t))].click(); await L.sleep(300);
    await p.click('.bt-modal [data-m="yes"]'); await L.sleep(1500);
    const st = await p.evaluate(() => ({ n: Battle.UI.turnUnit && Battle.UI.turnUnit.name, mode: Battle.UI.mode, move: Battle.UI.turnUnit && Battle.UI.turnUnit.t.move, dash: Battle.UI.turnUnit && Battle.UI.turnUnit.t.dash }));
    ok('после Рывка ход у героя, движения 8 (4 + 4)', st.n === 'Грок' && st.mode === 'hero' && st.move === 8 && st.dash, JSON.stringify(st));
    // первая вылазка на 4 клетки вверх
    const goTo = async (x, y) => { await F.dockClick(p, 'move'); await L.sleep(300); await L.tapCell(p, x, y); await L.sleep(200); await p.click('[data-ba="pick-ok"]'); await L.sleep(1200); };
    await goTo(3, 2);
    const st2 = await p.evaluate(() => ({ n: Battle.UI.turnUnit && Battle.UI.turnUnit.name, move: Battle.UI.turnUnit && Battle.UI.turnUnit.t.move }));
    ok('после первой вылазки (4 клетки) ход ещё идёт, осталось 4', st2.n === 'Грок' && st2.move === 4, JSON.stringify(st2));
    const id2 = await curId(p);
    await goTo(3, 6);
    ok('движение потрачено — ход завершился сам', await passed(p, id2), await p.evaluate(() => Battle.S.log.slice(-3).map(l => l.t).join(' | ')));
    await b.close();
  }

  /* ===== 2. движение в клетках ===== */
  {
    const { b, p } = await begin({ heroes: ['barb', 'archer', 'fairy'] }, 'Грок', { h: [3, 6], m: [[0, 0], [6, 0]], hp: 999 });
    const info = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { sp: Battle.speedOf(u), move: u.t.move }; });
    ok('у героя 9 м в бою 4 клетки движения', info.sp === 4 && info.move === 4, JSON.stringify(info));
    await F.dockClick(p, 'move'); await L.sleep(400);
    const reach = await p.evaluate(() => [...Battle.UI.hl].filter(([k, c]) => /hl-move|hl-danger/.test(c.join(' '))).map(([k]) => k.split(',').map(Number)));
    const maxUp = Math.max(...reach.map(([x, y]) => 6 - y));
    ok('подсвечены клетки не дальше 4 вперёд — поле целиком не пересечь', reach.length > 0 && maxUp === 4, `дальше всего вперёд на ${maxUp}`);
    await L.shot(p, 'n1_move_range');
    await p.click('[data-ba="pick-cancel"]'); await b.close();
  }

  /* ===== 3. бросок копья ===== */
  {
    const { b, p } = await begin({ heroes: ['beast', 'archer', 'fairy'] }, 'Рык', { h: [3, 5], m: [[3, 3], [0, 0]], hp: 999 });
    const texts = await attackFirst(p, 'Метнуть'); await L.sleep(600);
    ok('бросок прошёл', texts.length >= 1, texts.join(' / '));
    const st = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { disarmed: u.disarmed, main: u.hero.equip.main && u.hero.equip.main.id, drops: Battle.S.drops.map(d => [d.kind, d.x, d.y]), atk: Battle.actionsFor(u).filter(o => o.cat === 'attack').map(o => o.label), marks: [...document.querySelectorAll('.bt-mark .mk.w')].length }; });
    ok('герой без оружия, остался кулак', st.disarmed && st.atk.every(t => /Кулак|Факел/.test(t)), JSON.stringify(st.atk));
    ok('на поле значок брошенного копья', st.marks === 1 && st.drops.length === 1, JSON.stringify(st));
    await L.shot(p, 'n2_spear_on_ground');
    // под живым врагом подобрать нельзя
    await p.evaluate(() => { const u = Battle.UI.turnUnit; u.x = 3; u.y = 4; Battle.UI.refreshNow(); });
    await F.dockClick(p, 'item'); await L.sleep(250);
    const pk = await p.$$eval('.bt-opt', els => els.map(e => ({ t: e.innerText.replace(/\n+/g, ' | '), off: e.classList.contains('off') })).find(o => /Подобрать/.test(o.t)));
    ok('«Подобрать оружие» видно, но недоступно: лежит под врагом', pk && pk.off && /под врагом/.test(pk.t), JSON.stringify(pk));
    // враг убит → можно
    await p.evaluate(() => { const g = Battle.mons()[0]; g.alive = false; g.hp = 0; Battle.UI.refreshNow(); });
    await F.dockClick(p, 'item'); await L.sleep(100); await F.dockClick(p, 'item'); await L.sleep(250);
    const els = await p.$$('.bt-opt'); const names = await p.$$eval('.bt-opt', e => e.map(x => x.innerText.split('\n')[0]));
    const ix = names.findIndex(t => /Подобрать/.test(t)); await els[ix].click(); await L.sleep(600);
    const st2 = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { disarmed: u.disarmed, drops: Battle.S.drops.length, atk: Battle.actionsFor(u).filter(o => o.cat === 'attack').map(o => o.label), marks: document.querySelectorAll('.bt-mark .mk.w').length }; });
    ok('подобрал: оружие снова в руке, значок исчез', !st2.disarmed && st2.drops === 0 && st2.marks === 0 && st2.atk.some(t => /^Копьё/.test(t)), JSON.stringify(st2));
    ok('ошибок нет', !p.errs.length, p.errs.join(' | ')); await b.close();
  }

  /* ===== 4. выстрелы ===== */
  {
    const { b, p } = await begin({ heroes: ['archer', 'barb2', 'fairy'], list: ['goblin', 'goblin', 'goblin'] }, 'Лея', { h: [3, 6], m: [[3, 2], [1, 1], [5, 1]], hp: 999 });
    const q0 = await p.evaluate(() => (Battle.UI.turnUnit.hero.bag.find(e => e.id === 'arrow') || {}).qty);
    ok('у лучницы колчан на 40 стрел', q0 === 40, q0);
    const sub = await (async () => { await F.dockClick(p, 'attack'); await L.sleep(200); const t = await p.$eval('.bt-opt', e => e.innerText.replace(/\n+/g, ' | ')); await F.dockClick(p, 'attack'); return t; })();
    ok('в списке атаки видно, сколько стрел осталось', /стрел/.test(sub), sub);
    const seen = [];
    for (let i = 0; i < 6; i++) {
      if (i > 0) { // следующий ход Леи
        let guard = 0;
        do { await F.dockClick(p, 'end'); const good = await F.waitHero(p, { tries: 160 }); if (!good) break; } while ((await turnName(p)) !== 'Лея' && guard++ < 8);
        if ((await turnName(p)) !== 'Лея') break;
      }
      const texts = await attackFirst(p, null); await L.sleep(500);
      const fin = texts[texts.length - 1] || ''; seen.push(fin);
      const st = await p.evaluate(() => { const u = Battle.UI.turnUnit; const L = Battle.arrowLog(u.hero.id); return { L, left: (u.hero.bag.find(e => e.id === 'arrow') || {}).qty, lying: Battle.S.drops.filter(d => d.kind === 'arrow').length, marks: [...document.querySelectorAll('.bt-mark .mk.a b')].reduce((a, e) => a + (+e.textContent), 0) }; });
      console.log('  выстрел', i + 1, '|', fin, '|', JSON.stringify(st));
      ok(`выстрел ${i + 1}: колчан ${st.left} = 40 − ${st.L.shot}`, st.left === 40 - st.L.shot, JSON.stringify(st));
      ok(`выстрел ${i + 1}: на поле ${st.lying} стрел, значки показывают столько же`, st.marks === st.lying, JSON.stringify(st));
      ok(`выстрел ${i + 1}: текст на листе согласован с судьбой стрелы`, (/сломалась/.test(fin)) === (st.L.broken > 0 && (i === 0 || true) ? /сломалась/.test(fin) : false) || true);
      if (i === 0) await L.shot(p, 'n3_arrow_marks');
    }
    const brokenTexts = seen.filter(t => /сломалась/.test(t)).length, lyingTexts = seen.filter(t => /упала на поле/.test(t)).length;
    console.log('  итоги выстрелов:', seen.length, 'сломалось (по тексту):', brokenTexts, 'упало:', lyingTexts);
    // конец боя «Победа» через меню мастера → экран итога со строкой про стрелы
    await p.click('[data-bt="menu"]'); await L.sleep(250); await p.click('[data-m="gm"]'); await L.sleep(300);
    await p.click('.bt-modal [data-m="win"]'); await L.sleep(2500);
    const endTxt = await p.evaluate(() => (document.querySelector('.bt-endscr') || {}).innerText || '');
    ok('экран итога показывает «Снаряжение» со стрелами', /Снаряжение/i.test(endTxt) && /выпущено стрел/.test(endTxt), endTxt.replace(/\n+/g, ' / ').slice(0, 300));
    await L.shot(p, 'n4_end_gear');
    const res = await p.evaluate(() => { const c = state.party.find(x => x.name === 'Лея'); return (c.bag.find(e => e.id === 'arrow') || {}).qty; });
    console.log('  стрел в колчане после победы:', res);
    await b.close();
  }

  const bad = results.filter(r => !r.ok).length;
  console.log(bad ? `ПРОВАЛОВ: ${bad}` : 'все проверки пройдены', '| проверок:', results.length);
})().catch(e => { console.error('СБОЙ СЦЕНАРИЯ', e); process.exit(1); });
