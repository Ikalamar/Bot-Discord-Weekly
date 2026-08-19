// Lecture du Google Sheet, source de verite du calendrier.
// Colonnes attendues (en-tetes en ligne 1) : Nom | Date | Jeux | Type
//
// Le bot n'ecrit jamais dans le sheet : le suivi de "deja traite" se fait dans
// data/processed-tournaments.json (voir src/state.js).

const { google } = require('googleapis');

const RANGE = 'A2:D';
const DAYS_THRESHOLD = 3;
const REQUIRED_TYPE = 'weekly';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY manquants (voir .env.example).');
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

// "21/07/2026" -> Date locale (minuit)
function parseFrenchDate(str) {
  const [d, m, y] = str.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

// Toutes les lignes de type "Weekly" (nom + date presents), triees par date.
async function getWeeklyRows() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID manquant (voir .env.example).');

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: RANGE });
  const rows = res.data.values || [];

  const parsed = [];
  rows.forEach((row, i) => {
    const [name, dateStr, gamesStr, type] = row;
    if (!name || !dateStr) return;
    if ((type || '').trim().toLowerCase() !== REQUIRED_TYPE) return;

    parsed.push({
      rowNumber: i + 2, // ligne 1 = en-tetes, RANGE commence a A2
      name: name.trim(),
      date: parseFrenchDate(dateStr),
      games: (gamesStr || '')
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean),
    });
  });

  parsed.sort((a, b) => a.date - b.date);
  return parsed;
}

/** Lignes a traiter par le cron : dans les DAYS_THRESHOLD jours a venir. */
async function getPendingRows() {
  const rows = await getWeeklyRows();
  return rows.filter((r) => {
    const diff = daysUntil(r.date);
    return diff >= 0 && diff <= DAYS_THRESHOLD;
  });
}

/** Le prochain tournoi a venir, sans limite de temps (pour /next-tournament). */
async function getNextRow() {
  const rows = await getWeeklyRows();
  return rows.find((r) => daysUntil(r.date) >= 0) || null;
}

module.exports = { getPendingRows, getNextRow };
