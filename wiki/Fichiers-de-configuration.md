# Fichiers de configuration

`config/` contient tout ce qui n'est pas un secret (`.env`) ni de l'état
runtime (`data/`). Versionné, sauf `config.json` (identifiants propres au
serveur Discord).

## `source-registry.json`

Associe, pour chaque type de weekly, une combinaison de jeux à l'ID
numérique d'un tournoi existant possédant exactement cette liste d'events.
Ce tournoi sert de clone source.

```json
{
  "Bagarre 2 Bar": {
    "SSBU": 684607,
    "2XKO,SSBU": 937245,
    "SF6,SSBU": 937441
  },
  "72 Hit Combo": {
    "SSBU": 937445
  }
}
```

Clés : jeux triés par ordre alphabétique, joints par une virgule sans espace
(`2XKO,SSBU`, pas `SSBU,2XKO`). Le tri est appliqué automatiquement côté bot
pour matcher le sheet ; à respecter à la main uniquement en éditant ce
fichier.

ID d'un tournoi, via l'API publique :

```bash
node -e "
require('dotenv').config();
const { queryStartgg } = require('./src/startgg/public-api');
queryStartgg('query(\$slug:String!){tournament(slug:\$slug){id name}}', { slug: 'tournament/mon-tournoi' })
  .then(d => console.log(d.tournament));
"
```

Sans correspondance exacte : clone de la première référence disponible pour
ce type, écart signalé dans l'annonce Discord (« Aucune référence exacte...
clone fait depuis... »). Comportement dégradé plutôt que bloquant.

## `schedule.json`

Jour et horaires fixes par type de weekly. Le sheet fournit la date, ce
fichier fournit l'heure.

```json
{
  "Bagarre 2 Bar": {
    "dayOfWeek": "tuesday",
    "startTime": "18:00",
    "endTime": "23:00",
    "timezone": "Europe/Paris"
  },
  "72 Hit Combo": {
    "dayOfWeek": "sunday",
    "startTime": "18:00",
    "endTime": "22:00",
    "timezone": "Europe/Paris"
  }
}
```

`dayOfWeek` sert de garde-fou seulement : écart avec la date réelle du sheet
→ avertissement en log, traitement inchangé (le sheet reste prioritaire).

## `games.json`

Jeux reconnus et leurs alias, pour interpréter la colonne Jeux du sheet.

```json
{
  "games": [
    {
      "key": "SSBU",
      "displayName": "Super Smash Bros. Ultimate",
      "aliases": ["SSBU", "Smash Ultimate", "Smash Bros Ultimate"],
      "alwaysPresent": true
    },
    {
      "key": "SF6",
      "displayName": "Street Fighter 6",
      "aliases": ["SF6", "Street Fighter 6", "Street Fighter VI"],
      "alwaysPresent": false
    }
  ]
}
```

- `key` : identifiant canonique, doit correspondre aux clés de
  `source-registry.json`.
- `aliases` : formes acceptées dans le sheet (insensible à la casse),
  ramenées à `key` avant recherche dans le registre.
- `alwaysPresent` : informatif, non exploité par le code actuel.

Ajout d'un jeu : entrée avec `key` stable et alias plausibles, puis entrées
correspondantes dans `source-registry.json` une fois un premier tournoi créé
sur start.gg avec ce jeu.

## `config.json`

Généré depuis `config.example.json` au premier lancement (`src/config-store.js`).
Non versionné.

```json
{
  "discordChannels": ["123456789"],
  "controlChannel": "987654321",
  "weeklyRoleId": "555555555",
  "contact": {
    "type": "discord",
    "value": "https://discord.gg/xxxxxxx"
  }
}
```

Tous les champs sauf `contact.value` se configurent via les commandes
Discord (`/set-channel`, `/salon-admin`, `/set-role`, voir [Commandes
Discord](Commandes-Discord)). `contact.value` se remplit à la main : lien de
contact utilisé lors de la création (champ requis par start.gg même si le
clone reprend normalement le contact de la source).
