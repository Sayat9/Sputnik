// Создание героя с луком через настоящий finishDraft: колчан на 40 стрел; с мечом стрел нет.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const out = {};
    for (const w of ['shortbow', 'longbow', 'sword']) {
      state.party = [];
      forge = { open: true, step: 'hero', mode: 'new', hadParty: false, draft: newDraft(), errors: [] };
      Object.assign(forge.draft, { gender: 'm', name: 'Тест ' + w, race: 'human', weapon: w, shield: false, age: '', height: '', weight: '' });
      forge.draft.base = { str: '12', dex: '14', con: '12', int: '10', wis: '10', cha: '10' };
      finishDraft();
      const c = state.party[state.party.length - 1];
      out[w] = { arrows: (c.bag || []).filter(e => e.id === 'arrow').map(e => e.qty), slots: (c.bag || []).length, errors: forge.errors && forge.errors.length };
    }
    return out;
  });
  console.log(JSON.stringify(r), errs);
  const bad = r.shortbow.arrows.join() !== '40' || r.longbow.arrows.join() !== '40' || r.sword.arrows.length !== 0;
  console.log(bad ? 'ПРОВАЛ' : 'ok: у лучников колчан на 40 стрел, у мечника стрел нет');
  await b.close();
})();
