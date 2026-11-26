// Verification automatique quotidienne. Pour chaque ligne "Weekly" du sheet a J-3 max :
//
//   - tournoi deja existant sur start.gg -> demande dans le salon de controle
//     s'il faut annoncer (aucune creation)
//   - sinon -> creation + publication + annonce, sans intervention. Sans modele
//     exact pour les jeux : creation SANS publication, puis demande de validation
//     aux TOs (salon de controle) avant de publier et annoncer
//   - echec -> message d'instructions manuelles, pour qu'aucune weekly ne
//     passe a la trappe en silence
//
// Chaque ligne est traitee independamment : un echec n'empeche pas les autres
// de passer. Les succes sont memorises (src/state.js) pour ne pas etre
// reproposes les jours suivants ; les echecs non, pour etre reessayes.

const cron = require('node-cron');
const sheets = require('./sheets');
const tournament = require('./startgg/tournament');
const { findExistingMatch } = require('./startgg/duplicate-check');
const { hasBeenProcessed, markProcessed, getLastCheckDate, setLastCheckDate } = require('./state');
const { announce, successMessage, manualFallbackMessage } = require('./discord/announce');
const { askConfirmation, askPublishConfirmation } = require('./discord/confirm');
const { loadConfig } = require('./config-store');

const TIMEZONE = 'Europe/Paris';
const CHECK_HOUR = 8;

// Jour calendaire et heure a Paris, independants du fuseau de la machine.
function parisNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

let running = false;

/**
 * Verification complete. Ne la lance pas deux fois en parallele (rattrapage au
 * demarrage + 8h pile). Le jour n'est memorise comme "verifie" que si la
 * lecture du sheet a abouti : sinon un redemarrage reessaie.
 */
async function runCheck(client) {
  if (running) {
    console.log('Verification deja en cours, ignoree.');
    return;
  }
  running = true;
  try {
    const sheetRead = await processRows(client);
    if (sheetRead) setLastCheckDate(parisNow().day);
  } finally {
    running = false;
  }
}

/** @returns {Promise<boolean>} false si le sheet n'a pas pu etre lu. */
async function processRows(client) {
  let rows;
  try {
    rows = await sheets.getPendingRows();
  } catch (err) {
    console.error('Lecture du Google Sheet impossible:', err.message);
    return false;
  }

  console.log(`${rows.length} ligne(s) a traiter.`);

  for (const row of rows) {
    if (hasBeenProcessed(row.name)) {
      console.log(`"${row.name}" deja traite - ignore.`);
      continue;
    }

    const match = await findExistingMatch(row.name);

    if (match) {
      try {
        await askConfirmation(client, row, match);
        markProcessed(row.name);
        console.log(`"${row.name}" existe deja (${match.url}) - confirmation demandee.`);
      } catch (err) {
        console.error(`Confirmation impossible pour "${row.name}":`, err.message);
      }
      continue;
    }

    try {
      // Aucun modele pour cette combinaison de jeux : on cree la page SANS la
      // publier, puis les TOs valident la publication (salon de controle). Sans
      // salon de controle, personne a qui demander : comportement historique
      // (creation + publication + annonce directes).
      const source = tournament.previewSource(row);
      const askFirst = source.approximateMatch && !!loadConfig().controlChannel;

      const result = await tournament.createTournamentForRow(row, { publish: !askFirst });
      if (!result.url) throw new Error('Creation reussie mais aucune URL retournee par start.gg.');

      if (askFirst) {
        await askPublishConfirmation(client, row, result);
        markProcessed(row.name);
        console.log(`Tournoi cree non publie pour "${row.name}" (pas de modele pour "${source.requestedKey}"): ${result.url} - validation demandee.`);
        continue;
      }

      await announce(client, successMessage(result));
      markProcessed(row.name);
      console.log(`Tournoi cree pour "${row.name}": ${result.url}`);
    } catch (err) {
      console.error(`Creation automatique echouee pour "${row.name}":`, err.message);
      await announce(client, manualFallbackMessage(row, err)).catch(() => {});
    }
  }
  return true;
}

// Tous les jours a 8h, heure de Paris (independant du fuseau du serveur).
function start(client) {
  cron.schedule(
    '0 8 * * *',
    () => {
      runCheck(client).catch((err) => console.error('Verification quotidienne plantee:', err));
    },
    { timezone: TIMEZONE },
  );
  console.log('Verification quotidienne programmee (8h00 Europe/Paris).');

  // Rattrapage : demarre apres 8h sans que la verification du jour ait tourne
  // (bot arrete, redemarre, crash...) -> on la lance tout de suite.
  const now = parisNow();
  if (now.hour >= CHECK_HOUR && getLastCheckDate() !== now.day) {
    console.log("Verification du jour pas encore faite (demarrage apres 8h) : rattrapage lance.");
    runCheck(client).catch((err) => console.error('Rattrapage de la verification plante:', err));
  }
}

module.exports = { start, runCheck };
