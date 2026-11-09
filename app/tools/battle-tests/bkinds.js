// 09.11: виды существ (KIND_RU/monCat): пугало — механизмы, жуки и скорпионы — насекомые, слизи отдельно, химеры — чудовища; фильтры библиотеки и бестиария.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2'], tactical: false });
  const K = await p.evaluate(() => { const k = id => monCat(MONSTERS.find(m => m.id === id)); return { scarecrow: k('scarecrow'), beetle: k('coal-beetle'), scorp: k('sand-scorpion'), slime: k('slime'), chim: k('fled-chimera'), mourner: k('mourner'), ice: k('ice-spirit'), golem: k('clockwork-hound'), zombie: k('zombie'), goblin: k('goblin'), wolf: k('wolf'), all: [...new Set(MONSTERS.map(monCat))].every(x => KIND_RU[x]) }; });
  ok('пугало — механизмы и конструкты', K.scarecrow === 'construct', K);
  ok('жуки и скорпионы — насекомые', K.beetle === 'vermin' && K.scorp === 'vermin', K);
  ok('слизь — слизи, химера — чудовища', K.slime === 'ooze' && K.chim === 'monster', K);
  ok('призрак — духи, ледяной дух — элементаль', K.mourner === 'spirit' && K.ice === 'elemental', K);
  ok('механический пёс — механизм, зомби — нежить, гоблин — гуманоид, волк — зверь', K.golem === 'construct' && K.zombie === 'undead' && K.goblin === 'humanoid' && K.wolf === 'beast', K);
  ok('у каждого монстра есть подпись вида', K.all, K);
  const C = await p.evaluate(() => { state.journal = null; unlockJournal(8); unlockJournal(9); openLibrary(); const chips = [...document.querySelectorAll('[data-lx="kind"]')].map(x => x.textContent.trim()); closeLibrary(); return chips; });
  ok('в библиотеке 9 видов + «Все»', C.length === 10 && C.includes('Механизмы и конструкты'), C);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
