// Orchestration de la creation : detecte le type de weekly, resout le tournoi
// de reference a cloner, calcule les horaires, puis delegue a la lib navigateur.

const path = require('path');
const { pathToFileURL } = require('url');

const { SOURCE_REGISTRY_FILE, SCHEDULE_FILE, GAMES_FILE, SESSION_FILE } = require('../paths');
const { loadConfig } = require('../config-store');

const sourceRegistry = require(SOURCE_REGISTRY_FILE);
const schedule = require(SCHEDULE_FILE);
const gamesConfig = require(GAMES_FILE);
const { waitForBannerReady } = require('./wait-for-banner');

const BROWSER_LIB_URL = pathToFileURL(path.join(__dirname, 'browser', 'index.js')).href;

const DAY_NUMBERS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function detectType(name) {
  if (/bagarre\s*(2|de)\s*bar/i.test(name)) return 'Bagarre 2 Bar';
  if (/72\s*hit\s*combo/i.test(name)) return '72 Hit Combo';
  throw new Error(`Impossible de determiner le type de weekly depuis le nom "${name}".`);
}

// Fait correspondre un nom de jeu tel qu'ecrit dans le sheet a la cle canonique
// de games.json (via les alias), sinon garde le texte tel quel.
function canonicalizeGame(raw) {
  const needle = raw.trim().toLowerCase();
  const found = gamesConfig.games.find((g) => g.aliases.some((a) => a.toLowerCase() === needle));
  return found ? found.key : raw.trim();
}

// L'ordre d'ecriture des jeux dans le sheet ne doit pas compter : on trie.
function comboKey(games) {
  return games
    .map(canonicalizeGame)
    .sort((a, b) => a.localeCompare(b))
    .join(',');
}

/**
 * Cherche dans source-registry.json un tournoi de reference dont la liste
 * d'events correspond exactement a la combinaison de jeux demandee. Sans
 * correspondance exacte, se rabat sur la premiere reference du meme type et
 * signale `approximateMatch: true`.
 */
function resolveSource(type, games) {
  const registry = sourceRegistry[type] || {};
  const key = comboKey(games);

  if (registry[key] != null) {
    return { srcTournamentId: registry[key], matchedKey: key, requestedKey: key, approximateMatch: false };
  }

  // Repli : le modele qui couvre le plus de jeux demandes, sans en contenir
  // d'autres (ex: demande SSBU+SF6+Riftbound -> modele "SF6,SSBU" plutot que
  // "SSBU" seul). A defaut, Smash seul ("SSBU"), puis la premiere reference.
  const requested = new Set(key.split(','));
  const subsets = Object.entries(registry)
    .filter(([k, id]) => id != null && k.split(',').every((g) => requested.has(g)))
    .sort((a, b) => b[0].split(',').length - a[0].split(',').length);
  const fallback =
    subsets[0] ?? (registry.SSBU != null ? ['SSBU', registry.SSBU] : Object.entries(registry).find(([, id]) => id != null));
  if (!fallback) {
    throw new Error(`Aucun tournoi de reference dans source-registry.json pour "${type}". Ajoute au moins une entree.`);
  }
  const [fallbackKey, fallbackId] = fallback;
  return { srcTournamentId: fallbackId, matchedKey: fallbackKey, requestedKey: key, approximateMatch: true };
}

/**
 * Quel modele serait utilise pour cette ligne, sans rien creer. `approximateMatch`
 * vrai = aucun modele pour la combinaison de jeux demandee.
 */
function previewSource(row) {
  return resolveSource(detectType(row.name), row.games);
}

/** Combine la date du sheet avec les horaires fixes de schedule.json. */
function computeDates(type, date) {
  const sched = schedule[type];
  if (!sched || sched.startTime == null || sched.endTime == null) {
    throw new Error(`Horaires manquants dans schedule.json pour "${type}". Renseigne startTime/endTime.`);
  }

  const expectedDay = DAY_NUMBERS[sched.dayOfWeek];
  if (expectedDay != null && date.getDay() !== expectedDay) {
    console.warn(`Attention : la date fournie pour "${type}" ne tombe pas un ${sched.dayOfWeek} (verifie le sheet).`);
  }

  const [startH, startM] = sched.startTime.split(':').map(Number);
  const [endH, endM] = sched.endTime.split(':').map(Number);

  const startAt = new Date(date);
  startAt.setHours(startH, startM, 0, 0);
  const endAt = new Date(date);
  endAt.setHours(endH, endM, 0, 0);

  return { startAt, endAt };
}

function requireCredentials() {
  const email = process.env.STARTGG_EMAIL;
  const password = process.env.STARTGG_PASSWORD;
  if (!email || !password) throw new Error('STARTGG_EMAIL / STARTGG_PASSWORD manquants (voir .env.example).');
  return { email, password };
}

async function openSession() {
  const { StartGG } = await import(BROWSER_LIB_URL);
  const gg = new StartGG({ ...requireCredentials(), headless: true, sessionFile: SESSION_FILE });
  await gg.login();
  return gg;
}

// Publie ce que le clone n'a pas publie, puis attend que la banniere soit
// servie avant l'annonce, pour eviter que Discord ne fige un apercu par
// defaut en cache (voir wait-for-banner.js).
async function publishAndWait(gg, { id, slug, name }) {
  const publishing = await gg.ensurePublished(id, slug, { discoverable: true });
  for (const [feature, r] of Object.entries(publishing).filter(([, r]) => !r.ok)) {
    console.warn(`Publication "${feature}" echouee pour "${name}": ${r.error}`);
  }

  const bannerReady = await waitForBannerReady(id, slug);
  if (!bannerReady) {
    console.warn(`Banniere non confirmee a temps pour "${name}" avant annonce (apercu Discord possiblement generique).`);
  }
  return publishing;
}

/**
 * Cree le tournoi start.gg pour une ligne du sheet, et le publie sauf si
 * `publish` est faux. Par defaut, un modele approximatif (jeux manquants)
 * n'est PAS publie : c'est aux TOs de valider (voir publishCreatedTournament).
 * @param {{ name: string, date: Date, games: string[] }} row
 * @param {{ publish?: boolean }} [opts]
 */
async function createTournamentForRow(row, opts = {}) {
  const type = detectType(row.name);
  const { srcTournamentId, matchedKey, approximateMatch } = resolveSource(type, row.games);
  const { startAt, endAt } = computeDates(type, row.date);
  const publish = opts.publish ?? !approximateMatch;

  const config = loadConfig();
  if (!config.contact?.value) throw new Error('config/config.json : contact.value est vide.');

  const gg = await openSession();
  try {
    const result = await gg.createTournament({
      name: row.name,
      primaryContact: config.contact.value,
      primaryContactType: config.contact.type,
      startAt,
      endAt,
      srcTournamentId,
      publish,
    });

    let publishing = null;
    if (publish && result.id) {
      publishing = await publishAndWait(gg, { id: result.id, slug: result.slug, name: row.name });
    }

    return {
      ...result,
      url: result.slug ? `https://www.start.gg/${result.slug}` : null,
      type,
      matchedKey,
      approximateMatch,
      requestedGames: row.games,
      published: publish,
      publishing,
      startAt,
      timezone: schedule[type].timezone,
    };
  } finally {
    await gg.close();
  }
}

/**
 * Publie un tournoi cree non publie (apres validation des TOs).
 * @param {{ id: number, slug: string, name: string }} tournamentInfo
 */
async function publishCreatedTournament({ id, slug, name }) {
  const gg = await openSession();
  try {
    return await publishAndWait(gg, { id, slug, name });
  } finally {
    await gg.close();
  }
}

module.exports = {
  detectType,
  canonicalizeGame,
  comboKey,
  resolveSource,
  previewSource,
  computeDates,
  createTournamentForRow,
  publishCreatedTournament,
};
