<div align="center">

# 🏆 Bot Discord Weekly

**Le bot qui crée tes tournois start.gg pendant que tu dors.**

Un calendrier dans un Google Sheet. Un bot qui vérifie chaque matin ce qui
approche, crée la page start.gg de la weekly (logo, règlement, paiement,
bracket — tout est repris), la publie, et l'annonce sur Discord. Zéro clic.

[📖 Documentation complète (Wiki)](../../wiki) · [🐛 Signaler un bug](../../issues)

</div>

---

## Pourquoi ce bot existe

Faire vivre une weekly FGC, c'est chaque semaine la même corvée : ouvrir
start.gg, dupliquer la page de la dernière édition, corriger la date, publier,
puis aller l'annoncer sur Discord. Rien de compliqué, mais c'est un rituel
manuel qu'on oublie facilement — et qui prend 10 minutes qu'on n'a pas toujours.

Ce bot fait exactement ça à ta place, tous les jours, automatiquement.

## Ce qu'il fait

Chaque matin, pour chaque tournoi qui approche dans ton calendrier :

- **La page n'existe pas encore** → il la crée (clone complet d'une édition de
  référence : logo, bannière, règlement, contact, permissions, paiement,
  bracket), la publie, et poste l'annonce dans Discord — sans te demander
  quoi que ce soit.
- **La page existe déjà** (créée à la main) → il ne touche à rien, mais te
  demande dans un salon dédié si tu veux qu'il fasse l'annonce.
- **Un pépin survient** → il poste un mode d'emploi pour la créer à la main,
  plutôt que de laisser la weekly sans annonce en silence.

Une commande (`/next-tournament`) permet aussi de déclencher la vérification
à la demande, sans attendre le lendemain matin.

## Comment ça marche, en une phrase

start.gg n'offre **aucun moyen officiel de créer un tournoi par API** — le
bot pilote donc un navigateur headless pour reproduire exactement l'action
qu'un organisateur ferait à la main (« Copy settings from a previous
tournament »). Le détail complet — pourquoi, comment, et ce que ça implique —
est expliqué dans le [Wiki](../../wiki/Fonctionnement-technique).

## Démarrage rapide

```bash
git clone <ce-repo>
cd Bot-Discord-Weekly
npm install            # installe aussi Chromium (Playwright)
cp .env.example .env    # puis remplir les identifiants
npm start
```

Ça suppose d'avoir déjà en main un bot Discord, un compte start.gg dédié, et
un accès au Google Sheet du calendrier. Le guide pas-à-pas (comptes à créer,
permissions, configuration) est dans **[Installation et
configuration](../../wiki/Installation-et-configuration)**.

## Documentation

| Page | Contenu |
| --- | --- |
| [Installation et configuration](../../wiki/Installation-et-configuration) | Comptes nécessaires, variables d'environnement, premier lancement |
| [Format du Google Sheet](../../wiki/Format-du-Google-Sheet) | Colonnes attendues, règles de saisie |
| [Fichiers de configuration](../../wiki/Fichiers-de-configuration) | `source-registry.json`, `schedule.json`, `games.json`, `config.json` |
| [Commandes Discord](../../wiki/Commandes-Discord) | `/set-channel`, `/salon-admin`, `/set-role`, `/next-tournament` |
| [Fonctionnement technique](../../wiki/Fonctionnement-technique) | Architecture, pourquoi un navigateur, endpoints utilisés, limites |
| [Dépannage](../../wiki/Dépannage) | Solutions aux problèmes déjà rencontrés |

## Licence

MIT — voir [LICENSE](LICENSE).
