/* Тактический бой: оружие второй итерации (кровотечение кинжалов, оглушение молота, выпад рапиры, слабое место копья, парирование меча,
   крушащий удар секиры, прицел длинного лука, перчатки). Пассивки — B.P.weap (у каждого героя), особые атаки — B.weapSpecials/B.runSpecial.
   Числа — черновик, drafts.md → «Оружие — вторая итерация». */
(function () {
  const B = window.Battle, D = B.D;
  const { roll, amod, has, addStatus, removeStatus, log, dist, enemiesOf, alive, canAct } = B;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const UI = () => B.UI;
  const toast = t => { const g = ui(); if (g && g.toast) g.toast(t); };
  const fx = (u, t, k) => { const g = ui(); if (g) g.fxText(u, t, k); };
  const P = B.P;

  // Кому кровотечение не страшно (нет крови): нежить, конструкты, элементали.
  const noBlood = t => !!(t.mon && (t.mon.noBlood || t.mon.spectral || /нежить|конструкт|элементаль|механизм/i.test(`${t.mon.type || ""} ${t.mon.group || ""} ${t.mon.size || ""}`) || ["undead", "elemental"].includes(t.mon.ph) || ["undead", "stone"].includes(t.mon.zone)));          // решение автора 27.10: нежить, элементали, конструкты и механизмы — без крови и без отравления (все монстры 1 и 2 этажа зон нежити и камня)
  B.noBlood = noBlood;

  /* ===== особые атаки героя ===== */
  function lungeCells(u, t) {
    if (t.down || !alive(t)) return null;
    const dx = t.x - u.x, dy = t.y - u.y, d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d < 2 || d > 3 || !(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return null;
    const sx = Math.sign(dx), sy = Math.sign(dy), cells = [];
    for (let i = 1; i < d; i++) cells.push([u.x + sx * i, u.y + sy * i]);
    const x0 = u.x, y0 = u.y; let ok = true;
    for (const [x, y] of cells) if (!B.canStand(u, x, y)) { ok = false; break; }
    if (ok) { const l = cells[cells.length - 1]; u.x = l[0]; u.y = l[1]; ok = dist(u, t) <= 1; u.x = x0; u.y = y0; }
    return ok ? cells : null;
  }
  B.weapSpecials = (u, main) => {
    const out = [];
    if (!main || main.kindOf !== "weapon" || u.disarmed) return out;
    const base = B.atkFrom(u, main, "hand");
    if (main.id === "spear") out.push({ ...base, id: "weak:spear", n: "Копьё: слабое место", special: "weak", sub: "проверка Внимательности: больше урона" });
    if (main.id === "rapier") out.push({ ...base, id: "lunge:rapier", n: "Выпад", special: "lunge", reach: 3, sub: "рывок 1–2 кл. по прямой и укол +1к4 · потом −1 КД",
      needTarget: v => (enemiesOf(v).some(t => lungeCells(v, t)) ? null : "нужна цель на прямой в 2–3 клетках") });
    if (main.id === "greataxe") out.push({ ...base, id: "crush:greataxe", n: "Крушащий удар", special: "crush", acIgnore: 2, acIgnoreLabel: "крушит", alsoBonus: true, sub: "действие и доп. действие: игнорирует 2 КД цели; ломает щит (−2 или −3 КД), без щита портит броню (−1 КД, до 2 раз)" });
    return out;
  };
  async function pick(u, atk, prompt) {
    const targets = B.attackTargets(u, atk);
    if (!targets.length) { toast("Нет целей в досягаемости"); return null; }
    return UI().pickUnit({ prompt, units: targets.map(t => t.id), cells: B.rangeCells(u, atk), kind: "attack" });
  }
  async function weak(u, atk) {
    const tgt = await pick(u, atk, "Слабое место: выберите цель");
    if (!tgt) return false;
    if (tgt.isObj) return B.runAttackBase(u, atk);
    const ck = await B.doCheck(u, "perception", { title: "Слабое место", label: `ищете уязвимость: ${tgt.name}`, cancel: true });
    if (!ck) return false;
    const t = ck.total, o = { onCommit: () => B.commitAttack(u, atk, tgt) };
    let msg;
    if (t >= 20) { o.extra = [{ n: 1, s: 6, b: 0, dt: atk.dt, label: "Слабое место", critDouble: true }]; msg = "+1к6"; }
    else if (t >= 15) { o.extra = [{ n: 1, s: 4, b: 0, dt: atk.dt, label: "Слабое место", critDouble: true }]; msg = "+1к4"; }
    else if (t >= 10) { o.dmgPlus = 1; msg = "+1 урона"; }
    else if (t < 8) { o.dis = ["замешкался, ища слабое место"]; msg = "помеха на атаку"; }
    else msg = "без бонуса";
    log(`${u.name} ищет слабое место у ${tgt.name}: ${t} — ${msg}.`);
    fx(u, "слабое место: " + msg, t >= 10 ? "good" : "");
    const r = await B.doAttack(u, tgt, atk, o);
    return !r.cancelled;
  }
  async function lunge(u, atk) {
    const cands = enemiesOf(u).filter(t => lungeCells(u, t));
    if (!cands.length) { toast("Нужна цель на прямой в 2–3 клетках"); return false; }
    const tgt = await UI().pickUnit({ prompt: "Выпад: цель на прямой линии, 2–3 клетки", units: cands.map(t => t.id), cells: [], kind: "attack" });
    if (!tgt) return false;
    const path = lungeCells(u, tgt); if (!path) return false;
    log(`${u.name} делает выпад на ${tgt.name}.`);
    const r0 = await B.moveAlong(u, path, { noProvoke: true });
    if (r0.interrupted || !alive(u) || u.down) return true;
    atk = { ...atk, kind: "melee", reach: 1 };
    const r = await B.doAttack(u, tgt, atk, { cancelable: false, onCommit: () => B.commitAttack(u, atk, tgt), extra: [{ n: 1, s: 4, b: 0, dt: atk.dt, label: "Выпад", critDouble: true }] });
    addStatus(u, "lunged", { k: 1, when: "start" });
    fx(u, "после выпада −1 КД", "");
    return true;
  }
  B.runSpecial = async (u, atk) => {
    if (atk.special === "weak") return weak(u, atk);
    if (atk.special === "lunge") return lunge(u, atk);
    return B.runAttackBase(u, atk);                                                          // «Крушащий удар»: обычный бросок, эффекты — в afterAttack
  };

  /* ===== действия: прицел длинного лука, блок кулаками ===== */
  B.weapActions = u => {
    const out = [], c = u.hero; if (!c) return out;
    const main = B.mainOf(u), off = B.offOf(u), act = B.timeOK(u, "action");
    if (main && main.id === "longbow") out.push({ id: "aim", cat: "attack", label: "Прицел", ico: "bow", sub: "действие: следующий выстрел +1к6 урона", time: "action",
      enabled: act && !has(u, "aimed") && B.arrowsLeft(u) > 0, why: !act ? "действие потрачено" : has(u, "aimed") ? "уже прицелились" : "нет стрел",
      run: async () => { B.spendTime(u, "action"); addStatus(u, "aimed", { k: 2, when: "end" }); log(`${u.name} целится: следующий выстрел +1к6.`, "good"); fx(u, "прицел", "good"); return true; } });
    if (((main && main.id === "gloves") || (off && off.id === "gloves"))) out.push({ id: "fistblock", cat: "defend", label: "Блок кулаками", ico: "defend", sub: "до начала хода: урон ближних атак −1к4 + Ловкость", time: "action",
      enabled: act && !has(u, "fistblock"), why: !act ? "действие потрачено" : "уже в блоке",
      run: async () => { B.spendTime(u, "action"); addStatus(u, "fistblock", { k: 1, when: "start" }); log(`${u.name} встаёт в блок кулаками.`, "good"); fx(u, "блок кулаками", "good"); return true; } });
    // «Смена оружия»: основное действие — поменять оружие в руке на то, что лежит в рюкзаке.
    const cands = (c.bag || []).map((e, i) => ({ e, i, it: e && e.t === "w" ? itemOf(e) : null })).filter(x => x.it && x.it.kindOf === "weapon" && x.it.group !== "shield" && x.it.kind !== "Боеприпасы");
    if (cands.length) out.push({ id: "swapweapon", cat: "other", label: "Смена оружия", ico: "attack", sub: "основное действие: взять в руку оружие из рюкзака, прежнее уйдёт в рюкзак", time: "action",
      enabled: act && !u.disarmed, why: !act ? "действие потрачено" : "рука пуста: сначала подберите оружие",
      run: async () => {
        const g = UI(); if (!g || !g.choose) return false;
        const pick = await g.choose({ title: "Какое оружие взять?", options: cands.map(x => ({ id: String(x.i), label: `${x.it.name}${x.it.steel ? " (сталь)" : ""} · ${x.it.dmg || ""}` })).concat([{ id: "__no", label: "Отмена" }]) });
        if (pick == null || pick === "__no") return false;
        const idx = +pick, entry = c.bag[idx]; if (!entry) return false;
        const newIt = itemOf(entry), oldMain = c.equip.main, offIt = c.equip.off && itemOf(c.equip.off);
        const needOff = isTwoHandedWeapon(newIt) && newIt.group !== "ranged" && !(c.giantGrip && c.race === "barbarian") && offIt;          // двуручное: левая рука освобождается
        const bagFree = (c.bag.length - 1) + (oldMain ? 1 : 0) + (needOff ? 1 : 0) <= bagSize(c);
        if (!bagFree) { toast("В рюкзаке нет места для прежнего оружия"); return false; }
        const t0 = totals(c), d0 = derived(t0, c);
        c.bag.splice(idx, 1);
        c.equip.main = { t: entry.t, id: entry.id, ...(entry.steel ? { steel: true } : {}) };
        if (oldMain) addToBag(c, { ...oldMain, qty: 1 });
        if (needOff) { addToBag(c, { ...c.equip.off, qty: 1 }); delete c.equip.off; }
        const t1 = totals(c), d1 = derived(t1, c);          // КД, Ловкость и скорость зависят от снаряжения
        u.ac += d1.ac - d0.ac; u.abil.dex += t1.dex.total - t0.dex.total; u.speedC += B.cellsOfM(d1.speed) - B.cellsOfM(d0.speed);
        B.spendTime(u, "action"); log(`${u.name} меняет оружие: теперь в руке ${newIt.name}.`, "good"); fx(u, "смена оружия", "good"); saveChar(); return true;
      } });
    const fl = (c.bag || []).some(e => e && e.id === "calm-flute"), used = !!(c.flags && c.flags.calmFlute);
    if (fl) out.push({ id: "calm-flute", cat: "item", label: "Флейта успокоения", ico: "potion", sub: "действие: всему отряду +2 клетки скорости до конца боя, раз в день", time: "action",
      enabled: act && !used, why: !act ? "действие потрачено" : "уже играли сегодня",
      run: async () => {
        B.spendTime(u, "action"); (c.flags ||= {}).calmFlute = true;
        for (const h of B.heroes()) { h.speedC += 2; if (h.t) h.t.move += 2; }
        log(`${u.name} играет на флейте успокоения: отряд быстрее на 2 клетки.`, "good"); fx(u, "отряд быстрее", "good"); return true;
      } });
    return out;
  };

  /* ===== пассивки оружия ===== */
  P.weap = {
    speedBonus(u) { const m = B.mainOf(u), o = B.offOf(u); return m && o && (m.props || []).includes("Можно со щитом") && o.id === "shield" ? -1 : 0; },          // пика со щитом: −1 клетка скорости
    acBonus(u) { const m = u.hero ? B.mainOf(u) : null; return m && m.artId === "moon-sword" && u.moon === 3 ? 1 : 0; },          // фаза «ущерб»: +1 КД
    attackMods(u, ctx) {
      const w = ctx.atk && ctx.atk.w; if (!w) return;
      if (w.artId === "moon-sword" && u.moon === 0 && (ctx.hiddenData || has(ctx.tgt, "blinded"))) { ctx.extra.push({ n: 1, s: 6, b: 0, dt: ctx.atk.dt, label: "Новолуние", critDouble: true }); ctx.notes.push("новолуние +1к6"); }
      if (w.id === "longbow" && ctx.atk.kind === "ranged" && has(u, "aimed")) { ctx.extra.push({ n: 1, s: 6, b: 0, dt: ctx.atk.dt, label: "Прицел", critDouble: true }); ctx.consume.push([u, "aimed"]); ctx.notes.push("прицел +1к6"); }
      if (w.id === "axe" && B.isShieldBearer && B.isShieldBearer(ctx.tgt)) { ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; ctx.notes.push("топор против щита +2"); }
    },
    async afterAttack(u, ctx) {
      const { res, tgt, atk } = ctx, w = atk && atk.w;
      if (w && (w.id === "greataxe" || w.id === "greatsword") && u.hero && res && res.nat <= 5 && !has(u, "overswung")) {          // «Тяжёлый замах»: на кубике 1–5 герой повисает на оружии — на следующем ходу нет доп. действия
        addStatus(u, "overswung", { k: 2, when: "end" }); log(`${u.name}: тяжёлый замах (выпало ${res.nat}) — на следующем ходу нет доп. действия.`, "bad"); fx(u, "тяжёлый замах", "bad");
      }
      if (!w || !res.hit || !tgt || tgt.isObj || !(tgt.alive || tgt.down) || tgt.side === u.side) return;
      if (w.id === "dagger" && ctx.melee && alive(tgt) && !noBlood(tgt)) {
        const dc = 10 + Math.max(0, amod(u.abil.dex));
        const r = await B.doSave(tgt, "con", dc, { label: `кровотечение (${u.name})` });
        if (!r.ok) { addStatus(tgt, "bleeding", { k: 3, when: "end", src: u.id }); log(`${tgt.name} истекает кровью (3 хода).`, "skill"); fx(tgt, "кровотечение", "bad"); }
      }
      if (w.id === "warhammer" && ctx.melee && alive(tgt)) {
        const dc = 10 + Math.max(0, amod(u.abil.str)) - (tgt.size >= 2 ? 2 : 0);
        const r = res.crit ? { ok: false } : await B.doSave(tgt, "con", dc, { label: `оглушение (${u.name})` });
        if (!r.ok) { addStatus(tgt, "stunned", { k: 1, when: "end", src: u.id }); log(`${tgt.name} оглушён: −2 КД, нет доп. действия и реакции до конца его следующего хода.`, "skill"); fx(tgt, "оглушён", "bad"); }
      }
      if (atk.special === "crush" && alive(tgt)) {
        if (tgt.shield) { const d = tgt.towerShield ? 3 : 2; tgt.shield = false; tgt.ac = Math.max(5, tgt.ac - d); log(`${u.name} раскалывает щит ${tgt.name}: КД −${d}.`, "skill"); fx(tgt, "щит разбит", "bad"); }
        else if ((tgt.crushed || 0) < 2) { tgt.crushed = (tgt.crushed || 0) + 1; tgt.ac = Math.max(5, tgt.ac - 1); log(`${u.name} портит броню ${tgt.name}: КД −1.`, "skill"); fx(tgt, "броня повреждена", "bad"); }
      }
    },
    // «Парирование» меча: враг промахнулся по герою в ближнем бою более чем на 4 — ослабленный ответ (реакция).
    onMissedBy(u, ctx) {
      const { att, res } = ctx; if (!ctx.melee || res.parried || res.swapped || !u.hero) return;
      const main = B.mainOf(u); if (!main || !(main.id === "sword" || (main.artId === "moon-sword" && u.moon === 3))) return;
      if (!(u.t && u.t.react > 0) || !canAct(u) || att.side === u.side || dist(u, att) > 1) return;
      if (!(ctx.ac - res.total > 4)) return;
      res.post.push(async () => {
        if (!alive(att) || !canAct(u) || !(u.t.react > 0)) return;
        u.t.react = 0;
        const dm = B.atkFrom(u, main, "hand").dmg, sum = roll(dm.n, dm.s).total, v = Math.max(1, Math.floor(sum / 2));
        const ap = await B.applyDamage(u, att, [{ v, dt: "slash", label: "Парирование" }], { melee: true, src: u, pure: true });
        log(`${u.name} парирует и бьёт в ответ: ${att.name} получает ${ap.total} урона.`, "skill"); fx(u, "парирование", "good");
      });
    },
  };

  /* ===== расы (черновик, drafts.md → «Расы») ===== */
  const ELEM_DT = ["fire", "cold", "lightning", "acid", "thunder"];
  const isElemental = t => !!(t && t.mon && (t.mon.ph === "elemental" || /Элементаль/i.test(t.mon.type || "")));
  // Спектральные существа (призраки и подобные; решение автора 27.10): обычным (физическим) уроном не ранятся — только элементальным и прочим нефизическим; драконы бьют их обычными атаками.
  const PHYS = ["pierce", "slash", "bludgeon"];
  B.isSpectral = t => !!(t && t.mon && (t.mon.spectral || (t.cb && t.cb.spectral)));
  B.isElem = t => isElemental(t) || !!(t && t.mon && (t.mon.zone === "stone" || /Элементаль/i.test(t.mon.size || "")));
  B.physBlocked = (src, tgt, dt, atk) => B.isSpectral(tgt) && PHYS.includes(dt) && !(src && src.race === "dragon") && !(atk && atk.w && atk.w.salt);          // обычные атаки дракона и оружие в серебряной соли ранят спектральных
  P["race:beastkin"] = Object.assign(P["race:beastkin"] || {}, {
    checkMods(u, ctx) { if (ctx.skill === "perception" && B.inDark(u) && !u.dv) ctx.dis.push("звериная натура: темно"); },
  });
  P["race:fairy"] = {
    attackMods(u, ctx) {
      const a = ctx.atk, w = a && a.w;
      if (a && a.kind === "ranged" && !a.thrown) ctx.mods.push({ l: "Меткий глаз", v: 1 });
      if (w && ctx.melee && !a.thrown) { const f = B.wprops(w); if (f.heavy || f.two) ctx.dis.push("хрупкие руки: тяжёлое оружие"); }
    },
  };
  P["race:dragon"] = {
    dmgFlat(u, c) { return ELEM_DT.includes(c.dt) && c.v > 0 ? -1 : 0; },
    attackMods(u, ctx) { if (isElemental(ctx.tgt)) ctx.mods.push({ l: "Родовая вражда", v: -1 }); },
    // Решение автора 27.10: обычные атаки драконов поражают спектральных существ (B.physBlocked), а в бою со спектральными противниками и элементалями у дракона врождённая регенерация маны.
    turnStart(u) {
      if (!u.hero || !B.enemiesOf(u).some(e => B.alive(e) && (B.isSpectral(e) || B.isElem(e)))) return;
      const before = u.mp; B.setMp(u, u.mp + 1);
      if (u.mp > before) { log(`${u.name}: драконья кровь — +1 мана.`, "good"); fx(u, "+1 мана", "good"); }
    },
  };
  P["race:darkfairy"] = {
    attackMods(u, ctx) { if (B.brightAt && B.brightAt(u)) ctx.mods.push({ l: "Боится света", v: -1 }); },
  };
  /* ===== артефактное оружие (решения автора 29.10) =====
     Копьё-громоотвод (6): заряд за ману, бросок застревает в цели и бьёт молнией в начале следующего хода владельца, копьё можно воткнуть в клетку.
     Магнитные перчатки (7): «Притянуть». Парные тени (7): «Порез теней» — атака кинжалом на расстоянии до 3 клеток. Числа — черновик (drafts.md). */
  const CHARGE_MANA = 2, STRIKE = [2, 8], PULL_DC = 12, PULL_LARGE = -3, PULL_METAL = 3, PULL_MAX = 3;
  B.SKILL_ABIL.conCheck = "con"; B.SKILL_RU.conCheck = "Телосложение";
  const lodged = () => (B.S.lodged ||= []);
  const wetAt = (x, y) => { const t = B.tinfo && B.tinfo(x, y); return !!(t && t.wet); };
  const ownerOf = rec => B.byId(rec.hero);
  const MOON = [{ n: "новолуние", d: "+1к6, если вас не видят" }, { n: "серп", d: "после убийства шаг на 2 клетки без провокации" }, { n: "полнолуние", d: "удары радиантные, +1к4" }, { n: "ущерб", d: "+1 КД, ответ по промахнувшемуся" }];
  B.wearsRing = u => !!(u.hero && ["ring1", "ring2"].some(s => u.hero.equip && u.hero.equip[s] && u.hero.equip[s].id === "brotherhood-ring"));
  B.artTweak = (u, w, mode, atk) => {
    if (w.artId === "moon-sword" && mode === "hand") {
      if (u.moon === 2) { atk.dt = "radiant"; atk.extra = [{ n: 1, s: 4, dt: "radiant", label: "Полнолуние" }]; }
      if (u.moon != null) atk.sub = (atk.sub ? atk.sub + " · " : "") + "фаза: " + MOON[u.moon].n;
    }
    if (w.artId === "thunder-spear" && u.charged && mode !== "off") {
      atk.dt = "lightning"; atk.extra = [{ n: 1, s: 6, dt: "lightning", label: "Заряд молнии" }]; atk.charged = true;
      atk.sub = (atk.sub ? atk.sub + " · " : "") + "заряжено молнией";
    }
  };
  B.artAttacksOf = (u, main) => {
    if (main.artId !== "shadow-daggers" || u.disarmed) return [];
    const a = B.atkFrom(u, main, "hand");
    Object.assign(a, { id: "shadowcut:" + main.id, n: "Порез теней", kind: "melee", reach: 3, stretch: false, sub: "полноценная атака кинжалом на расстоянии до 4,5 м" });
    return [a];
  };
  // Бросок попал: копьё не падает под ноги цели, а остаётся в ней.
  B.artAfterAttack = async (u, atk, tgt, r) => {
    if (atk.thrown && atk.w.artId === "storm-axe" && !atk.bagEntry) return stormAxe(u, atk, tgt, r);
    if (!(atk.thrown && atk.w.artId === "thunder-spear") || atk.slot === "off" || !r.hit || tgt.isObj || !alive(tgt)) return;
    const S = B.S, i = S.drops.map(d => d.kind === "weapon" && d.hero === u.hero.id && d.slot === "main" && d.item && d.item.art === "thunder-spear").lastIndexOf(true);
    if (i < 0) return;
    const drop = S.drops.splice(i, 1)[0];
    lodged().push({ kind: "unit", tgt: tgt.id, hero: u.id, turn: u.turnsTaken, drop });
    log(`Копьё застряло в ${tgt.name}: в начале следующего хода ${u.name} в него ударит молния.`, "skill"); fx(tgt, "копьё застряло", "bad");
    const g = ui(); if (g) g.refresh();
  };
  function release(rec, pos) {
    const S = B.S, t = rec.kind === "unit" ? B.byId(rec.tgt) : null, p = pos || (t ? { x: t.x, y: t.y } : { x: rec.x, y: rec.y });
    rec.drop.x = p.x; rec.drop.y = p.y; S.drops.push(rec.drop);
    S.lodged = lodged().filter(r => r !== rec);
  }
  B.artRelease = S => { for (const rec of [...(S.lodged || [])]) { if (rec.kind === "cell" && S.cells[rec.y] && S.cells[rec.y][rec.x] === "spearstuck") S.cells[rec.y][rec.x] = ""; release(rec); } };
  B.artSpearDown = (x, y, src) => {
    const rec = lodged().find(r => r.kind === "cell" && r.x === x && r.y === y); if (!rec) return;
    release(rec, { x, y }); log(`Копьё сбито${src ? " (" + src.name + ")" : ""} и лежит на земле.`);
    const g = ui(); if (g) g.refresh();
  };
  function conductCells(x, y) {          // вода проводит молнию: все связные мокрые клетки от места удара
    const seen = new Set(), q = [[x, y]]; if (!wetAt(x, y)) return seen; seen.add(x + "," + y);
    while (q.length) { const [cx, cy] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, k = nx + "," + ny; if (!seen.has(k) && B.inB(nx, ny) && wetAt(nx, ny)) { seen.add(k); q.push([nx, ny]); } } }
    return seen;
  }
  async function spearStrike(rec, owner) {
    const t = rec.kind === "unit" ? B.byId(rec.tgt) : null;
    if (rec.kind === "unit" && (!t || !alive(t))) { release(rec); log("Цель копья-громоотвода погибла раньше: копьё падает на землю."); return; }
    const c = t ? { x: t.x, y: t.y } : { x: rec.x, y: rec.y }, v = roll(STRIKE[0], STRIKE[1]).total, weak = Math.max(1, Math.floor(v / 2)), hit = new Set();
    log(`Молния бьёт из копья-громоотвода${t ? " в " + t.name : ""}!`, "skill");
    const g = ui(); if (g) { g.banner("Молния!"); g.fxText({ x: c.x, y: c.y, size: 1, id: "bolt" }, "молния", "dmg"); }
    if (t) { await B.applyDamage(owner, t, [{ v, dt: "lightning", label: "Молния громоотвода" }], { src: owner }); hit.add(t.id); }
    const wet = conductCells(c.x, c.y);
    for (const o of B.live()) {
      if (hit.has(o.id) || !alive(o) || o.down) continue;
      const near = B.distCell(o, c.x, c.y) <= 1, onWater = wet.size && footprintOf(o).some(([x, y]) => wet.has(x + "," + y));
      if (!near && !onWater) continue;
      hit.add(o.id); await B.applyDamage(owner, o, [{ v: weak, dt: "lightning", label: onWater && !near ? "Молния по воде" : "Молния рядом" }], { src: owner });
    }
    rec.struck = true;
    if (rec.kind === "unit") release(rec, c);
  }
  const footprintOf = o => (B.footprint ? B.footprint(o) : [[o.x, o.y]]);
  B.artTurnStart = async u => {
    const S = B.S; if (!S) return;
    const mw = u.hero ? B.mainOf(u) : null;
    if (mw && mw.artId === "moon-sword" && !u.disarmed) { u.moon = ((u.moon == null ? -1 : u.moon) + 1) % 4; log(`${u.name}: фаза луны — ${MOON[u.moon].n}.`, "skill"); fx(u, MOON[u.moon].n, "good"); }
    if (!S.lodged || !S.lodged.length) return;
    for (const rec of [...S.lodged]) if (rec.hero === u.id && !rec.struck && rec.turn < u.turnsTaken) await spearStrike(rec, u);
  };

  // Топор бури: брошенный возвращается в руку; попав, стягивает врагов в 2 клетках (Телосложение, тяжёлым проще), падение даёт 1к4.
  async function stormAxe(u, atk, tgt, r) {
    const S = B.S, slot = atk.slot === "off" ? "off" : "main";
    const i = S.drops.map(d => d.kind === "weapon" && d.hero === u.hero.id && d.slot === slot && d.item && d.item.art === "storm-axe").lastIndexOf(true);
    if (i >= 0) { S.drops.splice(i, 1); if (slot === "off") u.disarmedOff = false; else u.disarmed = false; log(`${atk.w.name} возвращается в руку ${u.name}.`, "good"); const g = ui(); if (g) g.refresh(); }
    if (!r.hit || tgt.isObj || !alive(tgt)) return;
    const dcBase = 8 + (u.pb || 0) + Math.max(0, amod(u.abil.str));
    for (const e of enemiesOf(u)) {
      if (e === tgt || !alive(e) || e.down) continue;
      const d = B.dist(e, tgt); if (d <= 1 || d > 2) continue;
      const dc = dcBase - (e.size >= 2 ? 2 : 0) - (e.size >= 3 ? 2 : 0);
      const sv = await B.doSave(e, "con", dc, { label: `стяжка топора (${u.name})`, from: u });
      if (sv.ok) continue;
      const cell = (B.freeCellsNear(tgt, 1, e) || [])[0]; if (!cell) continue;
      const from = [e.x, e.y]; e.x = cell[0]; e.y = cell[1]; const g = ui(); if (g) await g.animMove(e, from, cell);
      log(`${e.name} притянут к ${tgt.name}.`, "skill"); fx(e, "стянут", "bad");
      if (B.terrainEnter) await B.terrainEnter(e);
      if (alive(e)) await B.applyDamage(u, e, [{ v: roll(1, 4).total, dt: "bludgeon", label: "Столкновение" }], { src: u });
    }
  }
  // Булава «Метеор»: раз за бой — прыжок и удар сверху; урон по области вполовину, цель может упасть, клетка — кратер; 1–2 на кубике — отбрасывает героя.
  const METEOR = { dmg: [2, 6], back: [1, 8] };
  async function meteor(u, atk) {
    if (u.meteorUsed) { toast("Метеорный удар уже использован в этом бою"); return false; }
    const reach = enemiesOf(u).filter(t => alive(t) && !t.down && B.dist(u, t) <= 3);
    if (!reach.length) { toast("Нет цели в 3 клетках"); return false; }
    const tgt = await UI().pickUnit({ prompt: "Метеорный удар: выберите цель (прыжок до 2 клеток)", units: reach.map(t => t.id), cells: [], kind: "attack" }); if (!tgt) return false;
    const tmp = { size: u.size, side: u.side, id: u.id };
    let land = null; if (B.dist(u, tgt) <= 1) land = [u.x, u.y]; else {
      const near = (B.freeCellsNear(tgt, 1, tmp) || []).filter(c => Math.max(Math.abs(c[0] - u.x), Math.abs(c[1] - u.y)) <= 2).sort((a, b) => Math.max(Math.abs(a[0] - u.x), Math.abs(a[1] - u.y)) - Math.max(Math.abs(b[0] - u.x), Math.abs(b[1] - u.y)));
      land = near[0] || null;
    }
    if (!land) { toast("Некуда приземлиться"); return false; }
    u.meteorUsed = true;
    if (land[0] !== u.x || land[1] !== u.y) { const from = [u.x, u.y]; u.x = land[0]; u.y = land[1]; const g = ui(); if (g) await g.animMove(u, from, land); log(`${u.name} взмывает и падает на ${tgt.name}.`, "skill"); }
    const a2 = { ...atk, kind: "melee", reach: 1, dmg: { ...atk.dmg, n: METEOR.dmg[0], s: METEOR.dmg[1] }, dt: "bludgeon" };
    const r = await B.doAttack(u, tgt, a2, { cancelable: false, onCommit: () => B.commitAttack(u, a2, tgt) });
    if (!r || r.cancelled) return true;
    const cx = tgt.x, cy = tgt.y;
    if (r.nat <= 2) {
      const v = roll(METEOR.back[0], METEOR.back[1]).total;
      log(`${u.name}: метеор срывается (выпало ${r.nat}) — героя отбрасывает назад, ${v} урона.`, "bad"); fx(u, "отброшен", "bad");
      await B.push(u, cx, cy, 2);
      if (alive(u)) await B.applyDamage(null, u, [{ v, dt: "bludgeon", label: "Отдача метеора" }], { src: null });
      return true;
    }
    if (!r.hit) return true;
    const half = Math.max(1, Math.floor((r.dealt || 0) / 2));
    for (const o of B.live()) {          // область бьёт и своих
      if (o === u || o === tgt || !alive(o) || o.down || B.distCell(o, cx, cy) > 1) continue;
      await B.applyDamage(u, o, [{ v: half, dt: "bludgeon", label: "Метеорный удар" }], { src: u });
    }
    if (alive(tgt)) { const sv = await B.doSave(tgt, "str", 8 + (u.pb || 0) + Math.max(0, amod(u.abil.str)), { label: "метеорный удар", from: u }); if (!sv.ok) { B.knock(tgt, u); fx(tgt, "сбит с ног", "bad"); } }
    if (B.S.cells[cy] && !B.S.cells[cy][cx]) { B.S.cells[cy][cx] = "crater"; log("На месте удара остаётся кратер.", "skill"); const g = ui(); if (g) g.refresh(); }
    return true;
  }
  B.doMeteor = meteor;

  // «Притянуть»: перчатки тянут цель по прямой, путь должен быть свободен.
  const METAL = /металл|желез|стал|латн|бронз|медн|голем|доспех|рыцар|конструкт/i;
  const isMetal = t => !!(t.mon && (t.mon.metal || METAL.test(`${t.mon.name || ""} ${t.mon.type || ""} ${t.mon.size || ""} ${t.mon.group || ""}`)));
  const pullDc = t => PULL_DC + (t.size >= 2 ? PULL_LARGE : 0) + (isMetal(t) ? PULL_METAL : 0);
  function pullPath(u, t) {
    const dx = t.x - u.x, dy = t.y - u.y, d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d < 2 || d - 1 > PULL_MAX + 0 || t.size >= 3 || (dx && dy && Math.abs(dx) !== Math.abs(dy))) return null;
    const sx = Math.sign(dx), sy = Math.sign(dy), cells = [], me = { ...t };
    let cx = t.x, cy = t.y;
    for (let i = 0; i < d - 1; i++) {
      cx -= sx; cy -= sy; me.x = cx; me.y = cy;
      if (!B.canStand(t, cx, cy)) return null;          // на пути препятствие или кто-то стоит
      cells.push([cx, cy]);
      if (B.dist({ x: u.x, y: u.y, size: u.size }, me) <= 1) break;
    }
    return cells.length && B.dist(u, { ...t, x: cells[cells.length - 1][0], y: cells[cells.length - 1][1] }) <= 1 ? cells : null;
  }
  async function doPull(u) {
    const cands = enemiesOf(u).filter(t => alive(t) && !t.down && pullPath(u, t));
    if (!cands.length) { toast("Притянуть: нет цели на прямой в 2–4 клетках с чистым путём"); return false; }
    const t = await UI().pickUnit({ prompt: "Притянуть: выберите цель", units: cands.map(x => x.id), cells: [], kind: "attack" }); if (!t) return false;
    const dc = pullDc(t);
    const ck = await B.doCheck(u, "conCheck", { title: "Притянуть", label: `${t.name} · Сл ${dc}`, dc, cancel: true, onCommit: () => B.spendTime(u, "action") });
    if (!ck) return false;
    if (ck.total < dc) { log(`${u.name} не смог притянуть ${t.name} (${ck.total} против Сл ${dc}).`); fx(t, "устоял"); return true; }
    const path = pullPath(u, t); if (!path) { log(`Путь для ${t.name} оказался занят.`); return true; }
    for (const [x, y] of path) { const from = [t.x, t.y]; t.x = x; t.y = y; const g = ui(); if (g) await g.animMove(t, from, [x, y]); if (B.terrainEnter) await B.terrainEnter(t); if (!alive(t)) break; }
    log(`${u.name} притягивает ${t.name} магнитом (${ck.total} против Сл ${dc}).`, "good"); fx(t, "притянут", "bad");
    return true;
  }
  B.doPull = doPull; B.pullPath = pullPath; B.pullDc = pullDc;

  /* ===== артефактное оружие, вторая партия (решения автора 29.10): Падающая звезда, Эхо-клинок, Посох разрядов, Зеркальный щит; «Упор» пики ===== */
  const STAR_MANA = 1, STAR_CD = 3, STAR_DMG = [2, 6], STAFF_MAX = 3, MIRROR_CHANCE = 40, MIRROR_MANA = 1;
  const starWhy = u => (u.mp < STAR_MANA ? "нужна 1 мана" : u.starAt != null && B.S.round - u.starAt < STAR_CD ? `перезарядка: ещё ${STAR_CD - (B.S.round - u.starAt)} р.` : B.arrowsLeft(u) < 1 ? "нет стрел" : null);
  async function star(u, atk) {
    const why = starWhy(u); if (why) { toast(why); return false; }
    const cells = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) { const d = B.distCell(u, x, y); if (d >= 1 && d <= atk.range[1]) cells.push([x, y]); }
    const pt = await UI().pickCell({ prompt: "Падающая звезда: выберите центр (нажмите ещё раз для подтверждения)", cells, kind: "attack", radius: 1, forSide: "hero" });
    if (!pt || pt.length !== 2) return false;
    const [cx, cy] = pt; B.commitAttack(u, atk, null);          // действие и стрела
    B.setMp(u, u.mp - STAR_MANA); u.starAt = B.S.round;
    log(`${u.name} пускает «Падающую звезду» в клетку ${cx + 1}:${cy + 1}.`, "skill");
    const g = ui(); if (g) { g.banner("Падающая звезда!"); g.fxText({ x: cx, y: cy, size: 1, id: "star" }, "звезда", "dmg"); }
    for (const t of B.live()) {          // область бьёт и своих (решение автора 29.10)
      if (!alive(t) || t.down || B.distCell(t, cx, cy) > 1) continue;
      const v = roll(STAR_DMG[0], STAR_DMG[1]).total;
      await B.applyDamage(u, t, [{ v, dt: "radiant", label: "Падающая звезда" }], { src: u });
      if (alive(t) && t.side !== u.side) { addStatus(t, "starlit", { k: Infinity, data: { endAtStartOf: u.id } }); removeStatus(t, "hidden"); removeStatus(t, "unseen"); }
    }
    return true;
  }
  const ws0 = B.weapSpecials;
  B.weapSpecials = (u, main, off) => {
    const out = ws0(u, main, off);
    if (main && main.artId === "meteor-mace" && !u.disarmed) { const base = B.atkFrom(u, main, "hand"); out.push({ ...base, id: "meteor:mace", n: "Метеорный удар", special: "meteor", sub: "раз за бой: прыжок до 2 клеток, 2к6 по цели и вполовину вокруг (и своим), кратер", needTarget: v => (v.meteorUsed ? "уже использован в этом бою" : (enemiesOf(v).some(x => alive(x) && B.dist(v, x) <= 3) ? null : "нет цели в 3 клетках")) }); }
    if (main && main.artId === "falling-star" && !u.disarmed) { const base = B.atkFrom(u, main, "hand"); out.push({ ...base, id: "star:longbow", n: "Падающая звезда", special: "star", sub: "1 мана и стрела, раз в 3 хода: радиус 1, радиантное 2к6, цели подсвечены", needTarget: v => starWhy(v) }); }
    return out;
  };
  const rs0 = B.runSpecial;
  B.runSpecial = (u, atk) => (atk.special === "star" ? star(u, atk) : atk.special === "meteor" ? meteor(u, atk) : rs0(u, atk));

  // Посох разрядов: потраченная мана копится зарядами; «Разряд» — 1к6 за заряд.
  B.staffCharge = (u, spent) => { const m = B.mainOf(u); if (m && m.artId === "discharge-staff") u.charges = Math.min(STAFF_MAX, (u.charges || 0) + spent); };
  // Зеркальный щит: дальняя атака попала — с шансом отражается (мана тратится на каждую попытку).
  B.mirrorTry = async (src, tgt, parts) => {
    const off = B.offOf(tgt); if (!off || off.artId !== "mirror-shield" || tgt.mp < MIRROR_MANA || !alive(src) || src.side === tgt.side || !canAct(tgt)) return null;
    B.setMp(tgt, tgt.mp - MIRROR_MANA);
    const total = parts.reduce((a, q) => a + q.v, 0);
    if (roll(1, 100).total > MIRROR_CHANCE) { log(`${tgt.name}: зеркальный щит не поймал удар (-${MIRROR_MANA} мана).`); return null; }
    log(`${tgt.name}: зеркальный щит отражает удар в ${src.name}!`, "skill"); fx(tgt, "отражено", "good");
    const dt = (parts.find(q => q.dt) || {}).dt || "pierce";
    await B.applyDamage(tgt, src, [{ v: Math.max(1, Math.floor(total / 2)), dt, label: "Отражение" }], { src: tgt, noReflect: true });
    return { total: 0, absorbed: total, notes: ["отражено щитом"] };
  };
  // Эхо-клинок: попадание оставляет эхо; следующая атака по цели (хоть мимо) повторяется без броска на половину прежнего удара.
  P.weap.attackDone = async function (u, ctx) {
    const { res, tgt, atk } = ctx, w = atk && atk.w;
    if (w && w.artId === "moon-sword" && u.moon === 1 && res && res.killed && u.t) { u.t.move += 2; u.t.disengage = true; log(`${u.name}: серп — шаг на 2 клетки без провокации.`, "skill"); fx(u, "серп", "good"); }
    if (!w || w.artId !== "echo-blade" || !tgt || tgt.isObj || !res || atk.mode !== "hand") return;
    if (u.echo && u.echo.tgt === tgt.id) {
      const e = u.echo; u.echo = null;
      if (alive(tgt) || tgt.down) {
        const v = Math.max(1, Math.floor(e.dmg / 2));
        const ap = await B.applyDamage(u, tgt, [{ v, dt: atk.dt, label: "Эхо клинка" }], { melee: true, src: u, pure: true });
        log(`${u.name}: эхо клинка повторяет удар — ${tgt.name} получает ${ap.total} урона.`, "skill"); fx(tgt, "эхо", "bad");
      }
    } else if (res.hit && res.dealt > 0) u.echo = { tgt: tgt.id, dmg: res.dealt };
  };
  // «Упор» пики: враг вошёл в зону досягаемости — реакция, попавший останавливается.
  P.weap.reactEnter = async function (e, mover, from) {
    if (!e.hero || e.disarmed) return;
    const pk = B.mainOf(e); if (!pk || pk.id !== "pike") return;
    const atk = B.attacksOf(e).find(a => a.kind === "melee" && a.w && a.w.id === "pike" && !a.offhand); if (!atk) return;
    const r = atk.reach || 2;
    if (dist(e, mover) > r || (from && B.distAt(e, mover, from[0], from[1]) <= r) || B.lineBlocked(e, mover)) return;
    if (!(await B.promptReaction({ unit: e, title: "Упор", text: `${mover.name} входит в зону пики. Встретить ударом? (реакция)` }))) return;
    e.t.react = 0; log(`${e.name}: упор пики по ${mover.name}.`, "skill"); fx(e, "упор", "good");
    await B.doAttack(e, mover, atk, { reaction: true, cancelable: false, rider: async res => { if (res.hit && mover.size <= 2) { addStatus(mover, "spearstop", { k: 0, when: "end" }); fx(mover, "остановлен", "bad"); } } });
  };

  const rb = B.weapActions;
  B.weapActions = u => {
    const out = rb(u);
    const c0 = u.hero, main0 = B.mainOf(u), off0 = B.offOf(u), act0 = B.timeOK(u, "action"), bon0 = B.timeOK(u, "bonus");
    if (main0 && main0.artId === "thunder-spear" && !u.disarmed) {
      out.push({ id: "spearcharge", cat: "skill", label: "Зарядить копьё", ico: "throwing", sub: `${CHARGE_MANA} маны, доп. действие: следующий удар или бросок — молния +1к6${u.charged ? " · уже заряжено" : ""}`, time: "bonus",
        enabled: bon0 && !u.charged && u.mp >= CHARGE_MANA, why: !bon0 ? "доп. действие потрачено" : u.charged ? "уже заряжено" : "не хватает маны",
        run: async () => { B.spendTime(u, "bonus"); B.setMp(u, u.mp - CHARGE_MANA); u.charged = true; log(`${u.name} заряжает копьё молнией.`, "good"); fx(u, "копьё заряжено", "good"); return true; } });
      out.push({ id: "spearplant", cat: "attack", label: "Воткнуть копьё", ico: "throwing", sub: "действие: метнуть в клетку — копьё станет препятствием с 1 ОЗ и ударит молнией в начале вашего следующего хода", time: "action", enabled: act0, why: "действие потрачено",
        run: async () => {
          const S = B.S, th = B.atkFrom(u, main0, "thrown"), tmp = { size: 1, side: "hero", id: "tmp" }, cells = [];
          for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
            const d = B.distCell(u, x, y); if (d < 1 || d > th.range[1]) continue;
            if (!B.canStand(tmp, x, y) || S.objs.some(o => o.x === x && o.y === y) || B.live().some(o => B.footprint(o).some(([fx2, fy2]) => fx2 === x && fy2 === y))) continue;
            if (B.lineBlocked(u, { x, y, size: 1, id: "c" })) continue;
            cells.push([x, y]);
          }
          if (!cells.length) { toast("Некуда воткнуть"); return false; }
          const pt = await UI().pickCell({ prompt: "Воткнуть копьё в клетку", cells, kind: "attack", radius: 0 });
          if (!pt || pt.length !== 2) return false;
          const [x, y] = pt, entry = c0.equip.main;
          B.spendTime(u, "action"); u.t.attacked = true; u.disarmed = true; S.cells[y][x] = "spearstuck";
          lodged().push({ kind: "cell", x, y, hero: u.id, turn: u.turnsTaken, drop: { kind: "weapon", hero: c0.id, slot: "main", item: entry, x, y } });
          log(`${u.name} вонзает копьё-громоотвод в землю: в начале его следующего хода ударит молния.`, "skill"); fx(u, "копьё воткнуто", "good");
          const g = ui(); if (g) g.refresh(); return true;
        } });
    }
    const planted = lodged().find(r => r.kind === "cell" && r.hero === u.id && B.distCell(u, r.x, r.y) <= 1);
    if (planted && u.disarmed) out.push({ id: "spearpull", cat: "other", label: "Вытащить копьё", ico: "attack", sub: "свободное действие: копьё возвращается в руку", time: "free", enabled: true,
      run: async () => { B.S.cells[planted.y][planted.x] = ""; B.S.lodged = lodged().filter(r => r !== planted); u.disarmed = false; log(`${u.name} вытаскивает копьё из земли.`, "good"); const g = ui(); if (g) g.refresh(); return true; } });
    if (main0 && main0.artId === "discharge-staff") {
      const n = u.charges || 0, tmp = { kind: "ranged", range: [3, 3] }, tg = B.attackTargets(u, tmp);
      out.push({ id: "discharge", cat: "skill", label: "Разряд", ico: "attack", sub: `действие: ${n ? n + "к6 электричества" : "нет зарядов"} в цель до 3 клеток (заряды копятся от потраченной маны, до ${STAFF_MAX})`, time: "action",
        enabled: act0 && n > 0 && tg.length > 0, why: !act0 ? "действие потрачено" : n < 1 ? "нет зарядов" : "нет цели в 3 клетках",
        run: async () => {
          const t = await UI().pickUnit({ prompt: "Разряд: выберите цель", units: tg.map(x => x.id), cells: B.rangeCells(u, tmp), kind: "attack" }); if (!t) return false;
          B.spendTime(u, "action"); const n2 = u.charges || 0, v = roll(n2, 6).total; u.charges = 0;
          log(`${u.name}: разряд посоха (${n2} зар.) бьёт ${t.name}.`, "skill");
          await B.applyDamage(u, t, [{ v, dt: "lightning", label: "Разряд посоха" }], { src: u }); return true;
        } });
    }
    if ((main0 && main0.artId === "magnet-gloves") || (off0 && off0.artId === "magnet-gloves")) {
      const any = enemiesOf(u).some(t => alive(t) && !t.down && pullPath(u, t));
      out.push({ id: "magnet", cat: "skill", label: "Притянуть", ico: "move", sub: "действие: проверка Телосложения, цель за 2–4 клетки по прямой подтянется к вам (путь должен быть свободен)", time: "action", enabled: act0 && any, why: !act0 ? "действие потрачено" : "нет цели на прямой с чистым путём",
        run: () => doPull(u) });
    }
    return out;
  };
  const rb2 = B.weapActions;
  B.weapActions = u => {
    const out = rb2(u);
    return out;
  };
  const rb3 = B.weapActions;
  B.weapActions = u => {
    const out = rb3(u);
    if (u.race === "darkfairy") {
      const bon = B.timeOK(u, "bonus"), used = !!u.flags.whisper;
      out.push({ id: "whisper", cat: "move", label: "Шёпот теней", ico: "disengage", sub: "доп. действие, раз за бой: движение не провоцирует атак", time: "bonus", enabled: bon && !used, why: used ? "уже использовано" : "доп. действие потрачено",
        run: async () => { B.spendTime(u, "bonus"); u.flags.whisper = true; u.t.disengage = true; log(`${u.name} шепчет тенью: движение до конца хода не провоцирует атак.`, "good"); fx(u, "шёпот теней", "good"); return true; } });
    }
    return out;
  };
})();
