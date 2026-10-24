// Сокровище 9 класса «Ночной страж»: заряды на заход (3, +2 за первый спуск на новый этаж), караул в Отдыхе, сброс в новом заходе.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const A = await p.evaluate(() => {
    const out = {}, r = state.run;
    out.none = ngCharges() === 0;                                   // сокровища нет — зарядов нет
    treasure('guard').owned = true; r.ng = null; r.reached = null;
    out.base = ngCharges();                                         // 3
    const goTo2 = () => { r.floor = 1; delete r.variant; r.pos = { x: 0, y: 10 }; r.day = 2; r.act = 2; switchFloor(); };
    goTo2(); out.after2 = ngCharges();                              // 5
    r.pos = { x: 0, y: 10 }; switchFloor(); out.back1 = r.floor === 1 && ngCharges() === 5;
    goTo2(); out.again2 = ngCharges();                              // новых зарядов нет: 5
    out.log = state.run.log ? JSON.stringify(state.run.log).includes('Ночной страж: +2') : true;
    // 3-й этаж: гипотетический вход
    ngEnterFloor(3); out.after3 = ngCharges(); ngEnterFloor(3); out.again3 = ngCharges();
    r.ng.granted = [2]; r.reached = [1, 2]; r.ng.used = 0;
    // отдых со стражем
    r.day = 5; r.act = 1; r.pos = { x: 5, y: 5 };
    state.party.forEach(c => { c.hp = 1; });
    const fat0 = state.party.map(c => r.status[c.id].fat);
    dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 0])), ng: false };
    out.html1 = /Ночной страж · заряды 5/.test(restOverlay());
    // переключатель и конфликт с караулом героя
    dgUi.rest.ng = true; dgUi.rest.guard = {}; out.html2 = /сторожит лагерь/.test(restOverlay());
    // много отдыхов подряд: встреч нет, заряды тратятся
    let enc = 0, spent = 0;
    for (let i = 0; i < 5; i++) {
      r.pending = null; dgUi.enc = null; r.queue = [];
      const before = ngCharges();
      dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 0])), ng: true };
      act('rest');
      if (r.pending || dgUi.enc) enc++;
      spent += before - ngCharges();
    }
    out.enc = enc; out.spent = spent; out.left = ngCharges();
    out.heal = state.party.every(c => c.hp > 1);                    // все спали и лечились
    // без заряда страж не включается
    dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 0])), ng: true };
    out.noCharge = ngCharges() === 0; act('rest'); out.stayed = ngCharges() === 0;
    // новый заход сбрасывает запас
    endRun(true); newRun(); out.reset = ngCharges() === 3 && ngState().granted.length === 0 && ngState().used === 0;
    return out;
  });
  ok('без сокровища зарядов нет', A.none); ok('с сокровищем 3 заряда', A.base === 3, A.base);
  ok('первый спуск на 2 этаж: 5 зарядов', A.after2 === 5, A.after2); ok('возврат на 1 этаж ничего не меняет', A.back1);
  ok('повторный спуск на 2 этаж зарядов не даёт', A.again2 === 5, A.again2);
  ok('спуск на 3 этаж даёт ещё +2 один раз', A.after3 === 7 && A.again3 === 7, JSON.stringify([A.after3, A.again3]));
  ok('кнопка и пояснение в окне Отдыха', A.html1 && A.html2);
  ok('5 ночей со стражем: ночных встреч нет, потрачено 5 зарядов, все лечатся', A.enc === 0 && A.spent === 5 && A.left === 0 && A.heal, JSON.stringify(A));
  ok('без зарядов страж не сторожит (заряд не уходит в минус)', A.noCharge && A.stayed);
  ok('новый заход сбрасывает заряды до 3', A.reset);
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
