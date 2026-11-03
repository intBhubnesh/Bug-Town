/**
 * Self-check for ranking. Run: bun run check
 *
 * Ranking is the one number on the billboard everyone will check against their
 * own memory, and tie handling is where it goes wrong: off-by-one ranks, two
 * people both called third, or an order that flips between the server's
 * prerender and the browser's first paint.
 */
import assert from "node:assert/strict";
import { BOARDS, boardValue, podiumColor, rankDevelopers, type Board } from "./leaderboard";
import { DEVELOPERS, type Developer } from "./seed";

const dev = (name: string, performance: number, found = 0, xp = 0): Developer => ({
  id: name.toLowerCase(),
  name,
  model: "Knight",
  xp,
  hp: 100,
  performance,
  wallet: 0,
  streak: 0,
  found,
  fixed: 0,
  goldenHits: 0,
});

/* ------------------------------- ordering ------------------------------ */

const simple = rankDevelopers([dev("Low", 10), dev("High", 30), dev("Mid", 20)], "performance");
assert.deepEqual(
  simple.map((r) => r.developer.name),
  ["High", "Mid", "Low"],
  "highest must come first",
);
assert.deepEqual(simple.map((r) => r.rank), [1, 2, 3]);
assert.deepEqual(simple.map((r) => r.tied), [false, false, false]);

/* --------------------------------- ties -------------------------------- */

// Two on equal points are both second, and the next is fourth — not third.
const ties = rankDevelopers(
  [dev("Ace", 50), dev("Bea", 30), dev("Cal", 30), dev("Dee", 10)],
  "performance",
);
assert.deepEqual(ties.map((r) => r.rank), [1, 2, 2, 4], "ties must share a rank and then skip");
assert.deepEqual(ties.map((r) => r.tied), [false, false, true, false]);
assert.deepEqual(ties.map((r) => r.developer.name), ["Ace", "Bea", "Cal", "Dee"]);

// Everyone level: all first.
const allEqual = rankDevelopers([dev("A", 5), dev("B", 5), dev("C", 5)], "performance");
assert.deepEqual(allEqual.map((r) => r.rank), [1, 1, 1]);

// A tie at the top still leaves exactly one rank 1 group.
assert.equal(allEqual.filter((r) => r.rank === 1).length, 3);

/* ----------------------------- determinism ----------------------------- */

// Equal values order by name, so the prerender and the browser agree.
const shuffledA = rankDevelopers([dev("Zoe", 7), dev("Abe", 7), dev("Mia", 7)], "performance");
const shuffledB = rankDevelopers([dev("Mia", 7), dev("Zoe", 7), dev("Abe", 7)], "performance");
assert.deepEqual(
  shuffledA.map((r) => r.developer.name),
  ["Abe", "Mia", "Zoe"],
  "ties must order by name",
);
assert.deepEqual(
  shuffledA.map((r) => r.developer.name),
  shuffledB.map((r) => r.developer.name),
  "ranking must not depend on input order",
);

/* ------------------------------ every board ---------------------------- */

const team = [dev("P", 100, 1, 10), dev("F", 1, 100, 10), dev("X", 1, 1, 1000)];
for (const { id } of BOARDS) {
  const ranked = rankDevelopers(team, id);
  assert.equal(ranked.length, team.length, `${id}: lost someone`);
  // Sorted descending by that board's own value.
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].value >= ranked[i].value, `${id} is not sorted descending`);
  }
  assert.equal(ranked[0].value, boardValue(ranked[0].developer, id), `${id}: value mismatch`);
}
assert.equal(rankDevelopers(team, "performance")[0].developer.name, "P");
assert.equal(rankDevelopers(team, "finders")[0].developer.name, "F");
assert.equal(rankDevelopers(team, "xp")[0].developer.name, "X");

// Ranking never mutates what it was handed.
const original = [dev("B", 1), dev("A", 2)];
const snapshot = original.map((d) => d.name);
rankDevelopers(original, "performance");
assert.deepEqual(original.map((d) => d.name), snapshot, "rankDevelopers mutated its input");

/* --------------------------------- empty ------------------------------- */

assert.deepEqual(rankDevelopers([], "performance"), [], "an empty team must rank to nothing");
assert.equal(rankDevelopers([dev("Solo", 0)], "xp")[0].rank, 1, "one person is first");

/* -------------------------------- podium ------------------------------- */

assert.ok(podiumColor(1) && podiumColor(2) && podiumColor(3), "the top three need colours");
assert.equal(podiumColor(4), null, "fourth is not on the podium");
assert.notEqual(podiumColor(1), podiumColor(2), "gold and silver must differ");

/* ---------------------------- the real team ---------------------------- */

for (const { id } of BOARDS) {
  const ranked = rankDevelopers(DEVELOPERS, id as Board);
  assert.equal(ranked.length, DEVELOPERS.length);
  assert.equal(ranked[0].rank, 1);
  // The billboard shows five rows; the team has to fill them.
  assert.ok(DEVELOPERS.length >= 5, "the billboard needs at least five developers to list");
  // Nobody may appear twice.
  assert.equal(new Set(ranked.map((r) => r.developer.id)).size, ranked.length);
}

console.log(
  `leaderboard.check.ts — ${BOARDS.length} boards over ${DEVELOPERS.length} developers, ` +
    `ties share ranks — all assertions passed`,
);
