/**
 * Self-check for the seeded town. Run: bun run check
 *
 * Two jobs. First, referential integrity — a bug pointing at a feature that
 * doesn't exist just vanishes from the village with no error. Second, the
 * demo's shape: the spread of health bands is the whole point of the showcase,
 * and it is easy to flatten by accident just by adding bugs.
 */
import assert from "node:assert/strict";
import { BAND_VARIANT, band } from "./game";
import { CHARACTER_ATTACK, CHARACTER_GEAR, CHARACTERS, ROLES } from "./roles";
import { FOOTPRINT } from "./buildings";
import { gltfClipNames, gltfFootprint, gltfNodeNames } from "./gltf-nodes";
import { CLEARING_RADIUS, NATURE_KINDS, PATH_RADIUS, terrainHeight } from "./terrain";
import { PROPS } from "./interior";
import { cellToWorld } from "./hex";
import {
  BUGS,
  BURNING_HEALTH,
  DEVELOPERS,
  FEATURES,
  MODULES,
  buildTown,
} from "./seed";

const PUBLIC = new URL("../../public", import.meta.url).pathname;
const town = buildTown();

const SKELETONS = ["Skeleton_Warrior", "Skeleton_Rogue", "Skeleton_Mage", "Skeleton_Minion"];

/* ----------------------- referential integrity ----------------------- */

const developerIds = new Set(DEVELOPERS.map((d) => d.id));
const featureIds = new Set(FEATURES.map((f) => f.id));
const moduleIds = new Set(MODULES.map((m) => m.id));

assert.equal(developerIds.size, DEVELOPERS.length, "duplicate developer id");
assert.equal(featureIds.size, FEATURES.length, "duplicate feature id");
assert.equal(moduleIds.size, MODULES.length, "duplicate module id");
assert.equal(new Set(BUGS.map((b) => b.id)).size, BUGS.length, "duplicate bug id");
assert.equal(new Set(BUGS.map((b) => b.key)).size, BUGS.length, "duplicate Jira key");

for (const f of FEATURES) {
  assert.ok(moduleIds.has(f.moduleId), `feature ${f.id} points at missing module ${f.moduleId}`);
  assert.ok(developerIds.has(f.ownerId), `feature ${f.id} owned by missing ${f.ownerId}`);
}
for (const m of MODULES) {
  assert.ok(developerIds.has(m.ownerId), `module ${m.id} owned by missing ${m.ownerId}`);
}
for (const b of BUGS) {
  assert.ok(featureIds.has(b.featureId), `bug ${b.key} points at missing feature ${b.featureId}`);
  assert.ok(developerIds.has(b.reporterId), `bug ${b.key} reported by missing ${b.reporterId}`);
  if (b.claimedBy) {
    assert.ok(developerIds.has(b.claimedBy), `bug ${b.key} claimed by missing ${b.claimedBy}`);
  }
  assert.ok(b.ageHours >= 0, `bug ${b.key} has a negative age`);
  // in_progress means someone holds the claim; the village draws them there.
  if (b.status === "in_progress") assert.ok(b.claimedBy, `bug ${b.key} is in progress with no claimant`);
}

// Every bug must be reachable from the village, or it is invisible.
const placed = town.modules.flatMap((m) => m.bugs).length;
assert.equal(placed, BUGS.length, "some bugs are not attached to any module");

/* -------------------------- grid sanity ------------------------------ */

const cells = MODULES.map((m) => `${m.cell[0]},${m.cell[1]}`);
assert.equal(new Set(cells).size, cells.length, "two modules share a hex cell");
assert.ok(!cells.includes("0,0"), "a module is standing on the town hall");

for (const m of town.modules) {
  const [x, , z] = cellToWorld(m.cell);
  const r = Math.hypot(x, z);
  // Buildings stand at y = 0 with no slope fitting, so each one must sit inside
  // the flat clearing — with room for the skeleton mob besieging it, which
  // spreads into another ring for every seven bugs.
  const mobRadius = 1.9 + Math.floor(Math.max(0, m.bugs.length - 1) / 7) * 0.6;
  assert.ok(
    r + mobRadius < CLEARING_RADIUS,
    `module ${m.id} (${m.bugs.length} bugs) at radius ${r.toFixed(2)} spills onto sloped ground`,
  );
  assert.equal(terrainHeight(x, z), 0, `module ${m.id} is not on flat ground`);
}
// Nobody should be standing where the ring road is worn through the grass.
for (const m of MODULES) {
  const [x, , z] = cellToWorld(m.cell);
  assert.ok(
    Math.abs(Math.hypot(x, z) - PATH_RADIUS) > 1.0,
    `module ${m.id} is sitting on the ring road`,
  );
}

/* ------------------------- assets on disk ---------------------------- */
/* A wrong path renders nothing and logs nothing, so check it here. */

const missing: string[] = [];
const wanted: string[] = [];
const need = (p: string) => wanted.push(p);

for (const m of MODULES) {
  // Health moves between bands at runtime, so all three variants must exist.
  for (const variant of ["green", "yellow", "red"] as const) {
    need(`/assets/hex/buildings/${variant}/${m.kind}_${variant}.gltf`);
  }
}
for (const d of DEVELOPERS) need(`/assets/characters/${d.model}.glb`);
// Anything the profile chooser can offer must exist, or a new user picks a
// character and gets an invisible one.
for (const c of CHARACTERS) need(`/assets/characters/${c.id}.glb`);
for (const model of SKELETONS) need(`/assets/skeletons/${model}.glb`);
for (const weapon of ["Skeleton_Axe", "Skeleton_Blade", "Skeleton_Staff"]) {
  need(`/assets/skeletons/weapons/${weapon}.gltf`);
}
for (const p of [
  "/assets/hex/buildings/blue/building_castle_blue.gltf",
  "/assets/hex/buildings/neutral/building_destroyed.gltf",
  "/assets/hex/buildings/neutral/building_scaffolding.gltf",
  "/assets/hex/decoration/props/flag_blue.gltf",
  "/assets/hex/buildings/neutral/wall_straight.gltf",
  "/assets/hex/buildings/neutral/wall_straight_gate.gltf",
  "/assets/hex/buildings/blue/building_tower_base_blue.gltf",
]) {
  need(p);
}
// Every dungeon piece the interiors build rooms from, architecture and
// furniture alike. A missing prop model renders nothing and logs nothing.
for (const piece of [
  "floor_tile_large", "wall", "wall_doorway", "torch_mounted",
  "banner_green", "banner_yellow", "banner_red",
  "chest", "chest_gold",
  ...Object.keys(PROPS),
]) {
  need(`/assets/dungeon/${piece}.glb`);
}
// Every nature model the forest can place.
for (const kind of NATURE_KINDS) need(`/assets/hex/decoration/nature/${kind}.gltf`);
for (const p of wanted) {
  if (!(await Bun.file(`${PUBLIC}${p}`).exists())) missing.push(p);
}
assert.deepEqual(missing, [], `missing asset files:\n  ${missing.join("\n  ")}`);

/* ---------------------- gear names inside the GLBs -------------------- */
/* A gear node name that doesn't exist renders nothing and logs nothing — the
   exact failure that left every character empty-handed in the first place. */

for (const c of CHARACTERS) {
  const nodes = await gltfNodeNames(`${PUBLIC}/assets/characters/${c.id}.glb`);
  const gear = CHARACTER_GEAR[c.id];
  assert.ok(gear.length > 0, `${c.id} carries nothing — the pack has weapons for every character`);
  for (const name of gear) {
    assert.ok(nodes.has(name), `${c.id} is told to carry "${name}", which is not a node in its GLB`);
  }
}

// The skeletons' weapons bolt onto a socket bone, so that bone has to be there.
for (const model of SKELETONS) {
  const nodes = await gltfNodeNames(`${PUBLIC}/assets/skeletons/${model}.glb`);
  assert.ok(nodes.has("handslot.r"), `${model} has no handslot.r bone to hold a weapon`);
}

/* --------------------- footprints match the assets -------------------- */
/* Layout reads this table instead of measuring the loaded model, so a drifted
   number puts the skeletons somewhere other than where the villagers walk. */

for (const m of MODULES) {
  const measured = await gltfFootprint(`${PUBLIC}/assets/hex/buildings/green/${m.kind}_green.gltf`);
  assert.ok(
    Math.abs(FOOTPRINT[m.kind] - measured) < 0.002,
    `FOOTPRINT.${m.kind} is ${FOOTPRINT[m.kind]} but the asset measures ${measured.toFixed(3)}`,
  );
}
for (const [key, path] of [
  ["ruin", "/assets/hex/buildings/neutral/building_destroyed.gltf"],
  ["scaffolding", "/assets/hex/buildings/neutral/building_scaffolding.gltf"],
  ["townHall", "/assets/hex/buildings/blue/building_castle_blue.gltf"],
] as const) {
  const measured = await gltfFootprint(`${PUBLIC}${path}`);
  assert.ok(
    Math.abs(FOOTPRINT[key] - measured) < 0.002,
    `FOOTPRINT.${key} is ${FOOTPRINT[key]} but the asset measures ${measured.toFixed(3)}`,
  );
}

/* ------------------------ attack clips exist -------------------------- */

for (const c of CHARACTERS) {
  const clips = await gltfClipNames(`${PUBLIC}/assets/characters/${c.id}.glb`);
  const attack = CHARACTER_ATTACK[c.id];
  assert.ok(
    clips.has(attack.clip),
    `${c.id} is told to attack with "${attack.clip}", which is not a clip in its GLB`,
  );
  // The walk and idle the tour and the village depend on.
  for (const name of ["Walking_A", "Idle", "Lie_Idle"]) {
    assert.ok(clips.has(name), `${c.id} is missing the "${name}" clip`);
  }
  assert.ok(attack.standoff > 0, `${c.id} has a non-positive attack standoff`);
}

// Ranged kit should fight from further out than melee, or the distinction is
// invisible and the whole point of varying it is lost.
assert.ok(
  CHARACTER_ATTACK.Rogue_Hooded.standoff > CHARACTER_ATTACK.Barbarian.standoff,
  "the crossbow should engage from further out than the axe",
);

for (const model of SKELETONS) {
  const clips = await gltfClipNames(`${PUBLIC}/assets/skeletons/${model}.glb`);
  for (const name of ["2H_Melee_Attack_Chop", "1H_Melee_Attack_Slice_Diagonal",
                      "1H_Melee_Attack_Stab", "Unarmed_Melee_Attack_Punch_A"]) {
    assert.ok(clips.has(name), `${model} is missing the "${name}" clip`);
  }
}

/* -------------------------- roles & chooser --------------------------- */

const models = new Set(CHARACTERS.map((c) => c.id));
assert.equal(models.size, CHARACTERS.length, "duplicate character in the chooser");
assert.equal(new Set(ROLES.map((r) => r.id)).size, ROLES.length, "duplicate role id");
assert.ok(ROLES.length >= 2, "a chooser with one role is not a chooser");
for (const r of ROLES) {
  assert.ok(models.has(r.model), `role ${r.id} defaults to unknown character ${r.model}`);
  assert.ok(r.title.length > 0 && r.blurb.length > 0, `role ${r.id} is missing its copy`);
}
// Every role suggesting the same character would make the chooser pointless.
assert.ok(
  new Set(ROLES.map((r) => r.model)).size > 1,
  "every role suggests the same character",
);

/* --------------------------- demo shape ------------------------------ */

const live = town.modules.filter((m) => m.state !== "retired" && m.state !== "building");
const bands = new Set(live.map((m) => band(m.health)));
assert.ok(bands.has("healthy"), "no healthy module — nothing green to compare against");
assert.ok(bands.has("warning"), "no warning module — the yellow band is unused");
assert.ok(bands.has("critical"), "no critical module — the red band is unused");

const burning = live.filter((m) => m.burning);
assert.equal(burning.length, 1, `expected exactly one burning module, got ${burning.length}`);
assert.equal(burning[0].id, "records", "Records is the designated disaster");
assert.ok(burning[0].health < BURNING_HEALTH);

// Every band must map to a building variant that exists (checked above).
for (const m of live) assert.ok(BAND_VARIANT[band(m.health)]);

const clean = live.filter((m) => m.bugs.length === 0);
assert.ok(clean.length >= 1, "no clean module — nothing shows what healthy looks like");

// Someone must be mid-fix, or no villager ever kneels at a building.
assert.ok(BUGS.some((b) => b.claimedBy), "no claimed bug — no developer is shown working");
// Someone must be flat out, or the HP-zero state never renders.
assert.ok(DEVELOPERS.some((d) => d.hp < 30), "no developer under 30 HP — that state never shows");
// A live golden window, or the multiplier countdown is always dead.
assert.ok(BUGS.some((b) => b.ageHours < 3), "no bug inside its golden window");

// The project as a whole should read as a project with problems, not a crisis
// and not a victory lap — the showcase is boring at either extreme.
assert.ok(
  town.health > 50 && town.health < 90,
  `project health ${town.health.toFixed(1)} is outside the interesting range`,
);

/* --------------------------- solving a bug ---------------------------- */
/* Resolving a bug has to heal the feature that owned it, stop it counting
   everywhere, and — critically — not move any other bug, because the skull is
   left standing where the skeleton was. */

{
  const records = buildTown().modules.find((m) => m.id === "records")!;
  assert.ok(records.burning, "precondition: Records should start on fire");

  const victim = records.bugs.find((b) => b.severity === "critical")!;
  const after = buildTown(new Set([victim.id]));
  const healed = after.modules.find((m) => m.id === "records")!;

  // The bug stays in place but stops being open.
  assert.equal(healed.bugs.length, records.bugs.length, "a solved bug must keep its slot");
  assert.equal(healed.openBugs.length, records.openBugs.length - 1, "it must stop being open");
  assert.ok(healed.bugs.find((b) => b.id === victim.id)?.solved, "it must be marked solved");
  assert.ok(!healed.openBugs.some((b) => b.id === victim.id));

  // A Critical is 20 health off one feature, so the module's average rises.
  assert.ok(
    healed.health > records.health,
    `health did not improve: ${records.health} -> ${healed.health}`,
  );
  assert.equal(healed.criticalCount, records.criticalCount - 1);
  assert.ok(after.openBugs === town.openBugs - 1, "the project total must drop by one");
  assert.ok(after.health > town.health, "project health must improve");

  // Positions depend on bug *order and count*, which must be untouched.
  assert.deepEqual(
    healed.bugs.map((b) => b.id),
    records.bugs.map((b) => b.id),
    "solving reordered the bugs — every skeleton and skull would jump",
  );

  // Solving everything in a module empties it without erasing its history.
  const allOfIt = new Set(records.bugs.map((b) => b.id));
  const clean = buildTown(allOfIt).modules.find((m) => m.id === "records")!;
  assert.equal(clean.openBugs.length, 0);
  assert.equal(clean.bugs.length, records.bugs.length);
  assert.equal(clean.health, 100, "a module with nothing open is at full health");
  assert.equal(clean.burning, false, "the fire must go out");
  assert.equal(clean.underAttack, false, "the smoke must stop");
  assert.equal(clean.overdueCritical, false);
  for (const feature of clean.features) {
    assert.equal(feature.health, 100, `${feature.name} should be fully healed`);
  }
}

// An unknown id in the solved set must be harmless, not a crash.
assert.equal(buildTown(new Set(["nope"])).openBugs, town.openBugs);

console.log(
  `seed.check.ts — ${MODULES.length} modules, ${FEATURES.length} features, ${BUGS.length} bugs, ` +
    `project health ${town.health.toFixed(1)}, ${burning.length} burning — all assertions passed`,
);
