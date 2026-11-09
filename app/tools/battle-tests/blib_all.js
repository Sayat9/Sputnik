// Библиотека (09.11): открытый класс показывает всех своих монстров со всех этажей и разломов;
// поиск в городской библиотеке берёт кандидатов из всех этажей; типы монстров подписаны по-русски.
const { chromium } = require('playwright');
const ROOT = process.argv[2] || '/home/user/app'; let n = 0, bad = 0; const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
(async () => {
  const L0 = require('./bui_lib.js'); const { b, p } = await L0.launch(400, 860, { touch: true }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500);
  const A = await p.evaluate(() => {
    state.journal = null; unlockJournal(9);
    const no8 = libMonsters().filter(m => m.cls === 8 && !journal().known[m.id]).length;
    unlockJournal(8);
    const all8 = MONSTERS.filter(m => !m.draft && !m.dyn && m.cls === 8).length, lib8 = libMonsters().filter(m => m.cls === 8).length;
    const f3 = libMonsters().some(m => m.cls === 8 && m.floor === 3), rift = libMonsters().some(m => m.cls === 8 && m.rift);
    return { no8, all8, lib8, f3, rift };
  });
  ok('8 класс скрыт, пока класс не открыт', A.no8 === 0, A);
  ok('все монстры 8 класса в библиотеке', A.lib8 === A.all8 && A.all8 > 40, A);
  ok('есть монстры 3 этажа и разломов', A.f3 && A.rift, A);
  const L = require('./bui_lib.js'); await L.setup(p, { heroes: ['barb2', 'archer'], tactical: false });
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.journal = null; unlockJournal(9); unlockJournal(8); state.party.forEach(c => { c.rank = 8; }); location.hash = 'town'; rerender(); });
  await p.waitForTimeout(300); await p.click('[data-bld="library"]'); await p.waitForSelector('[data-t="lr-cat"]');
  await p.click('[data-t="lr-cat"][data-k="monsters"]'); await p.click('[data-t="lr-hero"]'); await p.click('[data-t="lr-cls"][data-n="8"]');
  const txt = [];
  for (let i = 0; i < 8; i++) { txt.push(await p.evaluate(() => document.body.innerText)); if (!(await p.$('[data-t="lr-roll"]'))) break; await p.evaluate(() => { window.__libDie = 20; }); await p.click('[data-t="lr-roll"]'); txt.push(await p.evaluate(() => document.body.innerText)); const pick = await p.$('[data-t="lr-pick"]'); if (pick) await pick.click(); }
  const all = txt.join('\n'), cand = await p.evaluate(() => MONSTERS.filter(m => !m.draft && m.cls === 8).length);
  const B = { latin: all.match(/\b(goblin|beast|undead|stone|orc)\b/g) || [], ru: /Орки|Гоблины|Звери|Нежить|Элементали/.test(all), cand };
  ok('в поиске типы по-русски', B.ru, B);
  ok('нет английских типов в поиске', !B.latin.length, B);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
