# Fichiers de configuration

Tout ce qui n'est pas un secret (`.env`) ni de l'état runtime (`data/`) vit
dans `config/`. Ces fichiers sont versionnés (sauf `config.json`, qui contient
des identifiants propres à ton serveur Discord) et à éditer à la main, sauf
mention contraire.

## `source-registry.json`

Le cœur de la logique de clonage. Pour chaque type de weekly, associe une
**combinaison de jeux** à l'**ID numérique** d'un vrai tournoi existant qui a
déjà exactement cette liste d'events. C'est ce tournoi qui sera cloné.

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

**Format des clés** : les jeux du combo, triés par ordre alphabétique, joints
par une virgule sans espace (`2XKO,SSBU`, pas `SSBU,2XKO` ni `SSBU, 2XKO`).
L'ordre alphabétique est géré automatiquement par le bot pour matcher le
sheet — c'est uniquement quand tu remplis ce fichier à la main qu'il faut
respecter cet ordre.

**Comment trouver l'ID d'un tournoi** : c'est le nombre visible dans les
requêtes admin de start.gg, pas dans l'URL publique (qui n'affiche que le
slug). Le plus simple est d'utiliser l'API publique :

```bash
node -e "
require('dotenv').config();
const { queryStartgg } = require('./src/startgg/public-api');
queryStartgg('query(\$slug:String!){tournament(slug:\$slug){id name}}', { slug: 'tournament/mon-tournoi' })
  .then(d => console.log(d.tournament));
"
```

**Sans correspondance exacte** : si le sheet demande une combinaison de jeux
absente du registre, le bot clone la première référence disponible pour ce
type et le signale explicitement dans l'annonce Discord (« Aucune référence
exacte... clone fait depuis... »), avec une invitation à corriger les events
à la main puis à ajouter cette édition au registre pour la prochaine fois.
C'est volontairement dégradé plutôt que bloquant : mieux vaut un tournoi
approximatif signalé qu'aucun tournoi du tout.

## `schedule.json`

Jour de la semaine et horaires fixes de chaque type de weekly. Le sheet ne
donne que la **date** ; ce fichier fournit l'**heure**.

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

`dayOfWeek` sert uniquement de garde-fou : si la date fournie par le sheet ne
tombe pas sur ce jour, le bot affiche un avertissement dans ses logs mais
continue quand même (le sheet reste prioritaire — il peut y avoir une
exception ponctuelle de date).

## `games.json`

La liste des jeux que le bot sait reconnaître, avec leurs alias — c'est ce
qui permet d'interpréter la colonne « Jeux » du sheet peu importe comment le
jeu y est écrit.

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

- `key` : l'identifiant canonique utilisé dans les clés de
  `source-registry.json`. **Doit correspondre** entre les deux fichiers.
- `aliases` : toutes les façons dont ce jeu peut être écrit dans le sheet
  (insensible à la casse). Le bot ramène n'importe quel alias à `key` avant
  de chercher dans le registre.
- `alwaysPresent` : informatif seulement à ce stade (non exploité par le
  code) — pensé pour documenter les jeux qui reviennent à toutes les
  éditions.

**Ajouter un nouveau jeu** : ajoute une entrée avec une `key` courte et
stable, la liste des alias plausibles, puis crée les entrées correspondantes
dans `source-registry.json` une fois qu'un premier tournoi avec ce jeu existe
sur start.gg.

## `config.json`

Généré automatiquement depuis `config.example.json` au premier lancement
(voir `src/config-store.js`). Contient les identifiants propres à ton serveur
Discord — **non versionné**, chaque déploiement a le sien.

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
Discord (`/set-channel`, `/salon-admin`, `/set-role` — voir [Commandes
Discord](Commandes-Discord)), pas en éditant le fichier à la main.
`contact.value` doit être rempli manuellement dans le fichier : c'est le lien
utilisé comme contact du tournoi créé (le clone reprend normalement le
contact du tournoi source, mais start.gg exige quand même ce champ dans la
requête de création).
