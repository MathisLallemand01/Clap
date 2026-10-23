import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from '../src/lib/db.ts';
import { claimDaily, DAILY_BONUS, getDuplicates, getLedger, parisDay, recycleDuplicates, recycleValue } from '../src/lib/economy.ts';
import { createPlayer, GameError, getCollection, getPlayer, getStats, openBoosterFor, STARTING_TICKETS } from '../src/lib/game.ts';
import { RARITIES_BY_VALUE } from '../src/lib/rarity.ts';

const always = (v: number) => () => v;

test('la prime du jour : une fois par jour, heure de Paris', () => {
  const db = openDb(':memory:');
  const { id } = createPlayer(db);
  const evening = Date.UTC(2026, 9, 23, 21, 30); // 23h30 à Paris (UTC+2)
  assert.equal(parisDay(evening), '2026-10-23');
  assert.equal(claimDaily(db, id, evening), STARTING_TICKETS + DAILY_BONUS);
  assert.throws(() => claimDaily(db, id, evening + 60_000), (e: unknown) => e instanceof GameError && e.code === 'daily-taken');
  const afterMidnight = Date.UTC(2026, 9, 23, 22, 5); // 00h05 à Paris
  assert.equal(parisDay(afterMidnight), '2026-10-24');
  assert.equal(claimDaily(db, id, afterMidnight), STARTING_TICKETS + 2 * DAILY_BONUS);
  assert.deepEqual(getLedger(db, id).map((e) => e.reason), ['daily', 'daily']);
});

test('recyclage : garde le meilleur numéro, crédite le barème, journalise', () => {
  const db = openDb(':memory:');
  const { id } = createPlayer(db);
  // Le même tirage trois fois : chaque carte en trois exemplaires.
  for (let i = 0; i < 3; i++) openBoosterFor(db, id, 'casting', { rng: always(0) });
  const before = getCollection(db, id);
  const dups = getDuplicates(db, id);
  const expected = dups.reduce((s, d) => s + d.extra * recycleValue(d.rarity), 0);
  assert.ok(dups.length > 0);
  const tickets = getPlayer(db, id)!.tickets;
  const r = recycleDuplicates(db, id);
  assert.equal(r.tickets, expected);
  assert.equal(r.balance, tickets + expected);
  const after = getCollection(db, id);
  assert.ok(after.every((c) => c.copies === 1));
  assert.deepEqual(after.map((c) => [c.id, c.serial]), before.map((c) => [c.id, c.serial]), 'le meilleur numéro est gardé');
  assert.equal(getLedger(db, id)[0].reason, 'recycle');
  assert.throws(() => recycleDuplicates(db, id), (e: unknown) => e instanceof GameError && e.code === 'nothing-to-recycle');
});

test('recycler une seule carte ne touche pas aux autres', () => {
  const db = openDb(':memory:');
  const { id } = createPlayer(db);
  for (let i = 0; i < 2; i++) openBoosterFor(db, id, 'casting', { rng: always(0) });
  const [first, second] = getDuplicates(db, id);
  recycleDuplicates(db, id, { cardId: first.cardId });
  assert.deepEqual(getDuplicates(db, id).map((d) => d.cardId), second ? [second.cardId] : []);
});

test('après recyclage, les numéros de série restent uniques', () => {
  const db = openDb(':memory:');
  const { id } = createPlayer(db);
  for (let i = 0; i < 3; i++) openBoosterFor(db, id, 'casting', { rng: always(0) });
  recycleDuplicates(db, id);
  openBoosterFor(db, id, 'casting', { rng: always(0) });
  const rows = db.prepare('SELECT card_id, serial, COUNT(*) AS n FROM owned GROUP BY card_id, serial HAVING n > 1').all();
  assert.deepEqual(rows, []);
});

test('le barème suit la valeur des raretés', () => {
  for (let i = 1; i < RARITIES_BY_VALUE.length; i++) {
    assert.ok(recycleValue(RARITIES_BY_VALUE[i - 1]) >= recycleValue(RARITIES_BY_VALUE[i]));
  }
  assert.equal(recycleValue('figurant'), 3);
  assert.equal(recycleValue('legende'), 500);
});

test('une bobine payée en tickets apparaît au journal', () => {
  const db = openDb(':memory:');
  const { id } = createPlayer(db);
  for (let i = 0; i < 4; i++) openBoosterFor(db, id, 'casting');
  const ledger = getLedger(db, id);
  assert.equal(ledger.length, 1);
  assert.deepEqual([ledger[0].reason, ledger[0].amount, ledger[0].detail], ['booster', -300, 'Casting']);
  assert.equal(getStats(db, id).pulls, 4);
});
