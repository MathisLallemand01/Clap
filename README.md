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
(une quarantaine d’acteurs et autant de rôles) tant que l’import TMDB n’a pas tourné. Chaque compte reçoit
3 bobines offertes et 600 tickets.

## Catalogue réel avec TMDB

```bash
cp .env.example .env   # puis renseigner TMDB_API_KEY
npm run import:tmdb    # ~8 800 acteurs et ~26 000 rôles, environ 15 minutes
TMDB_PAGES=25 npm run import:tmdb   # essai rapide : ~450 acteurs
```

Le script récupère les acteurs (avec portrait) par ordre de popularité, classe leur rareté selon la
notoriété de leur carrière (votes cumulés de leurs rôles principaux), garde leurs 6 rôles principaux
les plus vus, calcule la rareté des rôles (`src/lib/rarity.ts`) et les tags des bobines thématiques
(pays, genre, décennie, blockbuster). Les rôles de doublage et les dessins animés sont écartés : une
carte Rôle doit montrer l’acteur à l’image. Les Icônes sont une liste choisie à la main dans le script.

## Connexion Google

Créez un identifiant OAuth « Application Web » dans la console Google Cloud, avec l’URI de redirection
`<adresse du site>/api/auth/google/callback`, puis renseignez `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
et `APP_URL` dans `.env`. Sans ces clés, le bouton Google affiche un message et l’inscription par
e-mail reste disponible.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Application Next.js |
| `npm test` | Tests du moteur (`node --test`) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run seed` | Réinsère le catalogue de démarrage |
| `npm run import:tmdb` | Importe le catalogue réel depuis TMDB |

## Organisation

```
src/lib/rarity.ts     Les deux échelles de rareté, leurs valeurs en entrées, les règles TMDB
src/lib/boosters.ts   Les 19 bobines : contenu, probabilités, thème, prix, habillage du paquet
src/lib/pull.ts       Le tirage (fonctions pures, testées)
src/lib/catalog.ts    Catalogue en mémoire, vitrines, vedettes des paquets
src/lib/game.ts       Joueurs, bobines offertes, tickets, collection, recyclage, parrainage
src/lib/auth.ts       Comptes, mots de passe (scrypt), sessions, Google
src/lib/missions.ts   Missions du jour, de la semaine, sagas, série de visites
src/lib/market.ts     Le Guichet (marché entre joueurs)
src/lib/social.ts     Amis, échanges, filleuls
src/lib/notify.ts     Notifications et journal d’événements
src/lib/tmdb.ts       Biographies, fiches film et bandes-annonces (cache 7 jours)
src/lib/sound.ts      Sons de la projection, synthétisés en Web Audio
src/app/              Pages : accueil, connexion, bobines, contenu, projection, collection,
                      fiches acteur et rôle, missions, guichet, échanges, parrainage, paramètres
tests/                Tests du moteur, des comptes, du marché et des échanges
```

## Pages

- `/` accueil · `/connexion` connexion et inscription (e-mail, Google, code de parrainage)
- `/bobines` choix des bobines · `/bobines/[id]` contenu, de la rareté la plus haute à la plus basse
- `/ouvrir/[id]` projection : le paquet se déchire, la bande défile, les cartes se révèlent
- `/collection` (recyclage des doublons) · `/acteur/[id]` · `/role/[id]` (bande-annonce)
- `/missions` · `/guichet` · `/echanges` · `/parrainage` · `/parametres`

Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.
