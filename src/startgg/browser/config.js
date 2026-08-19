// Configuration partagee de la lib navigateur start.gg.

import { fileURLToPath } from 'node:url';

// Session persistee dans data/ (jamais versionnee).
export const STATE_FILE = fileURLToPath(new URL('../../../data/startgg-session.json', import.meta.url));

export const LOGIN_PAGE = 'https://www.start.gg/login';
export const CREATE_PAGE = 'https://www.start.gg/create/tournament';
export const CLONE_ENDPOINT = '/api/-/rest/tournament/cloneTournamentPublic';
export const GQL_ENDPOINT = '/api/-/gql';

// Un vrai user agent Chrome. Chromium headless annonce sinon "HeadlessChrome",
// ce qui fait chuter le score reCAPTCHA v3 et peut declencher un challenge
// qu'on ne peut pas resoudre sans fenetre visible.
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

export const CONTEXT_OPTS = {
  userAgent: USER_AGENT,
  viewport: { width: 1280, height: 800 },
  locale: 'en-US',
};

// En-tetes envoyes par le client web start.gg. Sans client-version, les
// endpoints repondent "Out of date client".
export const API_HEADERS = {
  'Content-Type': 'application/json',
  Accept: '*/*',
  'client-version': '20',
  'x-web-source': 'gg-web-rest',
  'apollo-client-id': 'smashgg-legacy',
};
