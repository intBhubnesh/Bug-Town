/**
 * Hex coordinates, still used to lay out the buildings on a tidy grid even
 * though the ground itself is now continuous terrain (see `terrain.ts`).
 *
 * The spacing came from the asset, not a guess: KayKit's `hex_grass.gltf` is
 * 2.000 wide (x) by 2.309 deep (z), a pointy-top hexagon of size 2/√3, with
 * its top surface at y = 0. Keeping that spacing means buildings sit at
 * sensible distances and never overlap.
 */
export const HEX_WIDTH = 2;
export const HEX_ROW = Math.sqrt(3); // 1.7320508 — distance between rows
/** Where everything stands. The terrain is flat across the whole clearing. */
export const GROUND_Y = 0;

export type Cell = [q: number, r: number];

/** Axial hex coordinate to world position. */
export function cellToWorld([q, r]: Cell): [number, number, number] {
  return [HEX_WIDTH * (q + r / 2), GROUND_Y, HEX_ROW * r];
}

/** Hex distance from the origin, in tiles. */
export function cellDistance([q, r]: Cell): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

/**
 * Deterministic 0–1 from a string. Used for scattering the forest and placing
 * skeletons, so the server's prerender and the browser agree and nothing
 * reshuffles on hydration.
 */
export function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
