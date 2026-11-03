/**
 * The village floor.
 *
 * Replaces the hexagon pack's visible tiles with one continuous, gently rolling
 * disc of ground. Pure maths and typed arrays here, no three.js, so it can be
 * checked in node — see `terrain.check.ts`.
 *
 * Shape: dead flat inside the clearing so every building and villager stands on
 * y = 0 with no slope fitting, then rising into rolling forested ground that
 * lifts at the rim to hide the edge of the world.
 */

export const TERRAIN_RADIUS = 15;
/** Everything inhabited lives inside this, and it is perfectly flat. */
export const CLEARING_RADIUS = 8.6;
/** Where the villagers' ring road is worn into the grass. */
export const PATH_RADIUS = 7.4;
export const PATH_WIDTH = 0.62;

/* ----------------------------- value noise ---------------------------- */

function hash2(ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fz = smooth(z - z0);
  const a = hash2(x0, z0);
  const b = hash2(x0 + 1, z0);
  const c = hash2(x0, z0 + 1);
  const d = hash2(x0 + 1, z0 + 1);
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

/**
 * Ground height at a world position. Zero everywhere inside the clearing, so
 * nothing in the village ever needs slope fitting.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= CLEARING_RADIUS) return 0;
  const t = Math.min(1, (r - CLEARING_RADIUS) / (TERRAIN_RADIUS - CLEARING_RADIUS));
  // Squared ramp, so the clearing edge is a slope and not a cliff.
  const ramp = t * t;
  const n = valueNoise(x * 0.21, z * 0.21) * 0.68 + valueNoise(x * 0.54, z * 0.54) * 0.32;
  // Biased upward: the rim should rise and hide the horizon, not fall away.
  return ramp * (0.5 + (n - 0.5) * 1.7) * 2.4;
}

/* ------------------------------- colours ------------------------------ */

type Rgb = [number, number, number];

const GRASS_LIGHT: Rgb = [0.3, 0.46, 0.22];
const GRASS_DARK: Rgb = [0.16, 0.29, 0.15];
const DIRT: Rgb = [0.3, 0.26, 0.19];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Grass, shaded by a second noise, with the ring road worn through it. */
export function terrainColor(x: number, z: number, height: number): Rgb {
  const patch = valueNoise(x * 0.42 + 11.3, z * 0.42 - 7.1);
  // Dips read damper and darker than rises.
  const shade = Math.min(1, Math.max(0, patch * 0.75 + (height > 0 ? 0.25 : 0.1)));
  const grass = mix(GRASS_DARK, GRASS_LIGHT, shade);

  const r = Math.hypot(x, z);
  const offPath = Math.abs(r - PATH_RADIUS);
  if (offPath < PATH_WIDTH) {
    // Feathered edges, so the path doesn't look like a decal.
    const strength = 1 - offPath / PATH_WIDTH;
    return mix(grass, DIRT, strength * 0.85);
  }
  return grass;
}

/* ------------------------------ geometry ------------------------------ */

export interface TerrainData {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
}

/**
 * A polar disc: one centre vertex, then `rings` rings of `segments` vertices.
 * Polar beats a clipped plane — no square corners to hide, and the triangles
 * get larger toward the rim where detail is least needed.
 *
 * Winding is clockwise in (x, z) so the face normal points up; `terrain.check`
 * asserts that, because getting it backwards makes the ground invisible.
 */
export function buildTerrain(rings = 56, segments = 96): TerrainData {
  const vertexCount = 1 + rings * segments;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  const write = (index: number, x: number, z: number) => {
    const y = terrainHeight(x, z);
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;
    const [r, g, b] = terrainColor(x, z, y);
    colors[index * 3] = r;
    colors[index * 3 + 1] = g;
    colors[index * 3 + 2] = b;
  };

  write(0, 0, 0);
  // Ring radii ease outward, packing detail into the clearing and the treeline.
  const radiusAt = (ring: number) => {
    const t = ring / rings;
    return TERRAIN_RADIUS * Math.pow(t, 0.85);
  };

  for (let ring = 1; ring <= rings; ring++) {
    const radius = radiusAt(ring);
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      write(
        1 + (ring - 1) * segments + s,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
    }
  }

  const at = (ring: number, s: number) => 1 + (ring - 1) * segments + (s % segments);
  const tris: number[] = [];

  for (let s = 0; s < segments; s++) {
    tris.push(0, at(1, s + 1), at(1, s));
  }
  for (let ring = 2; ring <= rings; ring++) {
    for (let s = 0; s < segments; s++) {
      const a = at(ring - 1, s);
      const b = at(ring, s);
      const c = at(ring, s + 1);
      const d = at(ring - 1, s + 1);
      tris.push(a, c, b, a, d, c);
    }
  }

  return { positions, colors, indices: new Uint32Array(tris), vertexCount };
}

/* ------------------------------- scatter ------------------------------ */

export type NatureKind =
  | "tree_single_A"
  | "tree_single_B"
  | "trees_A_small"
  | "trees_A_medium"
  | "trees_A_large"
  | "trees_B_small"
  | "trees_B_medium"
  | "trees_B_large"
  | "rock_single_A"
  | "rock_single_B"
  | "rock_single_C"
  | "rock_single_D"
  | "rock_single_E";

export interface NaturePlacement {
  kind: NatureKind;
  position: [number, number, number];
  rotation: number;
  scale: number;
}

const GROVES: NatureKind[] = [
  "trees_A_medium",
  "trees_A_large",
  "trees_B_medium",
  "trees_B_large",
  "trees_A_small",
  "trees_B_small",
];
const SINGLES: NatureKind[] = ["tree_single_A", "tree_single_B"];
const ROCKS: NatureKind[] = [
  "rock_single_A",
  "rock_single_B",
  "rock_single_C",
  "rock_single_D",
  "rock_single_E",
];

/**
 * Where every tree and rock goes. Deterministic, so the server's prerender and
 * the browser agree and the forest doesn't reshuffle on hydration.
 *
 * `keepClear` is the list of world positions that must stay open — the town
 * hall and every module, whose skeleton mobs need the room.
 */
export function scatterNature(
  keepClear: { x: number; z: number; radius: number }[],
  random: (seed: string) => number,
  /**
   * How far out props inside the clearing may go. The city wall stands just
   * inside the clearing, so without this a tree pokes straight through it.
   */
  innerLimit: number = CLEARING_RADIUS,
): NaturePlacement[] {
  const out: NaturePlacement[] = [];
  const clear = (x: number, z: number, margin: number) => {
    for (const spot of keepClear) {
      if (Math.hypot(x - spot.x, z - spot.z) < spot.radius + margin) return false;
    }
    return true;
  };
  const onPath = (x: number, z: number) =>
    Math.abs(Math.hypot(x, z) - PATH_RADIUS) < PATH_WIDTH + 0.5;

  // The forest: a dense belt from the clearing edge out to the rim.
  const belt = 150;
  for (let i = 0; i < belt; i++) {
    const seed = `forest:${i}`;
    const angle = (i / belt) * Math.PI * 2 + (random(`${seed}:a`) - 0.5) * 0.09;
    const depth = random(`${seed}:d`);
    const radius = CLEARING_RADIUS + 0.3 + depth * (TERRAIN_RADIUS - CLEARING_RADIUS - 0.9);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!clear(x, z, 1.2)) continue;
    const roll = random(`${seed}:k`);
    const kind =
      roll < 0.74
        ? GROVES[Math.floor(random(`${seed}:g`) * GROVES.length)]
        : roll < 0.93
          ? SINGLES[Math.floor(random(`${seed}:s`) * SINGLES.length)]
          : ROCKS[Math.floor(random(`${seed}:r`) * ROCKS.length)];
    out.push({
      kind,
      position: [x, terrainHeight(x, z), z],
      rotation: random(`${seed}:rot`) * Math.PI * 2,
      // Bigger toward the rim, so the treeline reads as depth.
      scale: 0.85 + depth * 0.5 + random(`${seed}:sc`) * 0.25,
    });
  }

  // A handful of single trees and rocks inside the village, for life.
  const inner = 70;
  for (let i = 0; i < inner; i++) {
    const seed = `inner:${i}`;
    const angle = random(`${seed}:a`) * Math.PI * 2;
    const radius = 3.2 + random(`${seed}:d`) * Math.max(0.2, innerLimit - 3.2);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!clear(x, z, 1.5) || onPath(x, z)) continue;
    const rock = random(`${seed}:k`) > 0.45;
    out.push({
      kind: rock
        ? ROCKS[Math.floor(random(`${seed}:r`) * ROCKS.length)]
        : SINGLES[Math.floor(random(`${seed}:s`) * SINGLES.length)],
      position: [x, 0, z],
      rotation: random(`${seed}:rot`) * Math.PI * 2,
      scale: rock ? 0.8 + random(`${seed}:sc`) * 0.9 : 0.7 + random(`${seed}:sc`) * 0.4,
    });
  }

  return out;
}

export const NATURE_KINDS: NatureKind[] = [...GROVES, ...SINGLES, ...ROCKS];
