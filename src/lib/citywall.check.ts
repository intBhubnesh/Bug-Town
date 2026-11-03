/**
 * Self-check for the city wall. Run: npm run check
 *
 * A ring wall built from fixed-length pieces either closes exactly or it
 * doesn't, and "doesn't" shows up as gaps you can see through or segments
 * sunk into each other. Both are geometry, so both are checkable here.
 */
import assert from "node:assert/strict";
import {
  SEGMENT,
  SIDES,
  TOWERS,
  WALL_INNER_FACE,
  WALL_INRADIUS,
  WALL_RADIUS,
  buildCityWall,
} from "./citywall.ts";
import { CLEARING_RADIUS, PATH_RADIUS, terrainHeight } from "./terrain.ts";
import { cellToWorld } from "./hex.ts";
import { MODULES } from "./seed.ts";
import { BILLBOARD, BILLBOARD_TOTAL, MEDIAN_BUILDING } from "./buildings.ts";

/** Kept in step with VILLAGER_HEIGHT in components/Villager.tsx. */
const VILLAGER_HEIGHT = 0.85;

const wall = buildCityWall();

/* ------------------------------ it closes ----------------------------- */

assert.equal(wall.segments.length + wall.gates.length, SIDES, "wrong number of wall pieces");
assert.equal(wall.gates.length, 1, "the city should have exactly one gate");
assert.equal(wall.towers.length, TOWERS);

// The defining property: each side of the polygon is exactly one piece long.
const corner = (i: number) => {
  const angle = ((i % SIDES) / SIDES) * Math.PI * 2;
  return [Math.cos(angle) * WALL_RADIUS, Math.sin(angle) * WALL_RADIUS] as const;
};
for (let i = 0; i < SIDES; i++) {
  const [ax, az] = corner(i);
  const [bx, bz] = corner(i + 1);
  const side = Math.hypot(bx - ax, bz - az);
  assert.ok(
    Math.abs(side - SEGMENT) < 1e-9,
    `side ${i} is ${side.toFixed(6)} long but a piece is ${SEGMENT}`,
  );
}

// Every piece sits at the inradius, midway between two corners.
const all = [...wall.segments, ...wall.gates];
for (const piece of all) {
  const r = Math.hypot(piece.position[0], piece.position[2]);
  assert.ok(Math.abs(r - WALL_INRADIUS) < 1e-9, `a piece sits at ${r}, not the inradius`);
  assert.equal(piece.position[1], 0, "wall pieces stand on the ground");
}

// Adjacent pieces must butt together: their centres are one side apart.
const sorted = [...all].sort(
  (a, b) =>
    Math.atan2(a.position[2], a.position[0]) - Math.atan2(b.position[2], b.position[0]),
);
for (let i = 0; i < sorted.length; i++) {
  const a = sorted[i].position;
  const b = sorted[(i + 1) % sorted.length].position;
  const gap = Math.hypot(b[0] - a[0], b[2] - a[2]);
  assert.ok(
    Math.abs(gap - SEGMENT * Math.cos(Math.PI / SIDES)) < 1e-6,
    `neighbouring pieces are ${gap.toFixed(4)} apart — the ring has a gap or an overlap`,
  );
}

// Each piece must lie along its own tangent, or the ring looks like a cog.
for (const piece of all) {
  const [x, , z] = piece.position;
  const tangent = [-z, x];
  const length = Math.hypot(tangent[0], tangent[1]);
  // A rotation of φ about Y sends local +X to (cos φ, −sin φ).
  const laid = [Math.cos(piece.rotation), -Math.sin(piece.rotation)];
  const dot = Math.abs((laid[0] * tangent[0] + laid[1] * tangent[1]) / length);
  assert.ok(dot > 0.9999, `a wall piece is turned ${Math.acos(dot).toFixed(3)} rad off its tangent`);
}

/* --------------------------- it fits the town -------------------------- */

// The wall must stand on the flat clearing, not on the sloped forest floor.
assert.ok(WALL_RADIUS < CLEARING_RADIUS, `wall radius ${WALL_RADIUS} is outside the clearing`);
for (const piece of [...all, ...wall.towers]) {
  assert.equal(
    terrainHeight(piece.position[0], piece.position[2]),
    0,
    "a wall piece is standing on a slope",
  );
}

// Every building has to be inside the wall, with clearance.
for (const module of MODULES) {
  const [x, , z] = cellToWorld(module.cell);
  const r = Math.hypot(x, z);
  assert.ok(
    r + 1.6 < WALL_INRADIUS,
    `module ${module.id} at radius ${r.toFixed(2)} is outside or touching the wall`,
  );
}

// The villagers' ring road has to stay inside it too.
assert.ok(
  PATH_RADIUS + 0.4 < WALL_INRADIUS,
  `the ring road at ${PATH_RADIUS} collides with the wall at ${WALL_INRADIUS.toFixed(2)}`,
);

// The road must clear the inside face of the wall, not just its centreline.
assert.ok(
  WALL_INNER_FACE - PATH_RADIUS > 0.3,
  `only ${(WALL_INNER_FACE - PATH_RADIUS).toFixed(2)} between the road and the wall`,
);

// And the forest must stay off the wall: trees are scattered no further out
// than the road, and the widest grove is about 1.0 across at half scale.
assert.ok(
  WALL_INNER_FACE - (PATH_RADIUS - 0.7) > 1.0,
  "a tree at the scatter limit could poke through the wall",
);

/* -------------------- street furniture is in scale -------------------- */

// The notice board has to read as town furniture: taller than the people
// standing at it, shorter than the buildings around it.
assert.ok(
  BILLBOARD_TOTAL > VILLAGER_HEIGHT,
  `the billboard (${BILLBOARD_TOTAL.toFixed(2)}) is shorter than a villager`,
);
assert.ok(
  BILLBOARD_TOTAL < MEDIAN_BUILDING,
  `the billboard (${BILLBOARD_TOTAL.toFixed(2)}) looms over a typical building (${MEDIAN_BUILDING})`,
);
// And its face has to be wider than tall, or the standings don't fit.
assert.ok(BILLBOARD.width > BILLBOARD.height, "the board should be landscape");
// It stands in the square, so it must be inside the wall and off the road.
const boardSpot = { x: -2.3, z: 2.5 };
const boardR = Math.hypot(boardSpot.x, boardSpot.z);
assert.ok(boardR + BILLBOARD.width / 2 < WALL_INNER_FACE, "the billboard is outside the wall");
assert.ok(
  Math.abs(boardR - PATH_RADIUS) > BILLBOARD.width,
  "the billboard is standing in the ring road",
);
assert.equal(terrainHeight(boardSpot.x, boardSpot.z), 0, "the billboard is on a slope");

// The gate faces +Z, which is where the camera starts.
const gate = wall.gates[0].position;
assert.ok(gate[2] > WALL_INRADIUS * 0.95, "the gate is not on the side the camera starts on");

console.log(
  `citywall.check.ts — ${SIDES} sides of ${SEGMENT}, radius ${WALL_RADIUS.toFixed(3)} ` +
    `(inradius ${WALL_INRADIUS.toFixed(3)}), 1 gate, ${TOWERS} towers, ring closes exactly ` +
    `— all assertions passed`,
);
