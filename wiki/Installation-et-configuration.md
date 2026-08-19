# Installation et configuration

Guide complet pour faire tourner le bot de zéro. Compte environ 30 à 45
minutes la première fois (la plupart du temps passé à créer les comptes, pas
à configurer le code).

## Prérequis techniques

- **Node.js 18 ou plus récent** ([nodejs.org](https://nodejs.org))
- **~400 Mo d'espace disque** pour Chromium (installé automatiquement par
  Playwright — voir [Fonctionnement technique](Fonctionnement-technique) pour
  comprendre pourquoi un navigateur est nécessaire)
- Un serveur/poste qui peut rester **allumé en continu** (le bot doit tourner
  24/7 pour que le cron quotidien fonctionne) — un PC, un Raspberry Pi, un
  petit VPS, ou un téléphone Android via Termux conviennent

## Les trois comptes à préparer

Le bot a besoin de trois identités distinctes. **Recommandation forte** :
utilise des comptes dédiés au bot plutôt que tes comptes personnels — les
identifiants vivent dans un fichier `.env` sur la machine qui héberge le bot
en continu, ce qui est une plus grosse surface d'exposition qu'une session de
navigateur classique. Si la machine est compromise, seul le compte dédié est
en jeu, pas ton identité complète sur start.gg ou Discord.

### 1. Une application Discord (le bot lui-même)

1. Va sur le [Discord Developer Portal](https://discord.com/developers/applications)
   et crée une nouvelle application.
2. Onglet **General Information** → copie l'**Application ID** →
   `DISCORD_CLIENT_ID`.
3. Onglet **Bot** → **Reset Token** (ou **View Token** s'il est encore
   visible) → `DISCORD_TOKEN`.
   > ⚠️ Discord n'affiche le token qu'une seule fois. S'il est perdu, il faut
   > le regénérer (l'ancien devient invalide).
4. Onglet **OAuth2 → URL Generator** :
   - Scopes : `bot` **et** `applications.commands` (sans le second, les
     commandes slash n'apparaîtront jamais, même si le bot tourne).
   - Bot Permissions : `View Channels`, `Send Messages`, `Embed Links` (cette
     dernière est nécessaire pour que les liens start.gg s'affichent avec leur
     aperçu — sans elle, Discord montre le lien nu).
   - Copie l'URL générée, ouvre-la, choisis ton serveur (permission **Gérer
     le serveur** requise sur ce compte), **Autoriser**.

### 2. Un compte start.gg pour le bot

C'est le compte qui va se connecter et créer les tournois. Il doit être
**administrateur des tournois de référence** que le bot va cloner (ou tu
peux, à défaut, l'ajouter comme admin sur ces tournois après coup).

- `STARTGG_EMAIL` / `STARTGG_PASSWORD` : les identifiants de connexion de ce
  compte.
- `STARTGG_API_TOKEN` : depuis ce compte, va dans **Profil → Developer
  Settings** sur start.gg, génère un token personnel. Utilisé uniquement pour
  les requêtes de lecture (recherche de tournois, dates).

> Un compte start.gg tout juste créé ne peut pas rendre un tournoi
> « Discoverable » (visible dans la recherche) pendant ses 6 premières
> heures d'existence — restriction de start.gg elle-même, pas du bot. Voir
> [Dépannage](Dépannage#tournoi-cr%C3%A9%C3%A9-mais-pas-discoverable).

### 3. Un compte de service Google (lecture du Sheet)

1. Va sur la [Google Cloud Console](https://console.cloud.google.com), crée
   un projet (ou réutilise un existant).
2. **APIs & Services → Library** → cherche « Google Sheets API » → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service account**.
   Donne-lui un nom, pas besoin de rôle particulier au niveau du projet.
4. Ouvre le compte de service créé → onglet **Keys → Add Key → Create new
   key → JSON**. Un fichier se télécharge.
5. Dans ce fichier JSON :
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (colle-la telle quelle, guillemets
     et `\n` inclus)
6. **Partage ton Google Sheet** avec l'adresse `client_email` (Partager →
   coller l'adresse → rôle Éditeur).
7. `GOOGLE_SHEET_ID` : dans l'URL du sheet, la partie entre `/d/` et `/edit`.

## Installation du bot

```bash
git clone <ce-repo>
cd Bot-Discord-Weekly
npm install
```

`npm install` télécharge aussi Chromium (~200 Mo) via le hook `postinstall`
de Playwright — c'est normal, laisse-le se terminer.

```bash
cp .env.example .env
```

Remplis `.env` avec les valeurs récupérées ci-dessus. Toutes les variables
sont obligatoires ; le bot refuse de démarrer et indique clairement ce qui
manque si l'une d'elles est vide.

## Configuration du bot

Avant le premier lancement, prépare aussi les fichiers dans `config/` — voir
le détail sur la page **[Fichiers de configuration](Fichiers-de-configuration)** :

- `config/source-registry.json` — quel tournoi cloner pour chaque
  combinaison de jeux
- `config/schedule.json` — jour et horaires fixes de chaque weekly
- `config/games.json` — les jeux possibles et comment les reconnaître dans
  le sheet

Le fichier `config/config.json` (salons Discord, rôle, contact) se crée tout
seul au premier lancement depuis `config.example.json`, et se configure
ensuite entièrement via les commandes Discord — sauf le lien de contact
(`contact.value`), à renseigner à la main dans le fichier.

## Premier lancement

```bash
npm start
```

Le terminal doit afficher :

```
Connecte en tant que TonBot#1234
X commande(s) slash enregistree(s).
Cron quotidien programme (8h00 Europe/Paris).
```

Dans Discord (nécessite la permission **Gérer le serveur**) :

```
/set-channel salon:#annonces
/salon-admin salon:#staff-tournois
/set-role role:@Weekly
```

Voir [Commandes Discord](Commandes-Discord) pour le détail de chacune.

> Les commandes slash peuvent mettre jusqu'à une heure à apparaître après le
> premier démarrage (propagation côté Discord). Si elles n'apparaissent
> toujours pas, `Ctrl+R` dans le client Discord force le rafraîchissement du
> cache local.

Une fois configuré, lance `/next-tournament` pour un premier test immédiat
sans attendre le cycle du lendemain matin.
