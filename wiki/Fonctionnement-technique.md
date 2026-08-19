# Fonctionnement technique

Cette page explique les choix d'architecture, en particulier tout ce qui
n'est pas évident au premier coup d'œil. Utile pour contribuer au projet, le
déboguer, ou simplement comprendre pourquoi il est construit comme il l'est.

## Le problème de départ : créer un tournoi sans API officielle

L'API GraphQL publique de start.gg (`api.start.gg/gql/alpha`, celle
documentée pour les développeurs tiers) ne contient **aucune mutation de
création de tournoi**. On a vérifié le schéma complet : les seules mutations
disponibles concernent le seeding, les sets, les stations/streams, les
phases — rien pour créer ou éditer un tournoi. Ce n'est pas une question de
permissions ou de token : l'opération n'existe simplement pas dans le schéma
exposé aux développeurs tiers. (Même constat côté [parry.gg](https://parry.gg),
l'autre plateforme de tournois FGC majeure, dont l'API gRPC documentée
n'expose que des `Get*`/`Update*`, jamais de `Create`.)

La seule façon de créer un tournoi avec **tous** ses réglages (Details,
Permissions, Event Setup, Registration, Attendee Requirements, Payments,
Bracket Setup, Schedule, Stations & Streams, Block list, logo, bannière) est
de reproduire ce que fait l'interface web elle-même quand un organisateur
clique sur « Copy settings from a previous tournament ».

## La solution : un navigateur headless qui imite un humain

Le dossier `src/startgg/browser/` pilote un vrai navigateur Chromium (via
[Playwright](https://playwright.dev)) qui se connecte à start.gg exactement
comme le ferait un organisateur, puis appelle directement — via `fetch()`
exécuté **dans la page** — les mêmes endpoints internes que le site utilise
en coulisses :

- `POST /api/-/rest/tournament/cloneTournamentPublic` — crée le tournoi en
  clonant une édition de référence.
- `POST /api/-/gql` avec la mutation `updateProfilePublishing` — publie
  chaque section du tournoi (Homepage, Registration, Attendees, Events).
- `POST /api/-/gql` avec `updateBasicFieldsTournament` (`{ approved: true }`)
  — rend le tournoi visible dans la recherche start.gg (« Discoverable »).

Ces endpoints ne sont **ni documentés ni garantis** par start.gg — ils
peuvent changer sans préavis lors d'une refonte du site. C'est un compromis
assumé : c'est la seule façon d'obtenir une réplication complète et fidèle
des réglages, contre le risque que ça casse un jour.

### Pourquoi un navigateur et pas juste des requêtes HTTP directes

Deux endpoints (login et clone) exigent un token **reCAPTCHA v3** à usage
unique, généré côté client par le SDK Google chargé sur la page — impossible
à produire sans exécuter le JavaScript réel de la page dans un vrai moteur de
rendu. Un simple `fetch()` depuis Node, sans navigateur, ne peut pas générer
ce token.

En revanche, une fois la session établie (cookies valides), la publication et
la vérification de doublons **n'ont pas besoin** d'un navigateur — voir plus
bas.

### Comment ces endpoints ont été identifiés

En interceptant les vraies requêtes envoyées par le site quand un humain
clique sur les boutons correspondants (Publish, Copy settings...), à l'aide
d'un navigateur piloté avec capture réseau. Les outils utilisés pour ça sont
conservés dans `tools/` :

- `tools/capture-requests.mjs` — ouvre une fenêtre visible sur une page
  start.gg et logge chaque requête `POST`/`PUT` vers `/api/` déclenchée par
  les actions de l'interface.
- `tools/inspect-form.mjs` — liste les champs d'un formulaire, pour
  construire des sélecteurs fiables plutôt que de les deviner.

Si la création ou la publication cesse de fonctionner après une mise à jour
de start.gg, ce sont ces deux outils qu'il faut relancer pour identifier ce
qui a changé.

## Le compte du bot doit avoir 6 heures d'existence

Rendre un tournoi « Discoverable » (visible dans la recherche start.gg,
plutôt que seulement accessible par lien direct) est refusé **côté serveur**
pour tout compte de moins de 6 heures — un garde-fou anti-spam de start.gg,
pas une limite du bot. Le message d'erreur renvoyé est explicite : *"Your
account must be at least 6 hours old to make tournaments discoverable"*.

Le bot gère ça en douceur : chaque section (Homepage, Registration,
Attendees, Events) est publiée individuellement, et l'échec de
« Discoverable » ne bloque pas les autres — le tournoi reste alors publié en
mode « Link only » (accessible par lien direct, pas listé dans la recherche),
pleinement fonctionnel pour l'annonce Discord. Le problème disparaît de
lui-même une fois le compte plus ancien ; aucune action n'est nécessaire.

## Vérifier qu'un tournoi existe déjà : deux étages

Détecter un doublon est plus subtil qu'il n'y paraît, pour deux raisons
découvertes en conditions réelles :

1. **Le nom réel sur start.gg peut différer du nom dans le sheet.** Un
   tournoi créé à la main peut porter un nom légèrement différent de ce qui
   est écrit dans le calendrier (ex : `"72 HIT COMBO # 13"` avec un espace,
   contre `"72 Hit Combo #13"` sans espace dans le sheet). Une simple
   comparaison de chaînes échoue dans ce cas.
2. **Un tournoi peut exister mais ne pas être publié**, donc invisible pour
   l'API publique — qui n'indexe que ce qui est publié.

La solution (`src/startgg/duplicate-check.js`) combine deux stratégies :

- **`src/startgg/admin-api.js`** — devine le *slug* du tournoi à partir de
  son nom (start.gg dérive le slug en minuscules, ponctuation remplacée par
  des tirets), puis interroge directement ce tournoi précis via
  `/api/-/rest/tournament/<slug>` avec la session sauvegardée du bot. Ce
  endpoint répond **même si le compte du bot n'est pas administrateur du
  tournoi trouvé** — testé et confirmé — ce qui couvre à la fois les
  tournois publics créés par d'autres comptes et les tournois non publiés
  créés par le bot lui-même. Comme c'est un simple appel REST authentifié par
  cookie, **aucun navigateur n'est nécessaire** ici (voir
  `src/startgg/browser/api-client.js`).
- **`src/startgg/public-api.js`** — recherche par nom exact via l'API
  publique, en secours si le slug deviné ne correspond à rien (noms
  atypiques).

**Limite résiduelle, non contournable** : un tournoi non publié créé par un
**autre** compte que celui du bot, sur lequel le bot n'est pas administrateur,
reste invisible dans les deux cas. C'est une limite de plateforme — la seule
parade est d'ajouter le compte du bot comme admin sur ce tournoi.

## Le cycle quotidien

`src/cron.js`, déclenché tous les jours à 8h (heure de Paris, fixée
indépendamment du fuseau de la machine qui héberge le bot) :

```
Pour chaque ligne "Weekly" du sheet à J-3 ou moins :

  Deja traite avec succes (memoire locale) ?
    OUI -> ignore, passe a la ligne suivante

  Existe deja sur start.gg (verification en deux etages) ?
    OUI -> demande confirmation dans le salon de controle
           marque comme traite
    NON -> cree (clone) + publie + annonce automatiquement
           marque comme traite

  Echec de creation ?
    -> poste les instructions de creation manuelle
       NE marque PAS comme traite (nouvel essai le lendemain)
```

Chaque ligne est traitée indépendamment : l'échec d'une ligne n'empêche pas
les autres de passer.

### La mémoire locale

La fenêtre « J-3 » fait ressortir la même ligne du sheet plusieurs matins de
suite. Sans mémoire, le bot recréerait ou redemanderait confirmation chaque
jour pour le même tournoi. Comme le bot n'écrit jamais dans le sheet (voir
plus bas), cette mémoire vit uniquement en local
(`data/processed-tournaments.json`, géré par `src/state.js`) : une simple
association nom de tournoi → date de traitement.

Un échec n'y est volontairement **pas** inscrit, pour être retenté le
lendemain automatiquement plutôt que bloqué indéfiniment.

### Pourquoi le bot n'écrit rien dans le sheet

Une première version du projet écrivait l'URL start.gg créée dans une colonne
du sheet, à la fois comme trace et comme mécanisme anti-doublon. Deux
problèmes ont fait abandonner cette approche : la colonne prévue pour l'URL
était en réalité déjà utilisée à d'autres fins dans le sheet réel, et
utiliser le sheet comme mémoire couplait la logique du bot à un système
externe modifiable par n'importe qui. La mémoire locale (ci-dessus) est plus
robuste et ne dépend d'aucune convention de colonnes.

## Les boutons de confirmation Discord

Un bouton Discord ne transporte qu'un identifiant court dans son `customId`
(ex : `announce:23`), pas les données elles-mêmes. Le contexte complet (nom
du tournoi, URL, date réelle récupérée de start.gg, jeux) est donc persisté
dans `data/pending-confirmations.json` (`src/discord/confirm.js`) le temps
que quelqu'un clique — potentiellement des heures plus tard, voire après un
redémarrage du bot.

Deux flux distincts partagent ce mécanisme :

- **`announce`** — posé par le cron ou par `/next-tournament` quand un
  tournoi existe déjà : « Je fais l'annonce de cette weekly ? »
- **`create`** — posé uniquement par `/next-tournament` quand aucun doublon
  n'est trouvé : « Je lance la création ? »

Chaque interaction bouton est **acquittée immédiatement**
(`interaction.deferUpdate()`) avant tout travail réseau : Discord invalide
une interaction non-acquittée au bout de 3 secondes, et l'envoi d'une
annonce (ou pire, la création complète d'un tournoi) dépasse largement ce
délai.

## Pourquoi la date affichée vient toujours de start.gg, jamais du sheet

Un tournoi trouvé « déjà existant » a pu être créé à la main par un
organisateur, qui a pu ajuster la date par rapport à ce qui était initialement
prévu dans le sheet. Afficher la date du sheet dans ce cas produirait une
annonce fausse. Le bot lit donc toujours `startAt` (et le fuseau horaire)
directement depuis la réponse de start.gg pour construire le message
d'annonce (`src/discord/announce.js`), et seulement la date du sheet pour la
création automatique (où le bot connaît la date exacte puisque c'est lui qui
l'a fixée).
