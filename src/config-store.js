// Lecture/ecriture de config/config.json (salons, role, contact).
//
// Ce fichier contient des identifiants propres a chaque serveur Discord : il
// n'est pas versionne. Au premier demarrage il est cree a partir de
// config.example.json, pour qu'un clone du depot fonctionne sans etape
// manuelle.

const fs = require('fs');
const { CONFIG_FILE, CONFIG_EXAMPLE_FILE } = require('./paths');

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.copyFileSync(CONFIG_EXAMPLE_FILE, CONFIG_FILE);
    console.warn(`config/config.json cree depuis l'exemple. Configure le bot avec /set-channel, /salon-admin, /set-role.`);
  }
  // Lecture directe (pas require) : le fichier change en cours d'execution via
  // les commandes Discord, et on veut toujours l'etat a jour sans jongler avec
  // le cache de modules.
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

module.exports = { loadConfig, saveConfig };
