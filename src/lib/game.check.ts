/**
 * Self-check for the game maths. Run: npm run check
 * Deliberately assert-based with no test framework — if these numbers drift,
 * the whole economy is wrong and the village lies.
 */
import assert from "node:assert/strict";
import {
  bountyStack,
  multiplier,
  performancePoints,
  levelFromXp,
  xpForLevel,
  levelProgress,
  band,
  ownerDrainPerHour,
  average,
} from "./game.ts";

// Bounty stack: starts at ₹1, reaches the severity cap exactly at capHours.
assert.equal(bountyStack("critical", 0), 1);
assert.equal(bountyStack("critical", 2), 2);
assert.equal(bountyStack("critical", 4), 3);
assert.equal(bountyStack("critical", 99), 3, "stack must never exceed the cap");
assert.equal(bountyStack("high", 24), 5);
assert.equal(bountyStack("low", 168), 10);
assert.equal(bountyStack("low", 0), 1);
assert.equal(bountyStack("medium", -5), 1, "negative age clamps to report time");

// Golden window: 3× at report, 1× at three hours, flat after.
assert.equal(multiplier(0), 3);
assert.equal(multiplier(1.5), 2);
assert.equal(multiplier(3), 1);
assert.equal(multiplier(9), 1, "multiplier floors at 1×, never below");

// The worked example from the PRD: a High fixed an hour after report earns 58.
assert.equal(performancePoints("high", 1), 58);
assert.equal(performancePoints("high", 5), 25);
assert.equal(performancePoints("critical", 0), 120);

// Levels: the gates named in the PRD must land on the right XP.
assert.equal(xpForLevel(2), 100);
assert.equal(xpForLevel(4), 600);
assert.equal(xpForLevel(7), 2100);
assert.equal(xpForLevel(10), 4500);
assert.equal(levelFromXp(0), 1);
assert.equal(levelFromXp(99), 1);
assert.equal(levelFromXp(100), 2);
assert.equal(levelFromXp(599), 3, "feature ownership unlocks at 600, not 599");
assert.equal(levelFromXp(600), 4);
assert.equal(levelFromXp(2100), 7);
assert.equal(levelFromXp(4500), 10);
for (let n = 1; n <= 20; n++) {
  assert.equal(levelFromXp(xpForLevel(n)), n, `level ${n} must round-trip`);
  assert.equal(levelFromXp(xpForLevel(n + 1) - 1), n, `level ${n} must hold to its last XP`);
}
assert.equal(levelProgress(600), 0);
assert.ok(Math.abs(levelProgress(800) - 0.5) < 1e-9);

// Health bands.
assert.equal(band(100), "healthy");
assert.equal(band(80), "healthy");
assert.equal(band(79), "warning");
assert.equal(band(50), "warning");
assert.equal(band(49), "critical");
assert.equal(band(0), "critical");

// HP drain only counts bugs past the golden window, and caps at 5/hour.
assert.equal(ownerDrainPerHour([{ severity: "critical", ageHours: 1 }]), 0, "inside the window is free");
assert.equal(ownerDrainPerHour([{ severity: "critical", ageHours: 4 }]), 1);
assert.equal(ownerDrainPerHour([{ severity: "high", ageHours: 10 }]), 0.25);
assert.equal(
  ownerDrainPerHour(Array.from({ length: 20 }, () => ({ severity: "critical" as const, ageHours: 9 }))),
  5,
  "drain is capped at 5 HP/hour",
);

// Roll-ups.
assert.equal(average([]), 100, "a module with no features is healthy, not zero");
assert.equal(average([100, 50]), 75);

console.log("game.check.ts — all assertions passed");
