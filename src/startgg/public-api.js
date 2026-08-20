// Client de l'API GraphQL publique start.gg (lecture seule, token developpeur).

const STARTGG_API_URL = 'https://api.start.gg/gql/alpha';

async function queryStartgg(query, variables) {
  const token = process.env.STARTGG_API_TOKEN;
  if (!token) throw new Error('STARTGG_API_TOKEN manquant (voir .env.example).');

  const res = await fetch(STARTGG_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    const message = json.errors ? json.errors.map((e) => e.message).join('; ') : res.statusText;
    throw new Error(`start.gg API error (HTTP ${res.status}): ${message}`);
  }

  return json.data;
}

const TOURNAMENT_SEARCH_QUERY = `
  query TournamentSearch($name: String!) {
    tournaments(query: { perPage: 5, filter: { name: $name } }) {
      nodes {
        id
        name
        slug
        startAt
        timezone
      }
    }
  }
`;

/**
 * Cherche un tournoi par nom exact (insensible a la casse).
 * @returns {Promise<{ url: string, startAt: number|null, timezone: string|null }|null>}
 */
async function findTournamentByExactName(name) {
  const data = await queryStartgg(TOURNAMENT_SEARCH_QUERY, { name });
  const nodes = data.tournaments?.nodes || [];
  const match = nodes.find((t) => (t.name || '').trim().toLowerCase() === name.trim().toLowerCase());
  if (!match) return null;
  return { url: `https://www.start.gg/${match.slug}`, startAt: match.startAt ?? null, timezone: match.timezone ?? null };
}

const TOURNAMENT_IMAGES_QUERY = `
  query TournamentImages($id: ID!) {
    tournament(id: $id) {
      images {
        type
        url
      }
    }
  }
`;

/**
 * @param {number} tournamentId
 * @returns {Promise<string|null>} URL de la banniere, ou null si non configuree.
 */
async function getTournamentBannerUrl(tournamentId) {
  const data = await queryStartgg(TOURNAMENT_IMAGES_QUERY, { id: tournamentId });
  const images = data.tournament?.images || [];
  return images.find((i) => i.type === 'banner')?.url ?? null;
}

module.exports = { queryStartgg, findTournamentByExactName, getTournamentBannerUrl };
