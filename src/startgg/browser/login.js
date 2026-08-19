// Operations de la page de login. Le cycle de vie du navigateur appartient a
// la classe StartGG (index.js).

import { LOGIN_PAGE } from './config.js';
import { dismissCookieConsent } from './util.js';

/**
 * Remplit et soumet le formulaire de login, et retourne l'utilisateur connecte.
 * Le reCAPTCHA v3 de cette page est invisible : l'app genere le token a la soumission.
 *
 * @param {import('playwright').Page} page
 * @param {{ email: string, password: string, timeoutMs?: number }} params
 */
export async function performLogin(page, { email, password, timeoutMs = 60_000 }) {
  await page.goto(LOGIN_PAGE, { waitUntil: 'domcontentloaded' });
  await dismissCookieConsent(page);

  await fill(page, 'input[name="loginEmail"]', email);
  await fill(page, 'input[name="loginPassword"]', password);
  await clickLogin(page);

  const response = await page.waitForResponse(
    (r) => r.url().includes('/api/-/rest/user/login') && r.request().method() === 'POST' && r.ok(),
    { timeout: timeoutMs },
  );

  const raw = await response.json();
  return raw?.entities?.users ?? null;
}

async function fill(page, selector, value) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 10_000 });
  await el.fill(value);
}

async function clickLogin(page) {
  // Le bandeau de consentement se charge en asynchrone et peut couvrir le bouton.
  await dismissCookieConsent(page);
  const btn = page.getByRole('button', { name: 'Login', exact: true });
  await btn.waitFor({ state: 'visible', timeout: 10_000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}
