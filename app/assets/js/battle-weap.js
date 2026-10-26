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
      enabled: act && !has(u, "aimed") && countGear(c, "arrow") > 0, why: !act ? "действие потрачено" : has(u, "aimed") ? "уже прицелились" : "нет стрел",
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
    attackMods(u, ctx) {
      const w = ctx.atk && ctx.atk.w; if (!w) return;
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
      const main = B.mainOf(u); if (!main || main.id !== "sword") return;
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
  const rb = B.weapActions;
  B.weapActions = u => {
    const out = rb(u);
    if (u.race === "darkfairy") {
      const bon = B.timeOK(u, "bonus"), used = !!u.flags.whisper;
      out.push({ id: "whisper", cat: "move", label: "Шёпот теней", ico: "disengage", sub: "доп. действие, раз за бой: движение не провоцирует атак", time: "bonus", enabled: bon && !used, why: used ? "уже использовано" : "доп. действие потрачено",
        run: async () => { B.spendTime(u, "bonus"); u.flags.whisper = true; u.t.disengage = true; log(`${u.name} шепчет тенью: движение до конца хода не провоцирует атак.`, "good"); fx(u, "шёпот теней", "good"); return true; } });
    }
    return out;
  };
})();
