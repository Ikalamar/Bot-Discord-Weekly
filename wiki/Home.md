# Bot Discord Weekly — Documentation

Bienvenue dans la documentation complète du bot. Si tu découvres le projet,
commence par le [README](https://github.com/Ikalamar/Bot-Discord-Weekly) pour
une vue d'ensemble, puis reviens ici pour la configuration détaillée.

## Sommaire

1. **[Installation et configuration](Installation-et-configuration)** — la
   page à suivre pour partir de zéro : comptes à créer, variables
   d'environnement, premier lancement.
2. **[Format du Google Sheet](Format-du-Google-Sheet)** — comment doit être
   structuré le calendrier lu par le bot.
3. **[Fichiers de configuration](Fichiers-de-configuration)** — le rôle de
   chaque fichier dans `config/` et comment les remplir.
4. **[Commandes Discord](Commandes-Discord)** — les commandes slash
   disponibles une fois le bot en ligne.
5. **[Fonctionnement technique](Fonctionnement-technique)** — pour comprendre
   *pourquoi* le bot est construit comme il l'est (et pourquoi un navigateur
   headless est nécessaire).
6. **[Dépannage](Dépannage)** — solutions aux problèmes déjà rencontrés en
   conditions réelles.

## En bref

Le bot lit un Google Sheet tenant lieu de calendrier, et chaque jour à 8h
(heure de Paris) :

```
Pour chaque tournoi "Weekly" du sheet dans les 3 jours à venir :

  Existe déjà sur start.gg ?
    OUI → demande confirmation avant d'annoncer (salon de contrôle)
    NON → crée + publie + annonce automatiquement
```

Une commande manuelle (`/next-tournament`) permet de déclencher cette
vérification à la demande, sans attendre le cycle quotidien.
