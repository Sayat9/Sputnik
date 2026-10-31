// Скупка артефактов (Кузница, Башня магов), цены, серебряная соль на оружии, описания предметов.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : JSON.stringify(extra)); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const res = await p.evaluate(async () => {
    const out = {}, c = state.party[0]; await loadTown();
    out.prices = [artValue('bell'), artValue('chalice'), artValue('tollbell'), artValue('beginners-luck')];
    out.luckLevel7 = artValue('beginners-luck') === artValue('tollbell') && artValue('beginners-luck') > 3 * artValue('chalice');
    out.priceField = ARTIFACTS.monocle.price === artValue('monocle');
    // продажа: Башня (аксессуары +10 %), Кузница (броня +10 %)
    giveTreasure('tollbell'); giveTreasure('boots'); c.gold = 0;
    const clickT = sel => { const e = document.querySelector(sel); if (e) e.click(); return !!e; };
    Town.open('tower'); document.querySelector('[data-t="ttab"][data-k="art"]').click();
    const host = document.getElementById('townov');
    const rowsT = [...host.querySelectorAll('[data-t="artsell"]')].map(e => [e.dataset.key, e.textContent.trim()]);
    out.towerRows = rowsT;
    const tb = host.querySelector('[data-t="artsell"][data-key="t:tollbell"]'); tb && tb.click();
    out.afterTower = { gold: c.gold, owned: treasure('tollbell').owned };
    Town.close();
    c.gold = 0; Town.open('forge'); Town.state().tab = 'art';
    document.querySelector('[data-t="ftab"][data-k="art"]') && document.querySelector('[data-t="ftab"][data-k="art"]').click();
    const hostF = document.getElementById('townov');
    out.forgeRows = [...hostF.querySelectorAll('[data-t="artsell"]')].map(e => [e.dataset.key, e.textContent.trim()]);
    const fb = hostF.querySelector('[data-t="artsell"][data-key="t:boots"]'); fb && fb.click();
    out.afterForge = { gold: c.gold, owned: treasure('boots').owned };
    Town.close();
    // артефактное оружие: продаётся в кузнице (+10 %)
    c.bag = [{ t: 'w', id: 'spear', art: 'thunder-spear', qty: 1 }]; c.gold = 0; artState().known['thunder-spear'] = true;
    Town.open('forge'); document.querySelector('[data-t="bag"][data-i="0"]') && document.querySelector('[data-t="bag"][data-i="0"]').click();
    const wb = document.getElementById('townov').querySelector('[data-t="artsell"]'); out.wrows = !!wb; wb && wb.click(); out.wsold = { gold: c.gold, bag: c.bag.length }; Town.close();
    // соль на оружии
    const w = { t: 'w', id: 'sword', qty: 1 }; c.equip = c.equip || {}; c.equip.main = w; c.bag = [{ t: 'g', id: 'silver-salt', qty: 2 }];
    const tg = saltTargets(c); out.saltTargets = tg.map(x => x.k);
    out.saltBefore = !!itemOf(c.equip.main).salt;
    tg[0].e.salt = true; out.saltAfter = !!itemOf(c.equip.main).salt;
    out.saltNote = itemOf(c.equip.main).note;
    // описания
    out.notes = { sword: WEAPONS.find(x => x.id === 'sword').note, chain: ARMOR_FLAT.find(x => x.id === 'chainmail').note, flute: GEAR.flute.note, potion: GEAR.potion.note, chalice: GEAR.chalice.note.slice(0, 20) };
    return out;
  });
  ok('цены артефактов растут с классом', res.prices[0] < res.prices[1] && res.prices[1] < res.prices[2], res.prices);
  ok('Удача новичка — на уровне 7 класса и значительно дороже обычных 8-х', res.luckLevel7, res.prices);
  ok('у артефактов есть поле price', res.priceField);
  ok('Башня: колокольчик продаётся дороже на 10 % (1650)', res.afterTower.gold === 1650 && !res.afterTower.owned && res.towerRows.length >= 2, res);
  ok('Башня: сапоги продаются из списка артефактов', res.towerRows.some(r => r[0] === 't:boots'), res);
  ok('артефактное оружие продаётся в кузнице за 5500 (6 класс +10 %)', res.wrows && res.wsold.gold === 5500 && res.wsold.bag === 0, res.wsold);
  ok('соль: цель выбирается, оружие помечено и описано', res.saltTargets.length === 1 && !res.saltBefore && res.saltAfter && /соль/.test(res.saltNote), res);
  ok('описания: короткая фраза и известные статы, без правил способностей', /Прямой железный клинок/.test(res.notes.sword) && /Урон 1к8/.test(res.notes.sword) && !/Парирование:|реакци/.test(res.notes.sword) && !/крысолов/i.test(res.notes.flute) && /КД 14/.test(res.notes.chain), res.notes);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x.ok).length);
  await b.close();
})();
