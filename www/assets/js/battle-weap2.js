/* Тактический бой: оружие третьей итерации (12.11, автор) — палочка и посох (магический снаряд за ману, «Крест»), моргенштерн («Замах»),
   цеп («цветок», «Притянуться»), метательные кинжалы, а также артефакты нового оружия по описаниям автора: цеп-ловец («Сковать»), посох метеора, палочка цепной молнии.
   Пассивки — B.P.weap2 (у каждого героя). Все числа — черновик, drafts.md → «Оружие — третья итерация». */
(function () {
  const B = window.Battle, D = B.D;
  const { roll, amod, has, addStatus, removeStatus, log, dist, enemiesOf, alive, canAct } = B;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const UI = () => B.UI;
  const toast = t => { const g = ui(); if (g && g.toast) g.toast(t); };
  const fx = (u, t, k) => { const g = ui(); if (g) g.fxText(u, t, k); };
  const P = B.P;
  B.SKILL_ABIL.strCheck = "str"; B.SKILL_RU.strCheck = "Сила";
  const artMain = (u, id) => { const m = B.mainOf(u); return m && m.artId === id ? m : null; };
  const bleed = (t, u, k = 3) => { if (alive(t) && !B.noBlood(t) && !has(t, "bleeding")) { addStatus(t, "bleeding", { k, when: "end", src: u.id }); log(`${t.name} истекает кровью (${k} хода).`, "skill"); fx(t, "кровотечение", "bad"); return true; } return false; };

  D.status.chained = { name: "Скован цепью", ico: '<circle cx="7" cy="12" r="3"/><circle cx="12" cy="12" r="3"/><circle cx="17" cy="12" r="3"/>', desc: "Не может двигаться, но бьёт вокруг себя. В начале хода — проверка Силы: провал — урон цепа, успех — свобода." };
  D.YANK = { steps: [[16, 3], [12, 2], [8, 1]], ram: "1к4", sturdyHp: 15 };          // «Притянуться»: проверка Силы → клеток; крепкий предмет — от 15 ОЗ (камень, надгробие, дерево, частокол, бурелом)
  D.METEOR = { mana: 5, cd: 6, dmg: [3, 6], dcBase: 10, smallHp: 15, burn: 3 };          // «Посох метеора» (автор: большой расход маны, откат 6; числа — черновик)
  D.CHAIN = { mana: 3, cd: 2, dmg: [2, 6], jump: 2, fade: 0.8 };          // «Палочка цепной молнии» (автор: средний расход, раз в 2 хода, скачок в 2 клетках, −20 % за скачок)
  const wcd = (u, k) => (u.wcd && u.wcd[k]) || 0, setWcd = (u, k, n) => { (u.wcd ||= {})[k] = n; };          // откаты особых атак оружия: счёт — в начале своих ходов
  D.DAWN = { mana: 2, cd: 3 };          // «Утренняя звезда» (вариант выбран автором 13.11; числа — черновик)
  D.TDAGGER = { range: 3, perStr: 8, dmg: [1, 6, 1], breakNat: 3, breakNatSteel: 2, bleedNat: 17 };

  /* ===== особые атаки ===== */
  const yankObjs = (u, atk) => (B.objectTargets ? B.objectTargets(u, atk) : []).filter(o => o.def && o.def.hp >= D.YANK.sturdyHp && B.distCell(u, o.x, o.y) >= 2);
  const ws = B.weapSpecials;
  B.weapSpecials = (u, main, off) => {
    const out = ws(u, main, off);
    if (!main || main.kindOf !== "weapon" || u.disarmed) return out;
    if (main.magic && main.magic.plus) {
      const base = B.atkFrom(u, main, "hand"), cost = base.mana * 2;
      out.push({ ...base, id: "plus:" + main.id, n: "Крест", special: "plus", mana: cost, sub: `${cost} маны · цель и 4 клетки вокруг неё (сверху, снизу, слева, справа: урон −20 %), задевает и своих` });
    }
    if (main.id === "morningstar") {
      const base = B.atkFrom(u, main, "hand"), pen = -3;
      out.push({ ...base, id: "swing:morningstar", n: "Замах", special: "swing", reach: 2, lineCheck: true, penalty: pen, penaltyLabel: `замах ${pen}`, dmgBonus: (base.dmgBonus || 0) + 2, sub: `на клетку дальше · урон +2 · бросок ${pen}` });
    }
    if (main.artId === "dawn-star") {
      const base = B.atkFrom(u, main, "hand"), W = D.DAWN;
      out.push({ ...base, id: "dawn:morningstar", n: "Вспышка зари", special: "dawn", mana: W.mana, dt: "radiant", sub: `${W.mana} маны, раз в ${W.cd} хода: урон светом, враги рядом с целью ослеплены`,
        needTarget: v => (wcd(v, "dawn") > 0 ? `откат: ещё ${wcd(v, "dawn")} х.` : B.attackTargets(v, base).length ? null : "нет целей рядом") });
    }
    if (main.artId === "meteor-staff") {
      const base = B.atkFrom(u, main, "hand"), M = D.METEOR;
      out.push({ ...base, id: "skyfall:staff", n: "Метеор", special: "skyfall", mana: M.mana, lines: false, sub: `${M.mana} маны, откат ${M.cd} х.: взрыв крестом в любой точке поля — ${M.dmg[0]}к${M.dmg[1]} огнём, поджигает`, needTarget: v => (wcd(v, "skyfall") > 0 ? `откат: ещё ${wcd(v, "skyfall")} х.` : null) });
    }
    if (main.artId === "chain-wand") {
      const base = B.atkFrom(u, main, "hand"), C = D.CHAIN, am = amod(u.abil.int);
      out.push({ ...base, id: "chain:wand", n: "Цепная молния", special: "chain", mana: C.mana, dt: "lightning", dmg: { n: C.dmg[0], s: C.dmg[1], b: am + (main.bonus || 0) }, sub: `${C.mana} маны, раз в ${C.cd} хода: молния скачет по врагам в ${C.jump} клетках, каждый скачок −20 %`,
        needTarget: v => (wcd(v, "chain") > 0 ? `откат: ещё ${wcd(v, "chain")} х.` : B.attackTargets(v, base).length ? null : "нет целей в досягаемости") });
    }
    if (main.id === "flail") {
      const base = B.atkFrom(u, main, "hand");
      out.push({ ...base, id: "yank:flail", n: "Притянуться", special: "yank", sub: "зацепиться за крепкий предмет на линии цепа и подтянуться: проверка Силы",
        needTarget: v => (yankObjs(v, base).length ? null : "нет крепкого предмета на линии цепа (в 2+ клетках)") });
      if (main.artId === "binder-flail") out.push({ ...base, id: "bind:flail", n: "Сковать", special: "bind", sub: "как удар цепом, но вместо урона цепь обвивает цель: она не может двигаться, пока не пройдёт проверку Силы" });
    }
    return out;
  };
  // «Крест» посоха: один бросок атаки; центр — полный урон, четыре соседние клетки — ×0,8 (если бросок достаёт до их Уворота). Задевает всех, и своих.
  async function plus(u, atk) {
    const targets = B.attackTargets(u, atk);
    if (!targets.length) { toast("Нет целей на прямой"); return false; }
    const tgt = await UI().pickUnit({ prompt: "Крест: выберите цель в центре", units: targets.map(t => t.id), cells: B.rangeCells(u, atk), kind: "attack", from: u });
    if (!tgt || tgt.isObj) return false;
    const cx = tgt.x, cy = tgt.y, arms = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => [cx + dx, cy + dy]);
    const g = ui(); if (g && g.fxCross) g.fxCross(cx, cy);
    const r = await B.doAttack(u, tgt, atk, { onCommit: () => B.commitAttack(u, atk, tgt), scale: 1 });
    if (r.cancelled) return false;
    const seen = new Set([tgt.id]);
    for (const [x, y] of arms) {
      if (!B.inB(x, y)) continue;
      const e = B.occupant(x, y, null);
      if (e && !seen.has(e.id) && alive(e) && e.id !== u.id && !has(e, "underground")) {
        seen.add(e.id);
        if (r.nat === 1 || (r.nat !== 20 && r.total < e.ac)) { log(`Крест: луч проходит мимо ${e.name} (${r.total} против КД ${e.ac}).`, "miss"); continue; }
        const raw = r.raw || Math.max(1, B.avgDice ? Math.round(B.avgDice(atk.dmg)) : 4), v = Math.max(1, Math.floor(raw * 0.8));
        const ap = await B.applyDamage(u, e, [{ v, dt: atk.dt, label: "Крест" }], { src: u, splash: true });
        log(`Крест задевает ${e.name}: ${ap.total} урона.`, "skill");
      } else if (B.damageObject && B.objAt && B.objAt(x, y)) B.damageObject(x, y, Math.max(1, Math.floor((r.raw || 4) * 0.8)), atk.dt, u);
    }
    return true;
  }
  // «Притянуться»: герой подтягивается по прямой к крепкому предмету; встретив кого-то на пути, врезается — оба получают урон.
  async function slideTo(u, tx, ty, steps) {
    const sx = Math.sign(tx - u.x), sy = Math.sign(ty - u.y); let moved = 0;
    for (let i = 0; i < steps; i++) {
      const nx = u.x + sx, ny = u.y + sy;
      if (nx === tx && ny === ty) break;
      const who = B.occupant(nx, ny, u);
      if (who && alive(who)) {
        const dd = B.parseDice(D.YANK.ram), v = roll(dd.n, dd.s).total + Math.max(0, amod(u.abil.str));
        log(`${u.name} на лету врезается в ${who.name}!`, "skill");
        await B.applyDamage(u, who, [{ v, dt: "bludgeon", label: "Таран" }], { src: u, melee: true });
        if (alive(u)) await B.applyDamage(null, u, [{ v: Math.max(1, Math.floor(v / 2)), dt: "bludgeon", label: "Столкновение" }], { noReflect: true });
        break;
      }
      if (!B.canStand(u, nx, ny)) break;
      const from = [u.x, u.y]; u.x = nx; u.y = ny; moved++;
      const g = ui(); if (g) await g.animMove(u, from, [nx, ny]);
      if (B.breakGrapples) B.breakGrapples(u);
      await B.terrainEnter(u); if (!alive(u) || u.down) break;
    }
    return moved;
  }
  async function yank(u, atk) {
    const objs = yankObjs(u, atk);
    if (!objs.length) { toast("Нет крепкого предмета на линии цепа"); return false; }
    const tgt = await UI().pickUnit({ prompt: "Притянуться: выберите крепкий предмет", units: [], objs: objs.map(o => o.x + "," + o.y), cells: B.rangeCells(u, atk), kind: "attack" });
    if (!tgt || !tgt.isObj) return false;
    const ck = await B.doCheck(u, "strCheck", { title: "Притянуться", label: `цепь за «${tgt.name.toLowerCase()}»`, cancel: true, onCommit: () => B.commitAttack(u, atk, tgt) });
    if (!ck) return false;
    const st = D.YANK.steps.find(([dc]) => ck.total >= dc), steps = st ? st[1] : 0;
    if (!steps) { log(`${u.name} дёргает цепь, но сил не хватает (${ck.total}).`); fx(u, "не вышло", "bad"); return true; }
    const n = await slideTo(u, tgt.x, tgt.y, steps);
    log(`${u.name} подтягивается на цепи к «${tgt.name.toLowerCase()}»: ${n} кл. (проверка Силы ${ck.total}).`, "skill"); if (n) fx(u, "рывок на цепи", "good");
    return true;
  }
  // «Метеор» посоха (автор): любая точка поля, взрыв крестом 1-3-1 — огонь, поджог, мелкие препятствия уничтожаются.
  async function skyfall(u, atk) {
    const M = D.METEOR; if (wcd(u, "skyfall") > 0) { toast(`Метеор в откате: ещё ${wcd(u, "skyfall")} х.`); return false; }
    const cells = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) cells.push([x, y]);
    const pt = await UI().pickCell({ prompt: "Метеор: выберите центр взрыва (нажмите ещё раз для подтверждения)", cells, kind: "attack", radius: 1, forSide: "hero" });
    if (!pt || pt.length !== 2) return false;
    const [cx, cy] = pt, area = [[cx, cy], [cx, cy - 1], [cx, cy + 1], [cx - 1, cy], [cx + 1, cy]].filter(([x, y]) => B.inB(x, y));
    B.commitAttack(u, atk, null); setWcd(u, "skyfall", M.cd);
    log(`${u.name} обрушивает метеор в клетку ${cx + 1}:${cy + 1}.`, "skill");
    const g = ui(); if (g) { g.banner("Метеор!"); if (g.fxCross) g.fxCross(cx, cy); if (g.fxBoom) g.fxBoom(cx, cy, 1); }
    const inArea = t => B.footprint(t).some(([x, y]) => area.some(([ax, ay]) => ax === x && ay === y));
    const ts = B.live().filter(t => alive(t) && !has(t, "underground") && inArea(t));
    const total = roll(M.dmg[0], M.dmg[1]).total, dc = M.dcBase + Math.max(0, amod(u.abil.int));
    const sv = ts.length ? await B.massSave(ts, "dex", dc, { label: "Метеор", title: "Метеор", from: u }) : [];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i], ok = sv[i] && sv[i].ok;
      await B.applyDamage(u, t, [{ v: Math.max(1, ok ? Math.floor(total / 2) : total), dt: "fire", label: "Метеор" }], { src: u, splash: true });
      if (!ok && (alive(t) || t.down) && !has(t, "burning") && !has(t, "wet")) { addStatus(t, "burning", { k: M.burn, when: "end" }); log(`${t.name} загорается.`, "skill"); fx(t, "горит", "bad"); }
    }
    for (const [x, y] of area) {
      const o = B.objAt ? B.objAt(x, y) : null;
      if (o) { if (o.maxHp < M.smallHp && B.destroyObject) B.destroyObject(x, y, u); else if (B.damageObject) B.damageObject(x, y, total, "fire", u); }
      if (B.igniteAt) B.igniteAt(x, y, "метеор");
    }
    if (B.flushQueue) await B.flushQueue();
    return true;
  }
  // «Вспышка зари» моргенштерна: удар светом; попав, слепит врагов рядом с целью.
  async function dawn(u, atk) {
    if (wcd(u, "dawn") > 0) { toast(`Вспышка зари в откате: ещё ${wcd(u, "dawn")} х.`); return false; }
    const targets = B.attackTargets(u, atk); if (!targets.length) { toast("Нет целей рядом"); return false; }
    const tgt = await UI().pickUnit({ prompt: "Вспышка зари: выберите цель", units: targets.map(t => t.id), cells: B.rangeCells(u, atk), kind: "attack" });
    if (!tgt || tgt.isObj) return false;
    const r = await B.doAttack(u, tgt, atk, { onCommit: () => { B.commitAttack(u, atk, tgt); setWcd(u, "dawn", D.DAWN.cd); } });
    if (r.cancelled) return false;
    if (!r.hit) return true;
    const g = ui(); if (g && g.fxBoom) g.fxBoom(tgt.x, tgt.y, 1);
    for (const e of enemiesOf(u)) if (e !== tgt && alive(e) && !e.down && dist(e, tgt) <= 1) { addStatus(e, "dazzled", { k: 1, when: "end" }); fx(e, "ослеплён", "bad"); log(`${e.name} ослеплён вспышкой.`, "skill"); }
    return true;
  }
  // «Цепная молния» палочки (автор): бросок по первой цели; дальше молния сама скачет на ближайшего ещё не задетого врага в 2 клетках, каждый раз на 20 % слабее.
  async function chain(u, atk) {
    const C = D.CHAIN; if (wcd(u, "chain") > 0) { toast(`Цепная молния в откате: ещё ${wcd(u, "chain")} х.`); return false; }
    const targets = B.attackTargets(u, atk);
    if (!targets.length) { toast("Нет целей в досягаемости"); return false; }
    const tgt = await UI().pickUnit({ prompt: "Цепная молния: выберите первую цель", units: targets.map(t => t.id), cells: B.rangeCells(u, atk), kind: "attack", from: u });
    if (!tgt || tgt.isObj) return false;
    const r = await B.doAttack(u, tgt, atk, { onCommit: () => { B.commitAttack(u, atk, tgt); setWcd(u, "chain", C.cd); } });
    if (r.cancelled) return false;
    if (!r.hit) return true;
    const hitIds = new Set([tgt.id]); let cur = tgt, v = (r.parts || []).reduce((a, q) => a + q.v, 0) || r.dealt || 0;
    for (;;) {
      v = Math.floor(v * C.fade); if (v <= 0) break;
      const next = enemiesOf(u).filter(e => alive(e) && !e.down && !hitIds.has(e.id) && !has(e, "underground") && dist(e, cur) <= C.jump).sort((a, b) => dist(a, cur) - dist(b, cur))[0];
      if (!next) break;
      hitIds.add(next.id);
      const g = ui(); if (g && g.fxStrike) { g.fxStrike(cur, next, { kind: "ranged", dt: "lightning", range: [C.jump, C.jump] }); await B.sleep(B.cfg.fast ? 0 : 220); }
      const ap = await B.applyDamage(u, next, [{ v, dt: "lightning", label: "Цепная молния" }], { src: u });
      log(`Молния перескакивает на ${next.name}: ${ap.total} урона.`, "skill");
      cur = next;
    }
    return true;
  }
  // «Сковать» (идея автора): попадание не ранит, а сковывает; скованный каждый свой ход проверяет Силу.
  const bindDc = (u, t) => 10 + Math.max(0, amod(u.abil.str)) + B.forceVs(t).mod;
  async function bind(u, atk) {
    const targets = B.attackTargets(u, atk).filter(t => !B.forceVs(t).immune);
    if (!targets.length) { toast(B.attackTargets(u, atk).length ? "Цель слишком тяжела или велика для цепи" : "Нет целей в досягаемости"); return false; }
    const tgt = await UI().pickUnit({ prompt: "Сковать: выберите цель", units: targets.map(t => t.id), cells: B.rangeCells(u, atk), kind: "attack" });
    if (!tgt || tgt.isObj) return false;
    const ctx = B.attackCtx(u, tgt, atk, {});
    const ses = B.session(u, { kind: "attack", att: u, tgt, atk, title: "Сковать", sub: `${u.name} → ${tgt.name}`, anim: "blunt" });
    const r = await ses.d20({ label: "Бросок атаки", mods: ctx.mods, adv: ctx.adv, dis: ctx.dis, vs: { ac: ctx.ac, notes: ctx.acNotes, name: tgt.name }, reroll: B.rerollOptions(u, "attack"), cancel: true });
    if (!r) { ses.close(); return false; }
    B.commitAttack(u, atk, tgt);
    for (const [w, id] of ctx.consume) if (id !== "fooled:atk") removeStatus(w, id);
    const hit = r.nat === 20 || (r.nat !== 1 && r.total >= ctx.ac);
    if (hit) {
      for (const o of B.units()) { const c = has(o, "chained"); if (c && c.data.by === u.id) removeStatus(o, "chained"); }          // цепь держит одну цель
      addStatus(tgt, "chained", { k: Infinity, data: { by: u.id, dc: bindDc(u, tgt) } });
      log(`${u.name} сковывает ${tgt.name} цепью (${r.total} против КД ${ctx.ac}): Сл проверки Силы ${bindDc(u, tgt)}.`, "skill"); fx(tgt, "скован", "bad");
    } else { log(`${u.name}: цепь проходит мимо ${tgt.name} (${r.total} против КД ${ctx.ac}).`, "miss"); fx(tgt, "промах", "miss"); }
    await ses.finish({ text: hit ? "Цель скована" : "Промах", miss: !hit, anim: "blunt", tgt });
    return true;
  }
  const rs = B.runSpecial;
  B.runSpecial = (u, atk) => (atk.special === "plus" ? plus(u, atk) : atk.special === "skyfall" ? skyfall(u, atk) : atk.special === "dawn" ? dawn(u, atk) : atk.special === "chain" ? chain(u, atk) : atk.special === "yank" ? yank(u, atk) : atk.special === "bind" ? bind(u, atk) : rs(u, atk));

  // начало хода скованного: проверка Силы
  const ats = B.artTurnStart;
  B.artTurnStart = async u => {
    if (ats) await ats(u);
    if (u.wcd) for (const k of Object.keys(u.wcd)) if (u.wcd[k] > 0) u.wcd[k]--;          // откаты «Метеора» и «Цепной молнии»
    const c = has(u, "chained"); if (!c || !alive(u) || u.down) return;
    const by = B.byId(c.data.by), fl = by && artMain(by, "binder-flail");
    if (!by || !alive(by) || by.down || !fl || dist(u, by) > 5) { removeStatus(u, "chained"); log(`${u.name}: цепь спадает.`); return; }
    const d = roll(1, 20).total + amod(u.abil.str);
    if (d >= c.data.dc) { removeStatus(u, "chained"); log(`${u.name} рвёт цепь (Сила ${d} против Сл ${c.data.dc}).`, "good"); fx(u, "свободен", "good"); return; }
    const base = B.atkFrom(by, fl, "hand"), v = Math.max(1, (base.dmg.n ? roll(base.dmg.n, base.dmg.s).total : 0) + base.dmg.b);
    log(`${u.name} бьётся в цепи (Сила ${d} против Сл ${c.data.dc}): цепь впивается.`, "skill");
    await B.applyDamage(by, u, [{ v, dt: "bludgeon", label: "Цепь" }], { src: by });
  };

  /* ===== пассивки ===== */
  P.weap2 = {
    async afterAttack(u, ctx) {
      const { res, tgt, atk } = ctx, w = atk && atk.w;
      if (!res || !res.hit || !tgt || tgt.isObj || tgt.side === u.side) return;
      const live = tgt.alive || tgt.down;
      // метательный кинжал: высокий бросок — кровотечение
      if (atk.tdagger && live && res.nat >= D.TDAGGER.bleedNat) bleed(tgt, u, 3);
      if (!w || !w.artId) return;
      switch (w.artId) {
        case "binder-flail": { const c = [...B.units()].find(o => { const k = has(o, "chained"); return k && k.data.by === u.id; }); if (c && atk.mode === "hand" && atk.special !== "bind") { removeStatus(c, "chained"); log(`${u.name} отпускает цепь: ${c.name} свободен.`); } } break;
      }
    },
  };
})();
