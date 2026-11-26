// Memoire locale des tournois deja traites par le cron quotidien.
//
// La fenetre J-3 fait ressortir la meme ligne du sheet plusieurs matins de
// suite ; sans cette trace, le bot recreerait ou redemanderait confirmation
// chaque jour. La cle est le nom exact du tournoi : chaque edition ayant un
// nom different ("#134", "#135"), aucune edition future n'est bloquee.
//
// Un echec n'est volontairement pas marque, pour etre reessaye le lendemain.

const fs = require('fs');
const { DATA_DIR, PROCESSED_FILE, LAST_CHECK_FILE } = require('./paths');

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

// Date (jour calendaire Europe/Paris, "YYYY-MM-DD") de la derniere verification
// quotidienne menee a bout. Sert au rattrapage si le bot demarre apres 8h.
function getLastCheckDate() {
  if (!fs.existsSync(LAST_CHECK_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(LAST_CHECK_FILE, 'utf8')).date ?? null;
  } catch {
    return null;
  }
}

function setLastCheckDate(date) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LAST_CHECK_FILE, JSON.stringify({ date, at: new Date().toISOString() }, null, 2) + '\n', 'utf8');
}

module.exports = { hasBeenProcessed, markProcessed, getLastCheckDate, setLastCheckDate };
