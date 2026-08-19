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

// Ids fixes du modele ProfileFeature de start.gg (pas par tournoi).
const FEATURE_IDS = { homepage: 1, registration: 3, attendees: 6, events: 8 };

const UPDATE_PUBLISHING_QUERY = `mutation UpdatePublishing($profileType: String!, $profileId: ID!, $featureId: ID!, $publishState: PublishState!) {
  updateProfilePublishing(profileType: $profileType, profileId: $profileId, featureId: $featureId, publishState: $publishState) {
    id
    publishState
    __typename
  }
}`;

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
 * Publie toutes les sections (Homepage, Registration, Attendees, Events) d'un
 * tournoi, et le rend optionnellement visible dans la recherche start.gg.
 * @param {import('playwright').Page} page  N'importe quelle page sur le domaine start.gg.
 * @param {number} tournamentId
 * @param {{ discoverable?: boolean }} [opts]
 * @returns {Promise<Object>} resultat par section, ex: { homepage: {ok:true}, discoverable: {ok:false, error} }
 */
export async function publishTournament(page, tournamentId, { discoverable = true } = {}) {
  const results = {};

  for (const [name, featureId] of Object.entries(FEATURE_IDS)) {
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
