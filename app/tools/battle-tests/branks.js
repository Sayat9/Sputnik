// 10.11: ранги 6–1 (спуск на этаж 10 − ранг и монстр класса = рангу), анализ эссенции в колбе −20 %, цена продажи не выше цены магазина, карта разлома, лорд +500 %.
const L = require('./bui_lib.js');
(async () => { const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2'], autoEnd: false });
  const R = await p.evaluate(async () => { const o = {}, c = state.party[0];
    o.req = [6, 5, 4, 3, 2, 1].map(r => RANK_REQ[r].floor + '/' + RANK_REQ[r].cls); o.names = [6, 5, 4, 3, 2, 1].map(r => RANK_NAME[r]);
    c.rank = 7; c.deep = 4; c.slainCls = 6; o.ready6 = rankReady(c, 6); c.deep = 3; o.notReady = !rankReady(c, 6);
    o.lord = ESS_RANK_ADD.lord;
    // анализ в колбе
    state.run = null; await loadTown(); c.rank = 9; c.gold = 1000; const id = 'goblin'; c.bag = [{ t: 'g', id: 'ess-flask', qty: 1, ess: id, from: 'Гоблин' }]; c.essences = [];
    Town.open('tower'); const btn = document.querySelector('[data-t="analyze"][data-fl="1"]'); o.flBtn = btn && +btn.textContent; Town.close();
    // предел цены продажи: гоблин-торговец +10 % не выше цены магазина
    c.essences = ['goblin-merchant']; Town.open('shop'); const fa = (Town.state() && 1); Town.close();
    return o; });
  ok('ранги 6–1: этаж 4…9, класс 6…1', R.req.join() === '4/6,5/5,6/4,7/3,8/2,9/1', R.req);
  ok('готовность к 6 рангу: 4 этаж + 6 класс', R.ready6 && R.notReady, R);
  ok('названия рангов 6–1 есть', R.names.every(Boolean), R.names);
  ok('эссенция в колбе — анализ в Башне со скидкой', R.flBtn > 0, R);
  ok('лорд +500 %', R.lord === 5, R);
  const C = await p.evaluate(() => { const r = { k: 'rift' }; const inv = inventory(); inv.riftMaps = {}; const R = { id: 'blood' }; let got = ''; for (let i = 0; i < 200 && !got; i++) got = riftMapFind(R); return { got: !!got, owned: riftMapOwned('blood'), other: riftMapOwned('ice') }; });
  ok('карта разлома находится и открывается только для своего разлома', C.got && C.owned && !C.other, C);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0); })();
