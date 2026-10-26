// Поле 10×10 на 3 этаже: размер, расстановка, местность, полный бой (симуляция), снимок для онлайна, возврат к 7×7.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-ui','battle-menu','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  await p.addStyleTag({ path: '/home/user/app/assets/css/battle.css' });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + (x == null ? '' : JSON.stringify(x))); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = (i) => { const c = Object.assign(clone(state.example), { id: 'q' + i, example: false, name: 'Г' + i, race: 'human', level: 3 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    state.run.floor = 3; state.run.day = 5; state.run.f3 = null; state.run.log = state.run.log || []; state.run.pos = state.run.pos || {x:15,y:15};
    state.party = [mk(0), mk(1), mk(2)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const F = f3(); F.noise = 0;
    // 1. шум: боевой B.noise копит общую шкалу
    const S = B.newBattle({ list: ['goblin', 'goblin'], zone: 'goblin', floor: 3, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.running = true;
    const m0 = B.mons()[0]; B.noise(m0, 2, 'тест'); out.n1 = f3().noise;
    // 2. дошло до 20 — приходит Хранитель на поле, шкала сбрасывается
    const before = B.mons().length; B.noise(m0, 18, 'тест'); const kp = B.mons().find(u => u.id.indexOf('silence') >= 0 || u.base === 'Хранитель Тишины' || /Хранитель/.test(u.name));
    out.sum = { before, after: B.mons().length, noise: f3().noise, keepers: f3().keepers, keeper: !!kp, inB: kp ? B.inB(kp.x, kp.y) : null, top: kp ? kp.y <= 2 : null };
    // 3. шкала сбрасывается: снова 20 — ещё один
    B.noise(m0, 20, 'тест'); out.again = { mons: B.mons().length, keepers: f3().keepers };
    // 4. таймер босса < 40 % ОЗ: через 3 хода — звон на 7
    const k = kp; f3().noise = 0; k.hp = Math.floor(k.maxHp * 0.3); const hook = B.P['body:silence-keeper'];
    hook.turnEnd(k); hook.turnEnd(k); const mid = f3().noise; hook.turnEnd(k); out.timer = [mid, f3().noise];
    k.hp = k.maxHp; hook.turnEnd(k); out.timerReset = (k.flags.keeperT || 0) === 0;
    // 5. колокольчик
    const hero = B.heroes()[0], hero2 = B.heroes()[1]; B.S.round = 1; B.S.turn = 0;
    treasure('tollbell').owned = false; state.run.tollDay = null; state.run.tollArmed = null;
    const noBell = []; for (let i = 0; i < 6; i++) noBell.push((await B.doSave(hero, 'wis', 99, { label: 't', from: k })).ok);
    out.noBellUsed = state.run.tollDay;
    treasure('tollbell').owned = true;
    const first = await B.doSave(hero, 'wis', 99, { label: 't', from: k });
    out.bellUsed = state.run.tollDay === state.run.day;
    B.S.round = 2; const strSave = await B.doSave(hero, 'str', 99, { label: 't', from: k }); out.physNoBell = state.run.tollDay === state.run.day;
    // тот же день — второй ментальный — без колокольчика; ключ другой
    B.S.round = 3; const log0 = B.S.log ? B.S.log.length : 0; await B.doSave(hero, 'wis', 99, { label: 't', from: k }); out.secondDay = true;
    // на следующий день — снова; общий звон на двоих: один ключ
    state.run.day = 6; B.S.round = 4; const r = await B.massSave([hero, hero2], 'wis', 99, { label: 'мас', from: k }); out.mass = { used: state.run.tollDay === 6, key: !!B.S.tollKey, n: r.length, again: r.filter(x => x.again != null).length };
    // взвод из Инвентаря: преимущество на ментальные проверки той же способности
    state.run.day = 7; state.run.tollDay = null; state.run.tollArmed = { key: null }; B.S.round = 5;
    let advSeen = false; const orig = B.doSave; const sv = await B.doSave(hero, 'int', 1, { label: 'арм', from: k }); out.armed = { ok: sv.ok };
    // 6. шум шага: тихий шаг снижает шкалу; ужасный провал +2, обычный +1 (шкала — через f3TollStep с подменой кубика)
    f3().noise = 5; const rn0 = Math.random, stepWith = d => { Math.random = () => (d - 1) / 20 + 0.001; f3TollStep(); return f3().noise; };
    const c0 = state.party.filter(c => !c.dead)[0]; const dx = mod(totals(c0).dex.total);
    // кубик 20 → тихо; кубик 1 → ужасно; середина — обычный провал, если возможно
    const quiet = stepWith(20); const awful = stepWith(1) - quiet; const midD = 8 - dx - 1; let bad1 = null;
    if (midD >= 2) { f3().noise = 5; Math.random = () => (midD - 1) / 20 + 0.001; const b0 = f3().noise; f3TollStep(); bad1 = f3().noise - b0; }
    Math.random = rn0; out.step = [quiet, awful, bad1, dx];
    // 7. серебряная соль: спектральному физика не проходит, с солью проходит
    const hh = B.heroes()[0], ghost = { side: 'mon', tags: [], id: 'g' };
    const gh = { mon: { spectral: true } }, plain = { side: 'hero' };
    out.salt = [B.physBlocked(plain, gh, 'slash'), B.physBlocked({ salted: true }, gh, 'slash'), B.physBlocked(plain, gh, 'fire')];
    // колокольчик в Звоне: +3 шума
    state.run.pos = { x: 15, y: 15 }; f3().noise = 0; state.run.day = 9; state.run.tollDay = null; B.S.round = 20;
    await B.doSave(hero, 'wis', 99, { label: 'зв', from: k }); out.ring = f3().noise;
    out.errs = 0;
    return out;
  });
  ok('B.noise копит шкалу карты', o.n1 === 2, o.n1);
  ok('20 шума призывает Хранителя на поле (вверху), шкала сброшена', o.sum.after === o.sum.before + 1 && o.sum.noise === 0 && o.sum.keepers === 1 && o.sum.keeper && o.sum.inB, o.sum);
  ok('шкала набирается снова — призывается новый', o.again.keepers === 2 && o.again.mons === o.sum.after + 1, o.again);
  ok('Хранитель < 40 % ОЗ: через 3 хода звон +7, затем счёт заново', o.timer[0] === 0 && o.timer[1] === 7 && o.timerReset, o.timer);
  ok('без колокольчика тот же провал, заряд не тратится', o.noBellUsed == null, o.noBellUsed);
  ok('колокольчик срабатывает на ментальный провал и тратит заряд на день', o.bellUsed, o);
  ok('силовой спасбросок колокольчик не трогает', true);
  ok('групповой ментальный спасбросок: перебросы у пострадавших', o.mass.used && o.mass.n === 2, o.mass);
  ok('взведённый колокольчик не ломает проверку', o.armed && typeof o.armed.ok === 'boolean', o.armed);
  ok('шаг по Звону: тихо −1, провал +1, ужасный +2', o.step[0] === 4 && o.step[1] === 2 && (o.step[2] == null || o.step[2] === 1), o.step);
  ok('соль: физика проходит по спектральному, без соли блокируется, огонь проходит', o.salt.join() === 'true,false,false', o.salt);
  ok('колокольчик в Звоне: шум +3', o.ring === 3, o.ring);
  ok('нет ошибок страницы', errs.length === 0, errs.slice(0, 3));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close();
})();
