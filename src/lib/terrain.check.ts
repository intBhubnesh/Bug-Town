/**
 * Self-check for the generated ground. Run: npm run check
 *
 * Terrain is the one thing here that fails *silently and totally*: a flipped
 * triangle winding renders an invisible floor, a stray NaN deletes the whole
 * mesh, and a slope inside the clearing floats every building a few
 * centimetres off the grass. None of that throws.
 */
import assert from "node:assert/strict";
import {
  CLEARING_RADIUS,
  PATH_RADIUS,
  PATH_WIDTH,
  TERRAIN_RADIUS,
  buildTerrain,
  scatterNature,
  terrainColor,
  terrainHeight,
} from "./terrain.ts";
import { hash01 } from "./hex.ts";

/* ------------------------------- height ------------------------------- */

assert.equal(terrainHeight(0, 0), 0, "the plaza must be flat");
assert.equal(terrainHeight(CLEARING_RADIUS, 0), 0, "the clearing edge is still flat");
assert.equal(terrainHeight(0, -CLEARING_RADIUS), 0);

// Deterministic: the server prerenders this and the browser must agree.
for (const [x, z] of [[3, 4], [-9, 2], [11.5, -6], [0, 14]] as const) {
  assert.equal(terrainHeight(x, z), terrainHeight(x, z));
}

// Outside the clearing it has to actually undulate, or it's just a flat disc.
const samples: number[] = [];
for (let i = 0; i < 400; i++) {
  const angle = (i / 400) * Math.PI * 2;
  const r = CLEARING_RADIUS + 0.5 + (i % 7) * 0.8;
  samples.push(terrainHeight(Math.cos(angle) * r, Math.sin(angle) * r));
}
const spread = Math.max(...samples) - Math.min(...samples);
assert.ok(spread > 0.5, `forest floor is too flat (spread ${spread.toFixed(2)})`);
assert.ok(Number.isFinite(spread), "terrain produced a non-finite height");

// The ramp has to be continuous at the clearing edge, or there's a visible
// cliff where the village stops.
const justOutside = terrainHeight(CLEARING_RADIUS + 0.05, 0);
assert.ok(
  Math.abs(justOutside) < 0.05,
  `clearing edge steps by ${justOutside.toFixed(3)} — that reads as a cliff`,
);

/* ------------------------------- colour ------------------------------- */

const grass = terrainColor(2, 2, 0);
const path = terrainColor(PATH_RADIUS, 0, 0);
assert.ok(
  path[0] > grass[0] && path[1] < grass[1],
  "the ring road should be browner and less green than the grass",
);
for (const [r, g, b] of [grass, path, terrainColor(13, -4, 1.2)]) {
  for (const channel of [r, g, b]) {
    assert.ok(channel >= 0 && channel <= 1, `colour channel ${channel} out of range`);
  }
}

/* ------------------------------ geometry ------------------------------ */

const rings = 12;
const segments = 16;
const { positions, colors, indices, vertexCount } = buildTerrain(rings, segments);

assert.equal(vertexCount, 1 + rings * segments);
assert.equal(positions.length, vertexCount * 3);
assert.equal(colors.length, vertexCount * 3);
assert.equal(indices.length, (segments + (rings - 1) * segments * 2) * 3);

for (let i = 0; i < positions.length; i++) {
  assert.ok(Number.isFinite(positions[i]), `position[${i}] is not finite`);
}
for (const index of indices) {
  assert.ok(index >= 0 && index < vertexCount, `index ${index} is out of range`);
}

// Nothing may escape the disc.
for (let v = 0; v < vertexCount; v++) {
  const r = Math.hypot(positions[v * 3], positions[v * 3 + 2]);
  assert.ok(r <= TERRAIN_RADIUS + 1e-6, `vertex ${v} is outside the terrain radius`);
}

// Every face must point up. Backwards winding renders an invisible floor, and
// it is the single easiest thing to get wrong here.
let upward = 0;
for (let t = 0; t < indices.length; t += 3) {
  const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
  const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
  const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
  const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  // y component of u × v
  const ny = uz * vx - ux * vz;
  if (ny > 0) upward++;
  assert.ok(Number.isFinite(ny), `face ${t / 3} has a degenerate normal`);
}
assert.equal(
  upward,
  indices.length / 3,
  `${indices.length / 3 - upward} faces point downward — the ground would be invisible`,
);

/* ------------------------------- scatter ------------------------------ */

const keepClear = [
  { x: 0, z: 0, radius: 3 },
  { x: 4, z: 0, radius: 2.5 },
];
const placed = scatterNature(keepClear, hash01);

assert.ok(placed.length > 50, `only ${placed.length} nature props — the forest is bare`);
// Deterministic, for the same reason the heights are.
assert.deepEqual(scatterNature(keepClear, hash01), placed, "scatter is not deterministic");

for (const item of placed) {
  const [x, y, z] = item.position;
  const r = Math.hypot(x, z);
  assert.ok(r <= TERRAIN_RADIUS, `${item.kind} is off the edge of the world`);
  assert.ok(Number.isFinite(y), `${item.kind} has a non-finite height`);
  assert.ok(item.scale > 0, `${item.kind} has a non-positive scale`);
  // Nothing may grow where a building or its mob stands.
  for (const spot of keepClear) {
    assert.ok(
      Math.hypot(x - spot.x, z - spot.z) >= spot.radius,
      `${item.kind} at ${r.toFixed(2)} is inside a keep-clear zone`,
    );
  }
  // Props in the clearing must sit on flat ground, like everything else.
  if (r <= CLEARING_RADIUS) assert.equal(y, 0, `${item.kind} inside the clearing is not at y=0`);
  else assert.equal(y, terrainHeight(x, z), `${item.kind} is floating above the hills`);
}

// Trees on the worn path would look like nobody uses it.
const onPath = placed.filter(
  (item) =>
    Math.hypot(item.position[0], item.position[2]) <= CLEARING_RADIUS &&
    Math.abs(Math.hypot(item.position[0], item.position[2]) - PATH_RADIUS) < PATH_WIDTH,
);
assert.deepEqual(onPath, [], `${onPath.length} props are growing in the ring road`);

console.log(
  `terrain.check.ts — ${vertexCount} vertices, ${indices.length / 3} faces all facing up, ` +
    `${placed.length} nature props — all assertions passed`,
);
