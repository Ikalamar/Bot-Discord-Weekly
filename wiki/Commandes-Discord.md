# Commandes Discord

Permission **Gérer le serveur** requise par défaut (ajustable par commande
depuis Paramètres du serveur → Intégrations → [nom du bot]).

## `/set-channel`

Ajoute/retire un salon d'annonces. Plusieurs salons possibles : chaque
annonce est postée dans tous les salons enregistrés.

```
/set-channel salon:#annonces
/set-channel salon:#annonces retirer:true
```

| Option | Requis | Description |
| --- | --- | --- |
| `salon` | oui | Salon à ajouter ou retirer |
| `retirer` | non | `true` pour retirer au lieu d'ajouter |

## `/salon-admin`

Définit le salon de contrôle (un seul), où le bot demande confirmation avant
d'annoncer un tournoi trouvé déjà existant.

```
/salon-admin salon:#staff-tournois
```

| Option | Requis | Description |
| --- | --- | --- |
| `salon` | oui | Salon de contrôle |
| `retirer` | non | `true` pour désactiver |

Sans salon de contrôle configuré : avertissement en log, aucune confirmation
postée. La création automatique n'est pas affectée.

## `/set-role`

Rôle mentionné par le bot : joueurs (annonces publiques) ou TOs (demandes de
validation : création, publication, annonce d'un tournoi déjà existant).

```
/set-role role:@Weekly
/set-role role:@TO cible:TOs
```

| Option | Requis | Description |
| --- | --- | --- |
| `role` | oui | Rôle à mentionner |
| `cible` | non | `Joueurs` (défaut, annonces publiques) ou `TOs` (demandes de validation) |
| `retirer` | non | `true` pour retirer la mention |

Mention des joueurs enveloppée dans un spoiler (`||@Weekly||`) : notification
envoyée, tag masqué dans le message. La mention des TOs est affichée en clair
en tête des demandes de validation.

## `/next-tournament`

Déclenche la vérification quotidienne à la demande.

```
/next-tournament
```

Aucune option. Trois cas :

- aucune ligne `Weekly` à venir → message d'erreur
- tournoi déjà existant → confirmation postée dans le salon de contrôle,
  accusé de réception dans le salon d'exécution
- aucun doublon → boutons **Oui, créer** / **Non** ; sur oui, création +
  publication + annonce avec suivi en direct du statut

Contrairement à la vérification automatique, ignore la limite J-3 : prend le prochain tournoi,
quelle que soit son échéance.
