/* Тактический бой: действия героя — оружие, атаки, навыки эссенций, движение, оборона, рывок, отход, помощь, захват, толчок,
   предметы, побег. Каждое действие — объект {id, cat, label, sub, time, enabled, why, run}. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const { rnd, d, roll, parseDice, fmtDice, sleep, amod, sg, clamp, pick, log, dist, distCell, footprint, alive, live, enemiesOf, alliesOf, occupant, has, addStatus, removeStatus,
    hookAll, hookSum, hookAny, speedOf, reachable, pathTo, setMp, setHp, heal, canAct, ABIL_RU, SKILL_RU } = B;
  const NOUI = new Proxy({}, { get: () => () => undefined });                        // без интерфейса (автобой, проверки) все вызовы окна — пустые
  const UI = () => B.UI || NOUI;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const TIME_RU = { action: "действие", bonus: "доп. действие", reaction: "реакция", free: "свободно", move: "движение" };
  B.TIME_RU = TIME_RU;

  /* ===== оружие героя ===== */
  function wprops(w) {
    const p = w.props || [], find = re => p.find(x => re.test(x)) || "";
    const vers = find(/^Универсальное/).match(/\((.+)\)/), thr = find(/^Метательное/).match(/\((\d+)\/(\d+) м\)/), amm = find(/^Боеприпасы/).match(/\((\d+)\/(\d+) м\)/);
    return { finesse: p.includes("Фехтовальное"), light: p.includes("Лёгкое"), heavy: p.includes("Тяжёлое"), two: p.includes("Двуручное"), versatile: vers ? vers[1] : null,
      thrown: thr ? [Math.floor(+thr[1] / 1.5), Math.floor(+thr[2] / 1.5)] : null, ammoR: amm ? [+amm[1], +amm[2]] : null };
  }
  const DT = D.DT_FROM_RU;
  // «Длинная рука» хобгоблина-загонщика: досягаемость кнута и цепа +1,5 м (такого оружия в каталоге пока нет, правило готово).
  const longArm = (u, w) => (u.pass.includes("hobgoblin-driver") && w && /whip|flail|кнут|цеп/i.test(`${w.id} ${w.name}`) ? 1 : 0);
  function atkFrom(u, w, mode, entry, slot) {
    const c = u.hero, f = wprops(w), eq = c.equip || {}, eb = essBonus(c);
    const ranged = w.group === "ranged", strM = amod(u.abil.str), dexM = amod(u.abil.dex);
    const ab = ranged ? "dex" : (mode === "thrown" ? (f.finesse && dexM > strM ? "dex" : "str") : (f.finesse && dexM > strM ? "dex" : "str"));
    const am = amod(u.abil[ab]);
    const dice = parseDice(f.versatile && !eq.off && mode === "hand" ? f.versatile : w.dmg);
    const atk = { id: mode + ":" + w.id, w, n: w.name, hit: am + u.pb + (w.bonus || 0), parts: [{ l: ABIL_RU[ab], v: am }, ...(u.pb ? [{ l: "Бонус мастерства", v: u.pb }] : []), ...(w.bonus ? [{ l: "Сталь", v: w.bonus }] : [])], dmg: { ...dice, b: dice.b + am + (w.bonus || 0) }, dt: DT[w.type] || "bludgeon", tags: [], mode, time: "action" };
    if (mode === "hand" && !ranged) { atk.kind = "melee"; atk.reach = w.id === "spear" || w.id === "staff" ? 2 : w.id === "pike" ? (w.artId ? 2 : 1) : 1 + longArm(u, w); if (w.id === "spear" && !u.pass.includes("goblin-spear")) atk.stretch = true; if (w.id === "staff") { atk.stretch = true; atk.stretchPen = -2; }
      if (w.id === "mace") { atk.acIgnore = 1; } atk.sub = atk.reach > 1 ? `досягаемость ${atk.reach * 1.5} м`.replace(".", ",") : "ближний бой"; }
    else if (mode === "hand" && ranged) {
      atk.kind = "ranged"; atk.ammo = "arrow";
      const r = f.ammoR || [24, 96]; if (w.id === "shortbow" && f.ammoR && f.ammoR[1] > f.ammoR[0]) r[1] = f.ammoR[0]; const fr = c.race === "fairy" ? 3 : 0; atk.range = [Math.floor((r[0] + eb.range + fr) / 1.5), Math.floor((r[1] + eb.range + fr) / 1.5)]; atk.sub = "дальний бой, стрела";
    } else if (mode === "thrown") {
      atk.kind = "ranged"; atk.thrown = true; atk.n = "Метнуть: " + w.name; atk.range = [f.thrown[0] + (u.throwBonus || 0), f.thrown[1] + (u.throwBonus || 0)];          // «Дальность метательного оружия +3 м»
      atk.sub = entry ? "бросок из рюкзака: оружие упадёт у цели" : "бросок: оружие упадёт у цели, рука будет пуста";
      if (slot === "off") { atk.slot = "off"; atk.id = "thrown-off:" + w.id; atk.time = "bonus"; atk.n = "Метнуть второй: " + w.name; atk.sub = "доп. действие: оружие из другой руки упадёт у цели"; }
      if (u.pass.includes("hobgoblin-thrower")) atk.dmgBonus = (atk.dmgBonus || 0) + 1;                                      // «Полная перевязь»: метательное оружие наносит +1 урона
      if (entry) { atk.bagEntry = entry; atk.id = "thrown:" + w.id + "@" + (u.hero.bag || []).indexOf(entry); atk.n = "Метнуть из рюкзака: " + w.name; }
    }
    else if (mode === "off") { atk.slot = "off"; atk.kind = "melee"; atk.reach = 1; atk.time = "bonus"; atk.offhand = true; atk.dmg.b = Math.min(0, am); atk.n = "Второй рукой: " + w.name; atk.sub = "доп. действие, без модификатора урона"; }
    if (mode === "hand" && w.id === "gloves" && eq.off && eq.off.id === "gloves") { atk.dmg.n = 2; atk.dmg.s = 4; atk.sub = "две перчатки: 2к4"; }          // обе руки в перчатках: удар кулаками 2к4
    if (mode === "hand" && w.id === "greatsword" && !ranged) { atk.spin = true; atk.sub = (atk.sub ? atk.sub + " · " : "") + "вращающийся удар"; }
    if (w.artId && B.artTweak) B.artTweak(u, w, mode, atk);          // артефактное оружие (battle-weap.js)
    return atk;
  }
  // Оружие в основной руке. Пока брошенное оружие лежит на земле (u.disarmed), рука пуста; сам предмет из снаряжения не убирается
  // (при перезагрузке посреди боя, ошибке или переходе на обычный экран ничего не теряется), насовсем он уходит только в итоге боя (battle-end.js).
  B.atkFrom = atkFrom;
  B.offOf = u => (u.hero && !u.disarmedOff && u.hero.equip && u.hero.equip.off && !u.hero.equip.off.broken ? itemOf(u.hero.equip.off) : null);
  B.mainOf = u => (u.hero && !u.disarmed && u.hero.equip && u.hero.equip.main && !u.hero.equip.main.broken ? itemOf(u.hero.equip.main) : null);
  /* Прочность (index.html, блок DUR): критический промах (1) портит оружие, а попадание монстра с натуральной 20 — броню; монстры будущего вызывают то же с любым n.
     Сломанное уходит в рюкзак (если места нет — остаётся в руке, но не работает: mainOf/offOf его не отдают). */
  function weaponEntryOf(u, atk) {
    const eq = u.hero.equip || {};
    if (atk.bagEntry) return { e: atk.bagEntry, slot: "bag" };
    if (atk.slot === "off" || atk.offhand) return eq.off ? { e: eq.off, slot: "off" } : null;
    const wid = atk.w && atk.w.id;
    return eq.main && eq.main.id === wid ? { e: eq.main, slot: "main" } : eq.off && eq.off.id === wid ? { e: eq.off, slot: "off" } : null;
  }
  B.wearWeapon = (u, atk, n = 1) => {
    if (!u.hero || !atk || !atk.w) return false;                          // кулак, факел и особые действия без оружия не портятся
    const t = weaponEntryOf(u, atk); if (!t) return false;
    const broke = durHit(u.hero, t.e, t.slot, n);
    if (broke) { log(`${u.name}: ${itemOf(t.e).name.replace(" (сломано)", "")} ломается!`, "bad"); const g = ui(); if (g) g.fxText(u, "сломано", "miss"); }
    return broke;
  };
  B.wearArmor = (u, n = 1) => {
    const c = u.hero; if (!c || !c.equip) return null;
    const cand = [];
    for (const k of ["body", "off", "main"]) { const e = c.equip[k]; if (!e || !isDurable(e) || e.broken) continue; const it = itemOf(e); if (k === "body" || (it && (it.group === "shield" || it.id === "tower-shield"))) cand.push(k); }
    if (!cand.length) return null;
    const k = pick(cand), e = c.equip[k], before = derived(totals(c), c).ac, broke = durHit(c, e, k, n);
    u.ac += derived(totals(c), c).ac - before;                            // доспех сломался — КД падает сразу
    if (broke) { log(`${u.name}: ${itemOf(e).name.replace(" (сломано)", "")} разбит!`, "bad"); const g = ui(); if (g) g.fxText(u, "сломано", "miss"); }
    return k;
  };
  // Метательное оружие в рюкзаке («Полная перевязь» хобгоблина-метателя): каждая запись, ещё не брошенная в этом бою.
  function bagThrowEntries(u) {
    const c = u.hero; if (!c || !u.pass.includes("hobgoblin-thrower")) return [];
    return (c.bag || []).filter(e => { if (e.t !== "w" || (u.bagThrown || []).includes(e)) return false; const w = itemOf(e); return w && w.kindOf === "weapon" && w.group === "melee" && wprops(w).thrown; });
  }
  // Все броски героя, по одному на каждую вещь: то, что в руке, и то, что в рюкзаке (для «Двойного броска»).
  B.throwEntries = function (u) {
    const out = [], main = B.mainOf(u);
    if (main && main.kindOf === "weapon" && wprops(main).thrown) out.push(atkFrom(u, main, "thrown"));
    for (const e of bagThrowEntries(u)) out.push(atkFrom(u, itemOf(e), "thrown", e));
    return out;
  };
  function heroAttacks(u) {
    const c = u.hero, eq = c.equip || {}, out = [];
    const main = B.mainOf(u), off = B.offOf(u);
    if (main && main.kindOf === "weapon" && main.kind !== "Боеприпасы") {
      out.push(atkFrom(u, main, "hand"));
      const f = wprops(main);
      if (f.thrown) out.push(atkFrom(u, main, "thrown"));
      if (main.artId && B.artAttacksOf) out.push(...B.artAttacksOf(u, main));          // «Порез теней» и другие особые атаки артефактов
    }
    const seenBag = new Map();                                                                  // в списке действий одинаковое оружие из рюкзака — одной строкой
    for (const e of bagThrowEntries(u)) { const k = e.id; if (seenBag.has(k)) { seenBag.get(k).count++; continue; } const a = atkFrom(u, itemOf(e), "thrown", e); a.count = 1; seenBag.set(k, a); out.push(a); }
    for (const a of seenBag.values()) if (a.count > 1) a.n += ` ×${a.count}`;
    if (off && off.kindOf === "weapon" && off.group === "melee" && wprops(off).thrown && u.t && u.t.attacked) out.push(atkFrom(u, off, "thrown", null, "off"));          // два топора: второй тоже можно метнуть (доп. действие)
    if (off && off.kindOf === "weapon" && off.group === "melee" && off.id !== "tower-shield" && main && main.group === "melee" && !wprops(main).two && !(main.id === "gloves" && off.id === "gloves")) {
      // Парные клинки (решение автора): отдельной атаки доп. действием нет — один парный удар: обе атаки по одной цели, каждая с уроном −40 %
      const hand = out.find(x => x.id === "hand:" + main.id);
      if (hand && !hand.thrown) { hand.twin = true; hand.twinOff = atkFrom(u, off, "off"); hand.twinOff.dmgMult = 0.6; hand.dmgMult = 0.6; hand.sub = (hand.sub ? hand.sub + " · " : "") + "парный удар: две атаки по цели, урон −40 %"; }
    }
    if (main && main.group === "ranged" && off && off.kindOf === "weapon" && off.group === "melee" && off.id !== "tower-shield") out.push(atkFrom(u, off, "hand"));          // лучник с ножом в другой руке: ближний бой этим оружием
    const strM = amod(u.abil.str);
    if (B.weapSpecials) out.push(...B.weapSpecials(u, main, off));
    out.push({ id: "fist", n: "Кулак", kind: "melee", reach: 1, hit: strM + u.pb, parts: [{ l: "Сила", v: strM }, ...(u.pb ? [{ l: "Бонус мастерства", v: u.pb }] : [])], dmg: { n: 0, s: 0, b: Math.max(1, 1 + strM) }, dt: "bludgeon", tags: [], time: "action", sub: "атака рукой: 1 + Сила" });
    if (u.hero && countGear(u.hero, "torch") > 0) out.push({ id: "torchhit", n: "Факел", kind: "melee", reach: 1, hit: strM + u.pb, parts: [{ l: "Сила", v: strM }, ...(u.pb ? [{ l: "Бонус мастерства", v: u.pb }] : [])], dmg: { n: 0, s: 0, b: 1 }, dt: "fire", tags: [], time: "action", sub: "1 урона огнём" });
    return out;
  }
  B.heroAttacks = heroAttacks; B.wprops = wprops; B.atkFrom = atkFrom;
  B.heroReach = u => { const m = B.mainOf(u); return m && m.id === "spear" && u.pass.includes("goblin-spear") ? 2 : 1 + longArm(u, m); };
  B.attacksOf = u => (u.hero ? heroAttacks(u) : u.atk.filter(a => !(a.once && u.used && u.used["atk:" + a.id])));          // a.once — особенность вида «раз за бой» (Мёртвая хватка)
  B.meleeAttackOf = u => {
    const list = B.attacksOf(u).filter(a => a.kind === "melee" && !a.offhand && !a.thrown && !a.special);
    return list.sort((a, b) => B.avgDice(b.dmg) - B.avgDice(a.dmg))[0] || null;
  };
  B.inAttackRange = (u, t, atk) => {
    const dd = dist(u, t);
    if (atk.kind === "melee") return dd <= (atk.reach || 1) && !(atk.stretch && dd > 1 && B.lineBlocked(u, t));          // копьё через клетку: между ними не должно быть полного укрытия
    return dd <= atk.range[1] && !B.lineBlocked(u, t);
  };
  B.attackTargets = (u, atk) => enemiesOf(u).filter(t => !has(t, "underground") && B.inAttackRange(u, t, atk));          // «Нырок под землю»: закопавшегося атаковать нельзя
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

  // tgt — цель атаки: туда падает брошенное оружие. o.free — атака входит в способность, отдельного времени не тратит («Двойной бросок»).
  // Колчан режиссёра (артефакт 7 класса): 10 обычных стрел, которые стреляют первыми; на каждый бой пополняются.
  B.dqLeft = u => { if (!u.hero) return 0; if (u.dq === undefined) u.dq = (u.hero.bag || []).some(e => e && e.id === "director-quiver") ? 10 : 0; return u.dq; };
  B.arrowsLeft = u => B.dqLeft(u) + countGear(u.hero, "arrow");
  function commitAttack(u, atk, tgt, o = {}) {
    if (!o.free) spendTime(u, atk.time || "action");
    if (atk.alsoBonus) spendTime(u, "bonus");                                                    // «Крушащий удар»: действие и доп. действие
    if (!atk.offhand && !(atk.thrown && atk.slot === "off")) u.t.attacked = true;
    if (atk.charged) u.charged = false;                                                          // заряд копья-громоотвода потрачен
    if (atk.ammo && u.hero) {
      const L = B.arrowLog(u.hero.id);
      if (B.dqLeft(u) > 0) { u.dq--; u.dqShot = true; L.dq = (L.dq || 0) + 1; }          // колчан режиссёра: стрелы не ломаются и возвращаются сами
      else { u.dqShot = false; takeGear(u.hero, "arrow", 1); L.shot++; }
    }
    if (atk.thrown && u.hero) {
      const c = u.hero, S = B.S, x = tgt ? tgt.x : u.x, y = tgt ? tgt.y : u.y;
      if (atk.bagEntry) {                                                                         // из рюкзака: запись остаётся в рюкзаке до итога боя, как и оружие из руки
        if (!(u.bagThrown ||= []).includes(atk.bagEntry)) {
          u.bagThrown.push(atk.bagEntry); S.drops.push({ kind: "weapon", hero: c.id, slot: "bag", item: atk.bagEntry, x, y });
          log(`${u.name} достаёт и бросает ${atk.w.name.toLowerCase()}: оно падает на землю.`);
          if (ui()) ui().refresh();
        }
      } else if (atk.slot === "off") {
        if (!u.disarmedOff && c.equip.off) {
          S.drops.push({ kind: "weapon", hero: c.id, slot: "off", item: c.equip.off, x, y });
          u.disarmedOff = true;
          log(`${u.name} бросает ${atk.w.name.toLowerCase()} из другой руки: оно падает на землю.`);
          if (ui()) ui().refresh();
        }
      } else if (!u.disarmed && c.equip.main) {
        S.drops.push({ kind: "weapon", hero: c.id, slot: "main", item: c.equip.main, x, y });
        u.disarmed = true;
        log(`${u.name} бросает ${atk.w.name}: рука пуста, оружие падает на землю.`);
        if (ui()) ui().refresh();
      }
    }
  }
  B.commitAttack = commitAttack;
  const SPIN_MAIN = 0.75, SPIN_SIDE = 0.5;          // решение автора: двуручный меч — вращающийся удар, цель получает чуть меньше, соседи ещё меньше
  // Подпись «чем идёт атака» для списка действий.
  function atkWith(atk) {
    if (atk.id === "fist") return "кулаком";
    if (atk.id === "torchhit") return "факелом";
    if (atk.w) return atk.thrown ? "броском: " + atk.w.name.toLowerCase() : atk.w.name.toLowerCase();
    return "голыми руками";
  }
  B.runAttackBase = (...a) => runAttack(...a);
  async function runAttack(u, atk) {
    const targets = B.attackTargets(u, atk), objs = B.objectTargets ? B.objectTargets(u, atk) : [];
    if (!targets.length && !objs.length) { UI().toast("Нет целей в досягаемости"); return false; }
    const tgt = await UI().pickUnit({ prompt: `${atk.n}: выберите цель${objs.length ? " (можно и объект)" : ""}`, units: targets.map(t => t.id), objs: objs.map(o => o.x + "," + o.y), cells: rangeCells(u, atk), kind: "attack", from: atk.kind === "melee" ? null : u });
    if (!tgt) return false;
    if (tgt.isObj) { const r0 = await B.attackObject(u, atk, tgt, { onCommit: () => commitAttack(u, atk, tgt) }); return !r0.cancelled; }
    const r = await B.doAttack(u, tgt, atk, { onCommit: () => commitAttack(u, atk, tgt), scale: atk.spin ? SPIN_MAIN : undefined, extra: atk.extra });
    if (atk.twin && atk.twinOff && !r.cancelled && alive(tgt) && !tgt.isObj) {          // вторая атака парного удара: та же цель, без траты времени и выбора
      const r2 = await B.doAttack(u, tgt, atk.twinOff, { noRedirect: true });
      if (!r2.cancelled && r2.hit === false && r.hit === false) log(`${u.name}: парный удар мимо.`);
    }
    if (!r.cancelled && atk.w && atk.w.artId && B.artAfterAttack) await B.artAfterAttack(u, atk, tgt, r);          // копьё-громоотвод застревает в цели
    if (atk.spin && !r.cancelled && r.hit && r.raw) {          // враги по бокам от цели (рядом и с героем, и с целью) получают ещё меньше
      const sides = enemiesOf(u).filter(e => e !== tgt && alive(e) && !has(e, "underground") && dist(u, e) <= 1 && dist(e, tgt) <= 1);
      for (const e of sides) {
        if (r.nat !== 20 && r.total < e.ac) { log(`${u.name}: вращающийся удар мимо ${e.name} (${r.total} против КД ${e.ac}).`, "miss"); continue; }
        const v = Math.max(1, Math.floor(r.raw * SPIN_SIDE)), ap = await B.applyDamage(u, e, [{ v, dt: atk.dt, label: atk.n }], { melee: true, src: u, weapon: true });
        log(`${u.name}: вращающийся удар задевает ${e.name} — ${ap.total} урона.`);
      }
    }
    return !r.cancelled;
  }

  /* ===== движение ===== */
  async function runMove(u) {
    if (u.t.move <= 0 && !has(u, "prone")) { UI().toast("Движения не осталось"); return false; }
    const standCost = has(u, "prone") ? B.standCost(u) : 0;
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
    const path = ch.path && ch.path.length ? ch.path : pathTo(map, ch.x, ch.y);          // ch.path — маршрут через путевые точки
    const r = await B.moveAlong(u, path);
    u.t.move = Math.max(0, u.t.move - r.spent); u.t.moved += r.spent;
    log(`${u.name} перемещается (${r.spent} кл.).`);
    // остановился на своём оружии — предлагаем подобрать (свободное действие)
    if (alive(u) && !u.down && dropsHere(u).length && await UI().confirm({ title: "Подобрать оружие?", text: `Вы стоите на клетке, где лежит: ${dropNames(dropsHere(u))}. Подобрать — свободное действие.`, yes: "Подобрать", no: "Оставить" })) await pickUpWeapon(u);
    return true;
  }
  async function runStand(u) {
    if (!has(u, "prone")) return false;
    const cost = B.standCost(u);
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
  B.passivePerceptionOf = bestPassive;
  function hideSpot(u, o = {}) {
    if (u.pass && u.pass.includes("whisperer")) {                                      // «Шёпот в ухо»: от обманутого можно спрятаться без укрытия — «скрыт» общий, поэтому обмануты должны быть все, кто видит
      const seers = enemiesOf(u).filter(e => canAct(e) && B.canSeeUnit(e, u));
      if (seers.length && seers.every(e => has(e, "fooled"))) return "от обманутого";
    }
    const t = B.tinfo(u.x, u.y);
    if (t && t.hide) return "в укрытии";
    if (B.inZone && B.inZone(u, "dust")) return "в белой пыли";                         // сильное заслонение, как туман
    if (o.near) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tn = (dx || dy) && B.tinfo(u.x + dx, u.y + dy); if (tn && tn.hide) return "рядом заросли"; }          // «Уход в тень»: кусты и туман рядом тоже годятся
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && B.obstacleAt(u.x + dx, u.y + dy)) return "у препятствия";
    if (B.inDark(u)) return "в тени";
    return null;
  }
  B.hideSpot = hideSpot;
  // Попытка спрятаться: Скрытность против лучшего пассивного Восприятия врагов. o: time — чем платит ('action' | 'bonus' | null),
  // anywhere — укрытие не нужно, seen — можно, даже если враги рядом и видят, cancel — до броска можно отказаться.
  B.hideRoll = async function (u, o = {}) {
    const spot = o.anywhere ? "без укрытия" : hideSpot(u, o);
    if (!spot) { if (o.toast !== false) UI().toast("Спрятаться можно у препятствия, в кустах, тумане или в тени"); return null; }
    const foes = enemiesOf(u).filter(e => canAct(e));
    if (!o.seen && foes.some(e => dist(e, u) <= 1)) { if (o.toast !== false) UI().toast("Враг рядом: спрятаться нельзя"); return null; }
    const dc = Math.max(8, ...foes.filter(e => !(e.tremor && dist(e, u) <= e.tremor) && !(e.blind && dist(e, u) <= e.blind)).map(bestPassive));
    const adv = [], dis = [];
    if (u.hero && u.hero.equip && itemOf(u.hero.equip.body) && itemOf(u.hero.equip.body).stealth) dis.push("тяжёлая броня");
    const main = B.mainOf(u); if (main && main.id === "tower-shield") dis.push("ростовой щит");
    if (u.race === "dwarf") dis.push("тяжёлая поступь");
    const mods = [];          // решение автора: одноручный щит — минус к Скрытности
    if (u.pass.includes("ash-wraith")) dis.push("светится");                                       // «Тлеющее тело»: тусклый свет мешает прятаться
    if (u.race === "darkfairy" && spot === "в тени") adv.push("тёмная фея в тени");
    const r = await B.doCheck(u, "stealth", { title: o.title || "Спрятаться", label: `${spot} · Сл ${dc}`, dc, adv, dis, mods, cancel: !!o.cancel, onCommit: () => { if (o.time) spendTime(u, o.time); }, tags: ["hide"] });
    if (!r) return null;
    if (r.ok) { addStatus(u, "hidden", { k: Infinity }); log(`${u.name} прячется (${r.total} против ${dc}).`); const g = ui(); if (g) g.fxText(u, "скрыт", "good"); }
    else { log(`${u.name} не удалось спрятаться (${r.total} против ${dc}).`); const g = ui(); if (g) g.fxText(u, "заметили", "bad"); }
    return r;
  };
  async function doHide(u) { return !!(await B.hideRoll(u, { time: "action", cancel: true })); }
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
    if (ch === "push") { const n = await B.push(t, u.x, u.y, 1); if (!n) { B.knock(t, u); log(`${t.name} сбит с ног (некуда отступать).`); } else log(`${u.name} отталкивает ${t.name}.`); }
    else { B.knock(t, u); log(`${u.name} сбивает ${t.name} с ног.`); UI().fxText(t, "сбит с ног", "bad"); }
    return true;
  }
  // Что держит героя: у каждой хватки, сети, ловушки, засыпания своя проверка — одним действием можно вырваться только из одной.
  function holdsOf(u) {
    const out = [], gr = has(u, "grappled"), tr = has(u, "trapped") || has(u, "pinned"), rs = has(u, "restrained"), bu = has(u, "buried");
    if (gr) out.push({ id: "grappled", label: "Хватка" + (gr.data.by && B.byId(gr.data.by) ? `: ${B.byId(gr.data.by).name}` : "") });
    if (rs) out.push({ id: "restrained", label: rs.data && rs.data.net ? (rs.data.web ? "Паутина" : "Сеть") : "Путы" });
    if (tr) out.push({ id: tr.id, label: tr.id === "pinned" ? "Пригвождён" : "Ловушка" });
    if (bu) out.push({ id: "buried", label: "Засыпан землёй" });
    return out;
  }
  B.holdsOf = holdsOf;
  async function doEscape(u) {
    const holds = holdsOf(u); if (!holds.length) return false;
    let hold = holds[0];
    if (holds.length > 1) { const ch = await UI().choose({ title: "Из чего вырваться?", options: holds.map(h => ({ id: h.id, label: h.label })) }); if (!ch) return false; hold = holds.find(h => h.id === ch) || hold; }
    const st = has(u, hold.id), gr = hold.id === "grappled" ? st : null, by = gr ? B.byId(gr.data.by) : null;
    let ok;
    if (hold.id === "buried") {                                                                   // «Похоронить заживо»: Атлетика против результата могильщика
      const r = await B.doCheck(u, "athletics", { title: "Выбраться из земли", label: `нужно больше ${st.data.dc - 1}`, dc: st.data.dc, cancel: true, onCommit: () => spendTime(u, "action") });
      if (!r) return false; ok = r.ok;
    } else if (gr && gr.data.dc) {                                                                // хватка эссенции: проверка против её Сл (Силы — если так сказано в тексте, иначе Силы или Ловкости)
      const r = await B.doCheck(u, gr.data.skill || bestDef(u), { title: "Вырваться из хватки", label: `Сл ${gr.data.dc}`, dc: gr.data.dc, cancel: true, onCommit: () => spendTime(u, "action"), adv: has(u, "wet") ? ["промок: скользкий"] : [], tags: ["grapple"] });
      if (!r) return false; ok = r.ok;
    } else if (gr && by && alive(by)) {
      const r = await B.contest(u, bestDef(u), by, "athletics", { title: "Вырваться из захвата", cancel: true, onCommit: () => spendTime(u, "action"), advA: has(u, "wet") ? ["промок: скользкий"] : [], tagsA: ["grapple"] });
      if (!r) return false; ok = r.win;
    } else {
      const dc = (st.data && st.data.dc) || 12;
      const r = await B.doCheck(u, "athletics", { title: "Вырваться", label: `Сл ${dc}`, dc, cancel: true, onCommit: () => spendTime(u, "action") });
      if (!r) return false; ok = r.ok;
    }
    if (ok) { removeStatus(u, hold.id); log(`${u.name} вырывается (${hold.label.toLowerCase()}).`, "good"); UI().fxText(u, "свободен", "good"); }
    else UI().fxText(u, "не вышло", "bad");
    return true;
  }
  // Союзник рядом откапывает засыпанного — действием, без проверки.
  async function doDigOut(u) {
    const near = alliesOf(u).filter(a => dist(u, a) <= 1 && has(a, "buried"));
    if (!near.length) { UI().toast("Откапывать некого"); return false; }
    const t = near.length === 1 ? near[0] : await UI().pickUnit({ prompt: "Откопать: кого?", units: near.map(a => a.id), cells: [], kind: "help" });
    if (!t) return false;
    spendTime(u, "action"); removeStatus(t, "buried"); log(`${u.name} откапывает ${t.name}.`, "good"); UI().fxText(t, "откопан", "good"); return true;
  }
  // Сеть и паутина: рубящий урон (для паутины ещё огонь) снимает путы. У сети «5 ОЗ»; урон копится, пока она не порвётся.
  function netVictims(u) { return [u, ...alliesOf(u).filter(a => dist(u, a) <= 1)].filter(a => { const r = has(a, "restrained"); return r && r.data && r.data.net; }); }
  function netAttack(u, net) { return B.attacksOf(u).filter(a => a.kind === "melee" && !a.offhand && !a.thrown && (a.dt === "slash" || (net.web && a.dt === "fire")) && (a.id !== "fist")).sort((a, b) => B.avgDice(b.dmg) - B.avgDice(a.dmg))[0] || null; }
  async function doCutNet(u) {
    const vs = netVictims(u).filter(a => netAttack(u, has(a, "restrained").data.net));
    if (!vs.length) { UI().toast("Нужно рубящее оружие (для паутины — ещё огонь)"); return false; }
    const t = vs.length === 1 ? vs[0] : await UI().pickUnit({ prompt: "Разрезать путы: кого?", units: vs.map(a => a.id), cells: [], kind: "help", includeSelf: true });
    if (!t) return false;
    const st = has(t, "restrained"), net = st.data.net, a = netAttack(u, net);
    const ses = B.session(u, { kind: "damage", u, title: net.web ? "Разрубить паутину" : "Разрезать сеть", sub: `${u.name}: ${a.n} по ${net.web ? "паутине" : "сети"} (осталось ${net.hp})` });
    const r = await ses.dice({ label: `Урон ${a.dmg.n ? fmtDice(a.dmg) : a.dmg.b}`, n: a.dmg.n, s: a.dmg.s, bonus: a.dmg.b, dt: a.dt, cancel: true, reroll: B.rerollOptions(u, "damage", { melee: true }) });
    if (!r) { ses.close(); return false; }
    spendTime(u, "action");
    const dmg = r.sum + a.dmg.b; net.hp -= dmg;
    await ses.finish({ text: net.hp <= 0 ? `${dmg} урона — ${net.web ? "паутина" : "сеть"} порвана` : `${dmg} урона, осталось ${net.hp}`, anim: B.animKind(a), dmg, tgt: t });
    if (net.hp <= 0) { removeStatus(t, "restrained"); log(`${u.name} ${net.web ? "разрубает паутину" : "режет сеть"}: ${t.name} свободен.`, "good"); UI().fxText(t, "свободен", "good"); }
    else log(`${u.name} режет путы ${t.name}: осталось ${net.hp}.`);
    return true;
  }
  // Перевязка: Медицина Сл 10 останавливает кровотечение у себя или у союзника рядом (текст «Кровопускания»).
  async function doBandage(u) {
    const cands = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1 && !a.dead)].filter(a => has(a, "bleeding"));
    if (!cands.length) { UI().toast("Некого перевязывать: нет кровотечения"); return false; }
    const t = cands.length === 1 ? cands[0] : await UI().pickUnit({ prompt: "Перевязать: кого?", units: cands.map(a => a.id), cells: [], kind: "heal" });
    if (!t) return false;
    const trained = u.hero && typeof eduKnows === "function" && eduKnows(u.hero, "aid") && countGear(u.hero, "firstaid") > 0;          // курс первой помощи + набор: перевязка без броска
    if (trained) { takeGear(u.hero, "firstaid", 1); spendTime(u, "action"); removeStatus(t, "bleeding"); log(`${u.name} умело перевязывает ${t.name}: кровотечение остановлено.`, "good"); UI().fxText(t, "перевязан", "good"); return true; }
    const r = await B.doCheck(u, "medicine", { title: "Перевязать", label: `${t.name} · Сл 10`, dc: 10, cancel: true, onCommit: () => spendTime(u, "action") });
    if (!r) return false;
    if (r.ok) { removeStatus(t, "bleeding"); log(`${u.name} перевязывает ${t.name}: кровотечение остановлено.`, "good"); UI().fxText(t, "перевязан", "good"); }
    else { log(`${u.name} не справляется с перевязкой.`); UI().fxText(t, "не вышло", "bad"); }
    return true;
  }
  // Набор первой помощи (черновик): действие; останавливает кровотечение, лечит 1к4 ОЗ и поднимает павшего. Курс Академии: +2 и Мудрость к лечению.
  async function doFirstAid(u) {
    const c = u.hero, pool = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1 && !a.dead)].filter(a => a.hp < a.maxHp || a.down || has(a, "bleeding"));
    if (!pool.length) { UI().toast("Некому помогать"); return false; }
    const t = pool.length === 1 ? pool[0] : await UI().pickUnit({ prompt: "Первая помощь: кому?", units: pool.map(a => a.id), cells: [], kind: "heal", includeSelf: true });
    if (!t) return false;
    const trained = typeof eduKnows === "function" && eduKnows(c, "aid"), bonus = trained ? 2 + Math.max(0, amod(u.abil.wis)) : 0;
    const ses = B.session(u, { kind: "heal", u, title: "Первая помощь", sub: `${u.name} → ${t.name}` });
    const r = await ses.dice({ label: `Лечение 1к4${bonus ? " + " + bonus : ""}${trained ? " (курс)" : ""}`, n: 1, s: 4, bonus, heal: true, cancel: true, reroll: B.rerollOptions(u, "heal") });
    if (!r) { ses.close(); return false; }
    takeGear(c, "firstaid", 1); spendTime(u, "action");
    removeStatus(t, "bleeding");
    const got = heal(t, Math.max(1, r.sum + bonus), u);
    await ses.finish({ text: got ? `Восстановлено ${got} ОЗ` : "Кровотечение остановлено", heal: true, tgt: t, dmg: got });
    return true;
  }
  async function doSearch(u) {
    const traps = B.S.objs.filter(t => t.kind === "trap" && t.hidden);
    spendTime(u, "action");
    const r = await B.doCheck(u, "perception", { title: "Осмотреться", label: "ловушки и затаившиеся враги", dc: 12, tags: ["trapsearch"] });
    let found = 0;
    if (r && r.ok) { traps.forEach(t => { if (dist(u, { x: t.x, y: t.y, size: 1 }) <= 4) { t.hidden = false; found++; } }); if (found) log(`${u.name} замечает ловушки.`, "good"); }
    for (const m of B.mons()) { if (B.isUnseen(m) && alive(m) && dist(u, m) <= 6 && r && r.total >= (has(m, "hidden").data.dc || 0)) { B.revealHidden(m, "осмотр"); found++; } }
    if (found) UI().refresh(); else log(`${u.name} ничего не замечает.`);
    return true;
  }

  /* ===== предметы ===== */
  const POTIONS = { potion: { n: 1, s: 4, b: 2, name: "Слабое зелье лечения" }, "potion-good": { n: 2, s: 4, b: 4, name: "Зелье лечения" } };
  async function usePotion(u, pid = "potion") {
    const c = u.hero, chal = pid === "chalice", P = POTIONS[chal ? "potion-good" : pid];
    const near = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1 && !a.dead)];
    const t = await UI().pickUnit({ prompt: "Зелье лечения: кому?", units: near.map(a => a.id), cells: [], kind: "heal", includeSelf: true });
    if (!t) return false;
    const ses = B.session(u, { kind: "heal", u, title: P.name, sub: `${u.name} → ${t.name}` });
    const r = await ses.dice({ label: `Лечение ${P.n}к${P.s} + ${P.b}`, n: P.n, s: P.s, bonus: P.b, heal: true, cancel: true, reroll: B.rerollOptions(u, "heal") });
    if (!r) { ses.close(); return false; }
    if (chal) chaliceEmpty(c); else takeGear(c, pid, 1);
    spendTime(u, "bonus");
    const n = r.sum + P.b; const got = heal(t, n, u);
    await ses.finish({ text: got ? `Восстановлено ${got} ОЗ` : "Лечение не подействовало", heal: true, tgt: t, dmg: got });
    return true;
  }
  // Факел в бою (решение автора): зажечь — полное действие; один заряд (факел из рюкзака) горит 3 раунда; потушить можно (бонусным действием), остаток раундов сохраняется.
  const TORCH_ROUNDS = 3;
  async function lightTorch(u) {
    const S = B.S;
    if (S.torch) { ui() && ui().toast("Свет уже есть"); return false; }
    if (!(S.torchLeft > 0) && !takeGear(u.hero, "torch", 1)) return false;
    if (!(S.torchLeft > 0)) S.torchLeft = TORCH_ROUNDS;
    spendTime(u, "action"); S.torch = true; S.torchBy = u.id;
    log(`${u.name} зажигает факел: тьма отступает (раундов света: ${S.torchLeft}).`, "good"); if (ui()) { ui().fxText(u, "свет", "good"); ui().refresh(); } return true;
  }
  async function douseTorch(u) {
    const S = B.S; if (!S.torch || S.torchFixed) return false;
    spendTime(u, "bonus"); S.torch = false;
    log(`${u.name} тушит факел (осталось раундов света: ${S.torchLeft}).`); if (ui()) { ui().fxText(u, "тьма", "bad"); ui().refresh(); } return true;
  }
  B.lightTorch = lightTorch;
  const prevRoundT = B.onRound;
  B.onRound = function (round) {
    if (prevRoundT) prevRoundT.apply(this, arguments);
    const S = B.S; if (!S || !S.torch || S.torchFixed || typeof S.torchLeft !== "number") return;
    if (--S.torchLeft <= 0) { S.torch = false; S.torchLeft = 0; log("Факел догорел: тьма возвращается.", "bad"); if (ui()) { ui().banner("Факел догорел"); ui().refresh(); } }
  };
  async function coverAlly(u) {
    const near = alliesOf(u).filter(a => dist(u, a) <= 1 && !a.down);
    if (!near.length) { UI().toast("Прикрыть можно союзника рядом"); return false; }
    const t = await UI().pickUnit({ prompt: "Прикрыть щитом: кого?", units: near.map(a => a.id), cells: [], kind: "help" });
    if (!t) return false;
    spendTime(u, "bonus"); addStatus(t, "guarded", { k: Infinity, data: { endAtStartOf: u.id } });
    log(`${u.name} прикрывает ${t.name} ростовым щитом (+2 КД).`, "good"); UI().fxText(t, "+2 КД", "good"); return true;
  }
  // Своё брошенное оружие, которое лежит в клетке героя: подобрать можно только стоя на нём (свободное действие).
  function dropsHere(u) {
    if (!u.hero) return [];
    const cells = footprint(u);
    return B.S.drops.filter(w => w.kind === "weapon" && w.hero === u.hero.id && (!w.holder || w.holder === u.id) && cells.some(([x, y]) => x === w.x && y === w.y))
      .sort((a, b) => (a.slot === "main" ? 0 : 1) - (b.slot === "main" ? 0 : 1));
  }
  B.dropsHere = dropsHere;
  const dropNames = list => list.map(w => ((typeof itemOf === "function" && itemOf(w.item)) || { name: "оружие" }).name.toLowerCase()).join(", ");
  B.dropNames = dropNames;
  // Подбирает всё своё оружие в этой клетке: из руки — обратно в руку, из рюкзака — обратно в рюкзак. Свободное действие, тратить нечего.
  async function pickUpWeapon(u) {
    const S = B.S, here = dropsHere(u);
    if (!here.length) return false;
    for (const w of here) {
      S.drops.splice(S.drops.indexOf(w), 1);
      if (w.slot === "bag") u.bagThrown = (u.bagThrown || []).filter(e => e !== w.item); else if (w.slot === "off") u.disarmedOff = false; else u.disarmed = false;          // брошенное из рюкзака возвращается в рюкзак
    }
    log(`${u.name} подбирает ${dropNames(here)}.`, "good");
    const g = ui(); if (g) { g.fxText(u, here.some(w => w.slot !== "bag") ? "оружие в руке" : "подобрано", "good"); g.refresh(); }
    return true;
  }
  B.pickUpWeapon = pickUpWeapon;
  async function dragonHeart(u) {
    const c = u.hero; c.flags = c.flags || {};
    if (c.flags.heart) return false;
    spendTime(u, "bonus"); c.flags.heart = true;
    const t = Math.max(1, u.level + amod(u.abil.con)); if (t > (u.temp || 0)) { u.temp = t; u.tempSrc = "heart"; }
    log(`${u.name}: драконье сердце — ${t} временных ОЗ.`, "good"); UI().fxText(u, `+${t} врем. ОЗ`, "good"); return true;
  }

  /* ===== побег ===== */
  B.fleeDc = () => fleeDc();
  const fleeDc = () => { const fl = (B.S && (B.S.floor || (B.S.ev && B.S.ev.floor))) || 1; return B.S && B.S.ev && B.S.ev.void ? 10 : fl >= 3 ? 8 : fl >= 2 ? 7 : 5; };          // решение автора 28.10: 3 этаж — 8, Ведьмин лес — 10; прежнее: 5 на 1-м, 7 на 2-м          // решение автора: Сл побега 5 на 1-м этаже, 7 на 2-м
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
    if (u.y === B.H - 1) {
      const ck = await B.doCheck(u, "acrobatics", { title: "Побег", label: `уйти от преследования · Сл ${fleeDc()}`, dc: fleeDc() });          // решение автора: низкая Сл Ловкости
      if (!ck || !ck.ok) { log(`${u.name} не смог оторваться от врагов.`, "flee"); return true; }
      u.escaped = true; B.dropOwnedStatuses(u); log(`${u.name} покидает поле боя.`, "flee"); const g = ui(); if (g) g.fxEscape(u);
    }
    return true;
  }

  // Страховка для способностей монстров: цели должны входить в то, что способность сама назвала допустимым (A.tgt: units), и их не больше max.
  function fitPicks(A, u, picks) {
    let spec; try { spec = A.tgt(u); } catch (e) { return picks; }
    if (!spec) return picks;
    const idOf = x => (x && typeof x === "object" ? x.id : x), ok = spec.units && spec.units.length ? new Set(spec.units) : null;
    const out = { ...picks };
    if (spec.type === "unit" && out.unit && ok && !ok.has(idOf(out.unit))) return null;
    if (spec.type === "units" && out.units) {
      out.units = out.units.filter(x => !ok || ok.has(idOf(x)));
      if (spec.max) out.units = out.units.slice(0, spec.max);
      if (!out.units.length && (spec.min == null || spec.min > 0)) return null;
    }
    return out;
  }

  /* ===== список действий героя ===== */
  function skillOptions(u) {
    const out = [];
    for (const id of u.ess) {
      const A = B.A && B.A[id]; if (!A) continue;
      const eb = ESSENCES[id].active, st = A.state ? A.state(u) : {}, lvl = typeof essActiveLevel === "function" && u.side === "hero" ? essActiveLevel(id) : 2, name = lvl ? (st.label || eb.name) : "?? (навык эссенции)", mana = st.mana != null ? st.mana : eb.mana, cdTxt = D.essCd[id] >= 99 ? " · раз за бой" : D.essCd[id] ? " · КД " + D.essCd[id] : "";
      let why = null;
      if (A.time === "reaction") {
        out.push({ id: "skill:" + id, cat: "skill", label: name, ico: "skills", sub: lvl ? `${eb.mana} маны · реакция${D.essCd[id] ? " · КД " + D.essCd[id] : ""}` : "неизвестный навык", desc: lvl === 2 ? eb.text : "??", time: "reaction", enabled: false,
          why: u.cd[id] > 0 ? `перезарядка: ${u.cd[id]} р.` : u.mp < eb.mana ? `нужно ${eb.mana} маны` : "сработает сама: игра спросит, когда можно", ess: id, run: async () => false });
        continue;
      }
      why = timeWhy(u, A.time) || (u.mp < mana ? `нужно ${mana} маны` : (u.cd[id] > 0 ? (st.why || (D.essCd[id] >= 99 ? "уже использовано в этом бою" : `перезарядка: ${u.cd[id]} р.`)) : null));
      if (!why && A.can) { const c = A.can(u); if (c !== true && c) why = c; }
      out.push({ id: "skill:" + id, cat: "skill", label: name, ico: "skills", sub: lvl ? `${mana} маны · ${TIME_RU[A.time]}${lvl === 2 ? cdTxt : ""}${lvl === 2 && st.note ? " · " + st.note : ""}` : "неизвестный навык", desc: lvl === 2 ? eb.text : lvl === 1 ? "Остальные эффекты: ??" : "??", time: A.time, enabled: !why, why, ess: id,
        run: async () => { const spec = A.tgt ? A.tgt(u) : { type: "self" }; const picks = await UI().pickFor(u, spec, A); if (!picks) return false; return B.useActive(u, id, picks); } });
    }
    // доп. возможности пассивок
    for (const id of u.pass) { const P = B.P && B.P[id]; if (P && P.actions) out.push(...P.actions(u)); }
    return out;
  }
  // Расход ресурсов и запуск активки. Возвращает true, если способность сработала.
  // A.state(u) — состояние способности: label (название сейчас), mana (сколько стоит сейчас), cd (перезарядка после применения), note, why.
  // Так «Самодельная бомба» просит ману только за первую половину, а «Проклятие предков» перезаряжается лишь после конца проклятия.
  async function useActive(u, id, picks, o = {}) {
    const A = B.A[id], eb = ESSENCES[id].active; let committed = false;
    if (u.side === "mon" && picks && A.tgt) picks = fitPicks(A, u, picks);          // монстр бьёт только допустимые цели в зоне: одна цель — одна, область — только внутри
    if (picks === null) return false;
    if (u.side === "mon") { const g = ui(); if (g && g.fxAbility) { g.fxAbility(u, (A.state ? (A.state(u).label || eb.name) : eb.name), [...(picks && picks.units ? picks.units : []), picks && picks.unit].filter(x => x && typeof x === "object")); if (!B.cfg.fast) await B.sleep(420); } }          // небольшой эффект: монстр колдует
    const st = A.state ? A.state(u) : {};
    const mana = st.mana != null ? st.mana : eb.mana, cd = st.cd != null ? st.cd : (D.essCd[id] || 1);
    const commit = () => {
      if (committed) return; committed = true;
      if (u.side === "hero") { setMp(u, u.mp - mana); B.setCd(u, id, cd); spendTime(u, A.time); }
      else { u.used[id] = true; spendTime(u, A.time); }
      const hv = has(u, "hidden"); if (hv && hv.data.invis && id !== "grey-shade") { removeStatus(u, "hidden"); log(`${u.name}: невидимость пропала.`); }          // «Растворение»: способность снимает невидимость
    };
    if (u.side === "hero" && u.mp < mana) return false;
    const r = await A.run(u, picks, { commit, o });
    if (r === false && !committed) return false;
    if (!committed) commit();
    log(`${u.name}: ${st.label || eb.name}.`, "skill");
    if (u.side === "hero" && typeof journal === "function") { (journal().essUsed ||= {})[id] = true; }          // после первого применения видны название, мана и урон
    if (B.flushQueue) await B.flushQueue();
    return true;
  }
  B.useActive = useActive;

  // Призванный волк или двойник героя: атака, перемещение, подъём — играет игрок (решение автора).
  function summonActions(u) {
    const opts = [], t = u.t;
    for (const atk of u.atk) {
      const why = timeWhy(u, atk.time || "action") || (B.attackTargets(u, atk).length ? null : "нет целей рядом");
      opts.push({ id: "atk:" + atk.id, cat: "attack", label: atk.n, ico: "attack", sub: `${atk.kind === "melee" ? "до " + (atk.reach || 1) + " кл." : "дальний"} · ${B.fmtDice(atk.dmg)} ${D.DT[atk.dt]}${atk.dmgMult ? " · вполсилы" : ""}`, time: atk.time || "action", enabled: !why, why, atk, run: () => runAttack(u, atk) });
    }
    opts.push({ id: "move", cat: "move", label: "Перемещение", ico: "move", sub: `осталось ${t.move} кл.`, time: "move", enabled: t.move > 0 && speedOf(u) > 0, why: "нет движения", run: () => runMove(u) });
    if (has(u, "prone")) opts.push({ id: "stand", cat: "move", label: "Встать", ico: "move", sub: `стоит ${B.standCost(u)} кл.`, time: "move", enabled: t.move >= B.standCost(u) && t.move > 0, why: "нет движения", run: () => runStand(u) });
    opts.push(simple("dash", "Рывок", "dash", "ещё столько же клеток движения", () => doDash(u), { enabled: !timeWhy(u, "action") && speedOf(u) > 0, why: timeWhy(u, "action") || "скорость 0" }));
    return opts;
  }
  function actionsFor(u) {
    if (u.summon) return summonActions(u);
    const opts = [];
    const t = u.t;
    // атаки
    for (const atk of heroAttacks(u)) {
      const why = timeWhy(u, atk.time) || (atk.alsoBonus && timeWhy(u, "bonus") ? "нужно ещё и доп. действие" : null) || (atk.needTarget ? atk.needTarget(u) : (atk.ammo && B.arrowsLeft(u) < 1 ? "нет стрел" : ((B.attackTargets(u, atk).length || (B.objectTargets && B.objectTargets(u, atk).length)) ? null : "нет целей рядом")));
      opts.push({ id: "atk:" + atk.id, cat: "attack", label: atk.n, ico: atk.ammo ? "bow" : atk.thrown ? "throwing" : atk.id === "fist" ? "fist" : atk.id === "torchhit" ? "torch" : "attack",
        sub: `${atkWith(atk)} · ${atk.kind === "melee" ? "до " + (atk.reach || 1) + " кл." : atk.range[0] >= B.W - 1 ? "дальний · всё поле" : `дальний · ${atk.range[0]} кл., до ${Math.min(atk.range[1], 12)} с помехой`} · ${atk.dmg.n ? fmtDice(atk.dmg) : atk.dmg.b} ${D.DT[atk.dt]}${atk.penalty ? " · " + atk.penaltyLabel : ""}${atk.spin ? " · вращающийся удар" : ""}${atk.ammo ? " · стрел: " + B.arrowsLeft(u) : ""}`,
        time: atk.time, enabled: !why, why, atk, run: () => (atk.special && B.runSpecial ? B.runSpecial(u, atk) : runAttack(u, atk)) });
    }
    if (B.weapActions) opts.push(...B.weapActions(u));
    // навыки эссенций и особенности пассивок
    opts.push(...skillOptions(u));
    // движение
    opts.push({ id: "move", cat: "move", label: "Перемещение", ico: "move", sub: `осталось ${t.move} кл.`, time: "move", enabled: t.move > 0 && speedOf(u) > 0, why: speedOf(u) === 0 ? "скорость 0" : "нет движения", run: () => runMove(u) });
    if (has(u, "prone")) opts.push({ id: "stand", cat: "move", label: "Встать", ico: "move", sub: `стоит ${B.standCost(u)} кл.${B.standCost(u) > Math.ceil(speedOf(u) / 2) ? " (глубокая яма: всё движение)" : ""}`, time: "move", enabled: t.move >= B.standCost(u) && t.move > 0, why: "нет движения", run: () => runStand(u) });
    // оборона и прочие действия
    opts.push({ id: "defend", cat: "defend", label: "Оборона", ico: "defend", sub: "атаки по вам с помехой, преимущество на спасброски Ловкости", time: "action", enabled: timeOK(u, "action"), why: timeWhy(u, "action"), run: () => doDefend(u) });
    const act = timeWhy(u, "action");
    opts.push(simple("dash", "Рывок", "dash", "ещё столько же клеток движения", () => doDash(u), { enabled: !act && speedOf(u) > 0, why: act || "скорость 0" }));
    opts.push(simple("disengage", "Отход", "disengage", "движение не провоцирует атак по возможности", () => doDisengage(u), { enabled: !act, why: act }));
    opts.push(simple("help", "Помощь", "help", "следующая атака по врагу рядом — с преимуществом", () => doHelp(u), { enabled: !act && enemiesOf(u).some(e => dist(u, e) <= 1), why: act || "нет врага рядом" }));
    opts.push(simple("hide", "Спрятаться", "hide", "Скрытность против Восприятия врагов; нужно укрытие", () => doHide(u), { enabled: !act && !!hideSpot(u), why: act || "нет укрытия рядом" }));
    opts.push(simple("grapple", "Захват", "grapple", "Атлетика против Атлетики или Акробатики", () => doGrapple(u), { enabled: !act && enemiesOf(u).some(e => dist(u, e) <= 1), why: act || "нет врага рядом" }));
    opts.push(simple("shove", "Толчок", "shove", "оттолкнуть или сбить с ног", () => doShove(u), { enabled: !act && enemiesOf(u).some(e => dist(u, e) <= 1), why: act || "нет врага рядом" }));
    if (has(u, "burning")) opts.push(simple("douse-fire", "Потушить огонь", "move", "действие: перестать гореть (1к4 огнём в начале хода)", async () => { spendTime(u, "action"); removeStatus(u, "burning"); log(`${u.name} тушит огонь.`, "good"); return true; }, { enabled: !act, why: act }));
    if (has(u, "mired")) opts.push(simple("unmire", "Выбраться из топи", "move", "потратить действие: снова можно двигаться", async () => { spendTime(u, "action"); removeStatus(u, "mired"); u.bogStill = 0; u.t.move = speedOf(u); log(`${u.name} выбирается из топи.`, "good"); return true; }, { enabled: !act, why: act }));
    if (has(u, "grappled") || has(u, "trapped") || has(u, "restrained") || has(u, "pinned") || has(u, "buried")) opts.push(simple("escape", "Вырваться", "grapple", has(u, "buried") ? "Атлетика против результата могильщика" : "проверка Силы или Ловкости", () => doEscape(u), { enabled: !act, why: act }));
    if (netVictims(u).length) opts.push(simple("cutnet", "Разрезать путы", "attack", "рубящее оружие снимает сеть и паутину (5 урона)", () => doCutNet(u), { enabled: !act && netVictims(u).some(a => netAttack(u, has(a, "restrained").data.net)), why: act || "нужно рубящее оружие (для паутины — ещё огонь)" }));
    if (alliesOf(u).some(a => dist(u, a) <= 1 && has(a, "buried"))) opts.push(simple("dig", "Откопать союзника", "help", "союзник рядом на свободе", () => doDigOut(u), { enabled: !act, why: act }));
    if ([u, ...alliesOf(u)].some(a => has(a, "bleeding") && dist(u, a) <= 1 && !a.dead)) opts.push(simple("bandage", "Перевязать", "heart", "остановить кровотечение: Медицина Сл 10", () => doBandage(u), { enabled: !act, why: act }));
    if (B.S.objs.some(o => o.kind === "trap" && o.hidden) || B.mons().some(m => B.isUnseen(m) && alive(m))) opts.push(simple("search", "Осмотреться", "search", "найти скрытые ловушки и затаившихся врагов", () => doSearch(u), { enabled: !act, why: act }));
    // предметы
    if (countGear(u.hero, "firstaid") > 0) { const hurtNear = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1 && !a.dead)].some(a => a.hp < a.maxHp || a.down || has(a, "bleeding"));
      opts.push(simple("firstaid", "Первая помощь", "heart", `набор: ${countGear(u.hero, "firstaid")} · кровотечение, 1к4 ОЗ, поднять павшего${typeof eduKnows === "function" && eduKnows(u.hero, "aid") ? " · обучен" : ""}`, () => doFirstAid(u), { enabled: !act && hurtNear, why: act || "некому помогать", useless: !hurtNear })); }
    if (B.envActions) opts.push(...B.envActions(u));                                                // находки, сундуки
    const c = u.hero, bon = timeWhy(u, "bonus"), act0 = timeWhy(u, "action");
    for (const pid of ["potion-good", "potion"]) if (countGear(c, pid) > 0) {
      const P = POTIONS[pid], hurt = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1 && !a.dead)].some(a => a.hp < a.maxHp);       // без раненых рядом зелье бесполезно: автоконец хода его не ждёт
      opts.push({ id: pid, cat: "item", label: pid === "potion" ? "Слабое зелье лечения" : "Зелье лечения", ico: "potion", sub: `${P.n}к${P.s} + ${P.b} · осталось ${countGear(c, pid)}`, time: "bonus", enabled: !bon, why: bon, useless: !hurt, run: () => usePotion(u, pid) });
    }
    if (chalicesOf(c, "potion").length) { const P = POTIONS["potion-good"], hurt = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1 && !a.dead)].some(a => a.hp < a.maxHp);
      opts.push({ id: "chalice", cat: "item", label: "Чаша здоровья", ico: "potion", sub: `${P.n}к${P.s} + ${P.b} · после питья чаша пуста`, time: "bonus", enabled: !bon, why: bon, useless: !hurt, run: () => usePotion(u, "chalice") }); }
    if (chalicesOf(c, "empty").length) { const wet = (() => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = B.tinfo(u.x + dx, u.y + dy); if (t && t.wet) return true; } return false; })();
      opts.push({ id: "chalice-fill", cat: "item", label: "Набрать воды в чашу", ico: "potion", sub: "рядом лужа или пруд: через 2 дня вода станет зельем", time: "bonus", enabled: !bon && wet, why: bon || "нет воды рядом", useless: true, run: async () => { chaliceFill(chalicesOf(c, "empty")[0]); spendTime(u, "bonus"); log(`${u.name} набирает воды в чашу здоровья.`, "good"); return true; } }); }
    if ((countGear(c, "torch") > 0 || B.S.torchLeft > 0) && B.S.dark && !B.S.torch) opts.push({ id: "torch", cat: "item", label: "Зажечь факел", ico: "torch", sub: B.S.torchLeft > 0 ? `полное действие · догорит через ${B.S.torchLeft} р.` : "полное действие · один факел светит 3 раунда", time: "action", enabled: !act0, why: act0, run: () => lightTorch(u) });
    if (B.S.dark && B.S.torch && !B.S.torchFixed) opts.push({ id: "douse", cat: "item", label: "Потушить факел", ico: "torch", sub: `доп. действие · остаток света ${B.S.torchLeft} р. сохранится`, time: "bonus", enabled: !bon, why: bon, run: () => douseTorch(u) });
    const off = B.offOf(u), main = B.mainOf(u);
    if (off && off.id === "shield") opts.push({ id: "shieldbash", cat: "attack", label: "Удар щитом", ico: "shield", sub: "щитом · толчок, доп. действие", time: "bonus", enabled: !bon && enemiesOf(u).some(e => dist(u, e) <= 1), why: bon || "нет врага рядом", run: () => doShove(u, "bonus") });
    if (main && main.id === "tower-shield") opts.push({ id: "cover", cat: "other", label: "Прикрыть союзника", ico: "shield", sub: "+2 КД союзнику рядом до вашего хода", time: "bonus", enabled: !bon && alliesOf(u).some(a => dist(u, a) <= 1 && !a.down), why: bon || "нет союзника рядом", run: () => coverAlly(u) });
    const here = dropsHere(u);
    if (here.length) opts.push({ id: "pickup", cat: "item", label: `Подобрать: ${dropNames(here)}`, ico: "throwing", sub: "свободное действие — вы стоите на нём", time: "free", enabled: true, run: () => pickUpWeapon(u), pop: true });
    if (D.race[u.race] && D.race[u.race].heart) opts.push({ id: "heart", cat: "item", label: "Драконье сердце", ico: "heart", sub: "временные ОЗ = уровень + Тел., раз за отдых", time: "bonus", enabled: !bon && !(c.flags && c.flags.heart), why: bon || "уже использовано", run: () => dragonHeart(u) });
    // побег
    opts.push({ id: "flee", cat: "flee", label: "Побег", ico: "flee", sub: "добежать до нижнего края и покинуть поле", time: "action", enabled: speedOf(u) > 0, why: "скорость 0", run: () => runFlee(u) });
    if (has(u, "underground")) for (const o of opts) { o.enabled = false; o.why = "под землёй до начала хода"; }          // «Нырок под землю»: до следующего хода ничего не делает
    return opts;
  }
  B.actionsFor = actionsFor;

  // Ход героя закончен, когда не осталось ни действия, ни доп. действия, которое ещё можно потратить (battle-menu.js завершает его сам).
  // Одно лишь перемещение ход не продлевает; исключение — Рывок и Отход: после них двигаться и есть смысл хода.
  function canMoveAnywhere(u) {
    if (!(u.t.move > 0) || speedOf(u) <= 0) return false;
    return [...B.pathMap(u, u.t.move, {}).values()].some(v => (v.x !== u.x || v.y !== u.y) && B.canStand(u, v.x, v.y));
  }
  B.turnSpent = u => {
    if (!u || !alive(u) || u.down || u.escaped || has(u, "underground")) return true;
    const t = u.t || {};
    if (t.action > 0) return false;
    if (t.bonus > 0 && actionsFor(u).some(o => o.enabled && o.time === "bonus" && !o.useless)) return false;
    if ((t.dash || t.disengage) && canMoveAnywhere(u)) return false;
    return true;
  };
})();
