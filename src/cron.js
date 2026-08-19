// Verification automatique quotidienne. Pour chaque ligne "Weekly" du sheet a J-3 max :
//
//   - tournoi deja existant sur start.gg -> demande dans le salon de controle
//     s'il faut annoncer (aucune creation)
//   - sinon -> creation + publication + annonce, sans intervention
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
const { hasBeenProcessed, markProcessed } = require('./state');
const { announce, successMessage, warningMessage, manualFallbackMessage } = require('./discord/announce');
const { askConfirmation } = require('./discord/confirm');

async function runCheck(client) {
  let rows;
  try {
    rows = await sheets.getPendingRows();
  } catch (err) {
    console.error('Lecture du Google Sheet impossible:', err.message);
    return;
  }

  console.log(`${rows.length} ligne(s) a traiter.`);

  for (const row of rows) {
    if (hasBeenProcessed(row.name)) continue;

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
      const result = await tournament.createTournamentForRow(row);
      if (!result.url) throw new Error('Creation reussie mais aucune URL retournee par start.gg.');

      await announce(client, result.approximateMatch ? warningMessage(result) : successMessage(result));
      markProcessed(row.name);
      console.log(`Tournoi cree pour "${row.name}": ${result.url}`);
    } catch (err) {
      console.error(`Creation automatique echouee pour "${row.name}":`, err.message);
      await announce(client, manualFallbackMessage(row, err)).catch(() => {});
    }
  }
}

// Tous les jours a 8h, heure de Paris (independant du fuseau du serveur).
function start(client) {
  cron.schedule(
    '0 8 * * *',
    () => {
      runCheck(client).catch((err) => console.error('Verification quotidienne plantee:', err));
    },
    { timezone: 'Europe/Paris' },
  );
  console.log('Verification quotidienne programmee (8h00 Europe/Paris).');
}

module.exports = { start, runCheck };
