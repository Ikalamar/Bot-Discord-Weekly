// Complete les startggId dans config/games.json en cherchant chaque jeu via la
// query publique `videogames`. Utilitaire ponctuel.
//
// Usage : npm run lookup:videogames

require('dotenv').config({ path: require('../src/paths').ENV_FILE });

const fs = require('fs');
const { GAMES_FILE } = require('../src/paths');
const { queryStartgg } = require('../src/startgg/public-api');

const VIDEOGAME_SEARCH_QUERY = `
  query VideogameSearch($name: String!) {
    videogames(query: { perPage: 8, filter: { name: $name } }) {
      nodes {
        id
        name
        displayName
      }
    }
  }
`;

async function main() {
  const gamesFile = JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'));
  let updated = false;

  for (const game of gamesFile.games) {
    console.log(`\n[${game.key}] Recherche "${game.displayName}"...`);

    let data;
    try {
      data = await queryStartgg(VIDEOGAME_SEARCH_QUERY, { name: game.displayName });
    } catch (err) {
      console.error(`  Echec de la requete : ${err.message}`);
      continue;
    }

    const candidates = data.videogames?.nodes || [];

    if (candidates.length === 0) {
      console.warn(`  Aucun resultat pour "${game.displayName}" (jeu peut-etre pas encore reference).`);
      continue;
    }

    const exactMatches = candidates.filter(
      (c) => (c.displayName || c.name || '').toLowerCase() === game.displayName.toLowerCase(),
    );

    if (exactMatches.length === 1) {
      game.startggId = Number(exactMatches[0].id);
      updated = true;
      console.log(`  -> match exact : id=${exactMatches[0].id} (${exactMatches[0].displayName})`);
    } else {
      console.log('  Plusieurs candidats, choisis manuellement dans config/games.json :');
      for (const c of candidates) {
        console.log(`     id=${c.id}  name="${c.name}"  displayName="${c.displayName}"`);
      }
    }
  }

  if (updated) {
    fs.writeFileSync(GAMES_FILE, JSON.stringify(gamesFile, null, 2) + '\n', 'utf8');
    console.log('\nconfig/games.json mis a jour.');
  }
}

main();
