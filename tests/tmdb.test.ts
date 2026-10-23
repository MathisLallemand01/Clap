import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actorRarityFromRank, ACTOR_LADDER } from '../src/lib/rarity.ts';
import { cleanCharacter, eraWeight, isFrenchCinema, isSelf, latinName, leadRoles, notoriety, pickTrailer, splitName, type CastCredit } from '../src/lib/tmdb.ts';

const credit = (over: Partial<CastCredit>): CastCredit => ({
  id: 1, title: 'Film', original_title: 'Film', original_language: 'en', character: 'Héros', order: 0, release_date: '2010-01-01',
  vote_count: 1000, vote_average: 7, genre_ids: [18], backdrop_path: null, poster_path: null, ...over,
});

test('les raretés Acteur suivent les parts du classement', () => {
  const total = 1000;
  const counts = Object.fromEntries(ACTOR_LADDER.map((r) => [r, 0]));
  for (let rank = 1; rank <= total; rank++) counts[actorRarityFromRank(rank, total)]++;
  assert.deepEqual(counts, { legende: 30, tete: 90, premier: 230, second: 300, figurant: 350 });
  assert.equal(actorRarityFromRank(1, 1), 'figurant', 'un seul acteur est à 100 % du classement');
  assert.equal(actorRarityFromRank(1, 100), 'legende');
});

test('les noms non latins prennent un alias latin, ou sont écartés', () => {
  assert.equal(latinName('Jean Reno'), 'Jean Reno');
  assert.equal(latinName('  Léa   Seydoux '), 'Léa Seydoux');
  assert.equal(latinName('成龍', ['Jackie Chan', 'Chan Kong-sang']), 'Jackie Chan');
  assert.equal(latinName('秦漢', ['秦汉']), null);
});

test('prénom et nom, avec particules et suffixes', () => {
  assert.deepEqual(splitName('Louis de Funès'), { first: 'Louis', last: 'de Funès' });
  assert.deepEqual(splitName('Robert Downey Jr.'), { first: 'Robert', last: 'Downey Jr.' });
  assert.deepEqual(splitName('Samuel L. Jackson'), { first: 'Samuel L.', last: 'Jackson' });
  assert.deepEqual(splitName('Zendaya'), { first: '', last: 'Zendaya' });
  assert.deepEqual(splitName('Max von Sydow'), { first: 'Max', last: 'von Sydow' });
});

test('les personnages sont nettoyés', () => {
  assert.equal(cleanCharacter('Donkey (voice)'), 'Donkey');
  assert.equal(cleanCharacter('Bruce Wayne / Batman'), 'Bruce Wayne');
  assert.equal(cleanCharacter('Elsa (archive sound)'), 'Elsa');
  assert.equal(cleanCharacter('Griffin (segment "The Pitch")'), 'Griffin');
  assert.equal(cleanCharacter('(voices)'), '');
  assert.ok(isSelf('Himself'));
  assert.ok(!isSelf('Selma'));
});

test('rôles principaux : générique, votes, documentaires, doublons', () => {
  const roles = leadRoles([
    credit({ id: 1, vote_count: 500 }),
    credit({ id: 2, vote_count: 9000 }),
    credit({ id: 3, order: 7, vote_count: 99999 }),          // second rôle
    credit({ id: 4, vote_count: 10 }),                        // film trop peu vu
    credit({ id: 5, genre_ids: [99], vote_count: 5000 }),     // documentaire
    credit({ id: 6, character: 'Himself', vote_count: 5000 }),
    credit({ id: 2, vote_count: 9000, character: 'Autre' }),  // même film, deux personnages
    credit({ id: 7, release_date: undefined }),
  ], 8);
  assert.deepEqual(roles.map((r) => r.id), [2, 1]);
});

test('la notoriété pondère les films anciens', () => {
  assert.equal(eraWeight(2020), 1);
  assert.equal(eraWeight(1991), 2);
  assert.equal(eraWeight(1930), 5);
  assert.equal(notoriety([credit({ vote_count: 1000, release_date: '1991-05-01' }), credit({ vote_count: 1000, release_date: '2020-01-01' })]), 3000);
});

test('cinéma français : langue des rôles ou naissance en France', () => {
  const fr = credit({ original_language: 'fr' });
  const en = credit({ original_language: 'en' });
  assert.ok(isFrenchCinema([fr, fr, fr, en, en, en, en, en]));
  assert.ok(isFrenchCinema([fr, en]));
  assert.ok(!isFrenchCinema([fr, en, en]));
  assert.ok(isFrenchCinema([fr, en, en, en], 'Paris, France'));
  assert.ok(!isFrenchCinema([en, en], 'Paris, France'));
});

test('bande-annonce : Trailer français officiel en priorité', () => {
  const v = (over: object) => ({ iso_639_1: 'en', site: 'YouTube', type: 'Trailer', official: true, key: 'aaaaaaaaaaa', ...over });
  assert.equal(pickTrailer([v({ key: 'enofficial1' }), v({ iso_639_1: 'fr', official: false, key: 'frtrailer01' })]), 'frtrailer01');
  assert.equal(pickTrailer([v({ type: 'Teaser', iso_639_1: 'fr', key: 'frteaser001' }), v({ key: 'entrailer01' })]), 'entrailer01');
  assert.equal(pickTrailer([v({ type: 'Clip', key: 'clip0000001' }), v({ site: 'Vimeo', key: 'vimeo000001' })]), null);
  assert.equal(pickTrailer([v({ key: 'bad"key<script>' })]), null);
});
