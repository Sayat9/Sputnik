#!/usr/bin/env node
/* Лаборатория боёв: быстрые прогоны сценариев без интерфейса, короткий отчёт.
   node tools/lab.js <ключ=значение …>            справка: node tools/lab.js help
   Враги:   mons=goblin*3,dire-wolf      — заданный состав («изолированно»)
            nat=1 | nat=2:beast | nat=3  — «естественные условия»: состав бросает сама игра (этаж[:вариант 2 этажа goblin|beast|undead|stone]); day=5 roll=3-10
   Герои:   party=tank,archer,mage       — заготовки (см. PRESETS) или свои: имя:раса:оружие[/левая рука]:эссенция+эссенция:броня
            lv=4 steel=1 ess=wolf+fox (эссенции всем) bag=throw-dagger*10+arrow-steel*20 (в рюкзак всем)
   Прогон:  n=20 (боёв)  log=40 (строк журнала первого боя)  grep=регэксп (сколько раз встретилось в журналах)  each=1 (строка на каждый бой)  json=1
   Примеры: node tools/lab.js mons=dark-bear party=tank,mage lv=3 n=30
            node tools/lab.js nat=2:beast day=6 party=barb,archer,rogue,mage lv=4 n=40 grep="кровотеч"
            node tools/lab.js mons=mine-ghost*2 party=wand,tank n=20 log=30
   Сравнение: варианты через «|» в party / mons / nat — по одной строке на сочетание:
            node tools/lab.js "party=tank,mage|flail,star|rogue,archer" "mons=dark-bear|hobgoblin*2" lv=3 n=20 */
const { chromium } = require('playwright');
const APP = process.env.APP || '/home/user/app';
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-weap2','battle-env','battle-ai','battle-end','battle-net','battle'];
const PRESETS = {
  tank: 'Танк:dwarf:warhammer/shield::chainmail', barb: 'Варвар:barbarian:greatsword::hide', knight: 'Рыцарь:human:sword/shield::chainmail', pike: 'Пикинёр:human:pike/tower-shield::chainmail',
  rogue: 'Ловкач:human:dagger/dagger::leather', duel: 'Дуэлянт:human:rapier::leather', archer: 'Лучник:human:longbow::leather', short: 'Стрелок:fairy:shortbow/dagger::leather',
  mage: 'Маг:human:staff::', wand: 'Чародей:gnome:wand/shield::leather', flail: 'Цепник:human:flail/shield::leather', star: 'Звезда:human:morningstar/shield::hide', monk: 'Кулак:beastkin:gloves/gloves::', axe: 'Секира:barbarian:greataxe::hide', spear: 'Копейщик:beastkin:spear::leather',
};
const BASE = { str: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, dex: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 }, int: { str: 8, dex: 12, con: 12, int: 16, wis: 14, cha: 10 } };
const args = Object.fromEntries(process.argv.slice(2).map(a => { const i = a.indexOf('='); return i < 0 ? [a, '1'] : [a.slice(0, i), a.slice(i + 1)]; }));
if (args.help || !process.argv[2]) { console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(1).join('\n') + '\nЗаготовки героев: ' + Object.keys(PRESETS).join(', ')); process.exit(0); }
if (/\|/.test((args.party || '') + (args.mons || '') + (args.nat || ''))) { // сравнение вариантов: party=a,b|c,d  mons=x|y*2 — по строке на сочетание
  const cp = require('child_process'), split = k => (args[k] ? args[k].split('|') : [null]);
  for (const pa of split('party')) for (const mo of split('mons')) for (const na of split('nat')) {
    const a = { ...args, brief: '1' }; if (pa) a.party = pa; if (mo) a.mons = mo; if (na) a.nat = na;
    const r = cp.spawnSync(process.execPath, [__filename, ...Object.entries(a).map(([k, v]) => k + '=' + v)], { encoding: 'utf8' });
    process.stdout.write(`[${pa || 'tank,archer,mage'}] против [${mo || 'этаж ' + na}]: ` + (r.stdout || r.stderr)); }
  process.exit(0); }
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto(`file://${APP}/index.html`); await p.waitForTimeout(400);
  for (const f of FILES) await p.addScriptTag({ path: `${APP}/assets/js/${f}.js` });
  const R = await p.evaluate(async ({ args, PRESETS, BASE }) => {
    const B = Battle; B.cfg.fast = true; const n = +(args.n || 20), lv = +(args.lv || 3);
    const out = { err: [], issues: [], fights: [], abMon: {}, abHero: {}, atk: {}, grep: 0, log: [], comps: {}, warn: [] };
    // ---- герои
    const specs = (args.party || 'tank,archer,mage').split(',').map(s => PRESETS[s] || s);
    const mkHero = (spec, i) => { const [name, race, weap, ess, armor] = spec.split(':'); const [main, off] = (weap || 'sword').split('/');
      const ent = a => (ART_WEAPONS[a] ? { t: 'w', id: ART_WEAPONS[a].base, art: a } : { t: 'w', id: a, ...(args.steel ? { steel: true } : {}) });
      const w = WEAPONS.find(x => x.id === (ART_WEAPONS[main] ? ART_WEAPONS[main].base : main)); if (!w) { out.warn.push('нет оружия ' + main); }
      const kind = w && (w.magic ? 'int' : w.group === 'ranged' || /Фехтовальное/.test((w.props || []).join()) || w.hitAb === 'dex' ? 'dex' : 'str');
      const c = Object.assign(clone(state.example), { id: 'L' + i, example: false, name: name || 'Г' + i, race: RACES.find(r => r.id === race) ? race : 'human', level: lv });
      c.base = { ...BASE[kind || 'str'] }; c.equip = { main: ent(main) }; if (off) c.equip.off = ent(off);
      delete c.bag; delete c.kit; delete c.hp; c.essences = [...(ess ? ess.split('+') : []), ...(args.ess ? args.ess.split('+') : [])].filter(e => { if (ESSENCES[e]) return true; out.warn.push('нет эссенции ' + e); return false; });
      ensureKit(c); if (armor && ARMOR_FLAT.find(a => a.id === armor)) c.equip.body = { t: 'a', id: armor, ...(args.steel ? { steel: true } : {}) };
      if (w && w.group === 'ranged') addToBag(c, { t: 'g', id: 'arrow', qty: 40 });
      for (const it of (args.bag ? args.bag.split('+') : [])) { const [id, q] = it.split('*'); if (GEAR[id]) addToBag(c, { t: 'g', id, qty: +(q || 1) }); else out.warn.push('нет предмета ' + id); }
      c.mp = maxMp(c); return c; };
    // ---- враги
    const fixed = args.mons ? args.mons.split(',').flatMap(s => { const [id, k] = s.split('*'); if (!MONSTERS.find(m => m.id === id)) { out.warn.push('нет монстра ' + id); return []; } return Array(+(k || 1)).fill(id); }) : null;
    const [nf, nv] = String(args.nat || '').split(':'), day = +(args.day || 4), [r0, r1] = (args.roll || '3-14').split('-').map(Number);
    const natural = () => { const fl = +nf || 1; state.run.floor = fl; if (nv) state.run.variant = nv; state.run.day = day;
      for (let t = 0; t < 200; t++) { const F = FL(), x = Math.floor(Math.random() * F.size), y = Math.floor(Math.random() * F.size), roll = r0 + Math.floor(Math.random() * ((r1 || r0) - r0 + 1));
        try { const e = genEncounterRaw(x, y, day, roll, false); if (e && e.list && e.list.length) return { list: e.list.slice(), zone: e.zone, place: e.place, floor: fl, kind: roll <= 2 ? 'ambush' : 'hard', ambush: roll <= 2 }; } catch (er) { out.warn.push('генерация: ' + er.message); break; } }
      return null; };
    const ua = B.useActive; B.useActive = async (u, id, pk, o) => { const r = await ua(u, id, pk, o); if (r) { const k = u.side === 'mon' ? out.abMon : out.abHero; (k[id] ||= { n: 0, f: new Set() }); k[id].n++; k[id].f.add(cur); } return r; };
    let cur = 0;
    if (!state.run) { try { newRun(); } catch (e) { state.run = { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false, day: 1 }; } }
    for (cur = 0; cur < n; cur++) {
      state.party = specs.map(mkHero); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      const ev = fixed ? { list: fixed.slice(), zone: (MONSTERS.find(m => m.id === fixed[0]) || {}).zone || 'goblin', floor: +(args.floor || (MONSTERS.find(m => m.id === fixed[0]) || {}).floor || 1), kind: 'hard' } : natural();
      if (!ev || !ev.list.length) { out.warn.push('не удалось собрать встречу'); break; }
      const comp = ev.list.slice().sort().join('+'); out.comps[comp] = (out.comps[comp] || 0) + 1;
      try { const r = await B.sim({ title: 'lab', ...ev }); const S = r.S, hs = S.units.filter(u => u.hero && !u.summon);
        const lost = hs.reduce((a, u) => a + (u.maxHp - Math.max(0, u.hp)), 0) / hs.reduce((a, u) => a + u.maxHp, 0);
        out.fights.push({ c: comp, w: S.outcome === 'win' ? 1 : 0, o: S.outcome, r: S.round, dead: hs.filter(u => u.dead).length, down: hs.filter(u => u.dead || u.down).length, lost });
        for (const u of S.units) { if (u.hero && (u.mp < 0 || Number.isNaN(u.mp) || Number.isNaN(u.hp))) out.issues.push(`мана/ОЗ ${u.name}: ${u.mp}/${u.hp}`); if (B.alive(u) && !u.fled && !u.escaped && !u.gone && !B.inB(u.x, u.y)) out.issues.push(`${u.name} вне поля`); }
        const re = args.grep ? new RegExp(args.grep, 'i') : null;
        for (const l of S.log) { const t = l.t; if (/NaN|undefined/.test(t)) out.issues.push('журнал: ' + t.slice(0, 70)); if (re && re.test(t)) out.grep++;
          const m = /^(.+?): (.+?) по (.+?) — (.*)$/.exec(t); if (m) { const hero = hs.some(u => u.name === m[1]), k = (hero ? 'Г ' : 'М ') + m[2].replace(/^(Метнуть|Второй рукой): /, ''); const a = (out.atk[k] ||= { n: 0, hit: 0, dmg: 0 }); a.n++; const d = /(\d+) урона/.exec(m[4]); if (d) { a.hit++; a.dmg += +d[1]; } } }
        if (cur === 0 && args.log) out.log = S.log.slice(0, +args.log).map(l => l.t);
      } catch (e) { out.err.push(comp + ': ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')); }
      B.S = null;
    }
    for (const k of [out.abMon, out.abHero]) for (const id of Object.keys(k)) k[id] = [k[id].n, k[id].f.size];
    const nm = e => (e.art && ARTIFACTS[e.art] && ARTIFACTS[e.art].name) || itemOf(e).name;
    out.party = state.party.map(c => `${c.name} (${nm(c.equip.main)}${c.equip.off ? ' + ' + nm(c.equip.off) : ''}${c.essences.length ? '; ' + c.essences.join(', ') : ''}; ОЗ ${maxHp(c)}, мана ${maxMp(c)})`);
    return out;
  }, { args, PRESETS, BASE });
  await b.close();
  if (args.json) { console.log(JSON.stringify(R)); return; }
  const F = R.fights, N = F.length || 1, avg = k => (F.reduce((a, f) => a + f[k], 0) / N), pc = x => Math.round(x * 100) + '%';
  const bad = (R.err.length ? ' · ИСКЛЮЧЕНИЙ ' + R.err.length + ': ' + R.err[0].slice(0, 120) : '') + (R.issues.length ? ' · НАРУШЕНИЙ ' + R.issues.length + ': ' + R.issues[0] : '') + (errs.length ? ' · ошибки страницы: ' + errs[0].slice(0, 120) : '');
  if (args.brief) { console.log(`победы ${pc(avg('w'))} · раундов ${avg('r').toFixed(1)} · упало ${avg('down').toFixed(2)} · погибло ${avg('dead').toFixed(2)} · потеря ОЗ ${pc(avg('lost'))} (боёв ${F.length})${args.grep ? ' · «' + args.grep + '» ' + R.grep : ''}${bad}`); return; }
  console.log(`lab · ${args.mons ? 'состав ' + args.mons : 'естественно: этаж ' + args.nat + ', день ' + (args.day || 4)} · ур. ${args.lv || 3}${args.steel ? ', сталь' : ''} · боёв ${F.length}`);
  console.log('отряд: ' + R.party.join(' | '));
  console.log(`победы ${pc(avg('w'))} · раундов ${avg('r').toFixed(1)} · погибло героев ${avg('dead').toFixed(2)}/бой · упало ${avg('down').toFixed(2)}/бой · потеря ОЗ ${pc(avg('lost'))}`);
  const comps = Object.entries(R.comps); if (!args.mons && comps.length) console.log('составы: ' + comps.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, k]) => { const fs = F.filter(f => f.c === c); return `${c} ×${k} (${pc(fs.reduce((a, f) => a + f.w, 0) / (fs.length || 1))})`; }).join('; ') + (comps.length > 8 ? ` … ещё ${comps.length - 8}` : ''));
  const ab = o => Object.entries(o).map(([id, [n, f]]) => `${id} ${n} (в ${f} боях)`).join(', ') || '—';
  console.log('способности монстров: ' + ab(R.abMon)); console.log('способности героев: ' + ab(R.abHero));
  const at = Object.entries(R.atk).sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([k, a]) => `${k}: ${a.n} атак, ${pc(a.hit / a.n)} попаданий, ср. урон ${a.hit ? (a.dmg / a.hit).toFixed(1) : '—'}`); if (at.length) console.log('атаки:\n  ' + at.join('\n  '));
  if (args.grep) console.log(`«${args.grep}» в журналах: ${R.grep} раз`);
  if (args.each) console.log(F.map((f, i) => `${i + 1}: ${f.o}, раундов ${f.r}, потеря ${pc(f.lost)}${f.dead ? ', погибло ' + f.dead : ''} [${f.c}]`).join('\n'));
  if (R.log.length) console.log('журнал первого боя:\n  ' + R.log.join('\n  '));
  const W = [...new Set(R.warn)]; if (W.length) console.log('ВНИМАНИЕ: ' + W.join('; '));
  if (R.err.length) console.log('ИСКЛЮЧЕНИЯ:\n  ' + [...new Set(R.err)].slice(0, 8).join('\n  '));
  if (R.issues.length) console.log('НАРУШЕНИЯ:\n  ' + [...new Set(R.issues)].slice(0, 8).join('\n  '));
  if (errs.length) console.log('ОШИБКИ СТРАНИЦЫ:\n  ' + [...new Set(errs)].slice(0, 5).join('\n  '));
  process.exit(R.err.length || R.issues.length || errs.length ? 1 : 0);
})();
