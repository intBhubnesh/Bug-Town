/**
 * The city wall around the village.
 *
 * `wall_straight` from the hexagon pack is exactly 2.0 long on its X axis,
 * 0.8 thick and 1.1 tall, centred on its origin — so the wall is a regular
 * polygon whose side length *is* the piece length. Pick the number of sides and
 * the radius follows; the ring then closes exactly, with no gaps to hide and no
 * overlapping segments.
 *
 * Pure maths, no three.js, so `citywall.check.ts` can verify it closes.
 */

/** Length of one `wall_straight` piece along its X axis. */
export const SEGMENT = 2;
/** Sides of the polygon. 26 puts the wall just inside the flat clearing. */
export const SIDES = 26;
/** Towers at roughly even intervals, not on every corner. */
export const TOWERS = 6;

/** Distance to a corner: the radius that makes each side exactly SEGMENT long. */
export const WALL_RADIUS = SEGMENT / (2 * Math.sin(Math.PI / SIDES));
/** Distance to the middle of a side — the nearest the wall comes to the centre. */
export const WALL_INRADIUS = WALL_RADIUS * Math.cos(Math.PI / SIDES);
/** Inside face of the wall, allowing for its 0.8 thickness. */
export const WALL_INNER_FACE = WALL_INRADIUS - 0.4;

export interface WallPiece {
  position: [number, number, number];
  rotation: number;
}

export interface CityWall {
  /** Plain segments. */
  segments: WallPiece[];
  /** Gatehouse segments, replacing a plain one. */
  gates: WallPiece[];
  /** Towers on the corners. */
  towers: WallPiece[];
  radius: number;
  inradius: number;
}

/**
 * A rotation of φ about Y sends local +X to (cos φ, −sin φ) in the (x, z)
 * plane. To lay a piece along (dirX, dirZ) we need cos φ = dirX and
 * sin φ = −dirZ, hence:
 */
const alongX = (dirX: number, dirZ: number) => Math.atan2(-dirZ, dirX);

/** Face a piece's local +Z outward along the given direction. */
const facing = (dirX: number, dirZ: number) => Math.atan2(dirX, dirZ);

export function buildCityWall(): CityWall {
  const segments: WallPiece[] = [];
  const gates: WallPiece[] = [];
  const towers: WallPiece[] = [];

  // The gate faces +Z, which is where the camera starts, so you see it first.
  const gateSide = Math.round((SIDES * 0.25) % SIDES);

  for (let i = 0; i < SIDES; i++) {
    // Midpoint of side i, between corners i and i + 1.
    const mid = ((i + 0.5) / SIDES) * Math.PI * 2;
    const x = Math.cos(mid) * WALL_INRADIUS;
    const z = Math.sin(mid) * WALL_INRADIUS;
    // Tangent at the midpoint, which is the direction the piece must lie along.
    const rotation = alongX(-Math.sin(mid), Math.cos(mid));
    const piece: WallPiece = { position: [x, 0, z], rotation };
    if (i === gateSide) gates.push(piece);
    else segments.push(piece);
  }

  for (let t = 0; t < TOWERS; t++) {
    const corner = Math.round((t * SIDES) / TOWERS) % SIDES;
    const angle = (corner / SIDES) * Math.PI * 2;
    towers.push({
      position: [Math.cos(angle) * WALL_RADIUS, 0, Math.sin(angle) * WALL_RADIUS],
      rotation: facing(Math.cos(angle), Math.sin(angle)),
    });
  }

  return { segments, gates, towers, radius: WALL_RADIUS, inradius: WALL_INRADIUS };
}

/** Where the gate is, so a road can run out through it. */
export function gateCenter(): [number, number, number] {
  const wall = buildCityWall();
  return wall.gates[0]?.position ?? [0, 0, WALL_INRADIUS];
}
