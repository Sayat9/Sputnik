/* Тактический бой: правила — броски, атака, урон, спасброски, лечение, смерть, движение с реакциями, начало и конец хода.
   Игрок бросает сам через окно броска (battle-dice.js); монстры и режим «Авто» бросают автоматически. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const { rnd, d, roll, fmtDice, sleep, amod, sg, clamp, log, inB, key, dist, distCell, footprint, alive, live, enemiesOf, alliesOf, occupant, has, addStatus, removeStatus, tickStatuses,
    hookAll, hookSum, hookAny, coverBetween, speedOf, terrain, tinfo, ABIL_RU, SKILL_ABIL, SKILL_RU } = B;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const units = () => B.S.units;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ===== сессии бросков ===== */
  const ctlOf = u => (u.side === "mon" ? "auto" : (B.S.opts.autoHeroes ? "auto" : "ui"));
  function d20Core(o) {
    const adv = (o.adv || []).length > 0, dis = (o.dis || []).length > 0, mode = adv && !dis ? "adv" : dis && !adv ? "dis" : null;
    const a = d(20), b = mode ? d(20) : null, nat = mode === "adv" ? Math.max(a, b) : mode === "dis" ? Math.min(a, b) : a;
    const sum = (o.mods || []).reduce((s, m) => s + m.v, 0);
    return { dice: mode ? [a, b] : [a], nat, mode, sum, total: nat + sum };
  }
  function autoSession() {
    return { auto: true,
      async d20(o) { return Object.assign(d20Core(o), { auto: true }); },
      async dice(o) { const r = roll(o.n, o.s); return { rolls: r.rolls, sum: r.total, auto: true }; },
      note() {}, async finish() {}, close() {} };
  }
  function session(u, meta) { return ctlOf(u) === "ui" && B.Dice && ui() ? B.Dice.session(u, meta) : autoSession(u, meta); }
  // Перебросы: расовое «Наследие обряда» (кости урона рукопашной атаки, раз в ход) и «Вдохновение» героя (любой бросок).
  function rerollOptions(u, kind, ctx = {}) {
    const out = [];
    if (u.side !== "hero") return out;
    if (kind === "damage" && ctx.melee && D.race[u.race] && D.race[u.race].reroll === "rite" && !(u.t && u.t.riteUsed)) out.push({ id: "rite", label: "Наследие обряда", spend: () => { u.t.riteUsed = true; } });
    if ((u.insp || 0) > 0) out.push({ id: "insp", label: "Вдохновение", spend: () => { u.insp--; if (u.hero) u.hero.insp = u.insp; } });
    return out;
  }
  Object.assign(B, { session, ctlOf, d20Core, rerollOptions });

  /* ===== здоровье ===== */
  function setHp(u, v) { u.hp = clamp(Math.round(v), 0, u.maxHp); if (u.hero) u.hero.hp = u.hp; }
  function setMp(u, v) { u.mp = clamp(Math.round(v), 0, u.maxMp); if (u.hero) u.hero.mp = u.mp; }
  const canAct = u => alive(u) && !u.down && !has(u, "unconscious") && !has(u, "stable");
  function revive(u) {
    removeStatus(u, "unconscious"); removeStatus(u, "stable"); u.down = false; u.deathSaves = { ok: 0, fail: 0 };
    log(`${u.name} приходит в себя.`, "good"); const g = ui(); if (g) g.fxText(u, "в сознании", "good");
  }
  function heal(u, n, src) {
    if (!alive(u) && !(u.down && !u.dead)) return 0;
    if (has(u, "noheal")) { log(`${u.name}: раны не затягиваются.`); const g = ui(); if (g) g.fxText(u, "не лечится", "bad"); return 0; }
    const before = u.hp; setHp(u, u.hp + n);
    const got = u.hp - before;
    if (before === 0 && u.hp > 0 && u.down && !u.dead) revive(u);
    if (got > 0) { log(`${u.name} восстанавливает ${got} ОЗ.`, "good"); const g = ui(); if (g) g.fxHeal(u, got); }
    return got;
  }
  function kill(u, by) {
    const S = B.S; if (!u.alive) return;
    u.alive = false; setHp(u, 0);
    if (u.side === "mon") { S.killed.push(u.idx); log(`${u.name} убит.`, "kill"); }
    else { u.dead = true; u.down = true; if (u.hero) u.hero.dead = true; log(`${u.name} погибает.`, "bad"); }
    for (const o of live()) { const g = has(o, "grappled"); if (g && g.data.by === u.id) removeStatus(o, "grappled"); }
    const g = ui(); if (g) g.fxDeath(u);
  }
  async function dropToZero(u, left, o) {
    // «Упрямая плоть» и подобные пассивки — шанс остаться на 1 ОЗ.
    for (const id of u.pass) { const P = B.P && B.P[id]; if (P && P.beforeZero) { const r = await P.beforeZero(u, { left, o }); if (r) { setHp(u, 1); return; } } }
    if (u.side === "mon") { kill(u, o.src); return; }
    if (left >= u.maxHp) { kill(u, o.src); return; }                      // мгновенная смерть
    u.down = true; setHp(u, 0); u.deathSaves = { ok: 0, fail: 0 };
    removeStatus(u, "hidden");
    addStatus(u, "unconscious", { k: Infinity }); addStatus(u, "prone", { k: Infinity });
    for (const c of [...u.conds]) if (["grappled", "restrained", "pinned", "frightened", "dazzled", "poisoned", "dodging", "guarded", "rush", "envenomed"].includes(c.id)) removeStatus(u, c.id);
    log(`${u.name} падает без сознания!`, "bad");
    const g = ui(); if (g) g.fxText(u, "без сознания", "bad");
  }
  async function failDeathSave(u, n, crit) {
    u.deathSaves.fail += n;
    log(`${u.name}: провал спасброска от смерти (${u.deathSaves.fail}/3).`, "bad");
    if (u.deathSaves.fail >= 3) kill(u, null);
  }
  /* Урон: parts — [{v, dt, label}]. Учитывает уязвимости, сопротивления, плоские поправки пассивок, мокроту и временные ОЗ. */
  async function applyDamage(src, tgt, parts, o = {}) {
    let total = 0; const notes = [];
    for (const p of parts) {
      let v = p.v; if (!(v > 0)) continue;
      const wetBonus = (p.dt === "cold" || p.dt === "lightning") && has(tgt, "wet") ? roll(1, 4).total : 0;
      if (wetBonus) { v += wetBonus; notes.push(`промок +${wetBonus}`); }
      if (tgt.vuln.includes(p.dt) || hookAny(tgt, "vulnerable", { dt: p.dt }) || (tgt.hero && D.race[tgt.race] && (D.race[tgt.race].vuln || []).includes(p.dt))) { v *= 2; notes.push("уязвим"); }
      if (tgt.resist.includes(p.dt) || hookAny(tgt, "resist", { dt: p.dt })) { v = Math.floor(v / 2); notes.push("сопротивление"); }
      v += hookSum(tgt, "dmgFlat", { dt: p.dt, melee: o.melee, o, src, v });
      v += hookSum(src || { pass: [] }, "dmgBonusVs", { dt: p.dt, tgt, o, melee: o.melee });
      if (v < 1 && p.v > 0 && hookAny(tgt, "dmgMin1", { dt: p.dt })) v = 1;
      total += Math.max(0, v);
    }
    for (const id of tgt.pass) { const P = B.P && B.P[id]; if (P && P.dmgTotal) total = P.dmgTotal(tgt, { total, o, src, notes }); }
    total = Math.max(0, total);
    const absorbed = Math.min(tgt.temp || 0, total); tgt.temp = (tgt.temp || 0) - absorbed;
    const left = total - absorbed;
    if (src && left > 0 && src.id !== tgt.id) tgt.lastHitBy = src.id;
    const wasDown = tgt.down && tgt.hp === 0;
    const g = ui();
    if (left > 0) {
      if (wasDown && !tgt.dead) { setHp(tgt, 0); if (g) g.fxHit(tgt, left, parts[0] ? parts[0].dt : "bludgeon", !!o.crit); await failDeathSave(tgt, o.crit ? 2 : 1); }
      else {
        const before = tgt.hp;
        setHp(tgt, before - left);
        if (g) g.fxHit(tgt, left, parts[0] ? parts[0].dt : "bludgeon", !!o.crit);
        if (tgt.hp <= 0) await dropToZero(tgt, left - before, { ...o, src, dt: parts[0] ? parts[0].dt : null, taken: left });
      }
      if (tgt.alive) hookAll(tgt, "onDamaged", { src, total: left, o });
    } else if (g && total > 0) g.fxText(tgt, "поглощено", "");
    else if (g) g.fxText(tgt, "0", "");
    return { total: left, absorbed, notes };
  }
  Object.assign(B, { setHp, setMp, canAct, revive, heal, kill, applyDamage, dropToZero });

  /* ===== контекст атаки ===== */
  function seesTarget(a, t) { return !has(a, "deceived") || has(a, "deceived").data.by !== t.id; }
  function attackCtx(att, tgt, atk, o = {}) {
    const melee = atk.kind === "melee", d0 = dist(att, tgt);
    const ctx = { att, tgt, atk, o, melee, d0, mods: [], adv: [], dis: [], notes: [], consume: [], extra: [], cover: 0, ac: tgt.ac, acNotes: [], autoCrit: false, autoHit: false };
    if (atk.parts) ctx.mods.push(...atk.parts); else ctx.mods.push({ l: "Бонус атаки", v: atk.hit });
    if (atk.penalty) ctx.mods.push({ l: atk.penaltyLabel || "Штраф", v: atk.penalty });
    if (att.fat >= 3) ctx.mods.push({ l: "Усталость", v: -2 }); else if (att.fat === 2) ctx.mods.push({ l: "Усталость", v: -1 });
    if (has(att, "weakened")) ctx.mods.push({ l: "Ослаблен", v: -1 });
    if (o.bonusHit) ctx.mods.push({ l: o.bonusLabel || "Бонус", v: o.bonusHit });
    // состояния атакующего
    if (has(att, "prone")) ctx.dis.push("атакует лёжа");
    if (has(att, "poisoned")) ctx.dis.push("отравлен");
    const fr = has(att, "frightened"); if (fr) ctx.dis.push("испуган");
    if (has(att, "restrained") || has(att, "trapped")) ctx.dis.push("опутан");
    if (has(att, "dazzled")) { ctx.dis.push("ослеплён вспышкой"); ctx.consume.push([att, "dazzled"]); }
    if (!seesTarget(att, tgt)) ctx.dis.push("потерял цель из виду");
    const hid = has(att, "hidden"); ctx.hiddenData = hid ? { ...hid.data } : null;
    if (hid && !(tgt.tremor && dist(att, tgt) <= tgt.tremor) && !(tgt.blind && dist(att, tgt) <= tgt.blind)) { ctx.adv.push("атакует из укрытия"); }
    if (hid) ctx.consume.push([att, "hidden"]);
    const dtg = has(tgt, "deceived"); if (dtg && dtg.data.by === att.id) ctx.adv.push("цель потеряла вас из виду");
    const slw = has(att, "slowed"); if (slw && slw.data.disAtk) ctx.dis.push("скован");
    // состояния цели
    if (has(tgt, "prone")) { if (d0 <= 1) ctx.adv.push("цель сбита с ног"); else ctx.dis.push("цель лежит, далеко"); }
    if (has(tgt, "restrained") || has(tgt, "trapped")) ctx.adv.push("цель опутана");
    if (has(tgt, "unconscious") || has(tgt, "stable")) { ctx.adv.push("цель без сознания"); if (d0 <= 1) ctx.autoCrit = true; }
    if (has(tgt, "helped")) { ctx.adv.push("помощь союзника"); ctx.consume.push([tgt, "helped"]); }
    if (has(tgt, "dodging") && seesTarget(att, tgt)) ctx.dis.push("цель в обороне");
    if (has(tgt, "flicker")) { ctx.dis.push("мерцание"); ctx.consume.push([tgt, "flicker"]); }
    if (has(tgt, "grappled") && has(tgt, "grappled").data.by === att.id && melee) { /* держит — без бонуса */ }
    // дальнобойные
    if (!melee) {
      if (enemiesOf(att).some(e => e.id !== tgt.id && canAct(e) && dist(e, att) <= 1) || (d0 <= 1)) ctx.dis.push("враг вплотную");
      if (atk.range && d0 > atk.range[0]) ctx.dis.push("дальняя дистанция");
      if (att.side === "hero" && B.inDark(att) && !att.dv) ctx.dis.push("тьма");
    }
    // КД: укрытие и бонусы
    let cover = melee ? (d0 > 1 ? coverBetween(att, tgt) : 0) : coverBetween(att, tgt);
    const tc = tinfo(tgt.x, tgt.y); if (!melee && tc && tc.cover) cover = Math.max(cover, tc.cover);
    if (cover && hookAny(att, "ignoreHalfCover", ctx) && cover <= 2) { cover = 0; ctx.notes.push("укрытие не мешает"); }
    ctx.cover = cover; if (cover) ctx.acNotes.push(`укрытие +${cover}`);
    let ac = tgt.ac + cover;
    if (has(tgt, "guarded")) { ac += 2; ctx.acNotes.push("прикрыт щитом +2"); }
    const own = hookSum(tgt, "acBonus", ctx); if (own) { ac += own; ctx.acNotes.push(`пассивка ${sg(own)}`); }
    let aura = 0; for (const a of alliesOf(tgt)) aura = Math.max(aura, hookSum(a, "acAura", { ally: a, tgt, ctx }));
    if (aura) { ac += aura; ctx.acNotes.push(`стена щитов +${aura}`); }
    ctx.ac = ac;
    hookAll(att, "attackMods", ctx); hookAll(tgt, "defendMods", ctx);
    return ctx;
  }
  Object.assign(B, { attackCtx });

  /* ===== атака ===== */
  const animKind = atk => (atk.dt === "fire" ? "fire" : atk.dt === "cold" ? "cold" : atk.dt === "poison" ? "poison" : atk.dt === "lightning" ? "lightning" : atk.dt === "thunder" ? "thunder" : atk.dt === "slash" ? "slash" : atk.dt === "pierce" ? (atk.kind === "ranged" ? "arrow" : "pierce") : "blunt");
  async function rollDamage(att, tgt, atk, ctx, crit, ses) {
    const base = { ...atk.dmg }, n = base.n * (crit ? 2 : 1);
    let rolls = [], sum = 0;
    if (n > 0) {
      const r = await ses.dice({ label: crit ? "Урон (критический)" : "Урон", n, s: base.s, bonus: base.b, dt: atk.dt, crit, reroll: rerollOptions(att, "damage", { melee: ctx.melee }), cancel: false });
      rolls = r.rolls; sum = r.sum;
    }
    const parts = [{ v: sum + base.b + (atk.dmgBonus || 0), dt: atk.dt, label: atk.n }];
    for (const e of ctx.extra) {
      const rr = roll(e.n * (crit && e.critDouble ? 2 : 1), e.s);
      parts.push({ v: rr.total + (e.b || 0), dt: e.dt, label: e.label }); log(`${e.label}: ${rr.total + (e.b || 0)}.`);
    }
    return { parts, rolls, sum, total: parts.reduce((a, p) => a + p.v, 0) };
  }
  async function doAttack(att, tgt, atk, o = {}) {
    const S = B.S, ctx = attackCtx(att, tgt, atk, o);
    const ses = session(att, { kind: "attack", att, tgt, atk, title: atk.n, sub: `${att.name} → ${tgt.name}`, anim: animKind(atk) });
    const r = await ses.d20({ label: "Бросок атаки", mods: ctx.mods, adv: ctx.adv, dis: ctx.dis, vs: { ac: ctx.ac, notes: ctx.acNotes, name: tgt.name }, reroll: rerollOptions(att, "attack"), cancel: att.side === "hero" && o.cancelable !== false });
    if (!r) { ses.close(); return { cancelled: true }; }
    if (o.onCommit) await o.onCommit();
    for (const [u, id] of ctx.consume) removeStatus(u, id);
    const nat = r.nat, total = r.total;
    const hit = ctx.autoHit || nat === 20 || (nat !== 1 && total >= ctx.ac), crit = nat === 20 || (hit && ctx.autoCrit);
    const res = { hit, crit, nat, total, ac: ctx.ac, dealt: 0, parried: false, killed: false, att, tgt, atk, ctx };
    const g = ui(); if (g) await g.animAttack(att, tgt, atk, animKind(atk));
    if (hit) {
      // реакции цели до урона (парирование щитом и т. п.)
      for (const id of tgt.pass) { const P = B.P && B.P[id]; if (P && P.reactHit && canAct(tgt) && !res.parried) { const rr = await P.reactHit(tgt, { ...ctx, res, total }); if (rr) { res.parried = true; res.hit = false; } } }
    }
    if (!res.hit) {
      hookAll(att, "onMiss", { ...ctx, res });
      const text = res.parried ? "Парировано!" : nat === 1 ? "Критический промах" : "Промах";
      if (g) g.fxText(tgt, res.parried ? "парирует" : "промах", "miss");
      log(`${att.name}: ${atk.n} по ${tgt.name} — ${text.toLowerCase()} (${nat === total ? nat : `${nat} → ${total}`} против КД ${ctx.ac}).`, "miss");
      if (g && ses.auto) { g.banner(`${att.name} → ${tgt.name}: ${text.toLowerCase()} (${total} против КД ${ctx.ac})`); await sleep(650); }
      await ses.finish({ text, miss: true, anim: animKind(atk), tgt });
      return res;
    }
    const dm = await rollDamage(att, tgt, atk, ctx, crit, ses);
    res.parts = dm.parts;
    const mark = S.log.length;
    const ap = await applyDamage(att, tgt, dm.parts, { melee: ctx.melee, crit, ctx, src: att });
    res.dealt = ap.total; res.killed = !tgt.alive; res.notes = ap.notes;
    log(`${att.name}: ${atk.n} по ${tgt.name} — ${crit ? "КРИТ! " : ""}${ap.total} урона${ap.notes.length ? " (" + ap.notes.join(", ") + ")" : ""}${res.killed ? ", цель убита" : ""}.`, crit ? "crit" : "hit");
    if (S.log.length - mark > 1) S.log.push(...S.log.splice(mark, S.log.length - mark - 1));        // строки о последствиях (смерть и т. п.) — после строки об ударе
    if (g && ses.auto) { g.banner(`${att.name} → ${tgt.name}: ${crit ? "КРИТ! " : ""}${ap.total} урона${res.killed ? ", цель убита" : ""}`); await sleep(750); }
    await ses.finish({ text: `${crit ? "Критическое попадание! " : "Попадание! "}${ap.total} урона`, anim: animKind(atk), tgt, dmg: ap.total, crit });
    if (tgt.alive || tgt.down) { hookAll(att, "onHitDealt", { ...ctx, res }); if (o.rider) await o.rider(res); }
    if (att.alive) for (const id of att.pass) { const P = B.P && B.P[id]; if (P && P.afterAttack) await P.afterAttack(att, { ...ctx, res }); }
    return res;
  }

  /* ===== спасброски и проверки ===== */
  function saveCtx(u, abil, dc, o) {
    const mods = [{ l: ABIL_RU[abil], v: amod(u.abil[abil]) }]; if (u.saveB[abil]) mods.push({ l: "Эссенция", v: u.saveB[abil] });
    if (has(u, "weakened")) mods.push({ l: "Ослаблен", v: -1 });
    const adv = [...(o.adv || [])], dis = [...(o.dis || [])];
    if (abil === "dex" && has(u, "dodging")) adv.push("оборона");
    if (abil === "dex" && (has(u, "restrained") || has(u, "trapped"))) dis.push("опутан");
    if (abil === "dex" && has(u, "shaken")) { dis.push("оглушён грохотом"); removeStatus(u, "shaken"); }
    const ctx = { u, abil, dc, o, mods, adv, dis, tags: o.tags || [] };
    hookAll(u, "saveMods", ctx);
    return ctx;
  }
  async function doSave(u, abil, dc, o = {}) {
    if ((abil === "str" || abil === "dex") && (has(u, "unconscious") || has(u, "stable"))) { log(`${u.name} не может спастись (без сознания).`); return { ok: false, auto: true, nat: 0, total: 0 }; }
    const ctx = saveCtx(u, abil, dc, o);
    const ses = session(u, { kind: "save", u, title: o.title || `Спасбросок: ${ABIL_RU[abil]}`, sub: `${u.name} · ${o.label || ""}` });
    const r = await ses.d20({ label: "Спасбросок", mods: ctx.mods, adv: ctx.adv, dis: ctx.dis, vs: { dc }, reroll: rerollOptions(u, "save"), cancel: false });
    const ok = r.total >= dc;
    log(`${u.name}: спасбросок ${ABIL_RU[abil]} ${r.nat === r.total ? r.nat : r.nat + " → " + r.total} против Сл ${dc} — ${ok ? "успех" : "провал"}.`, ok ? "save" : "fail");
    const g = ui(); if (g) g.fxText(u, ok ? "успех" : "провал", ok ? "good" : "bad");
    await ses.finish({ text: ok ? "Спасбросок удался" : "Спасбросок провален", save: true, ok });
    return { ok, nat: r.nat, total: r.total, dice: r.dice, mode: r.mode };
  }
  function skillMod(u, skill) {
    const ab = SKILL_ABIL[skill] || "str";
    let v = amod(u.abil[ab]) + (u.skills[skill] || 0);
    if (u.fat >= 3) v -= 2; else if (u.fat === 2) v -= 1;
    if (has(u, "weakened")) v -= 1;
    return v;
  }
  async function doCheck(u, skill, o = {}) {
    const mods = [{ l: SKILL_RU[skill] || skill, v: skillMod(u, skill) }];
    const adv = [...(o.adv || [])], dis = [...(o.dis || [])];
    if (has(u, "poisoned")) dis.push("отравлен");
    if (skill === "acrobatics" || skill === "stealth") { if (has(u, "shaken") && skill === "acrobatics") { dis.push("оглушён грохотом"); removeStatus(u, "shaken"); } }
    const ctx = { u, skill, o, mods, adv, dis, tags: o.tags || [] }; hookAll(u, "checkMods", ctx);
    const ses = session(u, { kind: "check", u, title: o.title || `Проверка: ${SKILL_RU[skill]}`, sub: `${u.name} · ${o.label || ""}` });
    const r = await ses.d20({ label: "Проверка", mods: ctx.mods, adv: ctx.adv, dis: ctx.dis, vs: o.dc ? { dc: o.dc } : null, reroll: rerollOptions(u, "check"), cancel: !!o.cancel });
    if (!r) { ses.close(); return null; }
    if (o.onCommit) await o.onCommit();
    const ok = o.dc ? r.total >= o.dc : null;
    await ses.finish({ text: o.dc ? (ok ? "Проверка удалась" : "Проверка провалена") : `Результат ${r.total}`, save: true, ok: ok == null ? true : ok });
    return { total: r.total, nat: r.nat, ok };
  }
  // Состязание: u1 бросает первым (с окном, если герой), затем u2.
  async function contest(a, skillA, b, skillB, o = {}) {
    const ra = await doCheck(a, skillA, { title: o.title, label: o.labelA || `против ${b.name}`, adv: o.advA, dis: o.disA, cancel: o.cancel, onCommit: o.onCommit, tags: o.tagsA });
    if (!ra) return null;
    const rb = await doCheck(b, skillB, { title: o.titleB || o.title, label: o.labelB || `против ${a.name}`, adv: o.advB, dis: o.disB, tags: o.tagsB });
    const win = ra.total > rb.total;                      // при ничьей выигрывает защитник
    log(`${a.name} (${SKILL_RU[skillA]} ${ra.total}) против ${b.name} (${SKILL_RU[skillB]} ${rb.total}) — ${win ? "успех" : "провал"}.`);
    return { win, a: ra, b: rb };
  }
  Object.assign(B, { doAttack, doSave, doCheck, contest, skillMod, animKind, seesTarget });

  /* ===== движение с реакциями и местностью ===== */
  async function offerOpportunity(e, mover) {
    if (e.side === "hero") return B.promptOpportunity ? B.promptOpportunity(e, mover) : true;
    return B.AI && B.AI.wantsOpportunity ? B.AI.wantsOpportunity(e, mover) : true;
  }
  async function provoke(u, nx, ny) {
    for (const e of enemiesOf(u)) {
      if (!canAct(e) || !e.t.react || e.t.noReact) continue;
      const r = B.meleeReach(e);
      if (dist(e, u) <= r && dist(e, u, nx, ny) > r && B.meleeReach(e) >= 1 && !hookAny(u, "noProvoke", { e })) {
        if (!(await offerOpportunity(e, u))) continue;
        const atk = B.meleeAttackOf ? B.meleeAttackOf(e) : null; if (!atk) continue;
        e.t.react = 0;
        log(`${e.name}: атака по возможности по ${u.name}.`);
        const g = ui(); if (g) g.banner(`${e.name}: атака по возможности!`);
        await doAttack(e, u, atk, { reaction: true, cancelable: false });
        if (!alive(u) || u.down) return;
      }
    }
  }
  async function onEnter(u, from) {
    // реакции вроде «Встречного удара»: враги, у которых юнит вошёл в досягаемость
    for (const e of enemiesOf(u)) {
      if (!canAct(e) || !e.t.react) continue;
      for (const id of e.pass) { const P = B.P && B.P[id]; if (P && P.reactEnter) { await P.reactEnter(e, u, from); if (!alive(u) || u.down) return; } }
    }
  }
  async function trapTrigger(u, o) {
    const S = B.S;
    const oi = S.objs.findIndex(t => t.kind === "trap" && t.x === u.x && t.y === u.y);
    if (oi < 0) return false;
    const t = S.objs[oi];
    if ((t.owner === "mon" && u.side === "mon") || (t.owner === "hero" && u.side === "hero") || B.isFlying(u)) return false;
    S.objs.splice(oi, 1);
    log(`${u.name} попадает в ловушку!`, "bad"); const g = ui(); if (g) { g.banner(`${u.name} попал в ловушку!`); g.refresh(); }
    const sv = await doSave(u, "dex", t.dc, { label: "ловушка" });
    const dmg = B.parseDice(t.dmg), r = roll(dmg.n, dmg.s), v = sv.ok ? Math.floor(r.total / 2) : r.total;
    await applyDamage(null, u, [{ v, dt: t.dt || "pierce", label: "Ловушка" }], { src: null });
    if (!sv.ok && alive(u) && !u.down) addStatus(u, "trapped", { k: 1, data: { dc: t.dc } });
    return true;
  }
  async function terrainEnter(u) {
    const t = tinfo(u.x, u.y), fl = B.isFlying(u);
    if (t && t.wet && !fl) { if (!has(u, "wet")) { log(`${u.name} промокает.`); const g = ui(); if (g) g.fxText(u, "промок", ""); } addStatus(u, "wet", { k: 3, when: "end" }); removeStatus(u, "burning"); }
    if (t && t.hazard === "fire" && !fl) { const r = roll(1, 4).total; log(`${u.name} обжигается о костёр: ${r}.`); await applyDamage(null, u, [{ v: r, dt: "fire", label: "Костёр" }], {}); }
    for (const fx of u.size > 1 ? footprint(u) : []) { /* большие существа: местность по якорю */ }
    await trapTrigger(u);
  }
  // Перемещение по пути. Возвращает потраченное и признак прерывания.
  async function moveAlong(u, path, o = {}) {
    let spent = 0, interrupted = false;
    for (const [x, y] of path) {
      if (!alive(u) || u.down) { interrupted = true; break; }
      const sc = B.stepCost(u, x, y);
      if (!o.noProvoke && !(u.t && u.t.disengage)) await provoke(u, x, y);
      if (!alive(u) || u.down) { interrupted = true; break; }
      const from = [u.x, u.y]; u.x = x; u.y = y; spent += sc;
      const g = ui(); if (g) await g.animMove(u, from, [x, y]);
      await terrainEnter(u);
      if (!alive(u) || u.down) { interrupted = true; break; }
      await onEnter(u, from);
      hookAll(u, "onMoveStep", { from, to: [x, y] });
      for (const o of live()) { const gr = has(o, "grappled"); if (gr && gr.data.by === u.id && dist(u, o) > 1) removeStatus(o, "grappled"); }
      if (speedOf(u) === 0 && !o.force) { interrupted = true; break; }
    }
    return { spent, interrupted };
  }
  // Принудительное перемещение на n клеток от точки (без провоцированных атак).
  async function push(u, fromX, fromY, n) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      const dx = Math.sign(u.x - fromX) || 0, dy = Math.sign(u.y - fromY) || 0; if (!dx && !dy) break;
      const nx = u.x + dx, ny = u.y + dy;
      if (!B.canStand(u, nx, ny)) break;
      const from = [u.x, u.y]; u.x = nx; u.y = ny; moved++;
      const g = ui(); if (g) await g.animMove(u, from, [nx, ny]);
      await terrainEnter(u); if (!alive(u) || u.down) break;
      fromX = from[0]; fromY = from[1];
    }
    return moved;
  }
  Object.assign(B, { provoke, moveAlong, push, terrainEnter, trapTrigger });

  /* ===== ход: начало, конец, инициатива ===== */
  function rollInitiative() {
    const S = B.S;
    const rows = live().map(u => ({ u, d20: d(20), mod: amod(u.abil.dex) + (u.initB || 0) + hookSum(u, "initBonus", {}) }));
    rows.forEach(r => { r.total = r.d20 + r.mod; });
    rows.sort((a, b) => (S.ambush ? (a.u.side === "mon" ? 0 : 1) - (b.u.side === "mon" ? 0 : 1) : 0) || b.total - a.total || b.u.abil.dex - a.u.abil.dex || (a.u.side === "hero" ? -1 : 1));
    S.order = rows.map(r => r.u.id); S.initRows = rows.map(r => ({ id: r.u.id, d20: r.d20, mod: r.mod, total: r.total }));
    S.turn = 0; S.round = 1;
  }
  async function startTurn(u) {
    const S = B.S;
    u.turnsTaken++;
    for (const o of units()) o.conds = o.conds.filter(c => !(c.data && c.data.endAtStartOf === u.id));      // «до начала моего следующего хода»
    u.t = { move: 0, action: 1, bonus: 1, react: 1, dash: false, disengage: false, attacked: false, riteUsed: false, objUsed: false, moved: 0, startX: u.x, startY: u.y, rush: false, extraAttack: 0 };
    tickStatuses(u, "start");
    for (const k of Object.keys(u.cd)) if (u.cd[k] > 0) u.cd[k]--;
    hookAll(u, "turnStart", {});
    // начало хода: кровотечение, горение, хватка и т. п.
    const bl = has(u, "bleeding"); if (bl && alive(u)) { log(`${u.name} истекает кровью.`); await applyDamage(bl.src ? B.byId(bl.src) : null, u, [{ v: 1, dt: "slash", label: "Кровотечение" }], {}); }
    const bn = has(u, "burning"); if (bn && alive(u)) { if (has(u, "wet")) removeStatus(u, "burning"); else { const r = roll(1, 4).total; log(`${u.name} горит: ${r}.`); await applyDamage(null, u, [{ v: r, dt: "fire", label: "Горение" }], {}); } }
    const gr = has(u, "grappled"); if (gr && gr.data.dmg && alive(u) && !u.down) { const dd = B.parseDice(gr.data.dmg), r = roll(dd.n, dd.s).total; log(`${u.name} сдавлен хваткой: ${r}.`); await applyDamage(B.byId(gr.data.by), u, [{ v: r, dt: gr.data.dt || "bludgeon", label: "Хватка" }], {}); }
    const t = tinfo(u.x, u.y);
    if (t && t.hazard === "fire" && alive(u) && !B.isFlying(u)) { const r = roll(1, 4).total; log(`${u.name} стоит в огне: ${r}.`); await applyDamage(null, u, [{ v: r, dt: "fire", label: "Костёр" }], {}); }
    if (t && t.wet && alive(u) && !B.isFlying(u)) addStatus(u, "wet", { k: 3, when: "end" });
    if (alive(u) && !u.down) u.t.move = speedOf(u);
    // «Стоять» — героя, которому нужно встать, штраф учтёт действие движения
  }
  function endTurn(u) {
    for (const o of units()) o.conds = o.conds.filter(c => !(c.data && c.data.endAtEndOf === u.id && u.turnsTaken >= (c.data.endTurnNo || 0)));
    tickStatuses(u, "end");
    hookAll(u, "turnEnd", {});
    if (u.side === "hero" && u.hero) { u.hero.insp = u.insp; }
  }
  const unitsInOrder = () => B.S.order.map(B.byId).filter(Boolean);
  function currentUnit() { const S = B.S; return B.byId(S.order[S.turn]); }
  function advanceTurn() {
    const S = B.S; let guard = 0;
    do { S.turn++; if (S.turn >= S.order.length) { S.turn = 0; S.round++; log(`— Раунд ${S.round} —`, "round"); } guard++; }
    while (guard < S.order.length + 2 && (!alive(currentUnit() || { alive: false })));
    return currentUnit();
  }
  Object.assign(B, { rollInitiative, startTurn, endTurn, currentUnit, advanceTurn, unitsInOrder });

  /* ===== конец боя ===== */
  function checkEnd() {
    const S = B.S; if (S.outcome) return S.outcome;
    const mons = B.mons(), heroes = B.heroes();
    const monsLeft = mons.filter(alive);
    if (!monsLeft.length) { const fled = mons.some(m => m.fled); S.outcome = fled && S.killed.length < mons.length ? "retreat" : "win"; return S.outcome; }
    const heroesIn = heroes.filter(h => alive(h) && !h.down);
    if (!heroesIn.length) {
      const escaped = heroes.some(h => h.escaped);
      S.outcome = escaped ? "flee" : "defeat"; return S.outcome;
    }
    return null;
  }
  B.checkEnd = checkEnd;
})();
