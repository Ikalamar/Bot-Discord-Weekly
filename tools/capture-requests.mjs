// Outil de diagnostic : ouvre start.gg dans une fenetre visible et affiche les
// requetes reseau declenchees par les actions de l'interface.
//
// C'est avec cet outil qu'ont ete identifies les endpoints internes utilises
// par la lib (cloneTournamentPublic, updateProfilePublishing...). A relancer si
// start.gg change son interface et que la creation ou la publication casse.
//
// Usage : node tools/capture-requests.js [url]

import { chromium } from 'playwright';
import { STATE_FILE, CONTEXT_OPTS } from '../src/startgg/browser/config.js';

const TARGET = process.argv[2] || 'https://www.start.gg/create/tournament';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ ...CONTEXT_OPTS, storageState: STATE_FILE });
const page = await context.newPage();

page.on('request', (req) => {
  if (req.method() === 'GET') return;
  const url = req.url();
  if (!url.includes('/api/')) return;
  console.log(`\n=== ${req.method()} ${url}`);
  const body = req.postData();
  if (body) console.log('BODY:', body.slice(0, 1200));
});

await page.goto(TARGET, { waitUntil: 'networkidle' });
console.log(`Fenetre ouverte sur ${TARGET}. Declenche l'action a observer. Ecoute 300s...`);
await page.waitForTimeout(300_000);
await browser.close();
