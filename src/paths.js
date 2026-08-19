// Emplacements centralises, pour eviter les chaines de "../.." disseminees
// dans le code.
//
//   config/  fichiers edites a la main (versionnes, sauf config.json)
//   data/    etat runtime du bot (jamais versionne)

const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const DATA_DIR = path.join(ROOT, 'data');

module.exports = {
  ROOT,
  CONFIG_DIR,
  DATA_DIR,

  CONFIG_FILE: path.join(CONFIG_DIR, 'config.json'),
  CONFIG_EXAMPLE_FILE: path.join(CONFIG_DIR, 'config.example.json'),
  GAMES_FILE: path.join(CONFIG_DIR, 'games.json'),
  SCHEDULE_FILE: path.join(CONFIG_DIR, 'schedule.json'),
  SOURCE_REGISTRY_FILE: path.join(CONFIG_DIR, 'source-registry.json'),

  PENDING_FILE: path.join(DATA_DIR, 'pending-confirmations.json'),
  PROCESSED_FILE: path.join(DATA_DIR, 'processed-tournaments.json'),
  SESSION_FILE: path.join(DATA_DIR, 'startgg-session.json'),

  ENV_FILE: path.join(ROOT, '.env'),
};
