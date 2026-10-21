// Общая обвязка для проверки интерфейса боя в настоящем браузере.
const { chromium } = require('playwright');
const fs = require('fs');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '/tmp/battle-shots';
fs.mkdirSync(SHOTS, { recursive: true });

async function launch(w = 400, h = 860, o = {}) {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr || 1, hasTouch: !!o.touch, isMobile: !!o.touch });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push('PAGEERR ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console.error: ' + m.text()); if (m.type() === 'warning' && /бой|Battle|battle/.test(m.text())) p.errs.push('warn: ' + m.text()); });
  return { b, p };
}

const HEROES = {
  barb: { name: 'Грок', race: 'barbarian', main: 'greatsword', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 }, ess: [] },
  barb2: { name: 'Грок', race: 'barbarian', main: 'sword', off: 'shield', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 }, ess: [] },
  archer: { name: 'Лея', race: 'human', main: 'shortbow', base: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 }, ess: ['goblin-archer'] },
  fairy: { name: 'Пикси', race: 'fairy', main: 'rapier', base: { str: 8, dex: 16, con: 12, int: 12, wis: 12, cha: 14 }, ess: ['pixie'] },
  dwarf: { name: 'Торин', race: 'dwarf', main: 'warhammer', off: 'shield', base: { str: 15, dex: 10, con: 16, int: 10, wis: 12, cha: 8 }, ess: ['goblin'] },
  beast: { name: 'Рык', race: 'beastkin', main: 'spear', base: { str: 14, dex: 14, con: 14, int: 8, wis: 12, cha: 8 }, ess: ['wolf'] },
};

async function setup(p, { heroes = ['barb2', 'archer', 'fairy'], tactical = true, level = 1, autoEnd = false } = {}) {
  await p.goto(process.env.APP_URL || 'file:///home/user/app/index.html'); await p.waitForTimeout(500);
  const ok = await p.evaluate(async ({ heroes, HEROES, tactical, level, autoEnd }) => {
    state.settings = { tactical, battleOpts: { autoEnd } };
    state.party = heroes.map((k, i) => {
      const h = HEROES[k];
      const c = Object.assign(clone(state.example), { id: 'h' + i, example: false, name: h.name, race: h.race, level });
      c.base = { ...h.base }; c.equip = { main: { t: 'w', id: h.main } }; if (h.off) c.equip.off = { t: 'w', id: h.off };
      delete c.bag; delete c.kit; delete c.hp; c.essences = (h.ess || []).slice(); c.insp = 0;
      ensureKit(c);
      addToBag(c, { t: 'g', id: 'torch', qty: 2 });
      c.mp = maxMp(c); return c;
    });
    state.current = 'h0'; newRun();
    state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    saveChar();
    if (tactical) { const r = await loadBattle(); return r; }
    return true;
  }, { heroes, HEROES, tactical, level, autoEnd });
  return ok;
}

async function startFightPage(p, { list = ['goblin', 'goblin'], zone = 'goblin', ambush = false } = {}) {
  await p.evaluate(({ list, zone, ambush }) => {
    location.hash = 'labyrinth'; rerender();
    const ev = { kind: ambush ? 'ambush' : 'hard', title: ambush ? 'Засада!' : 'Тяжёлая встреча', raw: 10, n: 10, cause: 'event', ambush, list, zone, border: false, key: tkey(state.run.pos.x, state.run.pos.y), outcome: null, killed: [], turn: 0, round: 1, tactical: tacticalOn() };
    ev.init = rollInitiative(list, ambush);
    dgUi.enc = ev; rerender();
  }, { list, zone, ambush });
}

const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png` });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const mode = p => p.evaluate(() => (window.Battle && Battle.UI ? Battle.UI.mode : 'none'));
async function waitMode(p, m, ms = 20000) { await p.waitForFunction(m => window.Battle && Battle.UI && Battle.UI.mode === m, m, { timeout: ms }); }
// Центр клетки поля в координатах страницы.
async function cellXY(p, x, y) {
  return p.evaluate(({ x, y }) => { const r = document.querySelector('.bt-board').getBoundingClientRect(); return { x: r.left + (x + .5) * r.width / 7, y: r.top + (y + .5) * r.height / 7 }; }, { x, y });
}
async function tapCell(p, x, y) { const c = await cellXY(p, x, y); await p.mouse.click(c.x, c.y); }
const units = p => p.evaluate(() => Battle.S.units.map(u => ({ id: u.id, n: u.name, s: u.side, x: u.x, y: u.y, hp: u.hp, mhp: u.maxHp, alive: u.alive, down: u.down, t: u.t })));

module.exports = { launch, setup, startFightPage, shot, sleep, ev, mode, waitMode, cellXY, tapCell, units, SHOTS, HEROES };
