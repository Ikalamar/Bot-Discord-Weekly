// Publication d'un tournoi fraichement cree/clone.
//
// cloneTournamentPublic cree toujours le tournoi non publie, quel que soit
// l'etat du tournoi source : c'est le garde-fou de start.gg, la publication
// doit donc etre une etape separee. Requetes identifiees de la meme facon que
// le clone (voir tools/capture-clone.js) : en interceptant les appels reels
// des boutons Publish de /admin/tournament/<slug>/dashboard.
//
// L'option "Discoverable" est refusee par le serveur pour les comptes de moins
// de 6h ("Your account must be at least 6 hours old..."). L'echec est capture
// par fonctionnalite et non leve : le tournoi reste alors publie en "link
// only", pleinement utilisable, plutot que de faire echouer tout le reste.

import { GQL_ENDPOINT, API_HEADERS } from './config.js';

// Ids fixes du modele ProfileFeature de start.gg (pas par tournoi). "events"
// n'est PAS publie via updateProfilePublishing comme les autres sections :
// start.gg utilise une mutation dediee (bulkUpdateEventPublishing), voir plus
// bas.
const FEATURE_IDS = { homepage: 1, registration: 3, attendees: 6, events: 5 };

const UPDATE_PUBLISHING_QUERY = `mutation UpdatePublishing($profileType: String!, $profileId: ID!, $featureId: ID!, $publishState: PublishState!) {
  updateProfilePublishing(profileType: $profileType, profileId: $profileId, featureId: $featureId, publishState: $publishState) {
    id
    publishState
    __typename
  }
}`;

// Section "Events" : requete distincte interceptee au clic sur Save/Publish,
// eventId: null publie tous les events du tournoi d'un coup.
const UPDATE_PHASE_PUBLISHING_QUERY = `mutation UpdatePhasePublishing($tournamentId: ID!, $featureId: ID!, $publishState: PublishState!, $eventId: ID) {
  bulkUpdateEventPublishing(
    tournamentId: $tournamentId
    featureId: $featureId
    publishState: $publishState
    eventId: $eventId
  ) {
    id
    __typename
  }
}`;

// Les events sont crees par start.gg de facon asynchrone juste apres le
// clone, et pas tous en meme temps : ils apparaissent un par un sur
// quelques secondes. bulkUpdateEventPublishing(eventId: null) ne publie que
// les events deja crees au moment de l'appel : le lancer des qu'un premier
// event existe publie ce seul event et laisse les suivants de cote. On
// attend donc que le nombre d'events se stabilise (deux lectures
// consecutives identiques, non nulles) avant de publier.
const TOURNAMENT_EVENTS_QUERY = `query TournamentEvents($id: ID) {
  tournament(id: $id) {
    id
    events {
      id
      __typename
    }
    __typename
  }
}`;

async function waitForEventsToStabilize(page, tournamentId, { timeoutMs = 30_000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let previousCount = null;

  for (;;) {
    const result = await gqlRequest(page, 'TournamentEvents', TOURNAMENT_EVENTS_QUERY, { id: tournamentId });
    const count = result.ok ? (result.data?.tournament?.events?.length ?? 0) : 0;

    if (count > 0 && count === previousCount) return true;
    previousCount = count;

    if (Date.now() >= deadline) return count > 0; // au moins publier ce qui existe plutot que rien
    await page.waitForTimeout(intervalMs);
  }
}

const UPDATE_LISTING_QUERY = `mutation UpdateTournamentListingState($tournamentId: ID!, $fields: UpdateBasicFieldsTournament!) {
  updateBasicFieldsTournament(tournamentId: $tournamentId, fields: $fields) {
    id
    approved
    __typename
  }
}`;

async function gqlRequest(page, operationName, query, variables) {
  const { status, body } = await page.evaluate(
    async ({ endpoint, headers, operationName, query, variables }) => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ operationName, query, variables }),
      });
      return { status: res.status, body: await res.text() };
    },
    { endpoint: GQL_ENDPOINT, headers: API_HEADERS, operationName, query, variables },
  );

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return { ok: false, error: `HTTP ${status} (non-JSON response)` };
  }

  if (data.errors) return { ok: false, error: data.errors.map((e) => e.message).join('; ') };
  return { ok: true, data: data.data };
}

/**
 * Publie les sections (Homepage, Registration, Attendees, Events) d'un tournoi,
 * et le rend optionnellement visible dans la recherche start.gg.
 * @param {import('playwright').Page} page  N'importe quelle page sur le domaine start.gg.
 * @param {number} tournamentId
 * @param {Object} [opts]
 * @param {boolean} [opts.discoverable=true]
 * @param {string[]} [opts.sections]  Sections a publier (defaut : toutes).
 * @param {boolean} [opts.eventsReady]  true : events deja stabilises, pas d'attente ;
 *   false : aucun event, echec direct ; undefined : attend la stabilisation.
 * @returns {Promise<Object>} resultat par section, ex: { homepage: {ok:true}, discoverable: {ok:false, error} }
 */
export async function publishTournament(
  page,
  tournamentId,
  { discoverable = true, sections = Object.keys(FEATURE_IDS), eventsReady } = {},
) {
  const results = {};

  for (const [name, featureId] of Object.entries(FEATURE_IDS)) {
    if (!sections.includes(name)) continue;

    if (name === 'events') {
      const ready = eventsReady ?? (await waitForEventsToStabilize(page, tournamentId));
      if (!ready) {
        results[name] = { ok: false, error: "Aucun event visible cote start.gg apres le delai d'attente (clone pas encore propage)." };
        continue;
      }
      results[name] = await gqlRequest(page, 'UpdatePhasePublishing', UPDATE_PHASE_PUBLISHING_QUERY, {
        tournamentId,
        featureId,
        publishState: 'PUBLISHED',
        eventId: null,
      });
      continue;
    }
    results[name] = await gqlRequest(page, 'UpdatePublishing', UPDATE_PUBLISHING_QUERY, {
      profileType: 'tournament',
      profileId: tournamentId,
      featureId,
      publishState: 'PUBLISHED',
    });
  }

  if (discoverable) {
    results.discoverable = await gqlRequest(page, 'UpdateTournamentListingState', UPDATE_LISTING_QUERY, {
      tournamentId,
      fields: { approved: true },
    });
  }

  return results;
}

// --- Verification de l'etat reel ------------------------------------------------

async function restGet(page, path) {
  const { status, body } = await page.evaluate(
    async ({ path, headers }) => {
      const res = await fetch(path, { headers });
      return { status: res.status, body: await res.text() };
    },
    { path, headers: API_HEADERS },
  );
  if (status !== 200) throw new Error(`GET ${path} -> HTTP ${status}`);
  return JSON.parse(body);
}

/**
 * Etat de publication reel, tel que le voit le dashboard admin.
 * @param {string} slug  Slug start.gg complet, ex: "tournament/mon-tournoi".
 * @returns {Promise<{ homepage: boolean, registration: boolean, attendees: boolean, events: boolean, discoverable: boolean }>}
 */
export async function getPublishState(page, slug) {
  const [tData, eData] = await Promise.all([
    restGet(page, `/api/-/rest/${slug}?expand=[]`),
    restGet(page, `/api/-/rest/${slug}/events?expand=[]`),
  ]);
  const t = tData?.entities?.tournament;
  const events = eData?.entities?.event ?? [];
  return {
    homepage: !!t?.publishing?.publish,
    registration: !!t?.publishing?.registration,
    attendees: !!t?.publishing?.attendees,
    events: events.length > 0 && events.every((e) => !!e.publishing?.publish),
    discoverable: !!t?.approved,
  };
}

/**
 * A appeler juste apres le clone (fait avec publishing: true). start.gg ne
 * publie automatiquement que si les prerequis sont remplis ; on attend que les
 * events soient tous crees, on verifie l'etat reel, puis on ne publie a la main
 * que ce qui manque. Meme forme de retour que publishTournament.
 * @returns {Promise<Object>} { section: { ok, viaClone? , error? } }
 */
export async function ensureTournamentPublished(page, tournamentId, slug, { discoverable = true } = {}) {
  const eventsReady = await waitForEventsToStabilize(page, tournamentId);

  let state = null;
  if (slug) {
    try {
      state = await getPublishState(page, slug);
    } catch {
      state = null; // verification impossible : on publie tout, c'est idempotent
    }
  }

  const sectionNames = Object.keys(FEATURE_IDS);
  const results = {};
  for (const name of sectionNames) {
    if (state?.[name]) results[name] = { ok: true, viaClone: true };
  }

  const missing = sectionNames.filter((name) => !state?.[name]);
  const needDiscoverable = discoverable && !state?.discoverable;
  if (discoverable && state?.discoverable) results.discoverable = { ok: true, viaClone: true };

  if (missing.length > 0 || needDiscoverable) {
    Object.assign(
      results,
      await publishTournament(page, tournamentId, { discoverable: needDiscoverable, sections: missing, eventsReady }),
    );
  }

  return results;
}
