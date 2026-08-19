# Dépannage

## Commandes slash absentes dans Discord

Cause fréquente : bot invité sans scope `applications.commands` (seul `bot`
coché).

Solution : [Discord Developer Portal](https://discord.com/developers/applications) →
OAuth2 → URL Generator, cocher `bot` et `applications.commands`, régénérer
l'URL, autoriser à nouveau. Pas besoin de retirer le bot au préalable.

Autre cause : propagation des commandes globales, jusqu'à 1h.

Si le bot tourne et logue `X commande(s) slash enregistree(s).` mais que
rien n'apparaît : `Ctrl+R` dans le client Discord.

## "This interaction failed" sur un bouton

Interaction non acquittée dans les 3 secondes (Discord invalide
automatiquement). Cause typique : crash avant `interaction.reply()` /
`.update()` / `.deferUpdate()`, par exemple erreur de syntaxe dans le message
construit. L'erreur réelle est dans les logs du bot, pas dans le message
Discord.

## Lien start.gg sans aperçu

Permission **Embed Links** manquante sur le bot.

Solution : Paramètres du serveur → Rôles → rôle du bot → activer Intégrer
des liens. Alternative : régénérer le lien d'invitation avec cette
permission cochée.

## `browserType.launch: Executable doesn't exist`

Playwright cherche une révision de navigateur absente du disque. Cause
typique : `npx playwright install` lancé depuis un dossier différent de
celui où `playwright` est réellement installé (deux installations
distinctes réclament des révisions différentes ; une réinstallation peut
purger les révisions dont elle n'a pas besoin, y compris celles utilisées
par l'autre installation).

Solution : ce projet n'a qu'une seule installation de Playwright, déclarée
dans le `package.json` racine.

```bash
npx playwright install chromium
```

Vérifier l'absence d'autres installations Playwright sur la machine
(`npm ls playwright` dans d'autres projets) si le problème persiste.

## Tournoi créé mais pas Discoverable

Comportement attendu : start.gg refuse la visibilité en recherche pour tout
compte de moins de 6h. Le tournoi reste en mode "Link only", pleinement
fonctionnel. Détail : [Fonctionnement
technique](Fonctionnement-technique#restriction-des-6-heures). Résolution
automatique passé le délai.

## Tournoi recréé ou reconfirmé plusieurs jours de suite

Vérifier l'existence et les droits d'écriture de
`data/processed-tournaments.json` (mémoire anti-répétition, voir
[Fonctionnement technique](Fonctionnement-technique#m%C3%A9moire-locale)).
Fichier supprimé ou non accessible en écriture → perte de la mémoire,
retraitement des mêmes lignes.

## Création automatique en échec systématique

Vérifications dans l'ordre :

1. `STARTGG_EMAIL` / `STARTGG_PASSWORD` corrects (tester la connexion
   manuelle).
2. Droits admin du compte sur le tournoi de référence pointé par
   `config/source-registry.json` pour le type/combo de jeux concerné.
3. `config/config.json` → `contact.value` non vide (requis pour toute
   création).
4. Message d'erreur exact dans le terminal, point de départ du diagnostic.

En cas d'échec, instructions de création manuelle postées automatiquement
dans les salons d'annonces.
