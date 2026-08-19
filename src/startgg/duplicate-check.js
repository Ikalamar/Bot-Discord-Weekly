// Verification "ce tournoi existe-t-il deja ?", partagee par le cron
// automatique et la commande /next-tournament.
//
// Deux strategies successives : le slug devine (fiable meme si le nom reel
// differe legerement, et voit les tournois non publies du compte du bot), puis
// la recherche publique par nom en secours pour les noms atypiques.

const { findTournamentByExactName } = require('./public-api');
const { findBySlugGuess } = require('./admin-api');

/**
 * @param {string} name
 * @returns {Promise<{ url: string, published: boolean, startAt: number|null, timezone: string|null }|null>}
 */
async function findExistingMatch(name) {
  try {
    const bySlug = await findBySlugGuess(name);
    if (bySlug) return bySlug;
  } catch (err) {
    console.warn(`Recherche par slug echouee pour "${name}":`, err.message);
  }

  try {
    const byName = await findTournamentByExactName(name);
    if (byName) return { ...byName, published: true };
  } catch (err) {
    console.warn(`Recherche publique echouee pour "${name}":`, err.message);
  }

  return null;
}

module.exports = { findExistingMatch };
