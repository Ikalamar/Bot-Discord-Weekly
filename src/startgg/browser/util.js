// Petits utilitaires partages par la lib navigateur.

// Le bandeau de consentement (CookieYes) peut s'afficher dans la page ou dans
// une iframe, et recouvre les formulaires.
export async function dismissCookieConsent(page) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      for (const label of ['Accept All', 'Accept all', 'Reject All', 'Reject all']) {
        const btn = frame.getByRole('button', { name: label });
        if (await btn.count().catch(() => 0)) {
          await btn.first().click().catch(() => {});
          return;
        }
      }
    }
    await page.waitForTimeout(500);
  }
}

// Les champs masques ignorent souvent .fill() ; on tape caractere par caractere.
export async function typeMasked(page, selector, value) {
  const el = page.locator(selector).first();
  await el.click();
  await el.fill('');
  await el.pressSequentially(value, { delay: 30 });
}

// Lit la cle publique reCAPTCHA v3 depuis les balises script de la page.
export async function getRecaptchaSiteKey(page) {
  return page.evaluate(() => {
    const s = [...document.querySelectorAll('script[src*="recaptcha"]')]
      .map((x) => x.src)
      .find((x) => x.includes('render='));
    return s ? new URL(s).searchParams.get('render') : null;
  });
}

// Accepte des secondes unix, une Date ou une chaine parsable ; rend des secondes unix.
export function toUnix(v) {
  if (v instanceof Date) return Math.floor(v.getTime() / 1000);
  if (typeof v === 'number') return v;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${v}`);
  return Math.floor(ms / 1000);
}

// Formate au masque du formulaire de creation : "mm/dd/yyyy hh:mm (a|p)m".
export function toMask(v) {
  if (typeof v === 'string' && /\d{2}\/\d{2}\/\d{4}/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(typeof v === 'number' ? v * 1000 : v);
  const p = (n) => String(n).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${ampm}`;
}
