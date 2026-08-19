# Format du Google Sheet

Source de vérité du calendrier. Lecture seule : le bot n'y écrit jamais rien
(voir [Fonctionnement
technique](Fonctionnement-technique#pourquoi-le-bot-n%C3%A9crit-rien-dans-le-sheet)).

## Colonnes

En-têtes en ligne 1, données à partir de la ligne 2 :

| A : Nom | B : Date | C : Jeux | D : Type |
| --- | --- | --- | --- |
| `Bagarre 2 Bar #138` | `25/08/2026` | `SSBU, SF6` | `Weekly` |

**A, Nom** : nom exact de la page start.gg créée. Sert aussi à détecter le
type de weekly et à vérifier si le tournoi existe déjà.

**B, Date** : format `JJ/MM/AAAA`. Seule la date compte ; les horaires sont
fixés dans [`config/schedule.json`](Fichiers-de-configuration#scheduljson).

**C, Jeux** : liste séparée par des virgules, ordre indifférent (`SSBU, SF6`
≡ `SF6, SSBU`). Chaque jeu doit correspondre à un alias de
[`config/games.json`](Fichiers-de-configuration#gamesjson), sinon le texte
brut est utilisé et la recherche du tournoi de référence peut échouer.

**D, Type** : doit valoir exactement `Weekly` (insensible à la casse). Toute
autre valeur (vide, `Special`, etc.) fait ignorer la ligne, ce qui permet de
garder dans le même sheet des événements ponctuels sans que le bot s'en
mêle.

## Détection du type de weekly

Par expression régulière sur la colonne Nom :

- `bagarre 2 bar` / `bagarre de bar` → type `Bagarre 2 Bar`
- `72 hit combo` → type `72 Hit Combo`

Détermine les horaires ([`schedule.json`](Fichiers-de-configuration#scheduljson))
et le tournoi de référence
([`source-registry.json`](Fichiers-de-configuration#source-registryjson)).
Ajouter un type demande une modification de `detectType` dans
`src/startgg/tournament.js`, pas seulement une entrée de configuration.

## Fenêtre de traitement

- Vérification quotidienne automatique : lignes `Weekly` dont la date tombe entre J-0 et J+3.
- `/next-tournament` : ignore cette limite, prend la ligne `Weekly` la plus
  proche dans le temps.

Un tournoi déjà traité avec succès n'est pas reproposé (voir [mémoire
locale](Fonctionnement-technique#m%C3%A9moire-locale)).

## Exemple

| Nom | Date | Jeux | Type |
| --- | --- | --- | --- |
| Bagarre 2 Bar #138 | 25/08/2026 | SSBU, SF6 | Weekly |
| 72 Hit Combo #13 | 23/08/2026 | SSBU | Weekly |
| Tournoi spécial rentrée | 30/08/2026 | SSBU, Tekken 8 | Special |
| Bagarre 2 Bar #139 | 01/09/2026 | SSBU, 2XKO | Weekly |

Le bot traite les lignes 1, 2 et 4 (la 4 une fois dans sa fenêtre J-3),
ignore la 3.
