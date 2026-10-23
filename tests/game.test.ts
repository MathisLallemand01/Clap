import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOOSTERS, FREE_BOOSTER_CAP, FREE_BOOSTER_EVERY_MS, getBooster } from '../src/lib/boosters.ts';
import { openDb } from '../src/lib/db.ts';
import { createPlayer, GameError, getCatalog, getCollection, getPlayer, getStats, openBoosterFor, STARTING_TICKETS } from '../src/lib/game.ts';
import { boosterPool, openBooster, rollRarity } from '../src/lib/pull.ts';
import { RARITIES } from '../src/lib/rarity.ts';
import { themeFor } from '../src/lib/themes.ts';

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('les tirages de rareté suivent les probabilités annoncées', () => {
  const slot = getBooster('casting')!.slots[0];
  const rng = seeded(1);
  const counts: Record<string, number> = {};
  const n = 100_000;
  for (let i = 0; i < n; i++) {
    const r = rollRarity(slot, rng);
    counts[r] = (counts[r] ?? 0) + 1;
  }
  assert.ok(Math.abs(counts.figurant / n - 0.58) < 0.01);
  assert.ok(Math.abs(counts.legende / n - 0.01) < 0.003);
});

test('chaque bobine donne une carte par slot, du bon type, de la moins rare à la plus rare', () => {
  const catalog = getCatalog(openDb(':memory:'));
  const rng = seeded(2);
  for (const def of BOOSTERS) {
    // Le petit catalogue de démarrage ne couvre pas tous les thèmes.
    const pool = boosterPool(def, catalog);
    if (!def.slots.every((s) => pool.some((c) => c.kind === s.kind))) continue;
    for (let i = 0; i < 50; i++) {
      const cards = openBooster(def, catalog, rng);
      assert.equal(cards.length, def.slots.length, def.id);
      const kinds = (list: { kind: string }[]) => list.map((x) => x.kind).sort().join();
      assert.equal(kinds(cards), kinds(def.slots), def.id);
      // La meilleure carte est toujours révélée en dernier.
      cards.slice(1).forEach((c, k) => assert.ok(RARITIES[c.rarity].tier >= RARITIES[cards[k].rarity].tier, def.id));
    }
  }
});

test('une bobine thématique ne donne que des cartes de son thème', () => {
  const catalog = getCatalog(openDb(':memory:'));
  const def = getBooster('france')!;
  const pool = new Set(boosterPool(def, catalog).map((c) => c.id));
  const rng = seeded(3);
  for (let i = 0; i < 200; i++) {
    for (const c of openBooster(def, catalog, rng)) assert.ok(pool.has(c.id), c.id);
  }
  const roles = catalog.filter((c) => c.kind === 'role' && pool.has(c.id));
  assert.ok(roles.every((c) => c.tags.includes('country:FR')));
});

test('la Série B ne donne que des Séries B', () => {
  const catalog = getCatalog(openDb(':memory:'));
  const rng = seeded(4);
  for (let i = 0; i < 100; i++) {
    for (const c of openBooster(getBooster('serie-b')!, catalog, rng)) assert.equal(c.rarity, 'serieb');
  }
});

test('ouvrir consomme d’abord les bobines offertes, puis les tickets', () => {
  const db = openDb(':memory:');
  const now = 1_000_000;
  const player = createPlayer(db, now);
  for (let i = 0; i < FREE_BOOSTER_CAP; i++) {
    assert.equal(openBoosterFor(db, player.id, 'casting', { now }).paidWith, 'free');
  }
  const paid = openBoosterFor(db, player.id, 'casting', { now });
  assert.equal(paid.paidWith, 'tickets');
  assert.equal(paid.player.tickets, STARTING_TICKETS - getBooster('casting')!.price);
  assert.equal(paid.player.freeStock, 0);
  assert.equal(paid.player.nextFreeAt, now + FREE_BOOSTER_EVERY_MS);
});

test('sans bobine ni tickets, l’ouverture est refusée sans rien changer', () => {
  const db = openDb(':memory:');
  const now = 1_000_000;
  const player = createPlayer(db, now);
  for (let i = 0; i < FREE_BOOSTER_CAP; i++) openBoosterFor(db, player.id, 'casting', { now });
  openBoosterFor(db, player.id, 'avant-premiere', { now });
  const before = getStats(db, player.id);
  assert.throws(() => openBoosterFor(db, player.id, 'icones', { now }), (e: unknown) => e instanceof GameError && e.code === 'not-enough-tickets');
  assert.deepEqual(getStats(db, player.id), before);
});

test('les bobines offertes se rechargent avec le temps, sans dépasser la réserve', () => {
  const db = openDb(':memory:');
  const now = 1_000_000;
  const player = createPlayer(db, now);
  for (let i = 0; i < FREE_BOOSTER_CAP; i++) openBoosterFor(db, player.id, 'casting', { now });
  assert.equal(getPlayer(db, player.id, now + FREE_BOOSTER_EVERY_MS * 2 + 5)!.freeStock, 2);
  assert.equal(getPlayer(db, player.id, now + FREE_BOOSTER_EVERY_MS * 10)!.freeStock, FREE_BOOSTER_CAP);
});

test('collection, numéros de série et box-office', () => {
  const db = openDb(':memory:');
  const a = createPlayer(db);
  const b = createPlayer(db);
  const pulled = openBoosterFor(db, a.id, 'casting', { rng: seeded(5) }).cards;
  const again = openBoosterFor(db, b.id, 'casting', { rng: seeded(5) }).cards;
  assert.deepEqual(again.map((c) => c.id), pulled.map((c) => c.id));
  again.forEach((c, i) => assert.ok(c.serial > pulled[i].serial));

  const stats = getStats(db, a.id);
  assert.equal(stats.copies, 5);
  assert.equal(stats.entries, pulled.reduce((s, c) => s + RARITIES[c.rarity].entries, 0));
  const collection = getCollection(db, a.id);
  assert.equal(collection.reduce((s, c) => s + c.copies, 0), 5);
  for (let i = 1; i < collection.length; i++) {
    assert.ok(RARITIES[collection[i - 1].rarity].entries >= RARITIES[collection[i].rarity].entries);
  }
});

test('musiques cultes : l’acteur principal du bon film, pas les suites ni les seconds rôles', () => {
  const role = (first: string, last: string, film: string, year: number) =>
    ({ kind: 'role' as const, first, last, film, year });
  assert.equal(themeFor(role('Tom', 'Cruise', 'Top Gun : Maverick', 2022))?.song, 'Hold My Hand');
  assert.equal(themeFor(role('Tom', 'Cruise', 'Top Gun', 1986))?.song, 'Danger Zone');
  assert.equal(themeFor(role('Sylvester', 'Stallone', "Rocky III : L'Œil du tigre", 1982))?.song, 'Eye of the Tiger');
  assert.equal(themeFor(role('Sylvester', 'Stallone', 'Rocky', 1976))?.song, 'Gonna Fly Now');
  assert.equal(themeFor(role('Daniel', 'Radcliffe', 'Harry Potter et la Chambre des secrets', 2002)), null);
  assert.equal(themeFor(role('Miles', 'Teller', 'Top Gun : Maverick', 2022)), null);
  assert.equal(themeFor({ kind: 'actor', first: 'Tom', last: 'Cruise', film: null, year: null }), null);
});

test('Bande originale : uniquement des Rôles à musique culte ; Tout Clap : tout le catalogue', () => {
  const db = openDb(':memory:');
  const catalog = getCatalog(db);
  const soundtrack = getBooster('bande-originale')!;
  assert.ok(boosterPool(soundtrack, catalog).every((c) => themeFor(c)));
  assert.equal(boosterPool(getBooster('tout-clap')!, catalog).length, catalog.length);
});

test('Panthéon : uniquement des grands rôles de films très vus', () => {
  const db = openDb(':memory:');
  const pool = boosterPool(getBooster('pantheon')!, getCatalog(db));
  assert.ok(pool.every((c) => c.kind === 'role' && (c.votes ?? 0) >= 15_000 && RARITIES[c.rarity].tier >= 3));
});
