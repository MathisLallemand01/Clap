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
(une quarantaine d’acteurs et autant de rôles). Chaque visiteur reçoit un joueur invité,
3 bobines offertes et 600 tickets ; créer un compte rattache cette partie à un e-mail.

En production (`npm start`), le cookie de session est `Secure` : servez l’application en HTTPS
(ou sur `localhost`). Pour un test en HTTP sur une autre adresse, `CLAP_INSECURE_COOKIES=1`.

## Catalogue réel avec TMDB

```bash
cp .env.example .env   # puis renseigner TMDB_API_KEY
npm run import:tmdb    # ~1 minute : 800 acteurs + 150 du cinéma français, ~7 000 rôles, ~4 300 films
```

Le script part des films les plus vus (monde, France, Royaume-Uni), des acteurs populaires du
moment et des Icônes. Pour chaque acteur, il garde jusqu’à 8 rôles principaux (4 premiers au
générique, hors documentaires et apparitions) et récupère portrait, biographie, fiches des films
et bandes-annonces (YouTube, en français de préférence).

- **Notoriété** : somme des votes TMDB de ces rôles, pondérée par époque (un classique de 1965
  récolte dix fois moins de votes qu’un film récent aussi connu).
- **Raretés Acteur** : parts du classement (`ACTOR_SHARES` dans `src/lib/rarity.ts`). Le cinéma
  français (3 rôles en français, ou né en France avec au moins un) a son propre classement.
- **Raretés Rôle** : votes et note du film ; les Icônes sont une liste choisie à la main dans le script.
- Les noms non latins prennent un alias latin, sinon l’acteur est écarté.
- Relancer l’import met le catalogue à jour ; les cartes qui en sortent restent chez les joueurs
  qui les possèdent, mais disparaissent du catalogue.

Il faut que `api.themoviedb.org` et `image.tmdb.org` soient joignables (et `youtube-nocookie.com`
côté navigateur pour les bandes-annonces).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Application Next.js |
| `npm test` | Tests (`node --test`) : tirages, règles TMDB, comptes, sessions, économie |
| `npm run typecheck` | Vérification TypeScript |
| `npm run seed` | Réinsère le catalogue de démarrage |
| `npm run import:tmdb` | Importe le catalogue réel depuis TMDB |

## Organisation

```
src/lib/rarity.ts     Les deux échelles de rareté, leurs valeurs en entrées, les règles TMDB
src/lib/boosters.ts   Les bobines : contenu (slots), probabilités, thème, prix, apparence
src/lib/pull.ts       Le tirage (fonctions pures, testées)
src/lib/game.ts       Joueurs, bobines offertes, tickets, collection, box-office
src/lib/economy.ts    Prime du jour, recyclage des doublons, bonus de bienvenue, journal des tickets
src/lib/accounts.ts   Comptes (scrypt), sessions (jeton haché en base), limites de tentatives
src/lib/session.ts    Cookie de session côté Next, joueur courant
src/lib/catalog.ts    Fiches acteurs et films, catalogue, recherche
src/lib/tmdb.ts       Règles de lecture TMDB (noms, rôles, notoriété, bande-annonce), testées
src/lib/db.ts         Schéma SQLite (node:sqlite) et migrations
src/lib/sound.ts      Sons de la projection, synthétisés en Web Audio
src/app/ouvrir/[id]/  La projection : la bande de pellicule animée
src/app/acteur, role  Fiches acteur et rôle (biographie, film, bande-annonce)
src/app/catalogue     Tous les acteurs : recherche, rareté, pays
src/app/compte        Compte, prime du jour, recyclage, historique, mot de passe
src/app/actions.ts    Server actions (inscription, connexion, économie)
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
- Comptes e-mail + mot de passe : la partie invitée est rattachée à l’inscription, connexion sur
  plusieurs appareils, changement de mot de passe (déconnecte les autres appareils).
- Fiches acteur (biographie, rôles obtenus / à trouver) et rôle (film, synopsis, bande-annonce,
  casting du film), catalogue avec recherche et filtres.
- Économie : prime du jour (100 tickets, minuit heure de Paris), recyclage des doublons
  (moitié du prix conseillé), 300 tickets de bienvenue, historique des tickets.

À venir :
- Connexion Google / Apple (il faudra des identifiants OAuth), mot de passe oublié (il faudra un
  service d’envoi d’e-mails).
- Contenu détaillé de chaque bobine.
- Missions, Le Guichet (marché), échanges entre amis, parrainage, notifications.
- Passage de SQLite à PostgreSQL pour la mise en ligne.

Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.
