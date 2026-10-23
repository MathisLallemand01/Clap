import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discordAvatarUrl, getUser, getUserByDiscord, linkDiscord, logIn, signUp, unlinkDiscord, upsertDiscordUser, upsertGoogleUser } from '../src/lib/auth.ts';
import { markCelebrationSeen, nextCelebration } from '../src/lib/celebrations.ts';
import { openDb } from '../src/lib/db.ts';
import { GameError, getCollection, getPlayer, getStats, openBoosterFor, recycleDuplicates, recyclePlan, REFERRAL_REWARD, STARTING_TICKETS } from '../src/lib/game.ts';
import { buyListing, createListing, openListings, priceRange, sellerReceives } from '../src/lib/market.ts';
import { claimMission, missionStates, periodStart, recordVisit } from '../src/lib/missions.ts';
import { listNotifications } from '../src/lib/notify.ts';
import { acceptFriend, giftUnlockAt, listTrades, proposeTrade, respondTrade, sendFriendRequest, sendGift } from '../src/lib/social.ts';

const isCode = (code: string) => (e: unknown) => e instanceof GameError && e.code === code;

test('inscription, connexion, refus des doublons et des mauvais mots de passe', async () => {
  const db = openDb(':memory:');
  const u = await signUp(db, { name: 'Camille', email: 'Camille@Exemple.fr', password: 'motdepasse' });
  assert.equal(u.email, 'camille@exemple.fr');
  assert.match(u.referralCode, /^CA-[A-Z2-9]{4}$/);
  assert.equal((await logIn(db, 'camille@exemple.fr', 'motdepasse')).id, u.id);
  await assert.rejects(logIn(db, 'camille@exemple.fr', 'mauvais'), isCode('bad-credentials'));
  await assert.rejects(signUp(db, { name: 'Autre', email: 'camille@exemple.fr', password: 'motdepasse' }), isCode('email-taken'));
  await assert.rejects(signUp(db, { name: 'camille', email: 'x@exemple.fr', password: 'motdepasse' }), isCode('name-taken'));
  await assert.rejects(signUp(db, { name: 'Bob', email: 'b@exemple.fr', password: 'court' }), isCode('weak-password'));
});

test('Discord : liaison, photo animée (Nitro), unicité, déliaison', async () => {
  const db = openDb(':memory:');
  const a = await signUp(db, { name: 'Lina', email: 'lina@exemple.fr', password: 'motdepasse' });
  const b = await signUp(db, { name: 'Malo', email: 'malo@exemple.fr', password: 'motdepasse' });
  assert.equal(discordAvatarUrl('80351110224678912', 'abc'), 'https://cdn.discordapp.com/avatars/80351110224678912/abc.png?size=128');
  assert.match(discordAvatarUrl('80351110224678912', null), /embed\/avatars\/[0-5]\.png$/);
  linkDiscord(db, a.id, { id: '42', name: 'Lina ✦', avatar: 'a_f00' });
  const linked = getUser(db, a.id)!;
  assert.deepEqual(linked.discord, { id: '42', name: 'Lina ✦', avatar: 'https://cdn.discordapp.com/avatars/42/a_f00.gif?size=128' });
  assert.equal(linked.avatar, linked.discord!.avatar);
  assert.equal(getUserByDiscord(db, '42')!.id, a.id);
  assert.throws(() => linkDiscord(db, b.id, { id: '42', name: 'x', avatar: null }), isCode('discord-taken'));
  unlinkDiscord(db, a.id);
  assert.equal(getUser(db, a.id)!.discord, null);
  assert.equal(getUserByDiscord(db, '42'), null);
});

test('Discord : connexion, rattachement par e-mail, création d’un compte', async () => {
  const db = openDb(':memory:');
  const existing = await signUp(db, { name: 'Nora', email: 'nora@exemple.fr', password: 'motdepasse' });
  const byEmail = upsertDiscordUser(db, { id: '7', name: 'Nora 🎬', avatar: null, email: 'Nora@exemple.fr' }, undefined);
  assert.equal(byEmail.id, existing.id);
  assert.equal(byEmail.discord?.name, 'Nora 🎬');
  assert.equal(upsertDiscordUser(db, { id: '7', name: 'Nora', avatar: 'a_x', email: null }, undefined).id, existing.id);
  assert.match(getUser(db, existing.id)!.avatar!, /a_x\.gif/);
  const fresh = upsertDiscordUser(db, { id: '8', name: 'Ψ', avatar: null, email: null }, undefined);
  assert.notEqual(fresh.id, existing.id);
  assert.equal(fresh.discord?.id, '8');
  assert.ok(fresh.name.length >= 3);
});

test('Google : même compte au retour, rattachement par e-mail', async () => {
  const db = openDb(':memory:');
  const existing = await signUp(db, { name: 'Hugo', email: 'hugo@exemple.fr', password: 'motdepasse' });
  const linked = upsertGoogleUser(db, { sub: 'g-1', email: 'hugo@exemple.fr', name: 'Hugo L', picture: null }, undefined);
  assert.equal(linked.id, existing.id);
  const fresh = upsertGoogleUser(db, { sub: 'g-2', email: 'ines@exemple.fr', name: 'Inès Martin', picture: null }, undefined);
  assert.equal(upsertGoogleUser(db, { sub: 'g-2', email: 'ines@exemple.fr', name: 'Inès Martin', picture: null }, undefined).id, fresh.id);
});

test('le parrainage est payé quand le filleul a ouvert 3 bobines', async () => {
  const db = openDb(':memory:');
  const sponsor = await signUp(db, { name: 'Parrain', email: 'p@exemple.fr', password: 'motdepasse' });
  const filleul = await signUp(db, { name: 'Filleul', email: 'f@exemple.fr', password: 'motdepasse', referral: sponsor.referralCode });
  await assert.rejects(signUp(db, { name: 'Perdu', email: 'z@exemple.fr', password: 'motdepasse', referral: 'XX-0000' }), isCode('bad-referral'));
  for (let i = 0; i < 3; i++) openBoosterFor(db, filleul.playerId, 'casting');
  assert.equal(getPlayer(db, sponsor.playerId)!.tickets, STARTING_TICKETS + REFERRAL_REWARD);
  assert.equal(getPlayer(db, filleul.playerId)!.tickets, STARTING_TICKETS + REFERRAL_REWARD);
  openBoosterFor(db, filleul.playerId, 'casting');
  assert.equal(getPlayer(db, sponsor.playerId)!.tickets, STARTING_TICKETS + REFERRAL_REWARD, 'payé une seule fois');
});

test('recycler garde un exemplaire de chaque carte et crédite les tickets prévus', async () => {
  const db = openDb(':memory:');
  const u = await signUp(db, { name: 'Recycleur', email: 'r@exemple.fr', password: 'motdepasse' });
  for (let i = 0; i < 3; i++) openBoosterFor(db, u.playerId, 'serie-b');
  const plan = recyclePlan(db, u.playerId);
  const before = getPlayer(db, u.playerId)!.tickets;
  const uniqueBefore = getStats(db, u.playerId).unique;
  const done = recycleDuplicates(db, u.playerId);
  assert.deepEqual(done, { cards: plan.cards, tickets: plan.tickets });
  assert.equal(getPlayer(db, u.playerId)!.tickets, before + plan.tickets);
  assert.equal(getStats(db, u.playerId).unique, uniqueBefore);
  assert.ok(getCollection(db, u.playerId).every((c) => c.copies === 1));
});

test('missions : progression, récompense unique par période', async () => {
  const db = openDb(':memory:');
  const u = await signUp(db, { name: 'Missionnaire', email: 'm@exemple.fr', password: 'motdepasse' });
  const now = Date.UTC(2026, 9, 21, 10);
  recordVisit(db, u.playerId, now);
  recordVisit(db, u.playerId, now + 1000);
  assert.throws(() => claimMission(db, u.playerId, 'daily-open', now), isCode('mission-not-done'));
  openBoosterFor(db, u.playerId, 'casting', { now });
  openBoosterFor(db, u.playerId, 'casting', { now });
  const states = missionStates(db, u.playerId, now);
  assert.equal(states.find((m) => m.id === 'daily-visit')!.current, 1);
  assert.equal(claimMission(db, u.playerId, 'daily-open', now), 60);
  assert.throws(() => claimMission(db, u.playerId, 'daily-open', now), isCode('mission-claimed'));
  assert.equal(periodStart('daily', now).key, '2026-10-21');
  assert.equal(periodStart('weekly', now).key, 'w2026-10-19');
});

test('Guichet : fourchette de prix, commission, transfert de la carte', async () => {
  const db = openDb(':memory:');
  const seller = await signUp(db, { name: 'Vendeur', email: 'v@exemple.fr', password: 'motdepasse' });
  const buyer = await signUp(db, { name: 'Acheteur', email: 'a@exemple.fr', password: 'motdepasse' });
  const pulled = openBoosterFor(db, seller.playerId, 'casting').cards[0];
  const { min, max, suggested } = priceRange(pulled.rarity);
  assert.throws(() => createListing(db, seller.playerId, { cardId: pulled.id, price: suggested, days: 3 }), isCode('too-new'));
  openBoosterFor(db, seller.playerId, 'casting');
  openBoosterFor(db, seller.playerId, 'casting');
  assert.throws(() => createListing(db, seller.playerId, { cardId: pulled.id, price: max + 1, days: 3 }), isCode('bad-price'));
  const price = Math.max(min, suggested);
  const id = createListing(db, seller.playerId, { cardId: pulled.id, price, days: 3 });
  assert.equal(openListings(db).length, 1);
  const sellerBefore = getPlayer(db, seller.playerId)!.tickets;
  buyListing(db, buyer.playerId, id);
  assert.equal(getPlayer(db, buyer.playerId)!.tickets, STARTING_TICKETS - price);
  assert.equal(getPlayer(db, seller.playerId)!.tickets, sellerBefore + sellerReceives(price));
  assert.ok(getCollection(db, buyer.playerId).some((c) => c.id === pulled.id));
  assert.throws(() => buyListing(db, buyer.playerId, id), isCode('not-found'));
  assert.ok(listNotifications(db, seller.id).some((n) => n.kind === 'sale'));
  const sale = nextCelebration(db, seller.playerId)!;
  assert.equal(sale.kind, 'sale');
  assert.equal(sale.tickets, sellerReceives(price));
  assert.equal(sale.cards[0].id, pulled.id);
  markCelebrationSeen(db, seller.playerId, sale.id);
  assert.equal(nextCelebration(db, seller.playerId), null);
  assert.equal(nextCelebration(db, buyer.playerId), null);
});

test('échanges entre amis : cartes et tickets changent de main', async () => {
  const db = openDb(':memory:');
  const a = await signUp(db, { name: 'Alice', email: 'al@exemple.fr', password: 'motdepasse' });
  const b = await signUp(db, { name: 'Bruno', email: 'br@exemple.fr', password: 'motdepasse' });
  const cardA = openBoosterFor(db, a.playerId, 'casting').cards[0];
  const cardB = openBoosterFor(db, b.playerId, 'avant-premiere').cards[4];
  assert.throws(() => proposeTrade(db, a.id, b.id, { give: [cardA.id], take: [cardB.id], giveTickets: 0, takeTickets: 0 }), isCode('not-friends'));
  sendFriendRequest(db, a.id, 'bruno');
  acceptFriend(db, b.id, a.id);
  const id = proposeTrade(db, a.id, b.id, { give: [cardA.id], take: [cardB.id], giveTickets: 40, takeTickets: 0 });
  assert.equal(listTrades(db, b.id).pending.length, 1);
  assert.throws(() => respondTrade(db, a.id, id, true), isCode('forbidden'));
  respondTrade(db, b.id, id, true);
  assert.ok(getCollection(db, b.playerId).some((c) => c.id === cardA.id));
  assert.ok(getCollection(db, a.playerId).some((c) => c.id === cardB.id));
  assert.equal(getPlayer(db, a.playerId)!.tickets, STARTING_TICKETS - 40);
  assert.equal(getPlayer(db, b.playerId)!.tickets, STARTING_TICKETS + 40);
  // Les deux côtés voient l'échange conclu.
  const forA = nextCelebration(db, a.playerId)!;
  const forB = nextCelebration(db, b.playerId)!;
  assert.deepEqual([forA.kind, forA.cards[0].id, forA.tickets], ['trade', cardB.id, 0]);
  assert.deepEqual([forB.kind, forB.cards[0].id, forB.tickets], ['trade', cardA.id, 40]);
});

test('cadeaux : 7 jours d’ancienneté (sauf compte illimité), transfert immédiat, popup chez l’ami', async () => {
  const db = openDb(':memory:');
  const a = await signUp(db, { name: 'Agathe', email: 'ag@exemple.fr', password: 'motdepasse' });
  const b = await signUp(db, { name: 'Basile', email: 'ba@exemple.fr', password: 'motdepasse' });
  sendFriendRequest(db, a.id, 'basile');
  acceptFriend(db, b.id, a.id);
  const card = openBoosterFor(db, a.playerId, 'casting').cards[0];
  assert.ok(giftUnlockAt(db, a.id));
  assert.throws(() => sendGift(db, a.id, b.id, { cards: [card.id], tickets: 0 }), isCode('too-young'));
  db.prepare('UPDATE users SET created_at = ? WHERE id = ?').run(Date.now() - 8 * 86_400_000, a.id);
  assert.equal(giftUnlockAt(db, a.id), null);
  assert.throws(() => sendGift(db, a.id, b.id, { cards: [], tickets: 0 }), isCode('empty'));
  sendGift(db, a.id, b.id, { cards: [card.id], tickets: 50 });
  assert.ok(getCollection(db, b.playerId).some((c) => c.id === card.id));
  assert.equal(getPlayer(db, b.playerId)!.tickets, STARTING_TICKETS + 50);
  const gift = nextCelebration(db, b.playerId)!;
  assert.deepEqual([gift.kind, gift.cards[0].id, gift.tickets], ['gift', card.id, 50]);
  assert.equal(listTrades(db, a.id).history[0].gift, true);
  // Un compte de test illimité n'attend pas.
  const c = await signUp(db, { name: 'Testeuse', email: 'te@exemple.fr', password: 'motdepasse' });
  db.prepare('UPDATE players SET unlimited = 1 WHERE id = ?').run(c.playerId);
  assert.equal(giftUnlockAt(db, c.id), null);
});
