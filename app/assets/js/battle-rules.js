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
  const ctlOf = u => (u.side === "mon" || u.summon ? "auto" : (B.S.opts.autoHeroes ? "auto" : "ui"));        // призванные существа бросают сами
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
    if ((u.insp || 0) > 0 && !(u.fat >= 3)) out.push({ id: "insp", label: "Переброс", spend: () => { u.insp--; if (u.hero) u.hero.insp = u.insp; } });
    return out;
  }
  Object.assign(B, { session, ctlOf, d20Core, rerollOptions });

  /* ===== здоровье ===== */
  function setHp(u, v) { u.hp = clamp(Math.round(v), 0, u.maxHp); if (u.hero) u.hero.hp = u.hp; }
  function setMp(u, v) { u.mp = clamp(Math.round(v), 0, u.maxMp); if (u.hero) u.hero.mp = u.mp; }
  const canAct = u => alive(u) && !u.down && !has(u, "unconscious") && !has(u, "stable") && !has(u, "paralyzed") && !has(u, "underground");          // закопавшийся землекоп не действует и не реагирует
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
    if (got > 0) {
      log(`${u.name} восстанавливает ${got} ОЗ.`, "good"); const g = ui(); if (g) g.fxHeal(u, got);
      if (removeStatus(u, "bleeding")) log(`${u.name}: кровотечение остановлено.`, "good");              // лечение останавливает кровотечение
    }
    return got;
  }
  // Эффекты «до начала (конца) хода» выбывшего (погиб, сбежал) никогда не кончились бы сами — снимаем сразу; временные ОЗ «Боевого рёва» уходят с ним.
  function dropOwnedStatuses(u) {
    for (const o of units()) for (const c of [...o.conds]) if (c.data && (c.data.endAtStartOf === u.id || c.data.endAtEndOf === u.id)) {
      if (c.id === "roar" && o.tempSrc === "roar") { o.temp = 0; o.tempSrc = null; }
      removeStatus(o, c.id);
    }
  }
  B.dropOwnedStatuses = dropOwnedStatuses;
  // Хватка рвётся, когда держащий и пленник разошлись дальше 1,5 м (оттолкнули, притянули, перенесли).
  function breakGrapples(u) {
    const mine = has(u, "grappled");
    if (mine) { const h = B.byId(mine.data.by); if (!h || !alive(h) || dist(u, h) > 1) removeStatus(u, "grappled"); }
    for (const o of live()) { const g = has(o, "grappled"); if (g && g.data.by === u.id && dist(u, o) > 1) removeStatus(o, "grappled"); }
  }
  B.breakGrapples = breakGrapples;
  function kill(u, by) {
    const S = B.S; if (!u.alive) return;
    u.alive = false; setHp(u, 0);
    if (u.summon) log(`${u.name} ${u.kind === "double" ? "рассеивается" : "гибнет"}.`, "kill");
    else if (u.side === "mon") { S.killed.push(u.idx); (S.killedBy ||= {})[u.idx] = (() => { const k = by && by.summon && by.owner ? B.byId(by.owner) : by; return k && k.hero ? (typeof k.hero === "object" ? k.hero.id : k.hero) : null; })(); log(`${u.name} убит.`, "kill"); }          // кто добил: герой или его призванное существо (засчитывается хозяину)
    else { u.dead = true; u.down = true; if (u.hero) u.hero.dead = true; log(`${u.name} погибает.`, "bad"); }
    if (B.onDown) B.onDown(u, true);                                                // тела павших, двойники и зоны хозяина, концентрация
    for (const o of live()) { const g = has(o, "grappled"); if (g && g.data.by === u.id) removeStatus(o, "grappled"); }
    dropOwnedStatuses(u);                                                           // «до начала/конца хода» умершего не наступит
    const g = ui(); if (g) g.fxDeath(u);
  }
  async function dropToZero(u, left, o) {
    // «Упрямая плоть» и подобные пассивки — шанс остаться на 1 ОЗ.
    for (const id of u.pass) { const P = B.P && B.P[id]; if (P && P.beforeZero) { const r = await P.beforeZero(u, { left, o }); if (r) { setHp(u, 1); return; } } }
    if (u.side === "mon" || u.summon) { kill(u, o.src); return; }
    if (left >= u.maxHp) { kill(u, o.src); return; }                      // мгновенная смерть
    u.down = true; setHp(u, 0); u.deathSaves = { ok: 0, fail: 0 };
    removeStatus(u, "hidden");
    addStatus(u, "unconscious", { k: Infinity }); addStatus(u, "prone", { k: Infinity });
    for (const c of [...u.conds]) if (["grappled", "restrained", "pinned", "frightened", "dazzled", "poisoned", "dodging", "guarded", "rush", "envenomed", "blinded", "buried", "paralyzed", "fooled", "lured", "fuse", "eyepeck", "emerged", "underground"].includes(c.id)) removeStatus(u, c.id);
    for (const o of live()) { const gr = has(o, "grappled"); if (gr && gr.data.by === u.id) removeStatus(o, "grappled"); }      // без сознания хватку не держат
    log(`${u.name} падает без сознания!`, "bad");
    const g = ui(); if (g) g.fxText(u, "без сознания", "bad");
    if (B.onDown) B.onDown(u, false);
  }
  async function failDeathSave(u, n, crit) {
    u.deathSaves.fail += n;
    log(`${u.name}: провал спасброска от смерти (${u.deathSaves.fail}/3).`, "bad");
    if (u.deathSaves.fail >= 3) kill(u, null);
  }
  /* Урон: parts — [{v, dt, label}]. Учитывает уязвимости, сопротивления, плоские поправки пассивок, мокроту и временные ОЗ. */
  async function applyDamage(src, tgt, parts, o = {}) {
    let total = 0; const notes = [];
    // Плоские прибавки атакующего считаются один раз на всю атаку (к первой части урона): «Стая вокруг» волколака — себе и союзникам рядом.
    let outFlat = 0;
    if (src && o.ctx) { outFlat += hookSum(src, "dmgOut", { tgt, o }); let aura = 0; for (const a of alliesOf(src)) aura = Math.max(aura, hookSum(a, "dmgAura", { ally: a, src, tgt, o })); outFlat += aura; }          // аура одноимённых эссенций не складывается
    const memo = {};                                                                    // «один раз на удар» для хуков dmgFlat (например, «Латы из костей» режут общий урон, а не каждую часть)
    for (const p of parts) {
      let v = p.v; if (!(v > 0)) continue;
      if (outFlat) { v += outFlat; outFlat = 0; }                                       // прибавка — часть урона: уязвимость и сопротивление считаются и от неё
      const wetBonus = (p.dt === "cold" || p.dt === "lightning") && has(tgt, "wet") ? roll(1, 4).total : 0;
      if (wetBonus) { v += wetBonus; notes.push(`промок +${wetBonus}`); }
      if (p.dt === "fire" && B.fireOn) B.fireOn(tgt);                                    // любой огонь по рою паучат уничтожает его
      if (tgt.vuln.includes(p.dt) || hookAny(tgt, "vulnerable", { dt: p.dt }) || (tgt.hero && D.race[tgt.race] && (D.race[tgt.race].vuln || []).includes(p.dt))) { v *= 2; notes.push("уязвим"); }
      if (tgt.resist.includes(p.dt) || hookAny(tgt, "resist", { dt: p.dt })) { v = Math.floor(v / 2); notes.push("сопротивление"); }
      const exd = tgt.extraTaken && tgt.extraTaken[p.dt]; if (exd) { const xd = B.parseDice(exd), xr = roll(xd.n, xd.s).total; v += xr; notes.push(`чувствительность +${xr}`); }       // «Боится огня», «Холод жжёт»
      v += hookSum(tgt, "dmgFlat", { dt: p.dt, melee: o.melee, o, src, v, memo });
      v += hookSum(src || { pass: [] }, "dmgBonusVs", { dt: p.dt, tgt, o, melee: o.melee });
      if (v < 1 && p.v > 0 && hookAny(tgt, "dmgMin1", { dt: p.dt })) v = 1;
      total += Math.max(0, v);
    }
    for (const id of tgt.pass) { const P = B.P && B.P[id]; if (P && P.dmgTotal) total = P.dmgTotal(tgt, { total, o, src, notes }); }
    total = Math.max(0, total);
    if (o.reduce && total > 0) { const rd = B.parseDice(o.reduce.dice), rr = roll(rd.n, rd.s).total; total = Math.max(0, total - rr); notes.push(`${o.reduce.label || "щит"} −${rr}`); }          // «Принять удар» с ростовым щитом
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
      if (tgt.alive && !tgt.down && tgt.conc && B.concCheck) await B.concCheck(tgt, left);
      if (tgt.alive && B.hookAllAsync) await B.hookAllAsync(tgt, "onDamagedAsync", { src, total: left, o });
    } else if (g && total > 0) g.fxText(tgt, "поглощено", "");
    else if (g) g.fxText(tgt, "0", "");
    return { total: left, absorbed, notes };
  }
  Object.assign(B, { setHp, setMp, canAct, revive, heal, kill, applyDamage, dropToZero });

  /* ===== контекст атаки ===== */
  function seesTarget(a, t) { return !has(a, "deceived") || has(a, "deceived").data.by !== t.id; }
  // Невидимку («Растворение») не видит никто, кроме тех, кто чует её вибрацией или слепым зрением.
  function isInvisibleTo(e, t) {
    const h = has(t, "hidden"); if (!(h && h.data && h.data.invis)) return false;
    const d = dist(e, t);
    return !((e.tremor && d <= e.tremor && !B.isFlying(t)) || (e.blind && d <= e.blind));
  }
  // Видит ли e существо t: слепой, засыпанный и закопанный не видят никого, невидимку видят только особым чувством.
  function canSeeUnit(e, t) { return !(has(e, "blinded") || has(e, "buried") || has(e, "underground")) && !isInvisibleTo(e, t); }
  B.isInvisibleTo = isInvisibleTo; B.canSeeUnit = canSeeUnit;
  function attackCtx(att, tgt, atk, o = {}) {
    const melee = atk.kind === "melee", d0 = dist(att, tgt);
    const ctx = { att, tgt, atk, o, melee, d0, mods: [], adv: [], dis: [], notes: [], consume: [], extra: [], cover: 0, ac: tgt.ac, acNotes: [], autoCrit: false, autoHit: false };
    if (atk.parts) ctx.mods.push(...atk.parts); else ctx.mods.push({ l: "Бонус атаки", v: atk.hit });
    if (atk.penalty) ctx.mods.push({ l: atk.penaltyLabel || "Штраф", v: atk.penalty });
    if (att.fat >= 3) ctx.mods.push({ l: "Усталость", v: -2 }); else if (att.fat === 2) ctx.mods.push({ l: "Усталость", v: -1 });
    if (has(att, "weakened")) ctx.mods.push({ l: "Ослаблен", v: -1 });
    if (atk.stretch && d0 > 1) ctx.dis.push("копьё на 2 клетки");                                        // решение автора: копьё достаёт на клетку дальше, но с помехой
    if (o.bonusHit) ctx.mods.push({ l: o.bonusLabel || "Бонус", v: o.bonusHit });
    // состояния атакующего
    if (has(att, "prone")) ctx.dis.push("атакует лёжа");
    // отравление помех не даёт (решение автора): только урон ядом и метка
    const fr = has(att, "frightened"); if (fr) ctx.dis.push("испуган");
    if (has(att, "restrained")) ctx.dis.push("опутан");
    if (has(att, "dazzled")) { ctx.dis.push("ослеплён вспышкой"); ctx.consume.push([att, "dazzled"]); }
    if (has(att, "blinded") || has(att, "buried")) ctx.dis.push("ослеплён");
    const fl = has(att, "fooled"); if (fl && !fl.data.atkUsed) { ctx.dis.push("обманут"); ctx.consume.push([att, "fooled:atk"]); }
    if (has(att, "cursed")) ctx.dis.push("проклятие предков");
    if (att.fearsLight && B.brightAt && B.brightAt(att)) ctx.dis.push("боится яркого света");
    if (att.sight && d0 > att.sight && !(att.tremor && d0 <= att.tremor && !B.isFlying(tgt))) ctx.dis.push("плохое зрение");
    if (B.dustBlocks && B.dustBlocks(att, tgt)) ctx.dust = true;                                       // густая пыль: преимущество на дальние атаки сводится на нет (решение автора), помехи самой по себе нет
    if (!seesTarget(att, tgt)) ctx.dis.push("потерял цель из виду");
    const hid = has(att, "hidden"); ctx.hiddenData = hid ? { ...hid.data } : null;
    if (hid && !(tgt.tremor && dist(att, tgt) <= tgt.tremor && !B.isFlying(att)) && !(tgt.blind && dist(att, tgt) <= tgt.blind)) { ctx.adv.push("атакует из укрытия"); }
    if (hid) ctx.consume.push([att, "hidden"]);
    const dtg = has(tgt, "deceived"); if (dtg && dtg.data.by === att.id) ctx.adv.push("цель потеряла вас из виду");
    if (!o.noFlank && units().filter(x => x !== att && x.side === att.side && alive(x) && !x.down && !x.escaped && dist(x, tgt) <= 1).length >= 2) ctx.adv.push("цель в окружении союзников");          // решение автора: ≥2 союзника атакующего вплотную к цели
    if (isInvisibleTo(att, tgt)) ctx.dis.push("цель невидима");                                           // «Растворение»: бьют наугад, не видя цели
    if (has(tgt, "cursed")) ctx.extra.push({ n: 1, s: 4, b: 0, dt: atk.dt, label: "Проклятие предков", critDouble: true });          // каждое попадание по проклятому — ещё +1к4
    const pm = has(tgt, "packmark");                                                                       // «Вожак стаи»: союзник вожака бьёт отмеченного с преимуществом
    if (pm && pm.data.by !== att.id) { const ldr = B.byId(pm.data.by); if (ldr && ldr.side === att.side && alive(ldr)) { ctx.adv.push("Вожак стаи"); ctx.consume.push([tgt, "packmark"]); } }
    const slw = has(att, "slowed"); if (slw && slw.data.disAtk) ctx.dis.push("скован");
    // состояния цели
    if (has(tgt, "prone")) { if (d0 <= 1) ctx.adv.push("цель сбита с ног"); else ctx.dis.push("цель лежит, далеко"); }
    if (has(tgt, "restrained")) ctx.adv.push("цель опутана");
    if (has(tgt, "blinded") || has(tgt, "buried")) ctx.adv.push(has(tgt, "buried") ? "цель засыпана" : "цель ослеплена");
    if (has(tgt, "paralyzed")) { ctx.adv.push("цель парализована"); if (d0 <= 1) ctx.autoCrit = true; }
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
    const wall = B.wallCover ? B.wallCover(att, tgt) : 0; if (wall) { cover = Math.max(cover, wall); ctx.notes.push("Живая стена"); }          // щитоносец между атакующим и целью
    if (cover && hookAny(att, "ignoreHalfCover", ctx) && cover <= 2) { cover = 0; ctx.notes.push("укрытие не мешает"); }
    ctx.cover = cover; if (cover) ctx.acNotes.push(`укрытие +${cover}`);
    let ac = tgt.ac + cover;
    if (has(tgt, "guarded")) { ac += 2; ctx.acNotes.push("прикрыт щитом +2"); }
    const own = hookSum(tgt, "acBonus", ctx); if (own) { ac += own; ctx.acNotes.push(`пассивка ${sg(own)}`); }
    let aura = 0; for (const a of alliesOf(tgt)) aura = Math.max(aura, hookSum(a, "acAura", { ally: a, tgt, ctx }));
    if (aura) { ac += aura; ctx.acNotes.push(`стена щитов +${aura}`); }
    ctx.ac = ac;
    hookAll(att, "attackMods", ctx); hookAll(tgt, "defendMods", ctx);
    for (const a of alliesOf(att)) hookAll(a, "attackAura", { ally: a, att, tgt, ctx });          // «Пока король жив»
    const ha = tinfo(att.x, att.y), ht = tinfo(tgt.x, tgt.y);                                              // высота: с возвышенности бьют точнее, и по стоящему на ней тоже (решение автора, черновик)
    if (ha && ha.elevated) ctx.mods.push({ l: "Высота (атакует сверху)", v: B.D.height.att });
    if (ht && ht.elevated) ctx.mods.push({ l: "Высота (цель на возвышении)", v: B.D.height.tgt });
    if (ctx.dust && ctx.adv.length) { ctx.notes.push("густая пыль гасит преимущество"); ctx.adv.length = 0; }
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
    if (atk.dmgMult && atk.dmgMult !== 1) for (const p of parts) p.v = Math.max(0, Math.floor(p.v * atk.dmgMult));          // двойник бьёт вполсилы
    return { parts, rolls, sum, total: parts.reduce((a, p) => a + p.v, 0) };
  }
  // Судьба стрелы героя по броску атаки. Ломается ли она — решает исход (D.arrow); целая стрела остаётся лежать на поле (S.drops)
  // и возвращается в колчан в конце боя (battle-end.js), если отряд не бежал.
  function arrowFate(att, tgt, f) {
    const L = B.arrowLog(att.hero.id), margin = f.total - f.ac;
    let broken = false, note = "";
    if (f.nat === 1) { broken = true; note = "стрела сломалась"; }
    else if (!f.hit) note = "стрела упала на поле";
    else if (!f.crit && margin <= D.arrow.breakMargin) { broken = true; note = "стрела сломалась"; }
    if (broken) L.broken++; else B.S.drops.push({ kind: "arrow", hero: att.hero.id, x: tgt.x, y: tgt.y });
    return { broken, note };
  }
  B.arrowFate = arrowFate;
  async function doAttack(att, tgt, atk, o = {}) {
    const g0 = ui(); if (g0 && atk.kind !== "melee" && g0.setTraj) g0.setTraj([{ a: att, b: tgt }]);          // траектория выстрела видна на поле, пока идёт бросок
    try { return await doAttack0(att, tgt, atk, o); } finally { if (g0 && g0.setTraj) g0.setTraj(null); }
  }
  async function doAttack0(att, tgt, atk, o = {}) {
    const S = B.S;
    if (tgt.isObj) return B.attackObject(att, atk, tgt, o);                            // способность или атака по камню и т. п.: бросок против КД объекта
    if (B.redirectAttack && !o.noRedirect) { const nt = await B.redirectAttack(att, tgt, atk, o); if (nt) tgt = nt; }          // двойник, «Принять удар»
    const ctx = attackCtx(att, tgt, atk, o);
    if (o.extra) ctx.extra.push(...o.extra);
    const ses = session(att, { kind: "attack", att, tgt, atk, title: atk.n, sub: `${att.name} → ${tgt.name}`, anim: animKind(atk) });
    const r = await ses.d20({ label: "Бросок атаки", mods: ctx.mods, adv: ctx.adv, dis: ctx.dis, vs: { ac: ctx.ac, notes: ctx.acNotes, name: tgt.name }, reroll: rerollOptions(att, "attack"), cancel: att.side === "hero" && o.cancelable !== false });
    if (!r) { ses.close(); return { cancelled: true }; }
    if (o.onCommit) await o.onCommit();
    for (const [u, id] of ctx.consume) { if (id === "fooled:atk") { const f = has(u, "fooled"); if (f) f.data.atkUsed = true; } else removeStatus(u, id); }
    if (att.t && atk.kind === "melee") att.t.meleeAttacked = true;
    const nat = r.nat, total = r.total;
    const hit = ctx.autoHit || nat === 20 || (nat !== 1 && total >= ctx.ac), crit = nat === 20 || (hit && ctx.autoCrit);
    const res = { hit, crit, nat, total, ac: ctx.ac, dealt: 0, parried: false, killed: false, att, tgt, atk, ctx, post: [] };
    const fused = has(tgt, "fuse");                                                    // бомба горит в руке: любое попадание по подрывнику взрывает её, даже если он упадёт
    const touchDouble = () => { if (tgt.kind === "double") { const ow = B.byId(tgt.owner); if (ow) hookAll(ow, "doubleAttacked", { att, double: tgt, res }); } };          // «Подмена»: кто тронул двойника, тот обманут
    const g = ui(); if (g) await g.animAttack(att, tgt, atk, animKind(atk));
    if (hit) {
      // реакции цели до урона (парирование щитом и т. п.)
      for (const id of tgt.pass) { const P = B.P && B.P[id]; if (P && P.reactHit && canAct(tgt) && !res.parried) { const rr = await P.reactHit(tgt, { ...ctx, res, total }); if (rr) { res.parried = true; res.hit = false; if (rr === "swap") res.swapped = true; } } }
    }
    const ar = atk.ammo && att.side === "hero" && att.hero ? arrowFate(att, tgt, { nat, total, ac: ctx.ac, hit: res.hit, crit }) : null;
    res.arrow = ar;
    if (!res.hit) {
      hookAll(att, "onMiss", { ...ctx, res });
      if (!res.parried) hookAll(tgt, "onMissedBy", { ...ctx, res });                                // «Ложный образ»: промахнувшийся обманут
      const hitSide = !res.parried && !res.swapped && B.interceptShot ? await B.interceptShot(att, tgt, atk, res, ses) : null;          // низкий бросок: снаряд задевает кого-то на пути
      const text = (res.swapped ? "Подмена: удар пришёлся на двойника" : res.parried ? "Парировано!" : nat === 1 ? "Критический промах" : "Промах") + (hitSide ? ` (${hitSide})` : "");
      if (g) g.fxText(tgt, res.swapped ? "подмена" : res.parried ? "парирует" : "промах", "miss");
      log(`${att.name}: ${atk.n} по ${tgt.name} — ${text.toLowerCase()} (${nat === total ? nat : `${nat} → ${total}`} против КД ${ctx.ac})${ar && ar.note ? ", " + ar.note : ""}.`, "miss");
      if (g && ses.auto) { g.banner(`${att.name} → ${tgt.name}: ${text.toLowerCase()} (${total} против КД ${ctx.ac})`); await sleep(650); }
      await ses.finish({ text: text + (ar && ar.note ? " · " + ar.note : ""), miss: true, anim: animKind(atk), tgt });
      touchDouble();
      hookAll(att, "attackDone", { ...ctx, res });
      for (const f of res.post) await f();
      return res;
    }
    const dm = await rollDamage(att, tgt, atk, ctx, crit, ses);
    res.parts = dm.parts;
    const mark = S.log.length;
    const ap = await applyDamage(att, tgt, dm.parts, { melee: ctx.melee, crit, ctx, src: att, reduce: o.reduce });
    res.dealt = ap.total; res.killed = !tgt.alive; res.notes = ap.notes;
    log(`${att.name}: ${atk.n} по ${tgt.name} — ${crit ? "КРИТ! " : ""}${ap.total} урона${ap.notes.length ? " (" + ap.notes.join(", ") + ")" : ""}${res.killed ? ", цель убита" : ""}${ar && ar.note ? ", " + ar.note : ""}.`, crit ? "crit" : "hit");
    if (S.log.length - mark > 1) S.log.push(...S.log.splice(mark, S.log.length - mark - 1));        // строки о последствиях (смерть и т. п.) — после строки об ударе
    if (g && ses.auto) { g.banner(`${att.name} → ${tgt.name}: ${crit ? "КРИТ! " : ""}${ap.total} урона${res.killed ? ", цель убита" : ""}`); await sleep(750); }
    await ses.finish({ text: `${crit ? "Критическое попадание! " : "Попадание! "}${ap.total} урона${ar && ar.note ? " · " + ar.note : ""}`, anim: animKind(atk), tgt, dmg: ap.total, crit });
    if (tgt.alive || tgt.down) { hookAll(att, "onHitDealt", { ...ctx, res }); if (o.rider) await o.rider(res); }
    if (att.alive) for (const id of att.pass) { const P = B.P && B.P[id]; if (P && P.afterAttack) await P.afterAttack(att, { ...ctx, res }); }
    touchDouble();
    hookAll(att, "attackDone", { ...ctx, res });                                       // после любой атаки, попала она или нет: отскок «Петляет»
    for (const f of res.post) await f();                                               // отложенные последствия попадания: толчок, отскок, яд
    if (B.hookAllAsync) await B.hookAllAsync(tgt, "hitTaken", { ...ctx, res, fused });      // «Гнилая кровь», взрыв бомбы в руках
    if (B.flushQueue) await B.flushQueue();                                            // отдача «Колокола теней» и другое, что нельзя было сделать посреди броска
    return res;
  }

  /* ===== спасброски и проверки ===== */
  // Ауры союзников к спасброску вне doSave (спасбросок от смерти): «Под защитой духов» и подобные.
  function auraSave(u, abil) { const ctx = { u, abil, mods: [], adv: [], dis: [], tags: ["death"], o: {} }; for (const a of alliesOf(u)) hookAll(a, "saveAura", { ally: a, u, abil, ctx }); return ctx; }
  B.auraSave = auraSave;
  function saveCtx(u, abil, dc, o) {
    const mods = [{ l: ABIL_RU[abil], v: amod(u.abil[abil]) }]; if (u.saveB[abil]) mods.push({ l: "Эссенция", v: u.saveB[abil] });
    if (has(u, "weakened")) mods.push({ l: "Ослаблен", v: -1 });
    const adv = [...(o.adv || [])], dis = [...(o.dis || [])];
    if (abil === "dex" && has(u, "dodging")) adv.push("оборона");
    if (abil === "dex" && has(u, "restrained")) dis.push("опутан");
    if (abil === "dex" && has(u, "shaken")) { dis.push("оглушён грохотом"); removeStatus(u, "shaken"); }
    const ctx = { u, abil, dc, o, mods, adv, dis, tags: o.tags || [] };
    hookAll(u, "saveMods", ctx);
    for (const a of alliesOf(u)) hookAll(a, "saveAura", { ally: a, u, abil, ctx });                // «Под защитой духов», «Голос старейшины»
    if (abil === "dex" && o.from && B.wallCover) { const w = B.wallCover(o.from, u); if (w) mods.push({ l: "Живая стена", v: 2 }); }
    return ctx;
  }
  async function doSave(u, abil, dc, o = {}) {
    if ((abil === "str" || abil === "dex") && (has(u, "unconscious") || has(u, "stable") || has(u, "paralyzed"))) { log(`${u.name} не может спастись (${has(u, "paralyzed") ? "парализован" : "без сознания"}).`); return { ok: false, auto: true, nat: 0, total: 0 }; }
    const ctx = saveCtx(u, abil, dc, o);
    const ses = session(u, { kind: "save", u, title: o.title || `Спасбросок: ${ABIL_RU[abil]}`, sub: `${u.name} · ${o.label || ""}` });
    const r = await ses.d20({ label: "Спасбросок", mods: ctx.mods, adv: ctx.adv, dis: ctx.dis, vs: { dc }, reroll: rerollOptions(u, "save"), cancel: false });
    const ok = r.total >= dc;
    log(`${u.name}: спасбросок ${ABIL_RU[abil]} ${r.nat === r.total ? r.nat : r.nat + " → " + r.total} против Сл ${dc} — ${ok ? "успех" : "провал"}.`, ok ? "save" : "fail");
    const g = ui(); if (g) g.fxText(u, ok ? "успех" : "провал", ok ? "good" : "bad");
    await ses.finish({ text: ok ? "Спасбросок удался" : "Спасбросок провален", save: true, ok });
    return { ok, nat: r.nat, total: r.total, dice: r.dice, mode: r.mode };
  }
  // Спасброски сразу нескольких целей: без анимации кубиков, одна сводка (решение автора). Одна цель — обычный doSave.
  async function massSave(list, abil, dc, o = {}) {
    if (list.length < 2) return Promise.all(list.map(t => doSave(t, abil, dc, o)));
    const out = [];
    for (const t of list) {
      if ((abil === "str" || abil === "dex") && (has(t, "unconscious") || has(t, "stable") || has(t, "paralyzed"))) { out.push({ ok: false, nat: 0, total: 0, mode: null }); continue; }
      const ctx = saveCtx(t, abil, dc, o), r = d20Core({ mods: ctx.mods, adv: ctx.adv, dis: ctx.dis }), ok = r.total >= dc;
      log(`${t.name}: спасбросок ${ABIL_RU[abil]} ${r.nat === r.total ? r.nat : r.nat + " → " + r.total} против Сл ${dc} — ${ok ? "успех" : "провал"}.`, ok ? "save" : "fail");
      out.push({ ok, nat: r.nat, total: r.total, dice: r.dice, mode: r.mode });
    }
    const g = ui(); if (g && g.summary) await g.summary(o.title || o.label || "Спасброски", `${ABIL_RU[abil]}, Сл ${dc}`, list.map((t, i) => ({ name: t.name, side: t.side, total: out[i].total, nat: out[i].nat, ok: out[i].ok })));
    return out;
  }
  function skillMod(u, skill) {
    const ab = SKILL_ABIL[skill] || "str";
    let v = amod(u.abil[ab]) + (u.skills[skill] || 0);
    if (u.fat >= 3) v -= 2; else if (u.fat === 2) v -= 1;
    return v;
  }
  async function doCheck(u, skill, o = {}) {
    const mods = [{ l: SKILL_RU[skill] || skill, v: skillMod(u, skill) }, ...(o.mods || [])];
    const adv = [...(o.adv || [])], dis = [...(o.dis || [])];
    if (has(u, "shaken") && SKILL_ABIL[skill] === "dex") { dis.push("оглушён грохотом"); removeStatus(u, "shaken"); }
    const fl = has(u, "fooled"); if (fl && !fl.data.chkUsed && (skill === "perception" || skill === "insight")) { dis.push("обманут"); fl.data.chkUsed = true; }
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
  Object.assign(B, { rollDamage, doAttack, doSave, massSave, doCheck, contest, skillMod, animKind, seesTarget, attackCtx });

  /* ===== движение с реакциями и местностью ===== */
  async function offerOpportunity(e, mover) {
    if (e.side === "hero" && !e.summon) return B.promptOpportunity ? B.promptOpportunity(e, mover) : true;
    return B.AI && B.AI.wantsOpportunity ? B.AI.wantsOpportunity(e, mover) : true;
  }
  async function provoke(u, nx, ny) {
    for (const e of enemiesOf(u)) {
      if (!canAct(e) || !e.t.react || e.t.noReact || e.kind === "double" || !canSeeUnit(e, u)) continue;          // атаку по возможности делает только тот, кто видит уходящего; двойник — только своей атакой в свой ход
      const r = B.meleeReach(e);
      if (dist(e, u) <= r && B.distAt(e, u, nx, ny) > r && B.meleeReach(e) >= 1 && !hookAny(u, "noProvoke", { e })) {          // distAt: расстояние до u, как если бы он стоял в (nx, ny)
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
  async function trapTrigger(u, o = {}) {
    const S = B.S, cells = footprint(u);
    const oi = o.trap ? S.objs.indexOf(o.trap) : S.objs.findIndex(t => t.kind === "trap" && cells.some(([x, y]) => t.x === x && t.y === y));      // o.trap — ловушку задел сам герой, обезвреживая
    if (oi < 0) return false;
    const t = S.objs[oi];
    if ((t.owner === "mon" && u.side === "mon") || (t.owner === "hero" && u.side === "hero") || B.isFlying(u) || hookAny(u, "trapImmune", { trap: t })) return false;          // «Охотничий глаз»: простые ловушки не срабатывают
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
      if (u.t) { const dx = x - from[0], dy = y - from[1], sd = u.t.sdir; if (sd && sd[0] === dx && sd[1] === dy) u.t.straight++; else { u.t.sdir = [dx, dy]; u.t.straight = 1; } }      // «Петляет»: длина прямого бега перед атакой
      const g = ui(); if (g) await g.animMove(u, from, [x, y]);
      await terrainEnter(u);
      if (!alive(u) || u.down) { interrupted = true; break; }
      await onEnter(u, from);
      if (B.illusionCheck && alive(u) && !u.down) await B.illusionCheck(u);                         // «Морок»: впервые увидел иллюзию — проверка Проницательности
      hookAll(u, "onMoveStep", { from, to: [x, y] });
      for (const w of B.S.drops) if (w.holder === u.id) { w.x = u.x; w.y = u.y; }                    // «Жадность»: схваченное оружие у вора в руках
      breakGrapples(u);
      if (speedOf(u) === 0 && !o.force) { interrupted = true; break; }
    }
    if (alive(u) && !B.canStand(u, u.x, u.y) && B.freeCellsNear) {                       // остановили посреди чужой клетки («Летучий прах») — встаём рядом
      const c = B.freeCellsNear(u, 3, u)[0]; if (c) { u.x = c[0]; u.y = c[1]; const g2 = ui(); if (g2) g2.refresh(); }
    }
    if (u.side === "hero" && B.spotHidden) B.spotHidden(u);
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
      breakGrapples(u);                                                                // оттолкнули от того, кто держит (или от пленника) — хватка рвётся
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
    // в засаде монстры ходят первыми; герой, которого нельзя застать врасплох («Чует шаги»), идёт по своей инициативе вместе с ними
    const surprised = u => u.side === "hero" && !hookAny(u, "noSurprise", {});
    rows.sort((a, b) => (S.ambush ? (surprised(a.u) ? 1 : 0) - (surprised(b.u) ? 1 : 0) : 0) || b.total - a.total || b.u.abil.dex - a.u.abil.dex || (a.u.side === "hero" ? -1 : 1));
    S.order = rows.map(r => r.u.id); S.initRows = rows.map(r => ({ id: r.u.id, d20: r.d20, mod: r.mod, total: r.total }));
    S.turn = 0; S.round = 1;
  }
  async function startTurn(u) {
    const S = B.S;
    u.turnsTaken++;
    const invis = has(u, "hidden"), backToHidden = !!(invis && invis.data && invis.data.invis && invis.data.was && invis.data.endAtStartOf === u.id);          // невидимость кончилась, а обычная скрытность была до неё
    for (const o of units()) o.conds = o.conds.filter(c => !(c.data && c.data.endAtStartOf === u.id));      // «до начала моего следующего хода»
    if (backToHidden) addStatus(u, "hidden", { k: Infinity });
    if (B.expireOwned) B.expireOwned(u);                                                                   // «1 минута» кончается в начале хода хозяина через 10 раундов
    u.t = { move: 0, action: 1, bonus: 1, react: 1, dash: false, disengage: false, attacked: false, riteUsed: false, objUsed: false, moved: 0, startX: u.x, startY: u.y, rush: false, extraAttack: 0, straight: 0, sdir: null, packMark: false };
    tickStatuses(u, "start");
    hookAll(u, "turnStart", {});
    // начало хода: кровотечение, горение, хватка и т. п.
    const bl = has(u, "bleeding"); if (bl && alive(u)) { const bd = bl.data && bl.data.dice ? B.parseDice(bl.data.dice) : null, bv = bd ? roll(bd.n, bd.s).total : 1; log(`${u.name} истекает кровью (${bv}).`); await applyDamage(bl.src ? B.byId(bl.src) : null, u, [{ v: bv, dt: "slash", label: "Кровотечение" }], {}); }
    const bn = has(u, "burning"); if (bn && alive(u)) { if (has(u, "wet")) removeStatus(u, "burning"); else { const r = roll(1, 4).total; log(`${u.name} горит: ${r}.`); await applyDamage(null, u, [{ v: r, dt: "fire", label: "Горение" }], {}); } }
    const gr = has(u, "grappled"); if (gr && gr.data.dmg && !gr.data.tick && alive(u) && !u.down) { const dd = B.parseDice(gr.data.dmg), r = roll(dd.n, dd.s).total; log(`${u.name} сдавлен хваткой: ${r}.`); await applyDamage(B.byId(gr.data.by), u, [{ v: r, dt: gr.data.dt || "bludgeon", label: "Хватка" }], {}); }
    for (const o of [...live()]) { const g2 = has(o, "grappled"); if (g2 && g2.data.by === u.id && g2.data.tick === "holder" && g2.data.dmg && alive(u) && !u.down) { const dd = B.parseDice(g2.data.dmg), r = roll(dd.n, dd.s).total; log(`${u.name} сдавливает ${o.name}: ${r}.`); await applyDamage(u, o, [{ v: r, dt: g2.data.dt || "bludgeon", label: "Хватка" }], {}); } }          // урон «в начале хода держащего»
    const t = tinfo(u.x, u.y);
    if (t && t.hazard === "fire" && alive(u) && !B.isFlying(u)) { const r = roll(1, 4).total; log(`${u.name} стоит в огне: ${r}.`); await applyDamage(null, u, [{ v: r, dt: "fire", label: "Костёр" }], {}); }
    if (t && t.wet && alive(u) && !B.isFlying(u)) addStatus(u, "wet", { k: 3, when: "end" });
    if (alive(u) && !u.down) u.t.move = speedOf(u);
    if (alive(u) && B.zonesTurnStart) await B.zonesTurnStart(u);                               // рой паучат, белая пыль, тлеющее тело
    if (alive(u) && !u.down) await B.hookAllAsync(u, "turnStartAsync", {});                      // вынырнуть из-под земли и т. п.
    if (alive(u) && !u.down && has(u, "lured") && B.lureStep) await B.lureStep(u);              // «Чужой голос»: идёт, куда зовёт шептун
    // «Стоять» — героя, которому нужно встать, штраф учтёт действие движения
  }
  async function endTurn(u) {
    for (const k of Object.keys(u.cd)) { if (u.cdFresh && u.cdFresh[k]) delete u.cdFresh[k]; else if (u.cd[k] > 0) u.cd[k]--; }          // перезарядка: счёт — в конце своих ходов
    if (u.t) u.t.disengage = false;                                                                      // «Отход» действует до конца хода, а не дальше
    for (const o of units()) o.conds = o.conds.filter(c => { const gone = !!(c.data && c.data.endAtEndOf === u.id && u.turnsTaken >= (c.data.endTurnNo || 0)); if (gone && c.id === "roar" && o.tempSrc === "roar") { o.temp = 0; o.tempSrc = null; } return !gone; });        // «Боевой рёв»: временные ОЗ исчезают вместе со статусом
    if (alive(u) && B.endTurnSaves) await B.endTurnSaves(u);                                    // повторные спасброски: проклятие, паралич, «Чужой голос»
    tickStatuses(u, "end");
    hookAll(u, "turnEnd", {});
    if (alive(u) && B.hookAllAsync) await B.hookAllAsync(u, "turnEndAsync", {});
    if (u.side === "hero" && u.hero) { u.hero.insp = u.insp; }
    if (B.flushQueue) await B.flushQueue();
  }
  const unitsInOrder = () => B.S.order.map(B.byId).filter(Boolean);
  function currentUnit() { const S = B.S; return B.byId(S.order[S.turn]); }
  function advanceTurn() {
    const S = B.S; let guard = 0;
    do { S.turn++; if (S.turn >= S.order.length) { S.turn = 0; S.round++; log(`— Раунд ${S.round} —`, "round"); if (B.onRound) B.onRound(S.round); } guard++; }
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
