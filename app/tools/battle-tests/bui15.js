const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { dpr: 1 });
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin', 'wolf'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  // 1) реакция
  await p.evaluate(() => { window.__r = Battle.UI.promptReaction({ title: 'Встречный удар', text: 'Волк входит в вашу досягаемость. Ударить копьём? (3 маны)', yes: 'Ударить', no: 'Пропустить' }).then(v => { window.__rv = v; }); });
  await L.sleep(300); await L.shot(p, '90_reaction');
  await p.click('.bt-modal [data-m="yes"]'); await L.sleep(200);
  console.log('реакция ответ:', await p.evaluate(() => window.__rv));
  // 2) спасбросок от смерти
  await p.evaluate(() => { const u = Battle.heroes()[0]; window.__s = Battle.Dice.session(u, { kind: 'save', u, title: 'Спасбросок от смерти', sub: `${u.name}: 1 успех, 1 провал`, death: true }); window.__s.d20({ label: 'Спасбросок от смерти', mods: [], adv: [], dis: [], vs: { dc: 10 }, reroll: [], cancel: false, death: true }); });
  await L.sleep(800); await L.shot(p, '91_death_save');
  const t = await F.playSheet(p, { mode: 'button', shotName: '91b' }); console.log('смерть:', t); await p.evaluate(() => window.__s.close()); await L.sleep(300);
  // 3) спасбросок против эффекта с преимуществом/помехой
  await p.evaluate(() => { const u = Battle.heroes()[1]; window.__s = Battle.Dice.session(u, { kind: 'save', u, title: 'Спасбросок Ловкости', sub: 'Вспышка · Светлячок' }); window.__s.d20({ label: 'Спасбросок Ловкости', mods: [{ l: 'Ловкость', v: 3 }, { l: 'Мастерство', v: 2 }], adv: ['Оборона'], dis: [], vs: { dc: 12 }, reroll: [{ label: 'Вдохновение', spend() {} }, { label: 'Наследие', spend() {} }], cancel: false, save: true }); });
  await L.sleep(800); await L.shot(p, '92_save_adv');
  const t2 = await F.playSheet(p, { mode: 'drag', shotName: '92b' }); console.log('save adv:', t2); await p.evaluate(() => window.__s.close()); await L.sleep(300);
  // 4) урон (несколько костей), крит
  await p.evaluate(() => { const a = Battle.heroes()[0], tg = Battle.mons()[0]; window.__s = Battle.Dice.session(a, { title: 'Меч', sub: 'Грок → Гоблин', att: a, tgt: tg, anim: 'slash' }); window.__s.dice({ n: 4, s: 8, bonus: 4, crit: true, dt: 'slash', reroll: [{ label: 'Наследие обряда', spend() {} }], cancel: false }); });
  await L.sleep(800); await L.shot(p, '93_dmg_crit');
  const t3 = await F.playSheet(p, { mode: 'button', shotName: '93b' }); console.log('dmg:', t3);
  console.log('errs:', p.errs);
  await b.close();
})();
