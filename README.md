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
npm run import:tmdb    # films, séries, acteurs, sagas : compter 45 minutes à 1 heure
TMDB_PAGES=25 TMDB_FILM_PAGES=25 TMDB_TV_PAGES=5 npm run import:tmdb   # essai rapide
```

Le script part de trois sources : les **5 000 films les plus vus** (avec leurs 4 premiers rôles au
générique), les **1 000 séries les plus vues** (rôles principaux présents dans au moins 6 épisodes) et
les **acteurs populaires** (avec leurs 10 rôles principaux les plus vus). Quand TMDB a une image où
l’acteur est identifié (l’affiche de *Top Gun : Maverick* avec Tom Cruise), elle illustre la carte Rôle ;
sinon c’est un plan du film. Les séries ont leurs propres bobines (Séries cultes, policières, SF,
sitcoms, drames) et ne se mélangent pas aux bobines de cinéma. Aucun grand
film ne manque, et les stars de l’âge d’or arrivent par leurs films. Les rôles de doublage et les
dessins animés sont écartés : une carte Rôle doit montrer l’acteur à l’image.

Deux familles de cartes, deux échelles (`src/lib/rarity.ts`, expliquées sur la page `/raretes`) :

- **Acteurs** (bobines Casting) : Figurant, Second rôle, Premier rôle, Tête d’affiche, Légende, selon
  la notoriété de la carrière ; une liste de monstres sacrés est placée d’office en Légende.
- **Rôles** (bobines Film) : Série B, Succès, Culte, Vedette (une star en tête d’affiche), Icône (la
  tête d’affiche d’une saga ou d’un best-seller), Mythe (une centaine de personnages choisis à la main
  dans le script).

Les sagas viennent des collections TMDB. On peut relancer l’import à tout moment : les cartes déjà
possédées gardent leur numéro et prennent leur nouvelle rareté.

## Connexion Google

Créez un identifiant OAuth « Application Web » dans la console Google Cloud, avec l’URI de redirection
`<adresse du site>/api/auth/google/callback`, puis renseignez `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
et `APP_URL` dans `.env`. Sans ces clés, le bouton Google affiche un message et l’inscription par
e-mail reste disponible.

## Connexion Discord

Dans le [portail développeur Discord](https://discord.com/developers/applications), créez une application ;
dans « OAuth2 » → « Redirects », ajoutez **exactement** `<adresse du site>/api/auth/discord/callback`
(en local : `http://localhost:3000/api/auth/discord/callback`), puis copiez l’ID client et le secret
(« Reset Secret ») dans `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET`, et redémarrez le serveur. Laissez vide
« Interactions Endpoint URL » (il sert aux bots). « Continuer avec Discord » connecte le compte lié, rattache
un compte existant par e-mail vérifié, ou crée un compte au nom et à la photo Discord ; un joueur déjà connecté
peut aussi lier Discord dans Paramètres. Leur nom et leur photo Discord (GIF animé avec Nitro) s’affichent dans
le menu et le classement. En cas de refus, la raison exacte renvoyée par Discord est écrite dans la console du serveur.

## Musiques cultes

Quand on obtient le Rôle de l’acteur principal d’un film à musique culte (Tom Cruise dans *Top Gun : Maverick*
→ « Hold My Hand »), la musique se lance : un extrait officiel de 30 secondes, trouvé dans le catalogue public
d’Apple (iTunes Search, repli sur Deezer), avec un lien « Écouter en entier ». La liste des films est dans
`src/lib/themes.ts` ; ils sont reconnus dans le catalogue par année, acteur et titre. Aucune clé n’est
nécessaire, mais le serveur doit pouvoir joindre `itunes.apple.com`. La bobine « Bande originale » ne contient
que ces cartes.

## Sécurité

- Mots de passe hachés (scrypt) ; la base ne garde que l'empreinte SHA-256 des jetons de session.
- Cookies `httpOnly`, `SameSite=Lax`, `Secure` en production.
- Tentatives limitées : connexion (20 par adresse IP et 8 par compte toutes les 15 minutes), inscription
  (5 par heure et par adresse), bobine offerte aux visiteurs (3 par jour et par adresse). Ces compteurs
  sont en mémoire : ils valent pour un seul processus et repartent de zéro au redémarrage.
- Redirections limitées aux chemins internes du site ; en-têtes de sécurité (anti-cadre, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS en production) dans `next.config.ts`.
- Le compte de test aux tickets illimités (`npm run account:test`) est refusé en production.

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
