# Fonctionnement technique

## Absence d'API de création

L'API GraphQL publique de start.gg (`api.start.gg/gql/alpha`) n'expose aucune
mutation de création de tournoi. Schéma vérifié dans sa totalité : les seules
mutations disponibles couvrent seeding, sets, stations/streams, phases. Pas
une question de permissions ou de token, l'opération est absente du schéma
exposé aux tiers. Même constat côté [parry.gg](https://parry.gg) (API gRPC
documentée, uniquement `Get*`/`Update*`).

Répliquer un tournoi avec l'ensemble de ses réglages (Details, Permissions,
Event Setup, Registration, Attendee Requirements, Payments, Bracket Setup,
Schedule, Stations & Streams, Block list, logo, bannière) exige donc de
reproduire l'action "Copy settings from a previous tournament" de
l'interface web.

## Navigateur headless

`src/startgg/browser/` pilote Chromium via [Playwright](https://playwright.dev).
Connexion identique à un organisateur humain, puis appel via `fetch()`
exécuté dans la page des mêmes endpoints internes utilisés par le site :

- `POST /api/-/rest/tournament/cloneTournamentPublic` : création par clone.
- `POST /api/-/gql`, mutation `updateProfilePublishing` : publication par
  section pour Homepage, Registration, Attendees.
- `POST /api/-/gql`, mutation `bulkUpdateEventPublishing` (`UpdatePhasePublishing`) :
  publication de la section Events. Mutation distincte des trois précédentes
  (prend `tournamentId` + `eventId: null` plutôt que `profileType`/`profileId`) ;
  l'appeler avec `updateProfilePublishing` réussit silencieusement (`ok:true`)
  sans rien publier côté site.
- `POST /api/-/gql`, mutation `updateBasicFieldsTournament` (`{ approved: true }`) :
  visibilité dans la recherche start.gg.

Endpoints non documentés, non garantis. Une refonte du site peut casser la
création ou la publication sans préavis. Compromis assumé pour obtenir une
réplication fidèle des réglages.

### Nécessité du navigateur

Login et clone exigent un token reCAPTCHA v3 à usage unique généré côté
client par le SDK Google chargé sur la page. Aucun moyen de le produire sans
exécuter le JavaScript de la page dans un moteur de rendu réel.

Publication et vérification de doublons n'exigent pas de navigateur une fois
la session établie (voir plus bas).

### Identification des endpoints

Par interception réseau des requêtes réelles envoyées par le site lors des
actions correspondantes (Publish, Copy settings). Outils conservés dans
`tools/` :

- `tools/capture-requests.mjs` : logge chaque `POST`/`PUT` vers `/api/`
  déclenché par l'interface, dans une fenêtre visible.
- `tools/inspect-form.mjs` : liste les champs d'un formulaire pour
  construction de sélecteurs fiables.

À relancer en cas de changement d'interface côté start.gg.

## Restriction des 6 heures

`approved: true` (Discoverable) est refusé côté serveur pour tout compte de
moins de 6h d'existence, garde-fou anti-spam de start.gg. Message renvoyé :
`"Your account must be at least 6 hours old to make tournaments discoverable"`.

Chaque section est publiée individuellement ; l'échec de Discoverable ne
bloque pas les autres. Le tournoi reste en mode "Link only" (accessible par
lien direct, non listé), pleinement fonctionnel pour l'annonce. Résolution
automatique passé le délai.

## Détection de doublon

Deux problèmes constatés en conditions réelles :

1. Le nom réel sur start.gg peut différer du nom du sheet (`"72 HIT COMBO # 13"`
   vs `"72 Hit Combo #13"`). Comparaison stricte de chaînes insuffisante.
2. Un tournoi non publié est invisible pour l'API publique, qui n'indexe que
   le publié.

`src/startgg/duplicate-check.js` combine deux stratégies :

- `src/startgg/admin-api.js` : slug deviné depuis le nom (minuscules,
  ponctuation → tirets), requête directe sur `/api/-/rest/tournament/<slug>`
  via la session sauvegardée. Répond même si le compte du bot n'est pas admin
  du tournoi trouvé (testé) : couvre tournois publics tiers et tournois non
  publiés du bot. Appel REST simple, pas de navigateur nécessaire
  (`src/startgg/browser/api-client.js`).
- `src/startgg/public-api.js` : recherche par nom exact, secours si le slug
  deviné ne correspond à rien.

Limite non contournable : tournoi non publié d'un autre compte, sur lequel le
bot n'est pas admin, reste invisible dans les deux cas.

## Cycle quotidien

`src/cron.js` (la vérification quotidienne automatique), 8h Europe/Paris (fixe, indépendant du fuseau de la machine
hôte) :

```
Pour chaque ligne "Weekly" du sheet a J-3 ou moins :

  Deja traite avec succes (memoire locale) ?
    OUI -> ignore

  Existe deja sur start.gg (deux etages) ?
    OUI -> confirmation dans le salon de controle, marque comme traite
    NON -> clone + publication + annonce automatique, marque comme traite

  Echec de creation ?
    -> instructions manuelles postees
       PAS marque comme traite (nouvel essai le lendemain)
```

Traitement indépendant par ligne : un échec n'empêche pas les autres de
passer.

### Mémoire locale

La fenêtre J-3 fait ressortir la même ligne plusieurs matins de suite. Sans
mémoire, recréation ou reconfirmation quotidienne du même tournoi. Le bot
n'écrivant jamais dans le sheet, la mémoire vit en local
(`data/processed-tournaments.json`, `src/state.js`) : association nom de
tournoi → date de traitement.

Un échec n'y est pas inscrit, pour nouvel essai automatique le lendemain.

### Pourquoi le bot n'écrit rien dans le sheet

Version antérieure : écriture de l'URL créée dans une colonne du sheet, à la
fois trace et mécanisme anti-doublon. Abandonné : la colonne prévue était en
réalité déjà utilisée à d'autres fins dans le sheet réel, et le sheet comme
mémoire couplait la logique du bot à un système externe modifiable par
n'importe qui. La mémoire locale ne dépend d'aucune convention de colonnes.

## Boutons de confirmation Discord

Un `customId` de bouton ne transporte qu'un identifiant court (`announce:23`),
pas les données. Le contexte (nom, URL, date réelle, jeux) est persisté dans
`data/pending-confirmations.json` (`src/discord/confirm.js`) jusqu'au clic,
potentiellement des heures plus tard ou après redémarrage du bot.

Deux flux :

- `announce` : posé par la vérification quotidienne ou `/next-tournament` sur tournoi déjà
  existant.
- `create` : posé uniquement par `/next-tournament` sur absence de doublon.

Chaque interaction est acquittée immédiatement (`interaction.deferUpdate()`)
avant tout travail réseau. Discord invalide une interaction non acquittée
après 3 secondes ; l'envoi d'une annonce, a fortiori la création d'un
tournoi, dépasse ce délai.

## Source de la date affichée

Un tournoi trouvé "déjà existant" a pu être créé à la main avec une date
ajustée par rapport au sheet. `src/discord/announce.js` lit donc toujours
`startAt` et le fuseau horaire depuis la réponse de start.gg pour ce cas, et
utilise la date du sheet uniquement pour la création automatique (où le bot
fixe lui-même la date).
