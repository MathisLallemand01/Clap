import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signUp } from '../src/lib/auth.ts';
import { openDb } from '../src/lib/db.ts';
import { getPlayer, openBoosterFor } from '../src/lib/game.ts';
import { recordVisit } from '../src/lib/missions.ts';
import { claimSeasonReward, presenceBoard, seasonOf } from '../src/lib/ranking.ts';

const DAY = 24 * 3600 * 1000;

test('points de présence : visite, série, bonus des 7 jours, bobines offertes', async () => {
  const db = openDb(':memory:');
  const a = await signUp(db, { name: 'Alice', email: 'a@ex.fr', password: 'motdepasse' });
  const b = await signUp(db, { name: 'Bruno', email: 'b@ex.fr', password: 'motdepasse' });
  const t0 = Date.UTC(2026, 9, 1, 10);
  for (let d = 0; d < 7; d++) {
    recordVisit(db, a.playerId, t0 + d * DAY);
    recordVisit(db, a.playerId, t0 + d * DAY + 3600_000); // deux passages le même jour ne comptent qu'une fois
  }
  recordVisit(db, b.playerId, t0);
  recordVisit(db, b.playerId, t0 + 2 * DAY); // série cassée
  openBoosterFor(db, b.playerId, 'casting', { now: t0 + 2 * DAY });

  const board = presenceBoard(db, t0 - DAY, t0 + 8 * DAY, t0 + 6 * DAY);
  // Alice : 7 × 100 + 20 × (0+1+…+6) + 500 = 1 620 ; série en cours de 7 jours.
  assert.deepEqual(board.map((r) => [r.name, r.points, r.days, r.streak]), [['Alice', 1620, 7, 7], ['Bruno', 210, 2, 0]]);
});

test('saison : récompense versée une seule fois au premier passage de la saison suivante', async () => {
  const db = openDb(':memory:');
  const a = await signUp(db, { name: 'Alice', email: 'a@ex.fr', password: 'motdepasse' });
  const october = Date.UTC(2026, 9, 10, 10);
  recordVisit(db, a.playerId, october);
  const november = seasonOf(october).end + DAY;
  const before = getPlayer(db, a.playerId)!.tickets;
  assert.equal(claimSeasonReward(db, a.playerId, november), 'Une carte Icône');
  assert.equal(claimSeasonReward(db, a.playerId, november), null);
  assert.equal(getPlayer(db, a.playerId)!.tickets, before);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM owned WHERE player_id = ?').get(a.playerId) as { n: number }).n, 1);
});
