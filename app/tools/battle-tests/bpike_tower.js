// 09.11: пика + ростовой щит в левой руке — можно любому герою; Защита щита засчитывается, штрафа неудобного хвата нет.
const L = require('./bui_lib.js');
(async () => { const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['archer', 'barb2'], tactical: false });
  const R = await p.evaluate(() => { const c = state.party.find(x => x.race !== 'barbarian') || state.party[0]; c.equip.main = { t: 'w', id: 'pike' }; delete c.equip.off; c.bag = [{ t: 'w', id: 'tower-shield', qty: 1 }]; const d0 = derived(totals(c), c);
    openHero(c.id); heroUi.tab = 'inv'; heroUi.sel = 0; renderHero(); const btn = document.querySelector('#heroov [data-hx="equip"][data-slot-to="off"]'); const has = !!btn && !btn.disabled; if (btn) btn.click();
    const d1 = derived(totals(c), c); return { race: c.race, has, off: c.equip.off && c.equip.off.id, prot0: d0.prot, prot1: d1.prot, ac0: d0.ac, ac1: d1.ac, awk: awkward2h(c), two: twoHanded(c), grip: !!c.giantGrip }; });
  ok('кнопка «В левую руку» для ростового щита при пике', R.has, R);
  ok('щит надет в левую руку', R.off === 'tower-shield', R);
  ok('Защита +4 и Уворот −2 от ростового щита', R.prot1 - R.prot0 === 4 && R.ac0 - R.ac1 === 2, R);
  ok('без неудобного хвата и «Великана»', !R.awk && !R.grip, R);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0); })();
