// 12.11: артефакты нового оружия по описаниям автора: цеп-ловец («Сковать»), посох метеора, палочка цепной молнии.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-weap2','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async () => {
    const out = { ok: [], fail: [] }; const T = (n, c, x) => (c ? out.ok : out.fail).push(n + (c ? '' : ' :: ' + (x === undefined ? '' : JSON.stringify(x))));
    const mkHero = (art, offArt, base) => {
      const c = Object.assign(clone(state.example), { id: 'h' + Math.random().toString(36).slice(2, 6), example: false, name: 'Тест', race: 'human', level: 3 });
      c.base = base || { str: 16, dex: 14, con: 14, int: 16, wis: 12, cha: 10 };
      const ent = a => (ART_WEAPONS[a] ? { t: 'w', id: ART_WEAPONS[a].base, art: a } : { t: 'w', id: a });
      c.equip = { main: art ? ent(art) : undefined, off: offArt ? ent(offArt) : undefined };
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; try { ensureKit(c); } catch (e) {} addToBag(c, { t: 'g', id: 'arrow', qty: 20 }); c.mp = maxMp(c); return c;
    };
    const setup = async (art, off, mon = ['goblin', 'goblin', 'goblin']) => {
      state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false }; state.party = [mkHero(art, off)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      const S = Battle.newBattle({ list: mon, zone: 'goblin', ambush: false, kind: 'hard', title: 'тест' }); S.opts.autoHeroes = true; Battle.placeHeroesDefault(S); Battle.placeMonsters(S); Battle.rollInitiative(); S.phase = 'fight';
      for (let y = 0; y < Battle.H; y++) for (let x = 0; x < Battle.W; x++) S.cells[y][x] = null;
      const u = Battle.heroes()[0], ms = Battle.mons(); ms.forEach((m, i) => { m.hp = m.maxHp = 400; m.ac = 1; m.prot = 0; m.pass = m.pass.filter(x => !x.startsWith('body')); m.x = i * 2; m.y = 0; });
      await Battle.startTurn(u); u.x = 3; u.y = 6; return { u, ms, m: ms[0], S, c: state.party[0] };
    };
    Battle.UI = { pickUnit: async o => Battle.byId(o.units[0]), toast() {}, fxText() {}, fxHit() {}, fxHeal() {}, fxMana() {}, refresh() {}, refreshNow() {}, animMove: async () => {}, animAttack: async () => {}, banner() {}, active: false, confirm: async () => false, choose: async o => o.options[0].id };
    const at = (u, x, y) => { u.x = x; u.y = y; };
    const realRV = crypto.getRandomValues.bind(crypto), force = nat => { crypto.getRandomValues = a => { a[0] = nat - 1; return a; }; }, unforce = () => { crypto.getRandomValues = realRV; };
    const hit = async (u, t, a, nat = 15, o = {}) => { force(nat); try { return await Battle.doAttack(u, t, a, o); } finally { unforce(); } };
    const main = u => Battle.heroAttacks(u)[0];
    T('артефакты нового оружия — только три авторских: цеп-ловец, посох метеора, палочка цепной молнии', ['binder-flail', 'meteor-staff', 'chain-wand'].every(k => ART_WEAPONS[k] && ART_DROPS.includes(k)) && Object.keys(ART_WEAPONS).length === 17 + 4 && !Object.values(ART_WEAPONS).some(a => a.draft), Object.keys(ART_WEAPONS));
    T('у каждого артефактного оружия есть описание', Object.keys(ART_WEAPONS).every(k => ARTIFACTS[k] && ARTIFACTS[k].text), Object.keys(ART_WEAPONS).filter(k => !ARTIFACTS[k]));
    { const { u, ms, m } = await setup('binder-flail', null, ['goblin', 'crystal-colossus']); at(m, 3, 3); at(ms[1], 0, 0); const bd = Battle.heroAttacks(u).find(x => x.special === 'bind'); T('цеп-ловец: атака «Сковать» есть', !!bd);
      const h0 = m.hp; force(15); await Battle.runSpecial(u, bd); unforce(); T('сковать: без урона, цель скована, скорость 0', m.hp === h0 && !!Battle.has(m, 'chained') && Battle.speedOf(m) === 0, [h0, m.hp, m.conds.map(c => c.id)]);
      force(2); await Battle.startTurn(m); unforce(); T('скованный провалил Силу: урон и остаётся в цепи', m.hp < h0 && !!Battle.has(m, 'chained'), [h0, m.hp]);
      force(20); await Battle.startTurn(m); unforce(); T('скованный прошёл проверку: свободен', !Battle.has(m, 'chained'));
      at(ms[1], 3, 3); at(m, 0, 0); u.t.action = 1; const bd2 = Battle.heroAttacks(u).find(x => x.special === 'bind'); let said = ''; Battle.UI.toast = t => { said = t; }; const ok = await Battle.runSpecial(u, bd2); T('очень тяжёлого сковать нельзя', ok === false && !Battle.has(ms[1], 'chained'), [ok, said]); Battle.UI.toast = () => {}; Battle.S = null; }
    // ---- посох метеора
    { const { u, ms, S, c } = await setup('meteor-staff', null, ['goblin', 'goblin', 'goblin']); at(ms[0], 3, 2); at(ms[1], 3, 1); at(ms[2], 5, 2); S.cells[2][2] = 'crate'; S.cells[3][3] = 'rock';
      const sk = Battle.heroAttacks(u).find(x => x.special === 'skyfall'); T('посох метеора: атака «Метеор», 5 маны', sk && sk.mana === 5 && !sk.needTarget(u), sk && [sk.mana, sk.needTarget(u)]);
      Battle.UI.pickCell = async () => [3, 2]; const mp0 = u.mp, h = ms.map(x => x.hp); force(3); const ok = await Battle.runSpecial(u, sk); unforce();
      const d = ms.map((x, i) => h[i] - x.hp); T('метеор: крест — центр и сосед сверху ранены, стоящий в стороне цел', ok && d[0] > 0 && d[1] > 0 && d[2] === 0, d);
      T('метеор: мана −5, откат 6 ходов', u.mp === mp0 - 5 && u.wcd.skyfall === 6 && /откат/.test(Battle.heroAttacks(u).find(x => x.special === 'skyfall').needTarget(u)), [mp0, u.mp, u.wcd]);
      T('метеор: провалившие спасбросок горят', !!Battle.has(ms[0], 'burning') && !!Battle.has(ms[1], 'burning'), ms.map(x => x.conds.map(q => q.id)));
      T('метеор: ящики уничтожены, валун устоял', !S.cells[2][2] && S.cells[3][3] === 'rock', [S.cells[2][2], S.cells[3][3]]);
      for (let i = 0; i < 6; i++) await Battle.startTurn(u); T('метеор: через 6 своих ходов снова готов', u.wcd.skyfall === 0 && !Battle.heroAttacks(u).find(x => x.special === 'skyfall').needTarget(u), u.wcd); Battle.S = null; }
    // ---- палочка цепной молнии
    { const { u, ms } = await setup('chain-wand', null, ['goblin', 'goblin', 'goblin', 'goblin']); at(ms[0], 3, 3); at(ms[1], 4, 2); at(ms[2], 5, 1); at(ms[3], 0, 0);
      const ch = Battle.heroAttacks(u).find(x => x.special === 'chain'); T('палочка: «Цепная молния», 3 маны, молния', ch && ch.mana === 3 && ch.dt === 'lightning' && !ch.needTarget(u), ch && [ch.mana, ch.dt]);
      const mp0 = u.mp, h = ms.map(x => x.hp); force(15); await Battle.runSpecial(u, ch); unforce(); const d = ms.map((x, i) => h[i] - x.hp);
      T('цепная молния: скачет по врагам в 2 клетках, далёкий цел', d[0] > 0 && d[1] > 0 && d[2] > 0 && d[3] === 0, d);
      T('цепная молния: каждый скачок на 20 % слабее', d[1] === Math.floor(d[0] * 0.8) && d[2] === Math.floor(d[1] * 0.8), d);
      T('цепная молния: мана −3, раз в 2 хода', u.mp === mp0 - 3 && u.wcd.chain === 2, [mp0, u.mp, u.wcd]);
      await Battle.startTurn(u); T('на следующий ход ещё в откате', /откат/.test(Battle.heroAttacks(u).find(x => x.special === 'chain').needTarget(u) || ''));
      await Battle.startTurn(u); T('через ход снова готова', !Battle.heroAttacks(u).find(x => x.special === 'chain').needTarget(u));
      at(ms[1], 0, 6); at(ms[2], 0, 5); ms.forEach(x => { x.hp = 400; }); const h2 = ms.map(x => x.hp); u.t.action = 1; force(15); await Battle.runSpecial(u, Battle.heroAttacks(u).find(x => x.special === 'chain')); unforce();
      const d2 = ms.map((x, i) => h2[i] - x.hp); T('цепная молния: рядом никого — бьёт только первую цель', d2[0] > 0 && d2[1] === 0 && d2[2] === 0, d2); Battle.S = null; }
    { const { u, ms } = await setup('dawn-star', null, ['mourner', 'goblin', 'goblin']); at(ms[0], 3, 5); at(ms[1], 4, 4); at(ms[2], 0, 0); ms[0].hp = ms[0].maxHp = 400;
      const dw = Battle.heroAttacks(u).find(x => x.special === 'dawn'); T('утренняя звезда: «Вспышка зари», 2 маны, свет', dw && dw.mana === 2 && dw.dt === 'radiant' && !dw.needTarget(u), dw && [dw.mana, dw.dt]);
      const mp0 = u.mp, h0 = ms[0].hp; force(15); await Battle.runSpecial(u, dw); unforce();
      T('свет ранит призрака; сосед цели ослеплён, далёкий — нет', ms[0].hp < h0 && !!Battle.has(ms[1], 'dazzled') && !Battle.has(ms[2], 'dazzled') && !Battle.has(ms[0], 'dazzled'), [h0 - ms[0].hp, ms.map(x => x.conds.map(c => c.id))]);
      T('мана −2, откат 3 хода', u.mp === mp0 - 2 && u.wcd.dawn === 3 && /откат/.test(Battle.heroAttacks(u).find(x => x.special === 'dawn').needTarget(u)), [u.mp, u.wcd]);
      const ctx = Battle.attackCtx(ms[1], u, ms[1].atk[0]); T('ослеплённый бьёт с помехой', ctx.dis.includes('ослеплён вспышкой'), ctx.dis); Battle.S = null; }
    return out;
  });
  console.log(rep.ok.map(x => '  ✓ ' + x).join('\n')); if (rep.fail.length) console.log(rep.fail.map(x => '  ✗ ' + x).join('\n'));
  if (errs.length) console.log('ОШИБКИ:\n' + errs.join('\n'));
  console.log(`bart3: ${rep.ok.length} ок, ${rep.fail.length} провалов, ошибок ${errs.length}`);
  await b.close(); process.exit(rep.fail.length || errs.length ? 1 : 0);
})();
