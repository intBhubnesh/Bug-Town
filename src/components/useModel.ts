"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface Model {
  scene: THREE.Object3D;
  /** Bounding box size in world units. */
  size: THREE.Vector3;
  /**
   * Lift needed so the model's lowest point sits on the ground. A few KayKit
   * buildings (watermill, windmill) are authored sunk into their tile, so
   * measuring beats keeping a per-asset offset table.
   */
  lift: number;
}

/** Load a glTF prop, turn shadows on once, and measure it. */
export function useModel(url: string): Model {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    const boxed = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    boxed.getSize(size);
    return { scene, size, lift: -boxed.min.y };
  }, [scene]);
}

/**
 * Hats, capes, hoods and helmets are worth keeping; the pile of swords,
 * shields, axes, mugs and spellbooks is not.
 */
const COSMETIC = /(Hat|Cape|Hood|Helmet)$/i;

/**
 * Load one instance of a rigged KayKit character, scaled to `targetHeight`.
 *
 * Two things none of the packs do for you, and both bite silently:
 *
 * 1. Every character GLB ships its gear as *unskinned* sibling nodes that are
 *    all visible by default — render a Knight as-is and he holds two swords and
 *    four shields at once. Cosmetics stay on; pass `gear` with the node names
 *    of the weapon and shield this character should actually carry.
 * 2. The bind-pose bounding box includes that gear, so it cannot be used for
 *    scaling. Measuring only the skinned body meshes gives the real height
 *    (~2.2 units, feet at y = 0, consistent across all three packs).
 */
export function useCharacter(
  url: string,
  targetHeight: number,
  options: { castShadow?: boolean; gear?: string[] } = {},
) {
  const { scene, animations } = useGLTF(url);
  const { castShadow = true, gear } = options;
  // Stable key so the memo doesn't rebuild on a fresh array each render.
  const gearKey = gear ? gear.join("|") : "";

  const { body, scale } = useMemo(() => {
    // Each instance needs its own skeleton, so a plain Object3D.clone() won't do.
    const body = cloneSkinned(scene);
    const bounds = new THREE.Box3();
    body.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        mesh.castShadow = castShadow;
        mesh.frustumCulled = false; // skinned bounds lie; culling pops limbs off
        bounds.expandByObject(mesh);
      } else {
        // Cosmetics always, plus whatever kit this character is carrying.
        mesh.visible = COSMETIC.test(mesh.name) || (gear?.includes(mesh.name) ?? false);
        mesh.castShadow = castShadow && mesh.visible;
      }
    });
    const size = new THREE.Vector3();
    bounds.getSize(size);
    // 0.4 is the fallback if a pack ever ships a body we can't measure.
    return { body, scale: size.y > 0.1 ? targetHeight / size.y : 0.4 };
    // gear is read but intentionally not a dep: callers pass a fresh array
    // every render, and gearKey already captures its contents.
  }, [scene, targetHeight, castShadow, gearKey]);

  return { body, scale, animations };
}

/**
 * Play one named clip on a character, crossfading when the name changes.
 *
 * Deliberately not drei's `useAnimations`: it eagerly builds an
 * `AnimationAction` for every clip in the file, and these packs ship 52–76 of
 * them. Across a town of thirty-odd skeletons that is well over a thousand
 * actions to play one swing each. This creates exactly the ones used.
 *
 * `speed` scales the whole mixer (0 freezes, 0.2 is slow motion); `timeScale`
 * scales just this clip; `startAt` is a 0–1 offset into the clip so a crowd
 * doesn't move in lockstep.
 */
export function useClip(
  body: THREE.Object3D,
  animations: THREE.AnimationClip[],
  name: string,
  options: {
    timeScale?: number;
    startAt?: number;
    speed?: number;
    fade?: number;
    /** Play once and hold the last frame — for a death, which doesn't loop. */
    once?: boolean;
  } = {},
) {
  const { timeScale = 1, startAt, speed = 1, fade = 0.3, once = false } = options;
  const mixer = useMemo(() => new THREE.AnimationMixer(body), [body]);
  const previous = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const clip = THREE.AnimationClip.findByName(animations, name) ?? animations[0];
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.timeScale = timeScale;
    if (once) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    if (startAt !== undefined) action.time = startAt * clip.duration;

    // crossFadeFrom already fades the outgoing clip out, so there is nothing
    // to undo on cleanup — and the mixer dies with the component anyway.
    const outgoing = previous.current;
    if (outgoing && outgoing !== action) {
      action.reset().crossFadeFrom(outgoing, fade, true).play();
    } else {
      action.reset().fadeIn(fade).play();
    }
    previous.current = action;
  }, [mixer, animations, name, timeScale, startAt, fade, once]);

  useFrame((_, delta) => mixer.update(delta * speed));

  return mixer;
}

export interface MergedPiece {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}

/**
 * One model repeated many times, baked into a single static geometry.
 *
 * Modular kits are all repeats — 60 floor tiles and 80 wall segments from two
 * files — and none of it ever moves. Merging turns 140 draw calls into 2. Only
 * use it for geometry that never animates; a merged mesh has no parts left.
 */
export function useMerged(url: string, pieces: MergedPiece[]) {
  const { scene } = useGLTF(url);
  // Pieces are rebuilt on every render; their contents are what matter.
  const key = useMemo(
    () => pieces.map((p) => `${p.position.join(",")}|${p.rotation ?? 0}|${p.scale ?? 1}`).join(";"),
    [pieces],
  );

  const merged = useMemo(() => {
    const source = scene.getObjectByProperty("isMesh", true) as THREE.Mesh | undefined;
    if (!source || pieces.length === 0) return null;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const parts: THREE.BufferGeometry[] = [];

    for (const piece of pieces) {
      position.set(piece.position[0], piece.position[1], piece.position[2]);
      quaternion.setFromAxisAngle(axis, piece.rotation ?? 0);
      scale.setScalar(piece.scale ?? 1);
      matrix.compose(position, quaternion, scale);
      const part = source.geometry.clone();
      part.applyMatrix4(matrix);
      parts.push(part);
    }
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    const material = source.material as THREE.Material;
    if ("map" in material && (material as THREE.MeshStandardMaterial).map) {
      (material as THREE.MeshStandardMaterial).map!.colorSpace = THREE.SRGBColorSpace;
    }
    return { geometry, material };
    // `pieces` is read but keyed by `key`, which captures its contents.
  }, [scene, key]);

  useEffect(() => () => merged?.geometry?.dispose(), [merged]);

  return merged;
}

export const assetPath = {
  townHall: "/assets/hex/buildings/blue/building_castle_blue.gltf",
  ruin: "/assets/hex/buildings/neutral/building_destroyed.gltf",
  scaffolding: "/assets/hex/buildings/neutral/building_scaffolding.gltf",
  flag: "/assets/hex/decoration/props/flag_blue.gltf",
  cityWall: "/assets/hex/buildings/neutral/wall_straight.gltf",
  cityGate: "/assets/hex/buildings/neutral/wall_straight_gate.gltf",
  cityTower: "/assets/hex/buildings/blue/building_tower_base_blue.gltf",
  building: (kind: string, variant: "green" | "yellow" | "red") =>
    `/assets/hex/buildings/${variant}/${kind}_${variant}.gltf`,
  /** KayKit Adventurers — one per developer using the platform. */
  character: (model: string) => `/assets/characters/${model}.glb`,
  /** KayKit Skeletons — one per open bug, besieging the module it lives in. */
  skeleton: (model: string) => `/assets/skeletons/${model}.glb`,
  /** Weapons are separate models you attach to the rig's `handslot` bones. */
  skeletonWeapon: (name: string) => `/assets/skeletons/weapons/${name}.gltf`,
  /** KayKit Dungeon Remastered — the rooms inside a module. */
  dungeon: (name: string) => `/assets/dungeon/${name}.glb`,
};
