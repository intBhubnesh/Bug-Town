"use client";

import { useMemo } from "react";
import { buildCityWall } from "@/lib/citywall";
import { assetPath, useMerged } from "./useModel";

/**
 * The wall around the village.
 *
 * Three merged meshes — segments, the gatehouse, the towers — so the whole
 * fortification is three draw calls regardless of how many pieces it takes.
 * Geometry comes from `citywall.ts`, which lays it out as a regular polygon
 * whose side length is exactly the length of one `wall_straight` piece, so the
 * ring closes with no gaps and nothing overlapping.
 */
export function CityWall() {
  const wall = useMemo(() => buildCityWall(), []);

  const segments = useMerged(assetPath.cityWall, wall.segments);
  const gates = useMerged(assetPath.cityGate, wall.gates);
  const towers = useMerged(assetPath.cityTower, wall.towers);

  return (
    <group>
      {segments && (
        <mesh geometry={segments.geometry} material={segments.material} castShadow receiveShadow />
      )}
      {gates && <mesh geometry={gates.geometry} material={gates.material} castShadow receiveShadow />}
      {towers && (
        <mesh geometry={towers.geometry} material={towers.material} castShadow receiveShadow />
      )}
    </group>
  );
}
