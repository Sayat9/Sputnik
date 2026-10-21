/* Тактический бой: действия героя — оружие, атаки, навыки эссенций, движение, оборона, рывок, отход, помощь, захват, толчок,
   предметы, побег. Каждое действие — объект {id, cat, label, sub, time, enabled, why, run}. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const { rnd, d, roll, parseDice, fmtDice, sleep, amod, sg, clamp, pick, log, dist, distCell, footprint, alive, live, enemiesOf, alliesOf, occupant, has, addStatus, removeStatus,
    hookAll, hookSum, hookAny, speedOf, reachable, pathTo, setMp, setHp, heal, canAct, ABIL_RU, SKILL_RU } = B;
  const UI = () => B.UI;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const TIME_RU = { action: "действие", bonus: "доп. действие", reaction: "реакция", free: "свободно", move: "движение" };
  B.TIME_RU = TIME_RU;

  /* ===== оружие героя ===== */
  function wprops(w) {
    const p = w.props || [], find = re => p.find(x => re.test(x)) || "";
    const vers = find(/^Универсальное/).match(/\((.+)\)/), thr = find(/^Метательное/).match(/\((\d+)\/(\d+) м\)/), amm = find(/^Боеприпасы/).match(/\((\d+)\/(\d+) м\)/);
    return { finesse: p.includes("Фехтовальное"), heavy: p.includes("Тяжёлое"), two: p.includes("Двуручное"), versatile: vers ? vers[1] : null,
      thrown: thr ? [Math.floor(+thr[1] / 1.5), Math.floor(+thr[2] / 1.5)] : null, ammoR: amm ? [+amm[1], +amm[2]] : null };
  }
  const DT = D.DT_FROM_RU;
  function atkFrom(u, w, mode) {
    const c = u.hero, f = wprops(w), eq = c.equip || {}, eb = essBonus(c);
    const ranged = w.group === "ranged", strM = amod(u.abil.str), dexM = amod(u.abil.dex);
    const ab = ranged ? "dex" : (mode === "thrown" ? (f.finesse && dexM > strM ? "dex" : "str") : (f.finesse && dexM > strM ? "dex" : "str"));
    const am = amod(u.abil[ab]);
    const dice = parseDice(f.versatile && !eq.off && mode === "hand" ? f.versatile : w.dmg);
    const giant = c.giantGrip && c.race === "barbarian" && f.two && !ranged;
    const atk = { id: mode + ":" + w.id, w, n: w.name, hit: am + u.pb, parts: [{ l: ABIL_RU[ab], v: am }, { l: "Бонус мастерства", v: u.pb }], dmg: { ...dice, b: dice.b + am }, dt: DT[w.type] || "bludgeon", tags: [], mode, time: "action" };
    if (giant) { atk.penalty = -2; atk.penaltyLabel = "Великан: одной рукой"; }
    if (mode === "hand" && !ranged) { atk.kind = "melee"; atk.reach = w.id === "spear" && u.pass.includes("goblin-spear") ? 2 : 1; atk.sub = atk.reach > 1 ? "досягаемость 3 м" : "ближний бой"; }
    else if (mode === "hand" && ranged) {
      atk.kind = "ranged"; atk.ammo = "arrow";
      const r = f.ammoR || [24, 96]; atk.range = [Math.floor((r[0] + eb.range) / 1.5), Math.floor((r[1] + eb.range) / 1.5)]; atk.sub = "дальний бой, стрела";
    } else if (mode === "thrown") { atk.kind = "ranged"; atk.thrown = true; atk.n = "Метнуть: " + w.name; atk.range = f.thrown; atk.sub = "бросок, оружие падает"; }
    else if (mode === "off") { atk.kind = "melee"; atk.reach = 1; atk.time = "bonus"; atk.offhand = true; atk.dmg.b = Math.min(0, am); atk.n = "Второй рукой: " + w.name; atk.sub = "доп. действие, без модификатора урона"; }
    return atk;
  }
  function heroAttacks(u) {
    const c = u.hero, eq = c.equip || {}, out = [];
    const main = eq.main ? itemOf(eq.main) : null, off = eq.off ? itemOf(eq.off) : null;
    if (main && main.kindOf === "weapon" && main.kind !== "Боеприпасы") {
      out.push(atkFrom(u, main, "hand"));
      const f = wprops(main);
      if (f.thrown) out.push(atkFrom(u, main, "thrown"));
    }
    if (off && off.kindOf === "weapon" && off.group === "melee" && off.id !== "tower-shield" && u.t && u.t.attacked && main && main.group === "melee" && !wprops(main).two) out.push(atkFrom(u, off, "off"));
    const strM = amod(u.abil.str);
    out.push({ id: "fist", n: "Кулак", kind: "melee", reach: 1, hit: strM + u.pb, parts: [{ l: "Сила", v: strM }, { l: "Бонус мастерства", v: u.pb }], dmg: { n: 0, s: 0, b: Math.max(1, 1 + strM) }, dt: "bludgeon", tags: [], time: "action", sub: "атака рукой: 1 + Сила" });
    if (u.hero && countGear(u.hero, "torch") > 0) out.push({ id: "torchhit", n: "Факел", kind: "melee", reach: 1, hit: strM + u.pb, parts: [{ l: "Сила", v: strM }, { l: "Бонус мастерства", v: u.pb }], dmg: { n: 0, s: 0, b: 1 }, dt: "fire", tags: [], time: "action", sub: "1 урона огнём" });
    return out;
  }
  B.heroAttacks = heroAttacks;
  B.heroReach = u => { const m = u.hero && u.hero.equip && u.hero.equip.main ? itemOf(u.hero.equip.main) : null; return m && m.id === "spear" && u.pass.includes("goblin-spear") ? 2 : 1; };
  B.attacksOf = u => (u.side === "hero" ? heroAttacks(u) : u.atk);
  B.meleeAttackOf = u => {
    const list = B.attacksOf(u).filter(a => a.kind === "melee" && !a.offhand && !a.thrown);
    return list.sort((a, b) => B.avgDice(b.dmg) - B.avgDice(a.dmg))[0] || null;
  };
  B.inAttackRange = (u, t, atk) => {
    const dd = dist(u, t);
    if (atk.kind === "melee") return dd <= (atk.reach || 1);
    return dd <= atk.range[1] && !B.lineBlocked(u, t);
  };
  B.attackTargets = (u, atk) => enemiesOf(u).filter(t => B.inAttackRange(u, t, atk));
  function rangeCells(u, atk) {
    const r = atk.kind === "melee" ? (atk.reach || 1) : atk.range[1], out = [];
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (distCell(u, x, y) <= r && distCell(u, x, y) > 0) out.push([x, y]);
    return out;
  }
  B.rangeCells = rangeCells;

  /* ===== расход времени ===== */
  const timeOK = (u, t) => (t === "action" ? u.t.action > 0 : t === "bonus" ? u.t.bonus > 0 : t === "reaction" ? u.t.react > 0 : true);
  const spendTime = (u, t) => { if (t === "action") u.t.action = 0; else if (t === "bonus") u.t.bonus = 0; else if (t === "reaction") u.t.react = 0; };
  const timeWhy = (u, t) => (timeOK(u, t) ? null : t === "bonus" ? "доп. действие потрачено" : "действие потрачено");
  Object.assign(B, { timeOK, spendTime });

  function commitAttack(u, atk) {
    spendTime(u, atk.time || "action");
    if (!atk.offhand) u.t.attacked = true;
    if (atk.ammo && u.hero) { takeGear(u.hero, "arrow", 1); const S = B.S; S.usedArrows[u.hero.id] = (S.usedArrows[u.hero.id] || 0) + 1; }
    if (atk.thrown && u.hero) {
      const c = u.hero, S = B.S; S.thrown.push({ hero: c.id, slot: "main", item: c.equip.main }); delete c.equip.main;
      log(`${u.name} бросает ${atk.w.name}.`);
    }
  }
  B.commitAttack = commitAttack;
  async function runAttack(u, atk) {
    const targets = B.attackTargets(u, atk);
    if (!targets.length) { UI().toast("Нет целей в досягаемости"); return false; }
    const tgt = await UI().pickUnit({ prompt: `${atk.n}: выберите цель`, units: targets.map(t => t.id), cells: rangeCells(u, atk), kind: "attack" });
    if (!tgt) return false;
    const r = await B.doAttack(u, tgt, atk, { onCommit: () => commitAttack(u, atk) });
    return !r.cancelled;
  }

  /* ===== движение ===== */
  async function runMove(u) {
    if (u.t.move <= 0 && !has(u, "prone")) { UI().toast("Движения не осталось"); return false; }
    const standCost = has(u, "prone") ? Math.ceil(speedOf(u) / 2) : 0;
    const budget = u.t.move - standCost;
    if (speedOf(u) === 0) { UI().toast("Скорость 0: двигаться нельзя"); return false; }
    if (has(u, "prone") && budget < 0) { UI().toast("Не хватает движения, чтобы встать"); return false; }
    const scared = has(u, "frightened");                                                            // испуганный не приближается к источнику страха
    const map = B.pathMap(u, Math.max(0, budget), { avoid: (x, y) => scared && B.frightenOK && !B.frightenOK(u, x, y) });
    const cells = new Map();
    for (const [k, v] of map) if ((v.x !== u.x || v.y !== u.y) && B.canStand(u, v.x, v.y)) cells.set(k, v);
    if (!cells.size && !standCost) { UI().toast("Некуда идти"); return false; }
    const ch = await UI().pickMove({ unit: u, cells, standCost, budget });
    if (!ch) return false;
    if (standCost) { removeStatus(u, "prone"); u.t.move -= standCost; log(`${u.name} встаёт.`); }
    if (ch.stay) return true;
    const path = pathTo(map, ch.x, ch.y);
    const r = await B.moveAlong(u, path);
    u.t.move = Math.max(0, u.t.move - r.spent); u.t.moved += r.spent;
    log(`${u.name} перемещается (${r.spent} кл.).`);
    return true;
  }
  async function runStand(u) {
    if (!has(u, "prone")) return false;
    const cost = Math.ceil(speedOf(u) / 2);
    if (u.t.move < cost || speedOf(u) === 0) { UI().toast("Не хватает движения, чтобы встать"); return false; }
    u.t.move -= cost; removeStatus(u, "prone"); log(`${u.name} встаёт.`); return true;
  }

  /* ===== простые действия ===== */
  const simple = (id, label, ico, sub, fn, extra = {}) => ({ id, cat: "other", label, ico, sub, time: "action", run: fn, ...extra });
  async function doDash(u) { if (speedOf(u) === 0) { UI().toast("Скорость 0"); return false; } spendTime(u, "action"); u.t.move += speedOf(u); u.t.dash = true; log(`${u.name}: рывок (+${speedOf(u)} кл. движения).`); UI().fxText(u, "рывок", "good"); return true; }
  async function doDisengage(u) { spendTime(u, "action"); u.t.disengage = true; log(`${u.name}: отход — движение не провоцирует атак.`); UI().fxText(u, "отход", "good"); return true; }
  async function doDefend(u) { spendTime(u, "action"); addStatus(u, "dodging", { k: 1, when: "start" }); log(`${u.name} встаёт в оборону.`); UI().fxText(u, "оборона", "good"); return true; }
  async function doHelp(u) {
    const near = enemiesOf(u).filter(e => dist(u, e) <= 1);
    if (!near.length) { UI().toast("Помощь: нужен враг рядом с вами"); return false; }
    const t = await UI().pickUnit({ prompt: "Помощь: отвлеките врага — следующая атака по нему с преимуществом", units: near.map(e => e.id), cells: [], kind: "help" });
    if (!t) return false;
    spendTime(u, "action"); addStatus(t, "helped", { k: Infinity, data: { endAtStartOf: u.id } });
    log(`${u.name} отвлекает ${t.name}: следующая атака по нему с преимуществом.`); UI().fxText(t, "отвлечён", ""); return true;
  }
  function bestPassive(u) { return 10 + amod(u.abil.wis) + (u.skills.perception || 0) + hookSum(u, "passivePerception", {}); }
  function hideSpot(u) {
    const t = B.tinfo(u.x, u.y);
    if (t && t.hide) return "в укрытии";
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && B.obstacleAt(u.x + dx, u.y + dy)) return "у препятствия";
    if (B.inDark(u)) return "в тени";
    return null;
  }
  B.hideSpot = hideSpot;
  async function doHide(u) {
    const spot = hideSpot(u);
    if (!spot) { UI().toast("Спрятаться можно у препятствия, в кустах, тумане или в тени"); return false; }
    const foes = enemiesOf(u).filter(e => canAct(e));
    if (foes.some(e => dist(e, u) <= 1)) { UI().toast("Враг рядом: спрятаться нельзя"); return false; }
    const dc = Math.max(8, ...foes.filter(e => !(e.tremor && dist(e, u) <= e.tremor) && !(e.blind && dist(e, u) <= e.blind)).map(bestPassive));
    const adv = [], dis = [];
    if (u.hero && u.hero.equip && itemOf(u.hero.equip.body) && itemOf(u.hero.equip.body).stealth) dis.push("тяжёлая броня");
    const main = u.hero && u.hero.equip.main ? itemOf(u.hero.equip.main) : null; if (main && main.id === "tower-shield") dis.push("ростовой щит");
    const r = await B.doCheck(u, "stealth", { title: "Спрятаться", label: `${spot} · Сл ${dc}`, dc, adv, dis, cancel: true, onCommit: () => spendTime(u, "action"), tags: ["hide"] });
    if (!r) return false;
    if (r.ok) { addStatus(u, "hidden", { k: Infinity }); log(`${u.name} прячется (${r.total} против ${dc}).`); UI().fxText(u, "скрыт", "good"); }
    else { log(`${u.name} не удалось спрятаться (${r.total} против ${dc}).`); UI().fxText(u, "заметили", "bad"); }
    return true;
  }
  const bestDef = u => (u.skills.acrobatics || 0) + amod(u.abil.dex) > (u.skills.athletics || 0) + amod(u.abil.str) ? "acrobatics" : "athletics";
  B.bestDef = bestDef;
  async function doGrapple(u) {
    const near = enemiesOf(u).filter(e => dist(u, e) <= 1 && e.size <= u.size + 1 && canAct(e) || (dist(u, e) <= 1 && has(e, "prone")));
    if (!near.length) { UI().toast("Захват: нужен враг рядом"); return false; }
    const t = await UI().pickUnit({ prompt: "Захват: выберите цель", units: near.map(e => e.id), cells: [], kind: "attack" });
    if (!t) return false;
    const r = await B.contest(u, "athletics", t, bestDef(t), { title: "Захват", cancel: true, onCommit: () => spendTime(u, "action"), advB: has(t, "wet") ? ["промок: скользкий"] : [], labelA: `захват: ${t.name}`, tagsB: ["grapple"] });
    if (!r) return false;
    if (r.win) { addStatus(t, "grappled", { k: Infinity, data: { by: u.id } }); log(`${u.name} хватает ${t.name}.`); UI().fxText(t, "схвачен", "bad"); }
    else { UI().fxText(t, "вырвался", ""); }
    return true;
  }
  async function doShove(u, time = "action") {
    const near = enemiesOf(u).filter(e => dist(u, e) <= 1 && e.size <= u.size + 1);
    if (!near.length) { UI().toast("Толчок: нужен враг рядом"); return false; }
    const t = await UI().pickUnit({ prompt: "Толчок: выберите цель", units: near.map(e => e.id), cells: [], kind: "attack" });
    if (!t) return false;
    const r = await B.contest(u, "athletics", t, bestDef(t), { title: "Толчок", cancel: true, onCommit: () => spendTime(u, time), labelA: `толчок: ${t.name}`, disB: [], advB: [], tagsB: ["shove"] });
    if (!r) return false;
    if (!r.win) { UI().fxText(t, "устоял", ""); return true; }
    const ch = await UI().choose({ title: "Толчок удался", options: [{ id: "push", label: "Оттолкнуть на 1 клетку" }, { id: "prone", label: "Сбить с ног" }] });
    if (ch === "push") { const n = await B.push(t, u.x, u.y, 1); if (!n) { addStatus(t, "prone", { k: Infinity }); log(`${t.name} сбит с ног (некуда отступать).`); } else log(`${u.name} отталкивает ${t.name}.`); }
    else { addStatus(t, "prone", { k: Infinity }); log(`${u.name} сбивает ${t.name} с ног.`); UI().fxText(t, "сбит с ног", "bad"); }
    return true;
  }
  async function doEscape(u) {
    const gr = has(u, "grappled"), tr = has(u, "trapped") || has(u, "pinned"), rs = has(u, "restrained");
    const by = gr ? B.byId(gr.data.by) : null;
    let ok;
    if (gr && gr.data.dc) {                                       // хватка эссенции: проверка Силы или Ловкости против её Сл
      const r = await B.doCheck(u, bestDef(u), { title: "Вырваться из хватки", label: `Сл ${gr.data.dc}`, dc: gr.data.dc, cancel: true, onCommit: () => spendTime(u, "action"), adv: has(u, "wet") ? ["промок: скользкий"] : [], tags: ["grapple"] });
      if (!r) return false; ok = r.ok;
    } else if (by && alive(by)) {
      const r = await B.contest(u, bestDef(u), by, "athletics", { title: "Вырваться из захвата", cancel: true, onCommit: () => spendTime(u, "action"), advA: has(u, "wet") ? ["промок: скользкий"] : [], tagsA: ["grapple"] });
      if (!r) return false; ok = r.win;
    } else {
      const dc = (tr && tr.data.dc) || (rs && rs.data.dc) || 12;
      const r = await B.doCheck(u, "athletics", { title: "Вырваться", label: `Сл ${dc}`, dc, cancel: true, onCommit: () => spendTime(u, "action") });
      if (!r) return false; ok = r.ok;
    }
    if (ok) { for (const id of ["grappled", "trapped", "restrained", "pinned"]) removeStatus(u, id); log(`${u.name} вырывается.`, "good"); UI().fxText(u, "свободен", "good"); }
    else UI().fxText(u, "не вышло", "bad");
    return true;
  }
  // Перевязка: Медицина Сл 10 останавливает кровотечение у себя или у союзника рядом (текст «Кровопускания»).
  async function doBandage(u) {
    const cands = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1 && !a.dead)].filter(a => has(a, "bleeding"));
    if (!cands.length) { UI().toast("Некого перевязывать: нет кровотечения"); return false; }
    const t = cands.length === 1 ? cands[0] : await UI().pickUnit({ prompt: "Перевязать: кого?", units: cands.map(a => a.id), cells: [], kind: "heal" });
    if (!t) return false;
    const r = await B.doCheck(u, "medicine", { title: "Перевязать", label: `${t.name} · Сл 10`, dc: 10, cancel: true, onCommit: () => spendTime(u, "action") });
    if (!r) return false;
    if (r.ok) { removeStatus(t, "bleeding"); log(`${u.name} перевязывает ${t.name}: кровотечение остановлено.`, "good"); UI().fxText(t, "перевязан", "good"); }
    else { log(`${u.name} не справляется с перевязкой.`); UI().fxText(t, "не вышло", "bad"); }
    return true;
  }
  async function doSearch(u) {
    const traps = B.S.objs.filter(t => t.kind === "trap" && t.hidden);
    spendTime(u, "action");
    const r = await B.doCheck(u, "perception", { title: "Осмотреться", label: "поиск ловушек", dc: 12, tags: ["trapsearch"] });
    if (r && r.ok) { traps.forEach(t => { if (dist(u, { x: t.x, y: t.y, size: 1 }) <= 4) t.hidden = false; }); log(`${u.name} замечает ловушки.`, "good"); UI().refresh(); }
    else log(`${u.name} ничего не замечает.`);
    return true;
  }

  /* ===== предметы ===== */
  async function usePotion(u) {
    const c = u.hero;
    const near = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1 && !a.dead)];
    const t = await UI().pickUnit({ prompt: "Зелье лечения: кому?", units: near.map(a => a.id), cells: [], kind: "heal", includeSelf: true });
    if (!t) return false;
    const ses = B.session(u, { kind: "heal", u, title: "Слабое зелье лечения", sub: `${u.name} → ${t.name}` });
    const r = await ses.dice({ label: "Лечение 1к4 + 2", n: 1, s: 4, bonus: 2, heal: true, cancel: true, reroll: B.rerollOptions(u, "heal") });
    if (!r) { ses.close(); return false; }
    takeGear(c, "potion", 1); spendTime(u, "bonus");
    const n = r.sum + 2; const got = heal(t, n, u);
    await ses.finish({ text: got ? `Восстановлено ${got} ОЗ` : "Лечение не подействовало", heal: true, tgt: t, dmg: got });
    return true;
  }
  async function lightTorch(u) {
    const S = B.S;
    if (S.torch) { UI().toast("Свет уже есть"); return false; }
    if (!takeGear(u.hero, "torch", 1)) return false;
    spendTime(u, "bonus"); S.torch = true; S.torchLit = true;
    log(`${u.name} зажигает факел: тьма отступает.`, "good"); UI().fxText(u, "свет", "good"); UI().refresh(); return true;
  }
  async function coverAlly(u) {
    const near = alliesOf(u).filter(a => dist(u, a) <= 1 && !a.down);
    if (!near.length) { UI().toast("Прикрыть можно союзника рядом"); return false; }
    const t = await UI().pickUnit({ prompt: "Прикрыть щитом: кого?", units: near.map(a => a.id), cells: [], kind: "help" });
    if (!t) return false;
    spendTime(u, "bonus"); addStatus(t, "guarded", { k: Infinity, data: { endAtStartOf: u.id } });
    log(`${u.name} прикрывает ${t.name} ростовым щитом (+2 КД).`, "good"); UI().fxText(t, "+2 КД", "good"); return true;
  }
  async function pickUpWeapon(u) {
    const S = B.S, near = S.drops.filter(w => distCell(u, w.x, w.y) <= 1 && w.hero === u.hero.id);
    if (!near.length) return false;
    const w = near[0]; S.drops.splice(S.drops.indexOf(w), 1);
    if (!u.hero.equip.main) u.hero.equip.main = w.item; else addToBag(u.hero, { t: "w", id: w.item.id, qty: 1 });
    u.t.objUsed = true; log(`${u.name} подбирает оружие.`); UI().refresh(); return true;
  }
  async function dragonHeart(u) {
    const c = u.hero; c.flags = c.flags || {};
    if (c.flags.heart) return false;
    spendTime(u, "bonus"); c.flags.heart = true;
    const t = Math.max(1, u.level + amod(u.abil.con)); u.temp = Math.max(u.temp || 0, t);
    log(`${u.name}: драконье сердце — ${t} временных ОЗ.`, "good"); UI().fxText(u, `+${t} врем. ОЗ`, "good"); return true;
  }

  /* ===== побег ===== */
  async function runFlee(u) {
    const sp = speedOf(u);
    if (sp === 0) { UI().toast("Скорость 0: не убежать"); return false; }
    const canDash = u.t.action > 0;
    const budget = u.t.move + (canDash ? sp : 0);
    const map = B.pathMap(u, budget, {});
    const exits = new Map();
    for (const [k, v] of map) if (v.y === B.H - 1 && (B.canStand(u, v.x, v.y) || (v.x === u.x && v.y === u.y))) exits.set(k, v);
    if (!exits.size) { UI().toast("До нижнего края не добежать"); return false; }
    const ch = await UI().pickCell({ prompt: "Побег: выберите клетку у нижнего края", cells: [...exits.values()].map(v => [v.x, v.y]), kind: "flee", path: map });
    if (!ch) return false;
    const node = map.get(B.key(ch[0], ch[1])), need = node.cost;
    if (need > u.t.move) { spendTime(u, "action"); u.t.dash = true; u.t.move += sp; log(`${u.name} бросается бежать.`); }
    const r = await B.moveAlong(u, pathTo(map, ch[0], ch[1]));
    u.t.move = Math.max(0, u.t.move - r.spent);
    if (!alive(u) || u.down) return true;
    if (u.y === B.H - 1) { u.escaped = true; log(`${u.name} покидает поле боя.`, "flee"); const g = ui(); if (g) g.fxEscape(u); }
    return true;
  }

  /* ===== список действий героя ===== */
  function skillOptions(u) {
    const out = [];
    for (const id of u.ess) {
      const A = B.A && B.A[id]; if (!A) continue;
      const eb = ESSENCES[id].active, name = eb.name;
      let why = null;
      if (A.time === "reaction") {
        out.push({ id: "skill:" + id, cat: "skill", label: name, ico: "skills", sub: `${eb.mana} маны · реакция${D.essCd[id] ? " · КД " + D.essCd[id] : ""}`, desc: eb.text, time: "reaction", enabled: false,
          why: u.cd[id] > 0 ? `перезарядка: ${u.cd[id]} р.` : u.mp < eb.mana ? `нужно ${eb.mana} маны` : "сработает сама: игра спросит, когда можно", ess: id, run: async () => false });
        continue;
      }
      why = timeWhy(u, A.time) || (u.mp < eb.mana ? `нужно ${eb.mana} маны` : (u.cd[id] > 0 ? `перезарядка: ${u.cd[id]} р.` : null));
      if (!why && A.can) { const c = A.can(u); if (c !== true && c) why = c; }
      out.push({ id: "skill:" + id, cat: "skill", label: name, ico: "skills", sub: `${eb.mana} маны · ${TIME_RU[A.time]}${D.essCd[id] ? " · КД " + D.essCd[id] : ""}`, desc: eb.text, time: A.time, enabled: !why, why, ess: id,
        run: async () => { const spec = A.tgt ? A.tgt(u) : { type: "self" }; const picks = await UI().pickFor(u, spec, A); if (!picks) return false; return B.useActive(u, id, picks); } });
    }
    // доп. возможности пассивок
    for (const id of u.pass) { const P = B.P && B.P[id]; if (P && P.actions) out.push(...P.actions(u)); }
    return out;
  }
  // Расход ресурсов и запуск активки. Возвращает true, если способность сработала.
  async function useActive(u, id, picks, o = {}) {
    const A = B.A[id], eb = ESSENCES[id].active; let committed = false;
    const commit = () => {
      if (committed) return; committed = true;
      if (u.side === "hero") { setMp(u, u.mp - eb.mana); u.cd[id] = D.essCd[id] || 1; spendTime(u, A.time); }
      else { u.used[id] = true; spendTime(u, A.time); }
    };
    if (u.side === "hero" && u.mp < eb.mana) return false;
    const r = await A.run(u, picks, { commit, o });
    if (r === false && !committed) return false;
    if (!committed) commit();
    log(`${u.name}: ${eb.name}.`, "skill");
    return true;
  }
  B.useActive = useActive;

  function actionsFor(u) {
    const opts = [];
    const t = u.t;
    // атаки
    for (const atk of heroAttacks(u)) {
      const why = timeWhy(u, atk.time) || (atk.ammo && countGear(u.hero, "arrow") < 1 ? "нет стрел" : (B.attackTargets(u, atk).length ? null : "нет целей рядом"));
      opts.push({ id: "atk:" + atk.id, cat: "attack", label: atk.n, ico: atk.ammo ? "bow" : atk.thrown ? "throwing" : atk.id === "fist" ? "fist" : atk.id === "torchhit" ? "torch" : "attack",
        sub: `${atk.kind === "melee" ? "до " + (atk.reach || 1) + " кл." : atk.range[0] >= B.W - 1 ? "дальний · всё поле" : `дальний · ${atk.range[0]} кл., до ${Math.min(atk.range[1], 12)} с помехой`} · ${atk.dmg.n ? fmtDice(atk.dmg) : atk.dmg.b} ${D.DT[atk.dt]}${atk.penalty ? " · " + atk.penaltyLabel : ""}`,
        time: atk.time, enabled: !why, why, atk, run: () => runAttack(u, atk) });
    }
    // навыки эссенций и особенности пассивок
    opts.push(...skillOptions(u));
    // движение
    opts.push({ id: "move", cat: "move", label: "Перемещение", ico: "move", sub: `осталось ${t.move} кл.`, time: "move", enabled: t.move > 0 && speedOf(u) > 0, why: speedOf(u) === 0 ? "скорость 0" : "нет движения", run: () => runMove(u) });
    if (has(u, "prone")) opts.push({ id: "stand", cat: "move", label: "Встать", ico: "move", sub: `стоит ${Math.ceil(speedOf(u) / 2)} кл.`, time: "move", enabled: t.move >= Math.ceil(speedOf(u) / 2), why: "нет движения", run: () => runStand(u) });
    // оборона и прочие действия
    opts.push({ id: "defend", cat: "defend", label: "Оборона", ico: "defend", sub: "атаки по вам с помехой, преимущество на спасброски Ловкости", time: "action", enabled: timeOK(u, "action"), why: timeWhy(u, "action"), run: () => doDefend(u) });
    const act = timeWhy(u, "action");
    opts.push(simple("dash", "Рывок", "dash", "ещё столько же клеток движения", () => doDash(u), { enabled: !act && speedOf(u) > 0, why: act || "скорость 0" }));
    opts.push(simple("disengage", "Отход", "disengage", "движение не провоцирует атак по возможности", () => doDisengage(u), { enabled: !act, why: act }));
    opts.push(simple("help", "Помощь", "help", "следующая атака по врагу рядом — с преимуществом", () => doHelp(u), { enabled: !act && enemiesOf(u).some(e => dist(u, e) <= 1), why: act || "нет врага рядом" }));
    opts.push(simple("hide", "Спрятаться", "hide", "Скрытность против Восприятия врагов; нужно укрытие", () => doHide(u), { enabled: !act && !!hideSpot(u), why: act || "нет укрытия рядом" }));
    opts.push(simple("grapple", "Захват", "grapple", "Атлетика против Атлетики или Акробатики", () => doGrapple(u), { enabled: !act && enemiesOf(u).some(e => dist(u, e) <= 1), why: act || "нет врага рядом" }));
    opts.push(simple("shove", "Толчок", "shove", "оттолкнуть или сбить с ног", () => doShove(u), { enabled: !act && enemiesOf(u).some(e => dist(u, e) <= 1), why: act || "нет врага рядом" }));
    if (has(u, "grappled") || has(u, "trapped") || has(u, "restrained") || has(u, "pinned")) opts.push(simple("escape", "Вырваться", "grapple", "проверка Силы или Ловкости", () => doEscape(u), { enabled: !act, why: act }));
    if ([u, ...alliesOf(u)].some(a => has(a, "bleeding") && dist(u, a) <= 1 && !a.dead)) opts.push(simple("bandage", "Перевязать", "heart", "остановить кровотечение: Медицина Сл 10", () => doBandage(u), { enabled: !act, why: act }));
    if (B.S.objs.some(o => o.kind === "trap" && o.hidden)) opts.push(simple("search", "Осмотреться", "search", "найти скрытые ловушки", () => doSearch(u), { enabled: !act, why: act }));
    // предметы
    const c = u.hero, bon = timeWhy(u, "bonus");
    if (countGear(c, "potion") > 0) opts.push({ id: "potion", cat: "item", label: "Зелье лечения", ico: "potion", sub: `1к4 + 2 · осталось ${countGear(c, "potion")}`, time: "bonus", enabled: !bon, why: bon, run: () => usePotion(u) });
    if (countGear(c, "torch") > 0 && B.S.dark && !B.S.torch) opts.push({ id: "torch", cat: "item", label: "Зажечь факел", ico: "torch", sub: "освещает поле, убирает штрафы тьмы", time: "bonus", enabled: !bon, why: bon, run: () => lightTorch(u) });
    const off = c.equip.off ? itemOf(c.equip.off) : null, main = c.equip.main ? itemOf(c.equip.main) : null;
    if (off && off.id === "shield") opts.push({ id: "shieldbash", cat: "item", label: "Удар щитом", ico: "shield", sub: "толчок как доп. действие", time: "bonus", enabled: !bon && enemiesOf(u).some(e => dist(u, e) <= 1), why: bon || "нет врага рядом", run: () => doShove(u, "bonus") });
    if (main && main.id === "tower-shield") opts.push({ id: "cover", cat: "item", label: "Прикрыть союзника", ico: "shield", sub: "+2 КД союзнику рядом до вашего хода", time: "bonus", enabled: !bon && alliesOf(u).some(a => dist(u, a) <= 1 && !a.down), why: bon || "нет союзника рядом", run: () => coverAlly(u) });
    if (B.S.drops.some(w => w.hero === c.id && distCell(u, w.x, w.y) <= 1) && !u.t.objUsed) opts.push({ id: "pickup", cat: "item", label: "Подобрать оружие", ico: "attack", sub: "свободно, рядом лежит ваше оружие", time: "free", enabled: true, run: () => pickUpWeapon(u) });
    if (D.race[u.race] && D.race[u.race].heart) opts.push({ id: "heart", cat: "item", label: "Драконье сердце", ico: "heart", sub: "временные ОЗ = уровень + Тел., раз за отдых", time: "bonus", enabled: !bon && !(c.flags && c.flags.heart), why: bon || "уже использовано", run: () => dragonHeart(u) });
    // побег
    opts.push({ id: "flee", cat: "flee", label: "Побег", ico: "flee", sub: "добежать до нижнего края и покинуть поле", time: "action", enabled: speedOf(u) > 0, why: "скорость 0", run: () => runFlee(u) });
    return opts;
  }
  B.actionsFor = actionsFor;
})();
