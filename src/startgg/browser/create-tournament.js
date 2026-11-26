// Creation de tournoi (vierge ou clone) sur une page Playwright deja ouverte
// sur la page de creation. Le cycle de vie du navigateur appartient a StartGG
// (index.js).

import { CREATE_PAGE, CLONE_ENDPOINT, API_HEADERS } from './config.js';
import { dismissCookieConsent, typeMasked, getRecaptchaSiteKey, toUnix, toMask } from './util.js';

// Levee quand le srcTournamentId a cloner n'existe pas.
export class SourceTournamentNotFoundError extends Error {
  constructor(srcTournamentId) {
    super(`Source tournament ${srcTournamentId} does not exist`);
    this.name = 'SourceTournamentNotFoundError';
    this.code = 'SOURCE_NOT_FOUND';
    this.srcTournamentId = srcTournamentId;
  }
}

export const DEFAULT_CLONING_OPTIONS = {
  details: true,
  permissions: true,
  events: true,
  registrationOptions: true,
  attendeeRequirements: true,
  payments: true,
  bracketSetup: true,
  schedule: true,
  stationsAndStreams: true,
  blockList: true,
  // Cases ajoutees par start.gg a l'ecran de clone (valeurs par defaut de l'UI,
  // sauf publishing qui est decoche par defaut). Publishing ne s'applique que
  // si le tournoi remplit les prerequis de publication, sinon il reste non
  // publie : publish-tournament.js verifie et complete a la main si besoin.
  publishing: true,
  shortSlug: true,
  hubs: true,
};

/**
 * @param {import('playwright').Page} page  Doit etre sur la page de creation.
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.primaryContact
 * @param {string} [params.primaryContactType='email']
 * @param {number|string|Date} params.startAt
 * @param {number|string|Date} params.endAt
 * @param {number} [params.srcTournamentId]  Si defini, clone ce tournoi.
 * @param {boolean} [params.publish=true]  Coche "Publishing" au clone ; false = tournoi cree non publie.
 * @param {Object} [params.cloningOptions]
 * @returns {Promise<{ id: number|null, slug: string|null, name: string }>}
 */
export async function createTournamentOnPage(page, params) {
  const {
    name,
    primaryContact,
    primaryContactType = 'email',
    startAt,
    endAt,
    srcTournamentId = null,
    publish = true,
    // Non publie : on ne deplace pas le short URL vers une page invisible.
    cloningOptions = { ...DEFAULT_CLONING_OPTIONS, publishing: publish, shortSlug: DEFAULT_CLONING_OPTIONS.shortSlug && publish },
  } = params;

  if (srcTournamentId != null) {
    return cloneTournament(page, {
      name,
      primaryContact,
      primaryContactType,
      startAt: toUnix(startAt),
      endAt: toUnix(endAt),
      srcTournamentId,
      cloningOptions,
    });
  }

  return fillCreateForm(page, {
    name,
    primaryContact,
    startAt: toMask(startAt),
    endAt: toMask(endAt),
  });
}

// --- Clone (REST + reCAPTCHA genere dans la page) ----------------------------

async function cloneTournament(page, payload) {
  const siteKey = await getRecaptchaSiteKey(page);
  if (!siteKey) throw new Error('Could not find the reCAPTCHA site key on the page.');

  const { status, body } = await page.evaluate(
    async ({ siteKey, payload, endpoint, headers }) => {
      const captcha = await new Promise((resolve) => {
        window.grecaptcha.ready(() =>
          window.grecaptcha
            .execute(siteKey, { action: 'create_tournament' })
            .then(resolve)
            .catch(() => resolve(null)),
        );
      });
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...payload, captcha, validationKey: 'create-new-tournament' }),
      });
      return { status: res.status, body: await res.text() };
    },
    { siteKey, payload, endpoint: CLONE_ENDPOINT, headers: API_HEADERS },
  );

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Clone failed: HTTP ${status} (non-JSON response)`);
  }

  if (status !== 200 || data.success === false) {
    const message = data.message || `HTTP ${status}`;
    if (/source tournament does not exist/i.test(message)) {
      throw new SourceTournamentNotFoundError(payload.srcTournamentId);
    }
    throw new Error(`Clone failed: ${message}`);
  }

  // Selon la reponse, entities.tournament est un tableau ou un objet seul ;
  // `result` porte l'id quand resultEntity vaut "tournament".
  const entity = data?.entities?.tournament;
  const t = Array.isArray(entity) ? entity[0] : entity;
  let id = t?.id ?? (data?.resultEntity === 'tournament' ? data.result : null) ?? null;
  let slug = t?.slug ?? null;

  // Le tournoi existe (clone reussi) : si la reponse ne le decrit pas, on le
  // retrouve par son slug devine depuis le nom (start.gg slugifie le nom).
  if (!id || !slug) {
    console.warn(`Clone reussi mais tournoi non decrit dans la reponse (cles: ${Object.keys(data).join(', ')}) - recherche par nom.`);
    const found = await lookupBySlugGuess(page, payload.name);
    id = id ?? found?.id ?? null;
    slug = slug ?? found?.slug ?? null;
  }
  return { id, slug, name: t?.name ?? payload.name };
}

async function lookupBySlugGuess(page, name) {
  const guess = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  try {
    const { status, body } = await page.evaluate(
      async ({ path, headers }) => {
        const res = await fetch(path, { headers });
        return { status: res.status, body: await res.text() };
      },
      { path: `/api/-/rest/tournament/${guess}?expand=[]`, headers: API_HEADERS },
    );
    if (status !== 200) return null;
    const t = JSON.parse(body)?.entities?.tournament;
    return t ? { id: t.id ?? null, slug: t.slug ?? null } : null;
  } catch {
    return null;
  }
}

// --- Creation vierge (formulaire) --------------------------------------------

async function fillCreateForm(page, { name, primaryContact, startAt, endAt }) {
  await dismissCookieConsent(page);
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="primaryContact"]', primaryContact);
  await typeMasked(page, 'input[name="startAt"]', startAt);
  await typeMasked(page, 'input[name="endAt"]', endAt);

  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  // La page de creation enregistre sans renvoyer l'id du nouveau tournoi.
  // Passer par le clone si l'id/slug est necessaire.
  return { id: null, slug: null, name };
}

export { CREATE_PAGE };
