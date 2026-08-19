# Documentation

## Sommaire

1. [Installation et configuration](Installation-et-configuration) : comptes requis, variables d'environnement, premier lancement.
2. [Format du Google Sheet](Format-du-Google-Sheet) : structure du calendrier lu par le bot.
3. [Fichiers de configuration](Fichiers-de-configuration) : rôle de chaque fichier dans `config/`.
4. [Commandes Discord](Commandes-Discord) : commandes slash disponibles.
5. [Fonctionnement technique](Fonctionnement-technique) : architecture, endpoints utilisés, limites.
6. [Dépannage](Dépannage) : problèmes rencontrés et solutions.

## Résumé

Vérification quotidienne automatique (8h, Europe/Paris) :

```
Pour chaque tournoi "Weekly" du sheet dans les 3 jours à venir :

  Existe déjà sur start.gg ?
    OUI → demande confirmation avant d'annoncer (salon de contrôle)
    NON → crée + publie + annonce automatiquement
```

`/next-tournament` déclenche la même vérification à la demande, sans
attendre le cycle quotidien.
