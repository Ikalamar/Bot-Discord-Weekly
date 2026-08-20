// Attend que la banniere fraichement clonee soit reellement servie dans la
// balise og:image de la page publique, avant d'annoncer le lien sur Discord.
//
// Sans ca : le clone genere une copie fraiche de l'image (nouveau hash de
// fichier a chaque clone), et juste apres la creation il arrive que la page
// publique (cache CDN / rendu serveur pour crawlers) ne reflete pas encore
// cette image. Si le crawler Discord fetch le lien a ce moment-la, il fige un
// apercu par defaut (logo generique start.gg) et le met en cache cote Discord
// pendant longtemps, meme une fois l'image reellement disponible quelques
// secondes plus tard. Voir le bug observe sur "Bagarre 2 Bar".
//
// On reproduit ici exactement le fetch que fait Discord (meme user-agent) et
// on compare og:image a la banniere reelle (API GraphQL) jusqu'a ce qu'ils
// correspondent, ou jusqu'a un timeout.

const { getTournamentBannerUrl } = require('./public-api');

const DISCORD_USER_AGENT = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';
const OG_IMAGE_RE = /<meta property="og:image" content="([^"]+)"/;

async function fetchOgImage(slug) {
  // result.slug (REST clone + GraphQL) inclut deja le prefixe "tournament/".
  const res = await fetch(`https://www.start.gg/${slug}`, {
    headers: { 'User-Agent': DISCORD_USER_AGENT },
    redirect: 'follow',
  });
  if (!res.ok) return null;
  const html = await res.text();
  return html.match(OG_IMAGE_RE)?.[1] ?? null;
}

/**
 * Poll jusqu'a ce que og:image reflete la vraie banniere du tournoi, ou
 * jusqu'au timeout. Best-effort : ne leve jamais, ne bloque jamais
 * indefiniment.
 * @param {number} tournamentId
 * @param {string} slug
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 * @returns {Promise<boolean>} true si og:image confirme a temps, false sinon
 *   (banniere absente, timeout, ou erreur reseau : on n'annonce pas en retard
 *   pour autant).
 */
async function waitForBannerReady(tournamentId, slug, { timeoutMs = 45_000, intervalMs = 4_000 } = {}) {
  if (!slug) return false;

  let bannerUrl;
  try {
    bannerUrl = await getTournamentBannerUrl(tournamentId);
  } catch {
    return false;
  }
  if (!bannerUrl) return false; // pas de banniere configuree sur ce tournoi, rien a attendre

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ogImage = await fetchOgImage(slug).catch(() => null);
    if (ogImage === bannerUrl) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

module.exports = { waitForBannerReady };
