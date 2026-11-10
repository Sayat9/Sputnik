// 10.11: аукцион (слоты = 10 − ранг, новый слот — обычные/редкие эссенции своего класса без разломов; старые — 10 % артефакт, 10 % эссенция разлома), покупка; баннер и окно «Портал открылся».
const L = require('./bui_lib.js');
(async () => { const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2'], autoEnd: false });
  const R = await p.evaluate(async () => { const o = {}, c = state.party[0];
    c.rank = 9; auctionRoll(); o.r9 = state.auction.slots.map(s => s.cls + ':' + s.kind);
    c.rank = 7; const kinds = { art: 0, rift: 0, ess: 0, newRift: 0, newArt: 0, newRareOrNorm: 0, wrongCls: 0 };
    for (let i = 0; i < 400; i++) { auctionRoll(); for (const s of state.auction.slots) { if (s.kind === 'ess' && ESSENCES[s.id].cls !== s.cls) kinds.wrongCls++; if (s.cls === 7) { if (s.kind === 'art') kinds.newArt++; if (s.rift) kinds.newRift++; } else { if (s.kind === 'art') kinds.art++; else if (s.rift) kinds.rift++; else kinds.ess++; } } }
    o.k = kinds; o.r7 = state.auction.slots.map(s => s.cls);
    // покупка
    state.run = null; await loadTown(); c.rank = 9; c.gold = 100000; auctionRoll(); const sl = state.auction.slots[0]; const st0 = (inventory().essStash || []).length;
    Town.open('auction'); window.__shot = 1; o.lots = document.querySelectorAll('.tw-lot').length; o.locked = document.querySelectorAll('.tw-lot.locked').length; document.querySelector('[data-t="lot-buy"]').click(); o.sold = sl.sold; o.stash = (inventory().essStash || []).length - st0; o.gold = 100000 - c.gold === sl.price; Town.close();
    // баннер
    state.townUnlocked = true; location.hash = 'town'; route(); o.banner = !!document.querySelector('.gate-alert') === gateInfo().open;
    return o; });
  ok('9 ранг: один лот 9 класса', R.r9.length === 1 && /^9:ess/.test(R.r9[0]), R.r9);
  ok('7 ранг: лоты 9, 8, 7', R.r7.join() === '9,8,7', R.r7);
  ok('новый слот — без артефактов и разломов', R.k.newArt === 0 && R.k.newRift === 0, R.k);
  ok('старые слоты: ~10 % артефактов и ~10 % эссенций разломов', R.k.art > 30 && R.k.art < 130 && R.k.rift > 30 && R.k.rift < 130, R.k);
  ok('класс эссенции совпадает со слотом', R.k.wrongCls === 0, R.k);
  ok('9 лотов, 8 закрыты; покупка — в запас, деньги списаны', R.lots === 9 && R.locked === 8 && R.sold && R.stash === 1 && R.gold, R);
  ok('баннер «Портал открыт» соответствует вратам', R.banner, R);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0); })();
