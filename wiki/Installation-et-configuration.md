# Installation et configuration

## Prérequis

- Node.js ≥ 18
- ~400 Mo disque (Chromium, installé par Playwright)
- Machine allumée en continu (vérification quotidienne automatique) : PC, Raspberry Pi, VPS, ou
  Termux sur Android

## Comptes requis

Trois identités distinctes. Comptes dédiés recommandés plutôt que comptes
personnels : les identifiants vivent dans `.env` sur une machine allumée en
continu, surface d'exposition plus large qu'une session de navigateur
classique.

### Application Discord

1. [Discord Developer Portal](https://discord.com/developers/applications) → nouvelle application.
2. General Information → Application ID → `DISCORD_CLIENT_ID`.
3. Bot → Reset Token → `DISCORD_TOKEN`. Non récupérable après coup, seulement
   régénérable.
4. OAuth2 → URL Generator :
   - Scopes : `bot`, `applications.commands` (sans le second, aucune
     commande slash n'apparaît).
   - Permissions : `View Channels`, `Send Messages`, `Embed Links` (sans
     cette dernière, pas d'aperçu sur les liens start.gg).
   - Autoriser sur le serveur cible (permission Gérer le serveur requise sur
     le compte qui autorise).

### Compte start.gg

Compte administrateur des tournois de référence à cloner.

- `STARTGG_EMAIL` / `STARTGG_PASSWORD` : identifiants de connexion.
- `STARTGG_API_TOKEN` : Profil → Developer Settings sur start.gg. Utilisé
  uniquement pour les requêtes de lecture.

Restriction de start.gg (pas du bot) : un compte de moins de 6h ne peut pas
rendre un tournoi "Discoverable". Voir
[Dépannage](Dépannage#tournoi-cr%C3%A9%C3%A9-mais-pas-discoverable).

### Compte de service Google

1. [Google Cloud Console](https://console.cloud.google.com) → projet → APIs
   & Services → Library → activer "Google Sheets API".
2. Credentials → Create Credentials → Service account.
3. Keys → Add Key → Create new key → JSON.
4. Dans le JSON : `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `private_key` → `GOOGLE_PRIVATE_KEY` (guillemets et `\n` inclus).
5. Partager le sheet avec `client_email`, rôle Éditeur.
6. `GOOGLE_SHEET_ID` : dans l'URL du sheet, entre `/d/` et `/edit`.

## Installation

```bash
git clone <ce-repo>
cd Bot-Discord-Weekly
npm install
```

`postinstall` télécharge Chromium (~200 Mo).

```bash
cp .env.example .env
```

Toutes les variables sont requises. Le bot refuse de démarrer et indique ce
qui manque sinon.

## Configuration

Avant premier lancement, voir [Fichiers de configuration](Fichiers-de-configuration) :

- `config/source-registry.json` : tournoi à cloner par combinaison de jeux
- `config/schedule.json` : horaires fixes par weekly
- `config/games.json` : jeux reconnus et leurs alias

`config/config.json` se génère automatiquement au premier lancement, se
configure ensuite via les commandes Discord, sauf `contact.value` (à
remplir à la main).

## Premier lancement

```bash
npm start
```

Sortie attendue :

```
Connecte en tant que TonBot#1234
X commande(s) slash enregistree(s).
Verification quotidienne programmee (8h00 Europe/Paris).
```

```
/set-channel salon:#annonces
/salon-admin salon:#staff-tournois
/set-role role:@Weekly
```

Détail : [Commandes Discord](Commandes-Discord).

Propagation des commandes slash : jusqu'à 1h. `Ctrl+R` dans le client
Discord force le rafraîchissement du cache local si nécessaire.

Test immédiat : `/next-tournament`.
