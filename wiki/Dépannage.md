# Dépannage

Solutions aux problèmes déjà rencontrés en conditions réelles pendant le
développement de ce bot.

## Les commandes slash n'apparaissent pas dans Discord

**Cause la plus fréquente** : le bot a été invité sans le scope
`applications.commands` (seul `bot` a été coché lors de la génération du
lien d'invitation).

**Solution** : retourne sur [Discord Developer Portal → OAuth2 → URL
Generator](https://discord.com/developers/applications), coche **les deux**
scopes `bot` et `applications.commands`, régénère l'URL, ouvre-la et
autorise à nouveau — pas besoin de retirer le bot du serveur au préalable,
réautoriser suffit à ajouter le scope manquant.

**Autre cause possible** : propagation. Les commandes globales (notre cas)
peuvent mettre jusqu'à une heure à apparaître après un premier
enregistrement.

**Si le bot tourne et les commandes sont bien enregistrées** (le terminal
affiche `X commande(s) slash enregistree(s).`) mais qu'elles restent
invisibles : `Ctrl+R` (ou `Cmd+R`) dans le client Discord force le
rafraîchissement du cache local des commandes.

## « This interaction failed » en cliquant sur un bouton

Discord invalide une interaction non-acquittée au bout de 3 secondes. Si le
code plante *avant* d'appeler `interaction.reply()` / `.update()` /
`.deferUpdate()` — par exemple une erreur de syntaxe dans le message
construit — l'interaction n'est jamais acquittée et Discord affiche ce
timeout, sans que l'erreur réelle soit visible ailleurs que dans les logs du
bot. Le réflexe : regarder le terminal du bot, l'erreur exacte y est
loggée.

## Le lien start.gg s'affiche sans aperçu (pas de carte avec image/titre)

Il manque la permission **Embed Links** au bot. Sans elle, Discord affiche le
lien en texte brut mais ne génère pas la carte de prévisualisation.

**Solution rapide** : Paramètres du serveur → Rôles → rôle du bot → activer
**Intégrer des liens**.

**Solution alternative** : régénérer un lien d'invitation OAuth2 avec cette
permission cochée, et réautoriser (voir plus haut).

## `browserType.launch: Executable doesn't exist`

Playwright cherche un navigateur d'une révision précise qui n'est plus sur le
disque. Ça arrive typiquement après avoir lancé `npx playwright install`
depuis un dossier différent de celui où `playwright` est réellement installé
(deux installations de Playwright sur la même machine peuvent chacune
réclamer une révision de navigateur différente, et une réinstallation peut
purger les révisions dont *elle* n'a pas besoin, y compris celles utilisées
par l'autre installation).

**Solution** : dans ce projet, une seule installation de Playwright existe
(déclarée dans le `package.json` racine). Réinstalle simplement les
navigateurs depuis la racine du projet :

```bash
npx playwright install chromium
```

Si le problème revient régulièrement, vérifie qu'aucune autre installation
de Playwright ne traîne ailleurs sur la machine (`npm ls playwright` dans
d'autres projets), et évite de lancer `npx playwright install` en dehors de
ce dossier.

## Tournoi créé mais pas « Discoverable »

Comportement attendu, pas un bug : start.gg refuse de rendre un tournoi
visible dans sa recherche tant que le compte qui l'a créé a moins de 6 heures
d'existence. Le tournoi reste publié en mode « Link only », pleinement
utilisable pour l'annonce Discord (le lien direct fonctionne normalement).
Voir [Fonctionnement
technique](Fonctionnement-technique#le-compte-du-bot-doit-avoir-6-heures-dexistence)
pour le détail. Ça se résout tout seul avec le temps, aucune action requise.

## Le bot recrée ou reconfirme le même tournoi plusieurs jours de suite

Vérifie que `data/processed-tournaments.json` existe et est accessible en
écriture — c'est la mémoire qui empêche ce comportement (voir
[Fonctionnement
technique](Fonctionnement-technique#la-m%C3%A9moire-locale)). Si le fichier a
été supprimé ou si le process n'a pas les droits d'écriture sur `data/`, le
bot perd cette mémoire et retraite les mêmes lignes.

## La création automatique échoue systématiquement

Vérifie dans l'ordre :

1. `STARTGG_EMAIL` / `STARTGG_PASSWORD` sont-ils corrects ? (teste-les en te
   connectant manuellement sur start.gg)
2. Le compte a-t-il bien les droits admin sur le tournoi de référence
   pointé par `config/source-registry.json` pour ce type/combo de jeux ?
3. `config/config.json` → `contact.value` est-il rempli ? (le bot refuse de
   créer un tournoi sans ce champ)
4. Le message d'erreur exact est loggé dans le terminal — c'est le point de
   départ le plus fiable pour diagnostiquer plus loin.

En cas d'échec, le bot poste automatiquement les instructions de création
manuelle dans les salons d'annonces, pour qu'aucune weekly ne reste sans page
en attendant la résolution du problème.
