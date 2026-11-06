import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityOf, summarize } from '../src/lib/activity.ts';
import { auctionBids, auctionRange, createAuction, getAuction, leaderMax, placeBid, settleAuctions } from '../src/lib/auctions.ts';
import { signUp } from '../src/lib/auth.ts';
import { badgeStates, checkBadges, togglePin } from '../src/lib/badges.ts';
import { boxOffice, weeklyMoves } from '../src/lib/boxoffice.ts';
import { nextCelebration } from '../src/lib/celebrations.ts';
import { coteOf, cotes, median } from '../src/lib/cote.ts';
import { openDb } from '../src/lib/db.ts';
import { GameError, getPlayer, openBoosterFor } from '../src/lib/game.ts';
import { buyListing, createListing, priceRange } from '../src/lib/market.ts';
import { listNotifications, pendingTelegram } from '../src/lib/notify.ts';
import { getShowcase, moveShowcaseSlot, setShowcaseSlot } from '../src/lib/showcase.ts';
import { TRADE_MIN_PULLS } from '../src/lib/social.ts';
import { setWatch } from '../src/lib/watch.ts';

const isCode = (code: string) => (e: unknown) => e instanceof GameError && e.code === code;
const H = 3600 * 1000;

function veteran(db: ReturnType<typeof openDb>, playerId: string, pulls = TRADE_MIN_PULLS): void {
  const insert = db.prepare("INSERT INTO pulls (player_id, booster_id, paid_with, created_at) VALUES (?, 'casting', 'free', 0)");
  for (let i = 0; i < pulls; i++) insert.run(playerId);
}
const seats = (db: ReturnType<typeof openDb>, id: string) => getPlayer(db, id)!.seats;
const give = (db: ReturnType<typeof openDb>, id: string, n: number) => db.prepare('UPDATE players SET seats = ? WHERE id = ?').run(n, id);

async function trio() {
  const db = openDb(':memory:');
  const s = await signUp(db, { name: 'Vendeur', email: 'v@exemple.fr', password: 'motdepasse' });
  const a = await signUp(db, { name: 'Alice', email: 'a@exemple.fr', password: 'motdepasse' });
  const b = await signUp(db, { name: 'Bruno', email: 'b@exemple.fr', password: 'motdepasse' });
  for (const u of [s, a, b]) { veteran(db, u.playerId); give(db, u.playerId, 10_000); }
  const card = openBoosterFor(db, s.playerId, 'casting').cards[0];
  return { db, s, a, b, card };
}

test('médiane : valeur du milieu, moyenne des deux du milieu', () => {
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 9]), 5);
  assert.equal(median([1, 2, 3, 100]), 3);
});

test('enchères : plafond secret, palier de 5 %, sièges mis de côté puis rendus, adjudication', async () => {
  const { db, s, a, b, card } = await trio();
  const now = 1_000_000_000_000;
  const { min } = auctionRange(card);
  const id = createAuction(db, s.playerId, { cardId: card.id, startPrice: min * 2, buyout: null, hours: 1 }, now);
  // Le vendeur ne peut pas enchérir, et l'exemplaire n'est plus recyclable ni revendable.
  assert.throws(() => placeBid(db, s.playerId, id, min * 2, null, now), isCode('own-lot'));
  assert.ok((db.prepare("SELECT COUNT(*) AS n FROM auctions WHERE status = 'open' AND owned_id IN (SELECT id FROM owned WHERE player_id = ?)").get(s.playerId) as { n: number }).n === 1);
  assert.throws(() => placeBid(db, a.playerId, id, min * 2 - 1, null, now), isCode('too-low'));

  // Alice mène avec un plafond de 500 : 500 sièges mis de côté.
  assert.equal(placeBid(db, a.playerId, id, min * 2, 500, now).outcome, 'leading');
  assert.equal(seats(db, a.playerId), 10_000 - 500);
  assert.equal(leaderMax(db, id, a.playerId), 500);
  // Bruno offre 300 : le plafond d'Alice couvre, l'enchère monte à 315 (300 + 5 %), Alice reste devant.
  assert.equal(placeBid(db, b.playerId, id, 300, null, now + 1).outcome, 'outbid');
  assert.equal(getAuction(db, id, now + 1)!.currentBid, 315);
  assert.equal(seats(db, b.playerId), 10_000);
  // Bruno monte à 600 : il passe devant à 525 (500 + 5 %), Alice récupère ses 500.
  assert.equal(placeBid(db, b.playerId, id, 400, 600, now + 2).outcome, 'leading');
  assert.equal(getAuction(db, id, now + 2)!.currentBid, 525);
  assert.equal(seats(db, a.playerId), 10_000);
  assert.equal(seats(db, b.playerId), 10_000 - 600);
  assert.ok(listNotifications(db, a.id).some((n) => n.kind === 'auction' && n.urgent));
  assert.ok(pendingTelegram(db, a.id, now + 2));
  assert.ok(auctionBids(db, id).length >= 4);

  // Fin du compte à rebours : Bruno paie 525, récupère 75, le vendeur touche 525 − 5 %.
  const before = seats(db, s.playerId);
  settleAuctions(db, now + 2 * H);
  const done = getAuction(db, id, now + 2 * H)!;
  assert.equal(done.status, 'sold');
  assert.equal(seats(db, b.playerId), 10_000 - 525);
  assert.equal(seats(db, s.playerId), before + 525 - Math.ceil(525 * 0.05));
  assert.equal((db.prepare('SELECT player_id FROM owned WHERE card_id = ? ORDER BY id DESC LIMIT 1').get(card.id) as { player_id: string }).player_id, b.playerId);
  assert.equal(nextCelebration(db, b.playerId)?.kind, 'auction');
  // La vente compte dans la cote et le journal.
  assert.equal(coteOf(db, card.id, 30, now + 2 * H).recent[0].price, 525);
  const log = activityOf(db, b.id, b.playerId, now + 3 * H);
  assert.ok(log.some((e) => e.type === 'enchere' && e.seats === -525));
  assert.equal(summarize(log, now + 3 * H).spent, 525);
});

test('enchères : achat immédiat, prolongation dans la dernière minute, lot invendu', async () => {
  const { db, s, a, b, card } = await trio();
  const now = 2_000_000_000_000;
  const { min } = auctionRange(card);
  const id = createAuction(db, s.playerId, { cardId: card.id, startPrice: min, buyout: min * 4, hours: 1 }, now);
  placeBid(db, a.playerId, id, min, min * 3, now);
  // Une offre à 30 s de la fin rallonge le lot de 2 minutes.
  const late = now + H - 30_000;
  placeBid(db, b.playerId, id, min * 2, null, late);
  assert.equal(getAuction(db, id, late)!.endsAt, late + 120_000);
  // Achat immédiat : adjugé tout de suite, Alice récupère son plafond.
  assert.equal(placeBid(db, b.playerId, id, min * 4, null, late + 1).outcome, 'won');
  assert.equal(getAuction(db, id, late + 1)!.status, 'sold');
  assert.equal(seats(db, a.playerId), 10_000);
  assert.equal(seats(db, b.playerId), 10_000 - min * 4);

  const card2 = openBoosterFor(db, s.playerId, 'casting').cards[0];
  const id2 = createAuction(db, s.playerId, { cardId: card2.id, startPrice: auctionRange(card2).min, buyout: null, hours: 1 }, now);
  settleAuctions(db, now + 2 * H);
  assert.equal(getAuction(db, id2, now + 2 * H)!.status, 'unsold');
});

test('enchères réservées aux joueurs installés', async () => {
  const db = openDb(':memory:');
  const u = await signUp(db, { name: 'Neuf', email: 'n@exemple.fr', password: 'motdepasse' });
  const card = openBoosterFor(db, u.playerId, 'casting').cards[0];
  assert.throws(() => createAuction(db, u.playerId, { cardId: card.id, startPrice: auctionRange(card).min, buyout: null, hours: 1 }), isCode('trade-locked'));
});

test('cartes guettées : télégramme quand la carte arrive au Guichet sous le prix demandé', async () => {
  const { db, s, a, card } = await trio();
  setWatch(db, a.id, card.id, 'below', priceRange(card.rarity).suggested);
  createListing(db, s.playerId, { cardId: card.id, price: priceRange(card.rarity).max, days: 1 });
  assert.equal(listNotifications(db, a.id).filter((n) => n.kind === 'alert').length, 0);
  const card2 = openBoosterFor(db, s.playerId, 'casting').cards[1];
  setWatch(db, a.id, card2.id, 'any', null);
  createListing(db, s.playerId, { cardId: card2.id, price: priceRange(card2.rarity).min, days: 1 });
  const alerts = listNotifications(db, a.id).filter((n) => n.kind === 'alert');
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0].urgent);
});

test('cote : médiane sur 30 jours dès 3 ventes', async () => {
  const { db, s, a, card } = await trio();
  for (let i = 0; i < 3; i++) {
    const c = openBoosterFor(db, s.playerId, 'casting').cards.find((x) => x.id === card.id) ? card : card;
    void c;
  }
  // Trois ventes de la même carte à des prix différents.
  const extra = db.prepare('INSERT INTO owned (player_id, card_id, serial, obtained_at) VALUES (?, ?, ?, 0)');
  extra.run(s.playerId, card.id, 900);
  extra.run(s.playerId, card.id, 901);
  const { min, max } = priceRange(card.rarity);
  for (const price of [min, max, Math.round((min + max) / 2)]) {
    const id = createListing(db, s.playerId, { cardId: card.id, price, days: 1 });
    buyListing(db, a.playerId, id);
  }
  assert.equal(cotes(db).get(card.id), Math.round((min + max) / 2));
  const c = coteOf(db, card.id);
  assert.equal(c.count30, 3);
  assert.equal(c.low, min);
  assert.equal(c.days.length, 30);
});

test('palmarès : niveaux, tickets, pop-up et épingles', async () => {
  const db = openDb(':memory:');
  const u = await signUp(db, { name: 'Zoé', email: 'z@exemple.fr', password: 'motdepasse' });
  const before = getPlayer(db, u.playerId)!.tickets;
  openBoosterFor(db, u.playerId, 'casting');
  const tickets = getPlayer(db, u.playerId)!.tickets;
  assert.ok(checkBadges(db, u.playerId) >= 1);
  assert.equal(checkBadges(db, u.playerId), 0);
  const first = badgeStates(db, u.playerId).find((b) => b.def.id === 'premier-clap')!;
  assert.equal(first.level, 1);
  assert.ok(getPlayer(db, u.playerId)!.tickets >= tickets + 50);
  assert.ok(before > 0);
  assert.equal(nextCelebration(db, u.playerId)?.kind, 'badge');
  assert.ok(first.pinned);
  togglePin(db, u.playerId, 'premier-clap');
  assert.equal(badgeStates(db, u.playerId).find((b) => b.def.id === 'premier-clap')!.pinned, false);
  assert.throws(() => togglePin(db, u.playerId, 'mythe-vivant'), isCode('not-awarded'));
});

test('vitrine : six cases, cartes possédées seulement, réordonnables', async () => {
  const db = openDb(':memory:');
  const u = await signUp(db, { name: 'Vito', email: 'vi@exemple.fr', password: 'motdepasse' });
  const cards = [...openBoosterFor(db, u.playerId, 'casting').cards, ...openBoosterFor(db, u.playerId, 'casting').cards];
  const auto = getShowcase(db, u.playerId);
  assert.equal(auto.chosen, false);
  assert.equal(auto.slots.length, 6);
  setShowcaseSlot(db, u.playerId, 0, cards[3].id);
  const sc = getShowcase(db, u.playerId);
  assert.equal(sc.chosen, true);
  assert.equal(sc.slots[0].card?.id, cards[3].id);
  moveShowcaseSlot(db, u.playerId, 0, 1);
  assert.equal(getShowcase(db, u.playerId).slots[1].card?.id, cards[3].id);
  assert.throws(() => setShowcaseSlot(db, u.playerId, 2, 'role:0:0'), isCode('not-owned'));
});

test('box-office : cinq catégories et montées de la semaine', async () => {
  const db = openDb(':memory:');
  const u = await signUp(db, { name: 'Boris', email: 'bo@exemple.fr', password: 'motdepasse' });
  openBoosterFor(db, u.playerId, 'casting');
  for (const id of ['points', 'filmotheque', 'mythes', 'integrales', 'palmares'] as const) {
    const rows = boxOffice(db, id);
    assert.ok(Array.isArray(rows));
    weeklyMoves(db, id, rows);
  }
  const film = boxOffice(db, 'filmotheque');
  assert.equal(film[0].playerId, u.playerId);
  assert.equal(weeklyMoves(db, 'filmotheque', film).get(u.playerId), 0);
});
