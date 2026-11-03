/**
 * Inside a module: a floor plan with one room per feature.
 *
 * Pure geometry, no three.js, so `interior.check.ts` can verify that rooms
 * don't overlap, every bug is inside its own room, and every room has a way in.
 *
 * Built from the KayKit Dungeon Remastered pack, which is a clean 4-unit grid:
 * `floor_tile_large` is 4 × 4 centred on its origin with its top face at
 * y = 0.05, and `wall` is 4 wide × 4 tall × 1 deep, also centred in x. Every
 * number below is in those units.
 *
 * Scale note: this pack is roughly 2.6× the village. A dungeon wall is 4 units
 * tall where a village house is 1.3, so characters are rendered here at close
 * to their native ~2.2 rather than the 0.85 they use outside.
 */
import type { Severity } from "./game";

export const TILE = 4;
/** Top face of `floor_tile_large`. Everything indoors stands on this. */
export const FLOOR_Y = 0.05;
export const WALL_HEIGHT = 4;
/** Half the thickness of a wall piece, which is 1 deep and centred in z. */
const WALL_HALF = 0.5;

/** The PRD routes module-level bugs to the module's "General" feature. */
export const GENERAL_FEATURE = "General";

export interface InteriorFeature {
  id: string;
  name: string;
  health: number;
  ownerName: string;
  bugs: { id: string; severity: Severity }[];
}

export interface Bounds {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export interface BugSpot {
  bugId: string;
  severity: Severity;
  featureId: string;
  position: [number, number, number];
  /** Facing the doorway, so the room reads as guarded. */
  facing: number;
}

export interface RoomPlan {
  featureId: string;
  name: string;
  health: number;
  ownerName: string;
  bounds: Bounds;
  /** Middle of the floor, for the sign and the camera. */
  center: [number, number, number];
  /** Middle of the doorway in the south wall, where you walk in. */
  door: [number, number, number];
  bugs: BugSpot[];
}

export interface Piece {
  position: [number, number, number];
  rotation: number;
}

export interface InteriorPlan {
  rooms: RoomPlan[];
  /** The corridor along the south. Module-level bugs stand here. */
  hall: {
    bounds: Bounds;
    bugs: BugSpot[];
    /** Where you stand when you aren't fighting anything. */
    entrance: [number, number, number];
  };
  floors: Piece[];
  walls: Piece[];
  doorways: Piece[];
  torches: Piece[];
  bounds: Bounds;
}

/** Rooms grow with their bug count, so a sick feature is visibly bigger. */
function roomSize(bugCount: number): { w: number; d: number } {
  if (bugCount <= 2) return { w: 2, d: 2 };
  if (bugCount <= 6) return { w: 3, d: 2 };
  return { w: 3, d: 3 };
}

/** Pack n points into a bounded area as an even grid, centred. */
function packGrid(n: number, area: Bounds, y: number): [number, number, number][] {
  if (n === 0) return [];
  const width = area.xMax - area.xMin;
  const depth = area.zMax - area.zMin;
  // Favour columns when the area is wide, rows when it's deep.
  let cols = Math.max(1, Math.round(Math.sqrt((n * width) / Math.max(0.001, depth))));
  cols = Math.min(cols, n);
  const rows = Math.ceil(n / cols);
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Centre each row, so a short last row isn't left-aligned.
    const inRow = Math.min(cols, n - row * cols);
    const x = area.xMin + (width * (col + 0.5)) / inRow;
    const z = area.zMin + (depth * (row + 0.5)) / rows;
    out.push([x, y, z]);
  }
  return out;
}

/**
 * Lay out a module's interior.
 *
 * Rooms run left to right in a row with a one-tile wall between them, each
 * opening south onto a corridor that spans the whole plan. Feature bugs stand
 * in their feature's room; module-level bugs (the "General" feature) stand in
 * the corridor, because that is what module-level means.
 */
export function planInterior(features: InteriorFeature[]): InteriorPlan {
  const real = features.filter((f) => f.name !== GENERAL_FEATURE);
  const general = features.find((f) => f.name === GENERAL_FEATURE);

  const rooms: RoomPlan[] = [];
  const floors: Piece[] = [];
  const walls: Piece[] = [];
  const doorways: Piece[] = [];
  const torches: Piece[] = [];

  let tileX = 0;
  for (const feature of real) {
    const { w, d } = roomSize(feature.bugs.length);
    const xMin = tileX * TILE - TILE / 2;
    const xMax = (tileX + w - 1) * TILE + TILE / 2;
    const zMin = -TILE / 2;
    const zMax = (d - 1) * TILE + TILE / 2;
    const bounds: Bounds = { xMin, xMax, zMin, zMax };

    for (let i = 0; i < w; i++) {
      for (let j = 0; j < d; j++) {
        floors.push({ position: [(tileX + i) * TILE, 0, j * TILE], rotation: 0 });
      }
    }

    // North and south walls run along x; the middle south column is the door.
    const doorColumn = Math.floor(w / 2);
    for (let i = 0; i < w; i++) {
      const x = (tileX + i) * TILE;
      walls.push({ position: [x, 0, zMax - WALL_HALF], rotation: 0 });
      const piece = { position: [x, 0, zMin + WALL_HALF] as [number, number, number], rotation: 0 };
      if (i === doorColumn) doorways.push(piece);
      else walls.push(piece);
    }
    // East and west walls run along z, so they're turned a quarter turn.
    for (let j = 0; j < d; j++) {
      const z = j * TILE;
      walls.push({ position: [xMin + WALL_HALF, 0, z], rotation: Math.PI / 2 });
      walls.push({ position: [xMax - WALL_HALF, 0, z], rotation: Math.PI / 2 });
    }
    // Two torches on the back wall, pointing into the room.
    torches.push({ position: [xMin + 1.4, 2.4, zMax - 0.7], rotation: Math.PI });
    torches.push({ position: [xMax - 1.4, 2.4, zMax - 0.7], rotation: Math.PI });

    const inner: Bounds = {
      xMin: xMin + 1.3,
      xMax: xMax - 1.3,
      zMin: zMin + 1.6,
      zMax: zMax - 1.3,
    };
    const bugs: BugSpot[] = packGrid(feature.bugs.length, inner, FLOOR_Y).map((position, i) => ({
      bugId: feature.bugs[i].id,
      severity: feature.bugs[i].severity,
      featureId: feature.id,
      position,
      // Facing the door: forward is +Z, so a half turn looks south.
      facing: Math.PI,
    }));

    const doorX = (tileX + doorColumn) * TILE;
    rooms.push({
      featureId: feature.id,
      name: feature.name,
      health: feature.health,
      ownerName: feature.ownerName,
      bounds,
      center: [(xMin + xMax) / 2, FLOOR_Y, (zMin + zMax) / 2],
      door: [doorX, FLOOR_Y, zMin],
      bugs,
    });

    tileX += w + 1; // one tile of solid wall between neighbours
  }

  // The corridor spans one tile further each way than the rooms.
  const planXMin = rooms.length > 0 ? Math.min(...rooms.map((r) => r.bounds.xMin)) : -TILE / 2;
  const planXMax = rooms.length > 0 ? Math.max(...rooms.map((r) => r.bounds.xMax)) : TILE / 2;
  const hallZ = -TILE;
  const hallBounds: Bounds = {
    xMin: planXMin - TILE,
    xMax: planXMax + TILE,
    zMin: hallZ - TILE / 2,
    zMax: -TILE / 2,
  };

  const firstTile = Math.round((hallBounds.xMin + TILE / 2) / TILE);
  const lastTile = Math.round((hallBounds.xMax - TILE / 2) / TILE);
  for (let i = firstTile; i <= lastTile; i++) {
    floors.push({ position: [i * TILE, 0, hallZ], rotation: 0 });
    // Outer wall of the corridor.
    walls.push({ position: [i * TILE, 0, hallBounds.zMin + WALL_HALF], rotation: 0 });
  }
  // Cap both ends of the corridor.
  walls.push({ position: [hallBounds.xMin + WALL_HALF, 0, hallZ], rotation: Math.PI / 2 });
  walls.push({ position: [hallBounds.xMax - WALL_HALF, 0, hallZ], rotation: Math.PI / 2 });

  // Wall off the gaps between rooms, so the corridor is enclosed.
  const roomColumns = new Set<number>();
  for (const room of rooms) {
    const from = Math.round((room.bounds.xMin + TILE / 2) / TILE);
    const to = Math.round((room.bounds.xMax - TILE / 2) / TILE);
    for (let i = from; i <= to; i++) roomColumns.add(i);
  }
  for (let i = firstTile; i <= lastTile; i++) {
    if (!roomColumns.has(i)) {
      walls.push({ position: [i * TILE, 0, -TILE / 2 + WALL_HALF], rotation: 0 });
    }
  }

  const hallInner: Bounds = {
    xMin: hallBounds.xMin + 1.6,
    xMax: hallBounds.xMax - 1.6,
    zMin: hallBounds.zMin + 1.3,
    zMax: hallBounds.zMax - 1.3,
  };
  const hallBugs: BugSpot[] = general
    ? packGrid(general.bugs.length, hallInner, FLOOR_Y).map((position, i) => ({
        bugId: general.bugs[i].id,
        severity: general.bugs[i].severity,
        featureId: general.id,
        position,
        facing: 0,
      }))
    : [];

  return {
    rooms,
    hall: {
      bounds: hallBounds,
      bugs: hallBugs,
      entrance: [hallBounds.xMin + 2.2, FLOOR_Y, hallZ],
    },
    floors,
    walls,
    doorways,
    torches,
    bounds: {
      xMin: hallBounds.xMin,
      xMax: hallBounds.xMax,
      zMin: hallBounds.zMin,
      zMax: rooms.length > 0 ? Math.max(...rooms.map((r) => r.bounds.zMax)) : hallBounds.zMax,
    },
  };
}

/* ------------------------------ decoration ---------------------------- */

/**
 * The prop catalogue, measured from the GLBs.
 *
 * `radius` is half the larger ground dimension, used to keep props out of each
 * other and out of the skeletons. `lift` corrects models authored below the
 * floor (a chest's base sits at −0.17). `mount: "wall"` means it hangs at
 * height rather than standing — the pack authors those around their hanging
 * point, so they need no lift.
 */
export interface Prop {
  radius: number;
  lift: number;
  /** Against a wall, free-standing anywhere, or hung on the wall. */
  placement: "wall" | "floor" | "mount";
  /** Which rooms it suits: a kept room, a wrecked one, or either. */
  mood: "tidy" | "ruined" | "any";
  /** Needs a room at least this many tiles wide. */
  minWidth?: number;
}

export const PROPS: Record<string, Prop> = {
  // Against the walls
  shelf_large: { radius: 1.0, lift: 0.35, placement: "wall", mood: "tidy" },
  barrel_large: { radius: 0.9, lift: 0, placement: "wall", mood: "any" },
  keg: { radius: 1.0, lift: 0, placement: "wall", mood: "any" },
  crates_stacked: { radius: 1.12, lift: 0, placement: "wall", mood: "any" },
  box_stacked: { radius: 1.82, lift: 0, placement: "wall", mood: "any", minWidth: 3 },
  box_large: { radius: 0.75, lift: 0, placement: "wall", mood: "any" },
  trunk_large_A: { radius: 0.75, lift: 0, placement: "wall", mood: "tidy" },
  bed_frame: { radius: 1.5, lift: 0, placement: "wall", mood: "tidy", minWidth: 3 },
  table_long: { radius: 2.0, lift: 0, placement: "wall", mood: "tidy", minWidth: 3 },
  table_long_broken: { radius: 2.2, lift: 0, placement: "wall", mood: "ruined", minWidth: 3 },
  barrel_small_stack: { radius: 0.93, lift: 0, placement: "wall", mood: "ruined" },
  rubble_half: { radius: 2.0, lift: 0, placement: "wall", mood: "ruined", minWidth: 3 },

  // Free-standing
  table_medium: { radius: 1.0, lift: 0, placement: "floor", mood: "tidy" },
  table_medium_broken: { radius: 1.21, lift: 0, placement: "floor", mood: "ruined" },
  table_small_decorated_A: { radius: 0.61, lift: 0, placement: "floor", mood: "tidy" },
  chair: { radius: 0.38, lift: 0, placement: "floor", mood: "tidy" },
  stool: { radius: 0.38, lift: 0, placement: "floor", mood: "any" },
  barrel_small: { radius: 0.5, lift: 0, placement: "floor", mood: "any" },
  box_small: { radius: 0.5, lift: 0, placement: "floor", mood: "any" },
  trunk_medium_B: { radius: 0.48, lift: 0, placement: "floor", mood: "any" },
  trunk_small_C: { radius: 0.34, lift: 0, placement: "floor", mood: "any" },
  column: { radius: 0.35, lift: 0, placement: "floor", mood: "ruined" },
  torch_lit: { radius: 0.28, lift: 0.4, placement: "floor", mood: "any" },

  // Small clutter
  bottle_A_green: { radius: 0.18, lift: 0, placement: "floor", mood: "any" },
  bottle_B_brown: { radius: 0.28, lift: 0, placement: "floor", mood: "any" },
  candle_triple: { radius: 0.25, lift: 0, placement: "floor", mood: "tidy" },
  plate_stack: { radius: 0.5, lift: 0, placement: "floor", mood: "tidy" },
  coin_stack_medium: { radius: 0.52, lift: 0, placement: "floor", mood: "any" },
  keyring: { radius: 0.6, lift: 0.02, placement: "floor", mood: "any" },
  sword_shield_broken: { radius: 0.71, lift: 0.79, placement: "floor", mood: "ruined" },

  // Hung on the wall
  shelves: { radius: 1.0, lift: 0, placement: "mount", mood: "tidy" },
  sword_shield: { radius: 1.12, lift: 0, placement: "mount", mood: "tidy" },
};

/** The chest is guaranteed, one per room — gold when the feature is healthy. */
const CHEST = { plain: "chest", gold: "chest_gold", radius: 0.96, lift: 0.17 };

export interface PropPlacement {
  kind: string;
  position: [number, number, number];
  rotation: number;
}

/**
 * How close a prop may come to a skeleton. A skeleton's own footprint is about
 * 0.7 at indoor scale, so this is that plus a visible gap — generous enough to
 * read as "not touching", tight enough that a small room still fits furniture.
 */
const BUG_CLEARANCE = 1.0;

const pool = (mood: "tidy" | "ruined", placement: Prop["placement"], width: number) =>
  Object.entries(PROPS).filter(
    ([, p]) =>
      p.placement === placement && (p.mood === "any" || p.mood === mood) && (p.minWidth ?? 0) <= width,
  );

/**
 * Furnish one room.
 *
 * Props go along the walls first (that is where furniture lives), then a little
 * clutter on the open floor. Everything is rejected if it would overlap a
 * skeleton, another prop, or the path in from the doorway — a room you cannot
 * read is worse than an empty one.
 */
export function decorateRoom(
  room: RoomPlan,
  random: (seed: string) => number,
): PropPlacement[] {
  const placed: PropPlacement[] = [];
  const taken: { x: number; z: number; r: number }[] = room.bugs.map((b) => ({
    x: b.position[0],
    z: b.position[2],
    r: BUG_CLEARANCE,
  }));

  const { xMin, xMax, zMin, zMax } = room.bounds;
  const width = Math.round((xMax - xMin) / TILE);
  const mood: "tidy" | "ruined" = room.health >= 50 ? "tidy" : "ruined";

  const free = (x: number, z: number, r: number) => {
    // Keep the doorway and the step in from it clear.
    if (Math.abs(x - room.door[0]) < 2.1 && z < zMin + 2.6) return false;
    if (x - r < xMin + 1 || x + r > xMax - 1) return false;
    if (z - r < zMin + 1 || z + r > zMax - 1) return false;
    return !taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r);
  };

  const put = (kind: string, x: number, z: number, rotation: number, r: number, lift: number) => {
    placed.push({ kind, position: [x, FLOOR_Y + lift, z], rotation });
    taken.push({ x, z, r });
  };

  // One chest per room, as far from the door as it fits. The back row is
  // derived from the room, not hardcoded: a 2×2 room has no spare depth, and a
  // fixed offset silently left the smallest rooms without one.
  const chestKind = room.health >= 80 ? CHEST.gold : CHEST.plain;
  const backZ = zMax - 1 - CHEST.radius - 0.1;
  const frontZ = zMin + 1 + CHEST.radius + 0.1;
  const middle = (xMin + xMax) / 2;
  // Corners first — that is where a chest belongs, and it is the only space a
  // small room has left once its skeletons are standing in the middle.
  const chestX = [
    xMin + 1 + CHEST.radius + 0.1,
    xMax - 1 - CHEST.radius - 0.1,
    middle,
    middle - 1.7,
    middle + 1.7,
  ];
  let chested = false;
  for (const z of [backZ, frontZ]) {
    for (const x of chestX) {
      if (free(x, z, CHEST.radius)) {
        put(chestKind, x, z, z === backZ ? Math.PI : 0, CHEST.radius, CHEST.lift);
        chested = true;
        break;
      }
    }
    if (chested) break;
  }

  // Walls: candidate slots every ~1.9 units along each side, facing inward.
  const walls: { x: number; z: number; rotation: number }[] = [];
  const step = 1.9;
  for (let x = xMin + 1.6; x <= xMax - 1.6; x += step) {
    walls.push({ x, z: zMax - 1.3, rotation: Math.PI }); // back wall, facing in
    walls.push({ x, z: zMin + 1.3, rotation: 0 }); // front wall, facing in
  }
  for (let z = zMin + 1.6; z <= zMax - 1.6; z += step) {
    walls.push({ x: xMin + 1.3, z, rotation: Math.PI / 2 });
    walls.push({ x: xMax - 1.3, z, rotation: -Math.PI / 2 });
  }

  const wallPool = pool(mood, "wall", width);
  walls.forEach((slot, i) => {
    if (wallPool.length === 0) return;
    if (random(`wall:${room.featureId}:${i}`) > 0.58) return;
    const [kind, prop] = wallPool[Math.floor(random(`wk:${room.featureId}:${i}`) * wallPool.length)];
    if (!free(slot.x, slot.z, prop.radius)) return;
    put(kind, slot.x, slot.z, slot.rotation, prop.radius, prop.lift);
  });

  // A little on the open floor.
  const floorPool = pool(mood, "floor", width);
  for (let i = 0; i < 14; i++) {
    if (floorPool.length === 0) break;
    const x = xMin + 1.5 + random(`fx:${room.featureId}:${i}`) * (xMax - xMin - 3);
    const z = zMin + 1.5 + random(`fz:${room.featureId}:${i}`) * (zMax - zMin - 3);
    const [kind, prop] = floorPool[Math.floor(random(`fk:${room.featureId}:${i}`) * floorPool.length)];
    if (!free(x, z, prop.radius)) continue;
    put(kind, x, z, random(`fr:${room.featureId}:${i}`) * Math.PI * 2, prop.radius, prop.lift);
  }

  // Hung on the back wall, above the furniture.
  const mountPool = pool(mood, "mount", width);
  if (mountPool.length > 0) {
    const [kind] = mountPool[Math.floor(random(`mount:${room.featureId}`) * mountPool.length)];
    placed.push({
      kind,
      position: [(xMin + xMax) / 2 - 2.4, 2.1, zMax - 1.0],
      rotation: Math.PI,
    });
  }

  return placed;
}

/** Furnish the corridor: crates and barrels along its outer wall. */
export function decorateHall(
  plan: InteriorPlan,
  random: (seed: string) => number,
): PropPlacement[] {
  const placed: PropPlacement[] = [];
  const { xMin, xMax, zMin } = plan.hall.bounds;
  const taken = plan.hall.bugs.map((b) => ({ x: b.position[0], z: b.position[2], r: BUG_CLEARANCE }));
  const kinds: [string, Prop][] = [
    ["crates_stacked", PROPS.crates_stacked],
    ["barrel_large", PROPS.barrel_large],
    ["barrel_small", PROPS.barrel_small],
    ["box_large", PROPS.box_large],
    ["keg", PROPS.keg],
  ];

  for (let x = xMin + 1.8; x <= xMax - 1.8; x += 2.1) {
    if (random(`hall:${Math.round(x)}`) > 0.45) continue;
    const [kind, prop] = kinds[Math.floor(random(`hk:${Math.round(x)}`) * kinds.length)];
    const z = zMin + 1.25;
    // Leave the entrance clear so you can see yourself walk in.
    if (Math.abs(x - plan.hall.entrance[0]) < 2.2) continue;
    if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + prop.radius)) continue;
    placed.push({ kind, position: [x, FLOOR_Y + prop.lift, z], rotation: 0 });
    taken.push({ x, z, r: prop.radius });
  }
  return placed;
}

/** Every bug inside, room and hall alike, by id. */
export function interiorBugSpots(plan: InteriorPlan): Map<string, BugSpot> {
  const spots = new Map<string, BugSpot>();
  for (const room of plan.rooms) for (const bug of room.bugs) spots.set(bug.bugId, bug);
  for (const bug of plan.hall.bugs) spots.set(bug.bugId, bug);
  return spots;
}

export const boundsCenter = (b: Bounds): [number, number, number] => [
  (b.xMin + b.xMax) / 2,
  0,
  (b.zMin + b.zMax) / 2,
];

export const boundsSpan = (b: Bounds): number =>
  Math.max(b.xMax - b.xMin, b.zMax - b.zMin);
