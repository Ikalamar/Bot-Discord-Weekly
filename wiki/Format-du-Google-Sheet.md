# Format du Google Sheet

Le Sheet est la seule source de vérité pour le calendrier. Le bot le lit
seul — **il n'y écrit jamais rien** (voir [Fonctionnement
technique](Fonctionnement-technique#pourquoi-le-bot-n%C3%A9crit-rien-dans-le-sheet)
pour la raison).

## Colonnes attendues

En-têtes en ligne 1, données à partir de la ligne 2, dans cet ordre :

| Colonne | A : Nom | B : Date | C : Jeux | D : Type |
| --- | --- | --- | --- | --- |
| Exemple | `Bagarre 2 Bar #138` | `25/08/2026` | `SSBU, SF6` | `Weekly` |

### A — Nom

Le nom exact que la page start.gg créée portera. C'est aussi ce nom qui sert
à détecter le type de weekly (voir plus bas) et à vérifier si le tournoi
existe déjà.

### B — Date

Format `JJ/MM/AAAA`. C'est uniquement la **date** qui compte ici — les
horaires sont fixés séparément dans
[`config/schedule.json`](Fichiers-de-configuration#scheduljson).

### C — Jeux

Liste des jeux séparés par une virgule, dans n'importe quel ordre :
`SSBU, SF6` et `SF6, SSBU` sont strictement équivalents pour le bot. Chaque
jeu doit correspondre à un alias connu dans
[`config/games.json`](Fichiers-de-configuration#gamesjson) — sinon le bot
utilise le texte tel quel, ce qui peut empêcher de trouver le bon tournoi de
référence à cloner.

### D — Type

**Doit valoir exactement `Weekly`** (insensible à la casse) pour qu'une ligne
soit prise en compte. Toute autre valeur — vide, `Special`, un nom de
tournoi, etc. — fait ignorer la ligne par le bot. Ça permet de garder dans le
même sheet des lignes qui ne concernent pas le bot (ponctuels, événements
spéciaux à créer à la main) sans qu'il s'en mêle.

## Comment le nom détermine le type de weekly

Le bot reconnaît le type de weekly directement dans le texte de la colonne
Nom, par expression régulière :

- Contient « Bagarre 2 Bar » ou « Bagarre de Bar » → type `Bagarre 2 Bar`
- Contient « 72 Hit Combo » → type `72 Hit Combo`

Ce type sert ensuite à choisir les bons horaires
([`schedule.json`](Fichiers-de-configuration#scheduljson)) et le bon tournoi
de référence ([`source-registry.json`](Fichiers-de-configuration#source-registryjson)).

> Ajouter un troisième type de weekly demande une petite modification de code
> (`detectType` dans `src/startgg/tournament.js`), pas seulement une entrée de
> configuration.

## Quelles lignes sont traitées, et quand

Deux mécaniques différentes lisent le sheet :

- **Le cron quotidien** (8h, tous les jours) ne prend que les lignes dont la
  date tombe **dans les 3 jours à venir** (J-3 à J-0). Une ligne dont la date
  est plus lointaine est ignorée jusqu'à ce qu'elle entre dans cette fenêtre.
- **La commande `/next-tournament`** ignore cette limite de 3 jours et prend
  simplement la ligne « Weekly » la plus proche dans le temps, peu importe à
  combien de jours elle se trouve.

Dans les deux cas, seules les lignes de type `Weekly` sont considérées, et
une ligne dont le tournoi a déjà été traité avec succès n'est plus reproposée
(voir [Fonctionnement technique](Fonctionnement-technique#la-m%C3%A9moire-locale)
pour le détail de cette mémoire).

## Exemple de sheet

| Nom | Date | Jeux | Type |
| --- | --- | --- | --- |
| Bagarre 2 Bar #138 | 25/08/2026 | SSBU, SF6 | Weekly |
| 72 Hit Combo #13 | 23/08/2026 | SSBU | Weekly |
| Tournoi spécial rentrée | 30/08/2026 | SSBU, Tekken 8 | Special |
| Bagarre 2 Bar #139 | 01/09/2026 | SSBU, 2XKO | Weekly |

Ici, le bot traite les deux premières lignes (et la quatrième une fois
qu'elle entre dans sa fenêtre J-3), mais ignore complètement la troisième.
