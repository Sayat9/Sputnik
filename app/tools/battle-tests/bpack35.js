// Правки 02.11 (вечер): «Укус в ноги» матёрого волка, сеть зверолова на 2 хода, Угроза, щит −1 Лов, грузоподъёмность.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500); for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + JSON.stringify(x)); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = (i, eq) => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 1 }); c.base = { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }; c.equip = eq || { main: { t: 'w', id: 'sword' } }; c.bag = []; c.essences = []; c.hp = maxHp(c); return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const clear = S => { for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = null; S.objs.length = 0; };
    // «Укус в ноги»
    { state.party = [mk(0)]; const S = B.newBattle({ list: ['dire-wolf'], zone: 'beast', floor: 2 }); B.placeMonsters(S); S.phase = 'fight'; clear(S);
      const [h] = B.heroes(), w = B.mons()[0]; h.x = 1; h.y = 5; w.x = 1; w.y = 4; h.prot = 0; h.hp = h.maxHp = 999;
      B.addStatus(h, 'hamstrung', { k: 2, when: 'end', data: { by: w.id, dc: 30, cells: 0 } });
      const hp0 = h.hp; let saves = 0; const ds = B.doSave; B.doSave = async (...a) => { if (a[3] && a[3].label === 'Укус в ноги') saves++; return ds(...a); };
      await B.moveAlong(h, [[2, 5], [3, 5], [4, 5], [5, 5]], { noProvoke: true }); B.doSave = ds;
      out.bite = { saves: B.S.log.filter(l => /прокушенные ноги/.test(l.t || l.text || '')).length, lost: hp0 - h.hp, name: (ESSENCES['dire-wolf'].active || {}).name }; B.S = null; }
    // сеть зверолова: опутан не дольше 2 ходов
    { state.party = [mk(0)]; const S = B.newBattle({ list: ['goblin-trapper'], zone: 'goblin', floor: 2 }); B.placeMonsters(S); S.phase = 'fight'; clear(S);
      const [h] = B.heroes(), g = B.mons()[0]; h.x = 1; h.y = 5; g.x = 1; g.y = 3; h.abil.str = 1;
      const ds = B.doSave; B.doSave = async () => ({ ok: false, total: 1, nat: 1 });
      await B.A['goblin-trapper'].run(g, { unit: h }, { commit() {} }); B.doSave = ds;
      const st = B.has(h, 'restrained'); out.net = { k: st && st.k, when: st && st.when }; B.S = null; }
    // Угроза: из двух одинаковых героев рядом бьют того, у кого Угроза выше; у умного монстра эффект слабее
    { const pick = async (threat, mon) => { const res = { a: 0, b: 0 };
        for (let i = 0; i < 12; i++) { state.party = [mk(0), mk(1)]; const S = B.newBattle({ list: [mon], zone: 'goblin', floor: 1 }); B.placeMonsters(S); S.phase = 'fight'; S.dark = false; clear(S);
          const [a, bb] = B.heroes(), m = B.mons()[0]; a.x = 2; a.y = 4; bb.x = 4; bb.y = 4; m.x = 3; m.y = 3; bb.threat = threat; m.cd = { [mon]: 99 }; (m.ess || []).forEach(k => { m.cd[k] = 99; }); m.t = { move: 0, action: 1, bonus: 1, react: 1, moved: 0 }; m.flags.awake = true;
          const da = B.doAttack; B.doAttack = async (u, t) => { if (u === m) res[t === a ? 'a' : 'b']++; return { hit: false, nat: 2, dealt: 0 }; };
          await B.AI.takeTurn(m); B.doAttack = da; res.log = B.S.log.slice(-4).map(l => l.t || l.text); res.pos = [m.x, m.y, a.x, a.y, bb.x, bb.y]; B.S = null; }
        return res; };
      out.thr1 = await pick(1, 'goblin-sword'); out.thr2 = await pick(2, 'goblin-sword'); out.thr3 = await pick(3, 'goblin-sword'); }
    { const ch = id => { const m = MONSTERS.find(x => x.id === id); return B.tauntChance({ cls: m.cls, abil: { int: m.abil[3] } }, 2); }; out.chance = { goblin: ch('goblin-sword'), hob: ch('hobgoblin'), elder: ch('goblin-elder'), shaman: ch('orc-shaman'), chief: ch('orc-chief') }; }
    { const g = MONSTERS.find(x => x.id === 'goblin-sword'), st = MONSTERS.find(x => x.id === 'stone-guardian'); out.mdef = [g.dodge, g.prot, st.dodge, st.prot]; }
    { state.party = [mk(20)]; const S = B.newBattle({ list: ['crow', 'goblin'], zone: 'beast', floor: 2 }); B.placeMonsters(S); S.phase = 'fight'; S.dark = false; clear(S);
      const [h] = B.heroes(), [cr, gb] = B.mons(); h.x = 2; h.y = 4; cr.x = 2; cr.y = 3; gb.x = 3; gb.y = 3; const atk = B.attacksOf(h)[0];
      const base = gb.ac; out.fly = { flying: B.isFlying(cr), d: B.attackCtx(h, cr, atk).ac - cr.ac };
      S.dark = true; S.torch = false; h.dv = false; out.dark = B.attackCtx(h, gb, atk).ac - base;
      gb.dv = true; const ga = B.attacksOf(gb)[0]; out.darkDv = B.attackCtx(gb, h, ga).ac - h.ac; gb.dv = false; out.darkNoDv = B.attackCtx(gb, h, ga).ac - h.ac; B.S = null; }
    out.heroThreat = threatOf(mk(5));
    { const c0 = mk(6, { main: { t: 'w', id: 'sword' } }), c1 = mk(7, { main: { t: 'w', id: 'sword' }, off: { t: 'w', id: 'shield' } }); out.shieldDex = totals(c1).dex.total - totals(c0).dex.total; }
    { const c = mk(8); out.cap = load(c).cap; out.capWant = (totals(c).str.total + totals(c).con.total / 2) * 3; }
    return out;
  });
  console.log(JSON.stringify(o));
  ok('«Укус в ноги»: 4 клетки пути — 2 проверки Телосложения, при провале урон', o.bite.saves === 2 && o.bite.lost >= 2 && o.bite.lost <= 8 && o.bite.name === 'Укус в ноги', o.bite);
  ok('сеть зверолова держит 2 хода', o.net.k === 2 && o.net.when === 'end', o.net);
  ok('полёт: +3 к Увороту летящей цели', o.fly.flying && o.fly.d === 3, o.fly);
  ok('тьма: +2 к Увороту цели во тьме; тёмное зрение атакующего снимает бонус', o.dark === 2 && o.darkNoDv === 2 && o.darkDv === 0, [o.dark, o.darkNoDv, o.darkDv]);
  ok('Угроза по умолчанию 1', o.heroThreat === 1, o.heroThreat);
  ok('Угроза 2 — гоблин (9 кл.) всегда бьёт провокатора', o.thr2.b === 12 && o.thr2.a === 0, o.thr2);
  ok('шанс раскусить провокацию: 9 кл. 0, хобгоблин (Инт 9) 0, шаман-старейшина 15 %, шаманка орков 45 %', o.chance.goblin === 0 && o.chance.hob === 0 && Math.abs(o.chance.elder - 0.15) < 1e-9 && Math.abs(o.chance.shaman - 0.45) < 1e-9, o.chance);
  ok('монстры: Уворот от Ловкости и Защита по ярусу (гоблин-мечник 10/2, каменный сторож 6/5)', o.mdef.join() === '10,2,6,5', o.mdef);
  ok('щит: −1 к Ловкости', o.shieldDex === -1, o.shieldDex);
  ok('грузоподъёмность = (Сил + ½ Тел) × 3', Math.abs(o.cap - o.capWant) < 1e-9, [o.cap, o.capWant]);
  ok('нет ошибок', !errs.length, errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close();
})();
