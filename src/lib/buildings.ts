/**
 * Building footprints, in world units.
 *
 * These are measured from the glTF files, not invented — `seed.check.ts` reads
 * the accessor bounds straight out of the assets and fails if this table drifts
 * from them by more than a millimetre.
 *
 * They live here rather than being measured at runtime because the *layout*
 * needs them before anything is loaded: a skeleton's position depends on its
 * building's footprint, and a villager walking over to fight that skeleton
 * needs to know where it is standing. Measuring inside the building component
 * would bury that answer behind a Suspense boundary where nothing else can
 * reach it.
 */
import type { ModuleKind } from "./seed.ts";

export const FOOTPRINT: Record<ModuleKind | "ruin" | "scaffolding" | "townHall", number> = {
  building_market: 1.799,
  building_tavern: 1.332,
  building_church: 1.155,
  building_blacksmith: 1.288,
  building_tower_A: 1.153,
  building_tower_B: 1.383,
  building_mine: 1.92,
  building_barracks: 1.566,
  building_archeryrange: 1.671,
  building_home_B: 1.099,
  ruin: 1.539,
  scaffolding: 2.109,
  townHall: 2.256,
};

/**
 * Building heights, also measured from the files. Used to size props that stand
 * among the buildings, so nothing towers over the town by accident.
 */
export const BUILDING_HEIGHT: Record<ModuleKind | "ruin" | "scaffolding" | "townHall", number> = {
  building_market: 0.982,
  building_tavern: 1.397,
  building_church: 1.645,
  building_blacksmith: 0.985,
  building_tower_A: 2.192,
  building_tower_B: 2.485,
  building_mine: 1.137,
  building_barracks: 1.64,
  building_archeryrange: 1.792,
  building_home_B: 1.28,
  ruin: 0.994,
  scaffolding: 1.299,
  townHall: 3.979,
};

/** Measured range of the module buildings, for sizing anything that stands among them. */
export const SHORTEST_BUILDING = 0.982; // market
export const MEDIAN_BUILDING = 1.64; // barracks
export const TALLEST_BUILDING = 2.485; // tower_B

/**
 * The notice board in the square, sized against the buildings rather than
 * picked by eye: taller than the villagers reading it, shorter than a typical
 * building so it never looms. The first version was 2.6 units tall — higher
 * than every module building in the town, castle excepted.
 *
 * `citywall.check.ts` asserts it stays in that band.
 */
export const BILLBOARD = {
  /** Board face. */
  width: 1.16,
  height: 0.7,
  /** Post length below the board. */
  post: 0.46,
  /** Board thickness, and the beam across the top. */
  depth: 0.07,
  beam: 0.09,
};

/** Overall height of the billboard, posts to the top of its beam. */
export const BILLBOARD_TOTAL = BILLBOARD.post + BILLBOARD.height + BILLBOARD.beam + 0.05;

/** Which model a module actually renders as, given its state. */
export function footprintFor(kind: ModuleKind, state?: "live" | "retired" | "building"): number {
  if (state === "retired") return FOOTPRINT.ruin;
  if (state === "building") return FOOTPRINT.scaffolding;
  return FOOTPRINT[kind];
}
