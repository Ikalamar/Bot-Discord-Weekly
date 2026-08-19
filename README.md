# Bot start.gg — automatisation des weeklies

Bot Discord qui **crée, publie et annonce automatiquement** les pages start.gg
des weeklies récurrentes d'une association FGC, à partir d'un calendrier tenu
dans un Google Sheet.

Développé pour [La Mans Dale](https://www.start.gg/) (Le Mans) et ses deux
weeklies — *Bagarre 2 Bar* (mardi) et *72 Hit Combo* (dimanche) — mais adaptable
à d'autres événements récurrents.

## Ce que fait le bot

Chaque jour à 8h (heure de Paris), pour chaque ligne « Weekly » du sheet dont la
date tombe dans les 3 jours :

| Situation | Action |
| --- | --- |
| Le tournoi n'existe pas encore | Création (clone d'une édition précédente), publication, puis annonce Discord — sans intervention |
| Le tournoi existe déjà | Aucune création ; demande dans le salon de contrôle s'il faut annoncer |
| La création échoue | Message d'instructions manuelles, pour qu'aucune weekly ne passe à la trappe en silence |

Le clone reprend **l'intégralité** des réglages de l'édition de référence :
logo, bannière, règlement, contact Discord, permissions, paiements, bracket
setup, stations & streams, block list. C'est l'équivalent exact de
« Copy settings from a previous tournament » dans l'interface start.gg.

## Comment ça marche

L'API publique start.gg **ne permet pas de créer un tournoi** — aucune mutation
`createTournament` n'existe (idem chez parry.gg). Le bot combine donc deux
accès :

- **API publique GraphQL** (token développeur) — lecture seule : recherche de
  tournois, dates réelles, jeux.
- **Endpoints internes du site** pilotés via un navigateur headless
  (Playwright) — création (`cloneTournamentPublic`) et publication
  (`updateProfilePublishing`). Un navigateur est nécessaire car ces endpoints
  exigent un token reCAPTCHA v3 à usage unique que seule la page peut générer.

> ⚠️ Ces endpoints internes ne sont pas documentés ni garantis par start.gg :
> une refonte de leur site peut casser la création ou la publication. Les outils
> de `tools/` servent à les réidentifier le cas échéant.

## Prérequis

- Node.js ≥ 18
- Un compte start.gg **administrateur** des tournois de référence
- Un compte de service Google avec accès en lecture au Sheet
- Une application Discord (bot)

## Installation

```bash
npm install          # installe les dépendances + Chromium pour Playwright
cp .env.example .env # puis renseigner les valeurs
```

### Variables d'environnement (`.env`)

| Variable | Où l'obtenir |
| --- | --- |
| `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` | [Discord Developer Portal](https://discord.com/developers/applications) → onglets Bot et General Information |
| `STARTGG_API_TOKEN` | start.gg → profil → Developer Settings |
| `STARTGG_EMAIL`, `STARTGG_PASSWORD` | Compte start.gg qui créera les tournois |
| `GOOGLE_SHEET_ID` | Dans l'URL du Sheet, entre `/d/` et `/edit` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Clé JSON du compte de service Google Cloud (API Sheets activée) |

Le Sheet doit être partagé avec l'adresse du compte de service.

### Fichiers de configuration (`config/`)

| Fichier | Rôle |
| --- | --- |
| `config.json` | Salons, rôle mentionné, lien de contact. Créé automatiquement depuis `config.example.json` ; se remplit via les commandes Discord (sauf `contact.value`) |
| `source-registry.json` | Pour chaque type de weekly, le tournoi de référence à cloner selon la combinaison de jeux |
| `schedule.json` | Jour et horaires fixes de chaque weekly |
| `games.json` | Jeux connus et leurs alias, pour interpréter la colonne « Jeux » du Sheet |

### Format du Google Sheet

En-têtes en ligne 1, données à partir de la ligne 2 :

| Nom | Date | Jeux | Type |
| --- | --- | --- | --- |
| Bagarre 2 Bar #138 | 25/08/2026 | SSBU, SF6 | Weekly |

Seules les lignes dont la colonne **Type** vaut `Weekly` sont traitées. L'ordre
des jeux n'a pas d'importance. Le bot n'écrit jamais dans le Sheet.

### Tournois de référence

`source-registry.json` associe une combinaison de jeux à l'ID numérique d'un
tournoi existant qui a exactement ces events :

```json
{
  "Bagarre 2 Bar": {
    "SSBU": 684607,
    "2XKO,SSBU": 937245,
    "SF6,SSBU": 937441
  }
}
```

Les clés sont les jeux **triés alphabétiquement** et joints par une virgule.
Sans correspondance exacte, le bot clone la première référence disponible et
signale l'écart dans son annonce, pour ajustement manuel des events.

## Lancement

```bash
npm start
```

Puis, dans Discord (permission « Gérer le serveur » requise) :

| Commande | Rôle |
| --- | --- |
| `/set-channel salon:#annonces` | Ajoute un salon d'annonces (plusieurs possibles) |
| `/salon-admin salon:#staff` | Définit le salon de contrôle (demandes de confirmation) |
| `/set-role role:@Weekly` | Rôle mentionné dans les annonces |
| `/next-tournament` | Vérifie le prochain tournoi du calendrier et propose de le créer, hors du cycle quotidien |

Le bot doit être invité avec les scopes `bot` + `applications.commands`, et les
permissions *View Channels*, *Send Messages* et *Embed Links* (sans cette
dernière, les aperçus de liens start.gg ne s'affichent pas).

## Structure

```
src/
  index.js              point d'entrée : Discord, commandes, cron
  cron.js               job quotidien et arbre de décision
  sheets.js             lecture du Google Sheet
  state.js              mémoire des tournois déjà traités
  config-store.js       lecture/écriture de config/config.json
  paths.js              emplacements centralisés
  discord/
    announce.js         mise en forme et envoi des annonces
    confirm.js          flux de confirmation par boutons
    commands/           commandes slash
  startgg/
    public-api.js       API GraphQL publique (lecture seule)
    admin-api.js        recherche par slug via la session
    duplicate-check.js  « ce tournoi existe-t-il déjà ? »
    tournament.js       orchestration de la création
    browser/            pilotage Playwright (ESM)
tools/                  utilitaires de diagnostic
config/                 configuration éditable
data/                   état runtime (non versionné)
```

## Limites connues

- **Compte start.gg récent** : l'option « Discoverable » est refusée par
  start.gg pendant les 6 premières heures de vie d'un compte. Le tournoi est
  alors publié en « link only », pleinement utilisable ; le problème disparaît
  de lui-même ensuite.
- **Tournois invisibles** : un tournoi non publié créé par un *autre* compte,
  sur lequel le bot n'est pas administrateur, ne peut pas être détecté. Le bot
  risque alors d'en créer un doublon.
- **Dépendance aux endpoints internes** : voir l'avertissement plus haut.

## Licence

MIT — voir [LICENSE](LICENSE).
