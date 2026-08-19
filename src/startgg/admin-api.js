// Recherche d'un tournoi en devinant son slug depuis son nom.
//
// start.gg derive le slug du nom (minuscules, ponctuation -> tiret), donc on
// peut interroger directement le tournoi via la session sauvegardee, sans
// dependre de la recherche par nom (qui echoue des que le nom reel differe
// legerement de celui du sheet : "72 HIT COMBO # 13" vs "72 Hit Combo #13").
//
// Ce endpoint repond meme quand le compte du bot n'est pas admin du tournoi,
// ce qui couvre les tournois publics crees par d'autres comptes ainsi que les
// tournois pas encore publies crees par le bot lui-meme.
//
// Limite : un tournoi non publie cree par un AUTRE compte, sur lequel le bot
// n'est pas admin, reste invisible. Limite de la plateforme.

const path = require('path');
const { pathToFileURL } = require('url');

const API_CLIENT_URL = pathToFileURL(path.join(__dirname, 'browser', 'api-client.js')).href;

// Reproduit la generation de slug de start.gg.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * @param {string} name
 * @returns {Promise<{ url: string, published: boolean, startAt: number|null, timezone: string|null }|null>}
 */
async function findBySlugGuess(name) {
  const { apiGet } = await import(API_CLIENT_URL);
  const slug = slugify(name);

  let data;
  try {
    data = await apiGet(`/api/-/rest/tournament/${slug}?expand=[]`);
  } catch (err) {
    if (/HTTP 404/.test(err.message)) return null;
    throw err;
  }

  const tournament = data?.entities?.tournament;
  if (!tournament) return null;

  return {
    url: `https://www.start.gg/${tournament.slug}`,
    published: !!tournament.published,
    startAt: tournament.startAt ?? null,
    timezone: tournament.timezone ?? null,
  };
}

module.exports = { findBySlugGuess, slugify };
