# Bot Discord Weekly

Bot Discord qui automatise la création des pages start.gg de weeklies
récurrentes à partir d'un calendrier tenu dans un Google Sheet : création
(clone d'une édition de référence), publication, annonce.

Documentation complète : [Wiki](../../wiki).

## Fonctionnement

Chaque jour, le bot vérifie automatiquement les tournois à venir dans le
sheet. S'il n'existe pas encore sur start.gg, il le crée, le publie et
l'annonce sur Discord tout seul. S'il existe déjà (créé à la main), il
demande d'abord confirmation avant d'annoncer.

Une commande (`/next-tournament`) permet aussi de déclencher cette
vérification à la demande, sans attendre le lendemain.

## Pourquoi un navigateur headless

L'API GraphQL publique de start.gg n'expose aucune mutation de création de
tournoi (vérifié sur le schéma complet ; même constat côté parry.gg). Le seul
moyen de répliquer fidèlement une édition (permissions, paiement, bracket
setup, logo, bannière) est de reproduire l'action "Copy settings from a
previous tournament" faite par un organisateur dans l'interface web. Le bot
pilote donc Chromium via Playwright pour appeler les endpoints internes du
site, avec le token reCAPTCHA v3 que seule la page peut générer.

Détail complet : [Fonctionnement technique](../../wiki/Fonctionnement-technique).

## Installation

```bash
git clone <ce-repo>
cd Bot-Discord-Weekly
npm install       # installe aussi Chromium (Playwright)
cp .env.example .env
npm start
```

Prérequis : compte Discord (bot), compte start.gg dédié administrateur des
tournois de référence, compte de service Google avec accès lecture au sheet.
Procédure complète : [Installation et
configuration](../../wiki/Installation-et-configuration).

## Documentation

| Page | Contenu |
| --- | --- |
| [Installation et configuration](../../wiki/Installation-et-configuration) | Comptes requis, variables d'environnement, premier lancement |
| [Format du Google Sheet](../../wiki/Format-du-Google-Sheet) | Colonnes attendues |
| [Fichiers de configuration](../../wiki/Fichiers-de-configuration) | `source-registry.json`, `schedule.json`, `games.json`, `config.json` |
| [Commandes Discord](../../wiki/Commandes-Discord) | `/set-channel`, `/salon-admin`, `/set-role`, `/next-tournament` |
| [Fonctionnement technique](../../wiki/Fonctionnement-technique) | Architecture, endpoints utilisés, limites connues |
| [Dépannage](../../wiki/Dépannage) | Problèmes rencontrés et solutions |

## Licence

MIT, voir [LICENSE](LICENSE).
