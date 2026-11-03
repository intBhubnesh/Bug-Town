"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash01 } from "@/lib/hex";
import { NATURE_KINDS, PATH_RADIUS, buildTerrain, scatterNature, type NatureKind } from "@/lib/terrain";

export interface KeepClear {
  x: number;
  z: number;
  radius: number;
}

const naturePath = (kind: NatureKind) => `/assets/hex/decoration/nature/${kind}.gltf`;

/** One continuous rolling disc of grass with the ring road worn into it. */
function Terrain() {
  const geometry = useMemo(() => {
    const { positions, colors, indices } = buildTerrain();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      {/* Flat shading keeps the faceted low-poly look of the asset packs. */}
      <meshStandardMaterial vertexColors flatShading roughness={0.95} />
    </mesh>
  );
}

/**
 * Every tree and rock, baked into one geometry.
 *
 * All thirteen nature models share a single material and one texture atlas, and
 * the forest never changes — so merging ~200 placements into one static mesh
 * costs one draw call instead of two hundred.
 */
function Forest({ keepClear }: { keepClear: KeepClear[] }) {
  // Hooks can't run in a loop, so the list of kinds is fixed and loaded at once.
  const gltfs = useGLTF(NATURE_KINDS.map(naturePath));

  const baked = useMemo(() => {
    const sources = new Map<NatureKind, THREE.Mesh>();
    NATURE_KINDS.forEach((kind, i) => {
      const mesh = gltfs[i]?.scene.getObjectByProperty("isMesh", true) as THREE.Mesh | undefined;
      if (mesh) sources.set(kind, mesh);
    });
    if (sources.size === 0) return null;

    const parts: THREE.BufferGeometry[] = [];
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();

    // Trees stop at the ring road: the city wall stands just beyond it, and a
    // grove at the clearing edge would grow straight through the stonework.
    for (const item of scatterNature(keepClear, hash01, PATH_RADIUS - 0.7)) {
      const source = sources.get(item.kind);
      if (!source) continue;
      position.set(item.position[0], item.position[1], item.position[2]);
      quaternion.setFromAxisAngle(axis, item.rotation);
      scale.setScalar(item.scale);
      matrix.compose(position, quaternion, scale);
      const part = source.geometry.clone();
      part.applyMatrix4(matrix);
      parts.push(part);
    }
    if (parts.length === 0) return null;

    const geometry = mergeGeometries(parts, false);
    // The clones were only scaffolding for the merge.
    for (const part of parts) part.dispose();
    const first = sources.values().next().value as THREE.Mesh;
    return { geometry, material: first.material as THREE.Material, count: parts.length };
  }, [gltfs, keepClear]);

  useEffect(() => () => baked?.geometry?.dispose(), [baked]);

  if (!baked?.geometry) return null;
  return <mesh geometry={baked.geometry} material={baked.material} castShadow receiveShadow />;
}

export function Ground({ keepClear }: { keepClear: KeepClear[] }) {
  return (
    <group>
      <Terrain />
      <Forest keepClear={keepClear} />
    </group>
  );
}
