// Memoire locale des tournois deja traites par le cron quotidien.
//
// La fenetre J-3 fait ressortir la meme ligne du sheet plusieurs matins de
// suite ; sans cette trace, le bot recreerait ou redemanderait confirmation
// chaque jour. La cle est le nom exact du tournoi : chaque edition ayant un
// nom different ("#134", "#135"), aucune edition future n'est bloquee.
//
// Un echec n'est volontairement pas marque, pour etre reessaye le lendemain.

const fs = require('fs');
const { DATA_DIR, PROCESSED_FILE } = require('./paths');

function load() {
  if (!fs.existsSync(PROCESSED_FILE)) return {};
  return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
}

function save(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(store, null, 2) + '\n', 'utf8');
}

function hasBeenProcessed(name) {
  return Boolean(load()[name]);
}

function markProcessed(name) {
  const store = load();
  store[name] = new Date().toISOString();
  save(store);
}

module.exports = { hasBeenProcessed, markProcessed };
