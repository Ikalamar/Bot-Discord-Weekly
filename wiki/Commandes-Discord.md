# Commandes Discord

Les quatre commandes du bot. Toutes nécessitent la permission **Gérer le
serveur** sur le compte qui les exécute (configurable finement depuis
**Paramètres du serveur → Intégrations → [nom du bot]** dans Discord, si tu
veux autoriser un rôle spécifique plutôt que « Gérer le serveur »).

## `/set-channel`

Ajoute ou retire un salon de la liste des salons d'annonces. **Plusieurs
salons possibles** — chaque annonce est postée dans tous les salons
enregistrés.

```
/set-channel salon:#annonces
/set-channel salon:#annonces-discord-2 
/set-channel salon:#annonces retirer:true
```

| Option | Obligatoire | Description |
| --- | --- | --- |
| `salon` | oui | Le salon à ajouter (ou retirer) |
| `retirer` | non | `true` pour retirer le salon au lieu de l'ajouter |

## `/salon-admin`

Définit le salon de contrôle — **un seul à la fois**, contrairement aux
salons d'annonces. C'est là que le bot demande confirmation quand il trouve
un tournoi déjà existant, avant de l'annoncer.

```
/salon-admin salon:#staff-tournois
```

| Option | Obligatoire | Description |
| --- | --- | --- |
| `salon` | oui | Le salon de contrôle |
| `retirer` | non | `true` pour désactiver le salon de contrôle |

Sans salon de contrôle configuré, le bot ne peut pas demander de
confirmation : il se contente de logger un avertissement et ne poste rien
dans ce cas précis (la création automatique, elle, n'est pas affectée).

## `/set-role`

Rôle mentionné en tête de chaque annonce publique de weekly.

```
/set-role role:@Weekly
```

| Option | Obligatoire | Description |
| --- | --- | --- |
| `role` | oui | Le rôle à mentionner |
| `retirer` | non | `true` pour ne plus mentionner de rôle |

La mention est enveloppée dans un spoiler Discord (`||@Weekly||`) : le rôle
est bien notifié, mais le tag ne s'affiche pas en évidence dans le message —
un compromis courant pour garder l'annonce lisible tout en notifiant les
intéressés.

## `/next-tournament`

Déclenche à la demande la même vérification que fait le cron chaque matin,
sans attendre le lendemain — pratique pour tester la configuration ou pour
avancer manuellement sur le prochain tournoi du calendrier.

```
/next-tournament
```

Pas d'option. Le comportement dépend de ce que le bot trouve :

- **Aucune ligne « Weekly » à venir dans le sheet** → message d'erreur clair,
  rien d'autre.
- **Le tournoi existe déjà sur start.gg** → poste la demande de confirmation
  dans le salon de contrôle (identique au flux automatique), et confirme
  brièvement dans le salon où la commande a été tapée.
- **Aucun tournoi existant** → propose directement, avec deux boutons **Oui,
  créer** / **Non**, de lancer la création. Sur « Oui », le message se met à
  jour en direct (`⏳ Création en cours...`) puis affiche le résultat une
  fois le tournoi créé, publié et annoncé.

Contrairement au cron automatique, `/next-tournament` ne se limite pas aux
tournois à 3 jours ou moins : elle prend le prochain, quelle que soit son
échéance.
