// Окружение (преимущество при ≥2 союзниках у цели), Треск костей на одну цель, радиусы 9 класса, сводка массовых спасбросков, побег с проверкой Ловкости, шанс эссенции 93
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-ui','battle-menu','battle-end','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  await p.addStyleTag({ path: '/home/user/app/assets/css/battle.css' });
  const R = [], ok = (n, c, x) => { R.push({ n, ok: !!c }); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + (x == null ? '' : x)); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = (i) => { const c = Object.assign(clone(state.example), { id: "q" + i, example: false, name: "Г" + i, race: "human", level: 2 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const S = B.newBattle({ list: ['skeleton', 'skeleton', 'goblin'], zone: 'goblin', floor: 1, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeMonsters(S); B.preStart(S); B.rollInitiative();
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) S.cells[y][x] = null; S.objs.length = 0;
    const [h0, h1] = B.heroes(), [m0, m1, m2] = B.mons();
    // окружение
    h0.x = 3; h0.y = 3; m0.x = 3; m0.y = 4; m1.x = 2; m1.y = 4; m2.x = 6; m2.y = 0; h1.x = 0; h1.y = 6;
    const atk = B.attacksOf(m0)[0];
    out.flank2 = B.attackCtx(m0, h0, atk, {}).adv.some(a => /окружении/.test(a));
    m2.x = 4; m2.y = 4; out.flank2 = B.attackCtx(m0, h0, atk, {}).adv.some(a => /окружении/.test(a)); m2.x = 6; m2.y = 0; out.flank1 = B.attackCtx(m0, h0, atk, {}).adv.some(a => /окружении/.test(a));
    // треск костей: AI одна цель
    m1.x = 2; m1.y = 4; h1.x = 4; h1.y = 3;
    const ai = B.A.skeleton.ai(m0); out.skAi = ai ? ai.units.length : -1;
    const tg = B.A.skeleton.tgt(m0); out.skMax = tg.max;
    // радиус 1 клетка: герой в 2 клетках вне зоны
    h0.x = 3; h0.y = 1; h1.x = 3; h1.y = 6; out.skPool = B.A.skeleton.can(m0);
    return out;
  });
  ok('≥2 союзника рядом с целью — преимущество', o.flank2, JSON.stringify(o));
  ok('1 союзник — без преимущества', !o.flank1);
  ok('Треск костей у монстра бьёт одну цель', o.skAi <= 1, o.skAi);
  ok('Треск костей: выбор максимум 1 цель', o.skMax === 1, o.skMax);
  ok('Треск костей не достаёт через 2 клетки', o.skPool !== true, o.skPool);
  // сводка массового спасброска
  const s = await p.evaluate(async () => {
    const B = Battle, S = B.S; B.UI.open(); const [h0, h1] = B.heroes();
    const pr = B.massSave([h0, h1], 'wis', 10, { label: 'тест', title: 'Тест' });
    await new Promise(r => setTimeout(r, 200));
    const m = document.querySelector('.bt-modal'); const shown = !!(m && !m.hidden && m.querySelector('.bt-sum li'));
    const rows = m ? m.querySelectorAll('.bt-sum li').length : 0;
    const dice = !!document.querySelector('.bd-ov');
    m.querySelector('[data-m=sumok]').click(); const r = await pr;
    return { shown, rows, dice, n: r.length };
  }).catch(e => ({ err: String(e) }));
  ok('сводка спасбросков: окно со строками, без кубиков, закрывается', s.shown && s.rows === 2 && !s.dice && s.n === 2, JSON.stringify(s));
  ok('нет ошибок страницы', errs.length === 0, errs.join('|'));
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
