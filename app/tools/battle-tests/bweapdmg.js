// Средний урон за ход по оружию против целей с разной Защитой (02.11): node bweapdmg.js
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500); for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const r = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const kits = { 'кинжал': { main: 'dagger' }, 'два кинжала': { main: 'dagger', off: 'dagger' }, 'рапира': { main: 'rapier' }, 'копьё': { main: 'spear' }, 'копьё+щит': { main: 'spear', off: 'shield' }, 'меч': { main: 'sword' }, 'меч+щит': { main: 'sword', off: 'shield' }, 'два меча': { main: 'sword', off: 'sword' }, 'двуручный меч': { main: 'greatsword' } };
    for (const [nm, k] of Object.entries(kits)) {
      out[nm] = {};
      for (const tgtId of ['goblin', 'hobgoblin', 'crystalloid']) {
        const c = Object.assign(clone(state.example), { id: 'p1', example: false, name: 'Г', race: 'human', level: 2 });
        c.base = { str: 15, dex: 15, con: 12, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: k.main } }; if (k.off) c.equip.off = { t: 'w', id: k.off }; c.bag = []; c.essences = [];
        state.party = [c]; state.run = { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: true };
        let tot = 0, N = 1500;
        const S = B.newBattle({ list: [tgtId], zone: 'goblin', floor: 1 }); S.phase = 'fight';
        const h = B.heroes()[0], m = B.mons()[0]; h.x = 2; h.y = 4; m.x = 2; m.y = 3;
        const atk = B.attacksOf(h).find(a => a.id === 'hand:' + k.main) || B.attacksOf(h)[0];
        for (let i = 0; i < N; i++) {
          m.hp = m.maxHp = 9999; m.conds = []; h.t.action = 1; const hp0 = m.hp;
          await B.doAttack(h, m, atk, {}); if (atk.twin && atk.twinOff) await B.doAttack(h, m, atk.twinOff, { noRedirect: true });
          tot += hp0 - m.hp;
        }
        B.S = null;
        const mm = MONSTERS.find(x => x.id === tgtId); out[nm][`${tgtId} (Ув ${mm.dodge}/Защ ${mm.prot})`] = +(tot / N).toFixed(2);
      }
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1), errs.slice(0, 3)); await b.close();
})();
