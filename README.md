# Clap — le cinéma, carte par carte

Jeu de cartes à collectionner sur le cinéma. On ouvre des **bobines** (boosters), on collectionne
des **cartes Acteur** (portraits) et des **cartes Rôle** (un acteur dans un film), chacune avec sa
propre échelle de rareté. Tout est gratuit : les monnaies du jeu n’ont aucune valeur réelle.

## Démarrer

Node.js 22.18 ou plus récent (SQLite et TypeScript sont pris en charge nativement).

```bash
npm install
npm run dev          # http://localhost:3000
```

La base SQLite est créée au premier lancement dans `data/clap.db`, avec un catalogue de démarrage
(une quarantaine d’acteurs et autant de rôles). Chaque visiteur reçoit un joueur invité (cookie),
3 bobines offertes et 600 tickets.

## Catalogue réel avec TMDB

```bash
cp .env.example .env   # puis renseigner TMDB_API_KEY
npm run import:tmdb    # 500 acteurs populaires ; TMDB_PAGES=100 pour 2 000
```

Le script récupère les acteurs par ordre de popularité, leurs portraits et leurs rôles principaux,
calcule les raretés (`src/lib/rarity.ts`) et les tags des bobines thématiques (pays, genre, décennie,
blockbuster). Les Icônes sont une liste choisie à la main dans le script. Il faut que
`api.themoviedb.org` et `image.tmdb.org` soient joignables.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Application Next.js |
| `npm test` | Tests du moteur de jeu (`node --test`) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run seed` | Réinsère le catalogue de démarrage |
| `npm run import:tmdb` | Importe le catalogue réel depuis TMDB |

## Organisation

```
src/lib/rarity.ts     Les deux échelles de rareté, leurs valeurs en entrées, les règles TMDB
src/lib/boosters.ts   Les bobines : contenu (slots), probabilités, thème, prix, apparence
src/lib/pull.ts       Le tirage (fonctions pures, testées)
src/lib/game.ts       Joueurs, bobines offertes, tickets, collection, box-office
src/lib/db.ts         Schéma SQLite (node:sqlite)
src/lib/sound.ts      Sons de la projection, synthétisés en Web Audio
src/app/ouvrir/[id]/  La projection : la bande de pellicule animée
src/components/       Cartes, bobines, logo, navigation
scripts/              Import TMDB et catalogue de démarrage
tests/                Tests du moteur
```

## Où en est-on

Fait :
- Accueil, liste des bobines, collection avec progression par rareté.
- Ouverture animée : la bande avance image par image, chaque carte se révèle à l’obturateur,
  avec son et accroche de rareté ; la bande continue quand on ouvre une autre bobine.
- Bobines offertes (une toutes les 4 h, 3 en réserve), tickets, numéros de série, box-office en entrées.
- 10 bobines, dont des thématiques (France, Royaume-Uni, Hollywood, Blockbusters, Sci-fi, Série B, Années 80).

À venir :
- Comptes (Google, Apple, e-mail) à la place du joueur invité.
- Fiches acteur et rôle, bande-annonce (vidéos TMDB).
- Contenu détaillé de chaque bobine.
- Missions, recyclage des doublons, Le Guichet (marché), échanges entre amis, parrainage,
  notifications, paramètres.
- Passage de SQLite à PostgreSQL pour la mise en ligne.

Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.
