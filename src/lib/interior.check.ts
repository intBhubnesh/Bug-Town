/**
 * Self-check for the module interiors. Run: bun run check
 *
 * A floor plan fails quietly in specific ways: two rooms overlapping looks
 * like one odd room, a bug placed outside its walls looks like it belongs to
 * the neighbour, and a room with no doorway is a sealed box you can never
 * reach. None of those throw.
 */
import assert from "node:assert/strict";
import {
  FLOOR_Y,
  GENERAL_FEATURE,
  PROPS,
  TILE,
  decorateHall,
  decorateRoom,
  interiorBugSpots,
  planInterior,
  type Bounds,
  type InteriorFeature,
} from "./interior";
import { buildTown } from "./seed";
import { hash01 } from "./hex";

const inside = (p: [number, number, number], b: Bounds) =>
  p[0] >= b.xMin && p[0] <= b.xMax && p[2] >= b.zMin && p[2] <= b.zMax;

const overlaps = (a: Bounds, b: Bounds) =>
  a.xMin < b.xMax && b.xMin < a.xMax && a.zMin < b.zMax && b.zMin < a.zMax;

/* ------------------------- the real modules --------------------------- */

const town = buildTown();

for (const module of town.modules) {
  const features: InteriorFeature[] = module.features.map((f) => ({
    id: f.id,
    name: f.name,
    health: f.health,
    ownerName: f.ownerId,
    bugs: f.bugs.map((b) => ({ id: b.id, severity: b.severity })),
  }));
  const plan = planInterior(features);
  const label = `module ${module.id}`;

  // One room per feature, General excepted — those bugs are module-level and
  // belong in the corridor.
  const expected = features.filter((f) => f.name !== GENERAL_FEATURE).length;
  assert.equal(plan.rooms.length, expected, `${label}: wrong room count`);

  // No two rooms may share space.
  for (let i = 0; i < plan.rooms.length; i++) {
    for (let j = i + 1; j < plan.rooms.length; j++) {
      assert.ok(
        !overlaps(plan.rooms[i].bounds, plan.rooms[j].bounds),
        `${label}: rooms ${plan.rooms[i].name} and ${plan.rooms[j].name} overlap`,
      );
    }
    // And no room may sit on top of the corridor.
    assert.ok(
      !overlaps(plan.rooms[i].bounds, plan.hall.bounds),
      `${label}: room ${plan.rooms[i].name} overlaps the corridor`,
    );
  }

  // Every room needs exactly one way in, on its south wall.
  assert.equal(plan.doorways.length, plan.rooms.length, `${label}: doorway count != room count`);
  for (const room of plan.rooms) {
    const door = plan.doorways.find(
      (d) =>
        Math.abs(d.position[0] - room.door[0]) < 0.001 &&
        d.position[2] > room.bounds.zMin - 0.001 &&
        d.position[2] < room.bounds.zMin + TILE,
    );
    assert.ok(door, `${label}: room ${room.name} has no doorway`);
  }

  // Every bug must be inside its own room, and nowhere near a wall.
  for (const room of plan.rooms) {
    const feature = features.find((f) => f.id === room.featureId)!;
    assert.equal(room.bugs.length, feature.bugs.length, `${label}/${room.name}: lost a bug`);
    for (const bug of room.bugs) {
      assert.ok(inside(bug.position, room.bounds), `${label}/${room.name}: ${bug.bugId} is outside`);
      assert.equal(bug.position[1], FLOOR_Y, `${bug.bugId} is not standing on the floor`);
      // At least half a metre of clearance, or it clips into the wall.
      const clearance = Math.min(
        bug.position[0] - room.bounds.xMin,
        room.bounds.xMax - bug.position[0],
        bug.position[2] - room.bounds.zMin,
        room.bounds.zMax - bug.position[2],
      );
      assert.ok(clearance > 0.5, `${label}/${room.name}: ${bug.bugId} is inside a wall`);
    }
    // Two bugs standing in the same spot read as one bug.
    for (let i = 0; i < room.bugs.length; i++) {
      for (let j = i + 1; j < room.bugs.length; j++) {
        const [ax, , az] = room.bugs[i].position;
        const [bx, , bz] = room.bugs[j].position;
        assert.ok(
          Math.hypot(ax - bx, az - bz) > 0.9,
          `${label}/${room.name}: two skeletons are standing on each other`,
        );
      }
    }
  }

  // Module-level bugs belong in the corridor.
  const general = features.find((f) => f.name === GENERAL_FEATURE);
  assert.equal(plan.hall.bugs.length, general?.bugs.length ?? 0, `${label}: hall bug count`);
  for (const bug of plan.hall.bugs) {
    assert.ok(inside(bug.position, plan.hall.bounds), `${label}: hall bug ${bug.bugId} is outside`);
  }

  // Nothing may be lost between the module and its floor plan.
  const spots = interiorBugSpots(plan);
  assert.equal(spots.size, module.bugs.length, `${label}: ${module.bugs.length - spots.size} bugs missing`);
  for (const bug of module.bugs) {
    assert.ok(spots.has(bug.id), `${label}: ${bug.key} has nowhere to stand`);
  }

  // You have to be able to walk in.
  assert.ok(inside(plan.hall.entrance, plan.hall.bounds), `${label}: the entrance is outside the hall`);

  // Floors must exist under everything that stands on them.
  // Tiles are contiguous, so a point can sit exactly on a seam between four of
  // them — inclusive bounds, or a perfectly centred bug reads as standing on air.
  const floorAt = (x: number, z: number) =>
    plan.floors.some(
      (f) =>
        Math.abs(f.position[0] - x) <= TILE / 2 + 1e-6 &&
        Math.abs(f.position[2] - z) <= TILE / 2 + 1e-6,
    );
  for (const bug of spots.values()) {
    assert.ok(floorAt(bug.position[0], bug.position[2]), `${label}: ${bug.bugId} is standing on nothing`);
  }
  assert.ok(floorAt(plan.hall.entrance[0], plan.hall.entrance[2]), `${label}: the entrance has no floor`);
}

/* ------------------------------ decoration ---------------------------- */
/* Props are the easiest thing to get subtly wrong: one inside a skeleton, or
   one parked in the doorway, and the room stops being readable. */

let totalProps = 0;
for (const module of town.modules) {
  const features: InteriorFeature[] = module.features.map((f) => ({
    id: f.id,
    name: f.name,
    health: f.health,
    ownerName: f.ownerId,
    bugs: f.bugs.map((b) => ({ id: b.id, severity: b.severity })),
  }));
  const plan = planInterior(features);

  for (const room of plan.rooms) {
    const props = decorateRoom(room, hash01);
    totalProps += props.length;
    const label = `${module.id}/${room.name}`;

    // Every room gets furnished — an empty stone box is the thing this fixes.
    assert.ok(props.length >= 2, `${label}: only ${props.length} props, the room looks bare`);

    // Exactly one chest per room, and it must be a model we actually ship.
    const chests = props.filter((p) => p.kind === "chest" || p.kind === "chest_gold");
    assert.equal(chests.length, 1, `${label}: expected one chest, got ${chests.length}`);

    for (const prop of props) {
      const known = PROPS[prop.kind] ?? (prop.kind.startsWith("chest") ? { radius: 0.96 } : null);
      assert.ok(known, `${label}: unknown prop "${prop.kind}"`);
      const radius = known!.radius;
      const [x, y, z] = prop.position;
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `${label}: bad position`);

      // Wall-mounted things hang above the floor; everything else stands on it.
      const mounted = PROPS[prop.kind]?.placement === "mount";
      if (!mounted) {
        assert.ok(y >= FLOOR_Y - 0.001, `${label}: ${prop.kind} is below the floor`);
        assert.ok(y < FLOOR_Y + 1.5, `${label}: ${prop.kind} is floating at y=${y}`);
        // Inside the walls.
        assert.ok(
          x - radius > room.bounds.xMin + 0.4 && x + radius < room.bounds.xMax - 0.4,
          `${label}: ${prop.kind} is in the east/west wall`,
        );
        assert.ok(
          z - radius > room.bounds.zMin + 0.4 && z + radius < room.bounds.zMax - 0.4,
          `${label}: ${prop.kind} is in the north/south wall`,
        );
        // Never inside a skeleton.
        for (const bug of room.bugs) {
          assert.ok(
            Math.hypot(bug.position[0] - x, bug.position[2] - z) > radius,
            `${label}: ${prop.kind} is standing inside ${bug.bugId}`,
          );
        }
        // Never blocking the way in.
        assert.ok(
          !(Math.abs(x - room.door[0]) < 2.0 && z < room.bounds.zMin + 2.4),
          `${label}: ${prop.kind} is blocking the doorway`,
        );
      }
    }

    // Props must not be stacked inside each other either.
    const standing = props.filter((p) => PROPS[p.kind]?.placement !== "mount");
    for (let i = 0; i < standing.length; i++) {
      for (let j = i + 1; j < standing.length; j++) {
        const a = standing[i];
        const b = standing[j];
        const ra = PROPS[a.kind]?.radius ?? 0.96;
        const rb = PROPS[b.kind]?.radius ?? 0.96;
        const gap = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
        assert.ok(gap >= Math.min(ra, rb), `${label}: ${a.kind} and ${b.kind} overlap`);
      }
    }

    // A wrecked room should not be furnished like a tidy one.
    if (room.health < 50) {
      const tidyOnly = props.filter((p) => PROPS[p.kind]?.mood === "tidy");
      assert.deepEqual(
        tidyOnly.map((p) => p.kind),
        [],
        `${label} (health ${room.health}) is furnished with tidy props`,
      );
    }
  }

  // The corridor gets dressed too, but never across the entrance.
  for (const prop of decorateHall(plan, hash01)) {
    totalProps += 1;
    assert.ok(PROPS[prop.kind], `${module.id}: unknown hall prop "${prop.kind}"`);
    assert.ok(
      Math.abs(prop.position[0] - plan.hall.entrance[0]) >= 2.2,
      `${module.id}: ${prop.kind} is parked on the entrance`,
    );
  }
}

/* --------------------------- edge cases ------------------------------- */

// A module with no features at all still has to produce a walkable hall.
const empty = planInterior([]);
assert.equal(empty.rooms.length, 0);
assert.ok(empty.floors.length > 0, "an empty module has no floor to stand on");
assert.ok(inside(empty.hall.entrance, empty.hall.bounds));

// A clean feature gets a room too — "no bugs" is worth seeing.
const clean = planInterior([
  { id: "f1", name: "Spotless", health: 100, ownerName: "x", bugs: [] },
]);
assert.equal(clean.rooms.length, 1);
assert.equal(clean.rooms[0].bugs.length, 0);
assert.equal(clean.doorways.length, 1);

// A module that is nothing but module-level bugs: no rooms, a populated hall.
const onlyGeneral = planInterior([
  {
    id: "g",
    name: GENERAL_FEATURE,
    health: 60,
    ownerName: "x",
    bugs: [
      { id: "b1", severity: "high" },
      { id: "b2", severity: "low" },
    ],
  },
]);
assert.equal(onlyGeneral.rooms.length, 0);
assert.equal(onlyGeneral.hall.bugs.length, 2);

const biggest = town.modules.reduce((a, b) => (a.bugs.length > b.bugs.length ? a : b));
console.log(
  `interior.check.ts — ${town.modules.length} floor plans, ${totalProps} props placed, ` +
    `biggest is ${biggest.name} (${biggest.features.length} features, ${biggest.bugs.length} bugs) ` +
    `— all assertions passed`,
);
