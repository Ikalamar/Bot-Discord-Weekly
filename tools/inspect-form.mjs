// Outil de diagnostic : liste les champs de formulaire d'une page start.gg,
// pour construire des selecteurs fiables plutot que de les deviner.
//
// Necessite une session valide (data/startgg-session.json).
// Usage : node tools/inspect-form.js [url]

import { chromium } from 'playwright';
import { STATE_FILE, CONTEXT_OPTS } from '../src/startgg/browser/config.js';
import { dismissCookieConsent } from '../src/startgg/browser/util.js';

const TARGET = process.argv[2] || 'https://www.start.gg/create/tournament';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ ...CONTEXT_OPTS, storageState: STATE_FILE });
const page = await context.newPage();

await page.goto(TARGET, { waitUntil: 'networkidle' });
await dismissCookieConsent(page);
await page.waitForTimeout(2_000);

if (page.url().includes('/login')) {
  console.error('Redirige vers /login : session absente ou expiree.');
  await browser.close();
  process.exit(1);
}

const controls = await page.evaluate(() => {
  const labelFor = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return l.innerText.trim();
    }
    const wrap = el.closest('label');
    if (wrap) return wrap.innerText.trim();
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
  };

  return [...document.querySelectorAll('input, textarea, select, [role="combobox"], button[type="submit"]')].map(
    (el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || el.getAttribute('role') || '',
      name: el.getAttribute('name') || '',
      id: el.id || '',
      label: labelFor(el),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }),
  );
});

console.log(`\nChamps sur ${page.url()} :\n`);
for (const c of controls) {
  if (!c.visible) continue;
  console.log(
    [c.tag + (c.type ? `[${c.type}]` : ''), c.name && `name=${c.name}`, c.id && `id=${c.id}`, c.label && `label="${c.label}"`]
      .filter(Boolean)
      .join('  '),
  );
}

console.log('\nFenetre ouverte 30s pour inspection manuelle...');
await page.waitForTimeout(30_000);
await browser.close();
