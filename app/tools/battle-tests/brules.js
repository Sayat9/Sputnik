// Проверка правил атаки статистикой: частота попаданий при разных условиях против ожидаемой.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-env','battle-ai','battle-end','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const out = await p.evaluate(async () => {
    const res = [];
    const mkHero = () => { const c = Object.assign(clone(state.example), { id: 'rt', example: false, name: 'Тест', race: 'human', level: 1 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const N = 3000;
    async function trial(name, expectHit, o = {}) {
      Battle.cfg.fast = true;
      state.party = [mkHero()]; state.run.status = { rt: { fat: 0, sat: 3, starve: 0, awake: 0 } };
      const S = Battle.newBattle({ list: ['goblin'], zone: 'goblin' });
      for (const row of S.cells) row.fill(''); S.objs.length = 0; S.dark = false; S.torch = false;
      const h = Battle.heroes()[0], t = Battle.mons()[0];
      h.x = 3; h.y = o.hy || 5; t.x = 3; t.y = o.ty || (o.far ? 3 : 4); t.ac = 12; t.maxHp = t.hp = 99999; t.alive = true; h.hp = h.maxHp = 99999;
      if (o.setup) o.setup(S, h, t);
      const atk = Object.assign({ id: 'x', n: 'Тест', kind: o.ranged ? 'ranged' : 'melee', reach: 1, range: [18, 60], hit: o.hit != null ? o.hit : 5, dmg: { n: 1, s: 8, b: 0 }, dt: 'slash', tags: [], time: 'action' }, o.atk || {});
      if (o.untargetable) { res.push({ name, hit: Battle.attackTargets(h, atk).includes(t) ? 100 : 0, expect: expectHit, crit: 0, avgDmg: 0 }); Battle.S = null; return; }          // цель не видна: запрет в выборе цели, а не в броске
      let hits = 0, crits = 0, dmg = 0, n = 0;
      for (let i = 0; i < N; i++) {
        if (o.reset) o.reset(S, h, t);
        const r = await Battle.doAttack(h, t, atk, {});
        if (r.hit) hits++; if (r.crit) crits++; dmg += r.dealt; n++;
        t.hp = t.maxHp = 99999; t.alive = true; t.down = false;
      }
      res.push({ name, hit: +(hits / n * 100).toFixed(1), expect: expectHit, crit: +(crits / n * 100).toFixed(1), avgDmg: +(dmg / Math.max(1, hits)).toFixed(2) });
      Battle.S = null;
    }
    await trial('базовая атака +5 против КД 12', 70);
    await trial('цель сбита с ног рядом (преимущество)', 91, { setup: (S, h, t) => Battle.addStatus(t, 'prone', { k: Infinity }) });
    await trial('атакующий отравлен (помеха)', 49, { setup: (S, h, t) => Battle.addStatus(h, 'poisoned', { k: Infinity }) });
    await trial('преимущество + помеха = обычный бросок', 70, { setup: (S, h, t) => { Battle.addStatus(t, 'prone', { k: Infinity }); Battle.addStatus(h, 'poisoned', { k: Infinity }); } });
    await trial('дальняя атака вплотную (помеха)', 49, { ranged: true });
    await trial('дальняя атака с дистанции 2 (обычная)', 70, { ranged: true, far: true });
    await trial('половинное укрытие (+2 КД)', 60, { ranged: true, far: true, setup: (S) => { S.cells[4][3] = 'rock'; } });
    await trial('укрытие три четверти (+5 КД)', 45, { ranged: true, far: true, hy: 6, ty: 3, setup: (S) => { S.cells[5][3] = 'rock'; S.cells[4][3] = 'rock'; } });
    await trial('три препятствия на линии: цель не видна (нельзя выбрать целью)', 0, { ranged: true, far: true, hy: 6, ty: 2, untargetable: true, setup: (S) => { S.cells[5][3] = 'rock'; S.cells[4][3] = 'rock'; S.cells[3][3] = 'rock'; } });
    await trial('цель без сознания рядом: преимущество и крит', 91, { setup: (S, h, t) => { Battle.addStatus(t, 'unconscious', { k: Infinity }); } });
    await trial('бонус +30: единица всегда мимо (95 %)', 95, { hit: 30 });
    await trial('бонус −20: только двадцатка (5 %)', 5, { hit: -20 });
    await trial('цель в обороне (помеха)', 49, { setup: (S, h, t) => Battle.addStatus(t, 'dodging', { k: Infinity }) });
    await trial('атакует лёжа (помеха)', 49, { setup: (S, h, t) => Battle.addStatus(h, 'prone', { k: Infinity }) });
    await trial('цель прикрыта щитом (+2 КД)', 60, { setup: (S, h, t) => Battle.addStatus(t, 'guarded', { k: Infinity }) });
    return res;
  });
  console.log('условие'.padEnd(52), 'попад.%', 'ожид.%', 'крит%', 'ср.урон');
  for (const r of out) console.log(r.name.padEnd(52), String(r.hit).padStart(7), String(r.expect).padStart(6), String(r.crit).padStart(6), String(r.avgDmg).padStart(7), Math.abs(r.hit - r.expect) > 3.5 ? '  <-- ПРОВЕРИТЬ' : '');
  console.log('errs', errs.slice(0, 5));
  await b.close();
})();
