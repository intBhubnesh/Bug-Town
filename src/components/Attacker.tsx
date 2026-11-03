"use client";

import { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEVERITY_HEX, type Severity } from "@/lib/game";
import { assetPath, useCharacter, useClip } from "./useModel";

/**
 * One skeleton per open bug, chosen so severity reads from across the village:
 * a Critical is a Warrior swinging a two-handed axe, a Low is a bare-fisted
 * Minion. All four skeletons share one rig and 52 clips, so only the model, the
 * weapon, the swing and the size change per severity.
 */
const ATTACKER: Record<
  Severity,
  { model: string; clip: string; height: number; swing: number; weapon?: string }
> = {
  critical: {
    model: "Skeleton_Warrior",
    clip: "2H_Melee_Attack_Chop",
    height: 1.0,
    swing: 0.95,
    weapon: "Skeleton_Axe",
  },
  high: {
    model: "Skeleton_Rogue",
    clip: "1H_Melee_Attack_Slice_Diagonal",
    height: 0.85,
    swing: 1.15,
    weapon: "Skeleton_Blade",
  },
  medium: {
    model: "Skeleton_Mage",
    clip: "1H_Melee_Attack_Stab",
    height: 0.74,
    swing: 0.9,
    weapon: "Skeleton_Staff",
  },
  // No weapon, so it gets the unarmed clip — a Low bug is a nuisance, not a siege.
  low: { model: "Skeleton_Minion", clip: "Unarmed_Melee_Attack_Punch_A", height: 0.64, swing: 0.8 },
};

/** The skeletons ship a crumble-to-the-floor death; use it when a bug is fixed. */
export const DEATH_CLIP = "Death_C_Skeletons";
/** Long enough for the clip to land before the skull replaces it. */
export const DEATH_MS = 2000;

/** Which model stands in for a severity — the skull has to match the body. */
export const attackerModel = (severity: Severity) => ATTACKER[severity].model;
export const attackerHeight = (severity: Severity) => ATTACKER[severity].height;

/** The rig ships `handslot.l` / `handslot.r` bones for exactly this. */
function Weapon({ body, model }: { body: THREE.Object3D; model: string }) {
  const { scene } = useGLTF(assetPath.skeletonWeapon(model));

  useEffect(() => {
    const socket = body.getObjectByName("handslot.r");
    if (!socket) return;
    const held = scene.clone(true);
    held.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = false;
    });
    socket.add(held);
    return () => void socket.remove(held);
  }, [body, scene]);

  return null;
}

export interface AttackerPlacement {
  id: string;
  severity: Severity;
  /** Ground position relative to the building's centre. */
  position: [number, number, number];
  /** Y rotation so it faces the wall it is hitting. */
  facing: number;
  /** 0–1, offsets the swing so a crowd doesn't chop in unison. */
  phase: number;
}

export function Attacker({
  severity,
  position,
  facing,
  phase,
  dimmed,
  engaged,
  dying,
  heightScale = 1,
}: AttackerPlacement & {
  dimmed?: boolean;
  engaged?: boolean;
  /** Playing its death animation, on the way to becoming a skull. */
  dying?: boolean;
  heightScale?: number;
}) {
  const spec = ATTACKER[severity];
  // ponytail: skeletons don't cast shadows. Thirty-odd of them at nine skinned
  // meshes each would double the shadow pass for detail nobody reads from this
  // camera height. Turn it on per-severity if the village ever gets small.
  // The dungeon pack is ~2.6× the village, so indoors everything scales up.
  const { body, scale, animations } = useCharacter(
    assetPath.skeleton(spec.model),
    spec.height * heightScale,
    { castShadow: false },
  );

  // `startAt` scatters the swing so the siege reads as a mob, not a chorus line.
  // Skeletons on a retired module stand down rather than keep hitting a ruin.
  useClip(body, animations, dying ? DEATH_CLIP : spec.clip, {
    timeScale: dying ? 1 : spec.swing,
    startAt: dying ? 0 : phase,
    speed: dimmed && !dying ? 0.2 : 1,
    once: dying,
    fade: dying ? 0.12 : 0.3,
  });

  const group = useRef<THREE.Group>(null);

  // A skeleton someone is fighting turns away from the wall to face them,
  // so the pair reads as a duel rather than two things ignoring each other.
  const heading = engaged ? facing + Math.PI : facing;

  useFrame(({ clock }) => {
    if (!group.current) return;
    // A dying skeleton stops swaying — it's falling over.
    if (dying) {
      group.current.rotation.y = heading;
      return;
    }
    // Lean into the swing; a bare looped clip reads as mechanical.
    const t = clock.elapsedTime * spec.swing + phase * Math.PI * 2;
    group.current.rotation.y = heading + Math.sin(t * 1.6) * 0.07;
  });

  return (
    <group ref={group} position={position} rotation={[0, heading, 0]}>
      <primitive object={body} scale={scale} />
      {spec.weapon && <Weapon body={body} model={spec.weapon} />}
      {/* Severity colour on the ground, so a wide shot still sorts the mob. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025 * heightScale, 0]}>
        <circleGeometry args={[spec.height * heightScale * 0.32, 18]} />
        <meshBasicMaterial
          color={dying ? "#3fb950" : engaged ? "#58a6ff" : SEVERITY_HEX[severity]}
          transparent
          opacity={dimmed ? 0.12 : engaged || dying ? 0.75 : 0.45}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Lay a mob around a building. Rings of seven, pushed outward as the crowd
 * grows, so nine bugs genuinely look worse than two instead of collapsing into
 * one silhouette.
 */
export function placeAttackers(
  bugs: { id: string; severity: Severity }[],
  footprint: number,
  hash: (seed: string) => number,
): AttackerPlacement[] {
  const perRing = 7;
  const inner = footprint * 0.5 + 0.44;

  return bugs.map((bug, i) => {
    const ring = Math.floor(i / perRing);
    const slot = i % perRing;
    const radius = inner + ring * 0.6;
    // Stagger alternate rings so the back row shows between the front row.
    const jitter = (hash(`jit:${bug.id}`) - 0.5) * 0.28;
    const angle = ((slot + (ring % 2 ? 0.5 : 0)) / perRing) * Math.PI * 2 + jitter;
    return {
      id: bug.id,
      severity: bug.severity,
      position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
      // Face the building at the centre: atan2 of the direction back to origin.
      facing: Math.atan2(-Math.cos(angle), -Math.sin(angle)),
      phase: hash(`ph:${bug.id}`),
    };
  });
}

export interface BugSpot {
  bugId: string;
  moduleId: string;
  /** World position of the skeleton standing in for this bug. */
  position: [number, number, number];
  /** The skeleton's facing — toward the wall. Its attacker comes from behind. */
  facing: number;
}

/**
 * Where every bug's skeleton stands, in world space.
 *
 * The same `placeAttackers` maths the buildings use, resolved to world
 * coordinates so a villager can walk over and fight one specific bug. Computed
 * from the footprint table rather than a loaded model, so it is available
 * before any asset resolves.
 */
export function locateBugs(
  modules: { id: string; cell: [number, number]; bugs: { id: string; severity: Severity }[]; footprint: number }[],
  cellToWorld: (cell: [number, number]) => [number, number, number],
  hash: (seed: string) => number,
): Map<string, BugSpot> {
  const spots = new Map<string, BugSpot>();
  for (const module of modules) {
    const [ox, , oz] = cellToWorld(module.cell);
    for (const placement of placeAttackers(module.bugs, module.footprint, hash)) {
      spots.set(placement.id, {
        bugId: placement.id,
        moduleId: module.id,
        position: [ox + placement.position[0], placement.position[1], oz + placement.position[2]],
        facing: placement.facing,
      });
    }
  }
  return spots;
}
