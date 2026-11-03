"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { assetPath, useCharacter, useClip } from "./useModel";
import type { Developer } from "@/lib/seed";
import { GROUND_Y } from "@/lib/hex";
import { CHARACTER_ATTACK, CHARACTER_GEAR } from "@/lib/roles";

/** Villager height in world units. Homes in the pack are 0.9–1.3 tall. */
export const VILLAGER_HEIGHT = 0.85;
const WALK_RADIUS = 7.4;

export type Activity =
  | { kind: "walking" }
  /** Fighting the skeleton that stands for the bug they claimed. */
  | { kind: "attacking"; at: [number, number, number]; facing: number }
  | { kind: "down"; at: [number, number, number] };

/**
 * One developer. What they're doing is visible from across the village:
 * walking the ring means idle, kneeling at a building means they hold a claim
 * on a bug there, lying down means their HP hit the floor.
 */
export function Villager({
  developer,
  activity,
  accent,
  index,
  total,
  onHover,
  onSelect,
}: {
  developer: Developer;
  activity: Activity;
  accent: string;
  index: number;
  total: number;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { body, scale, animations } = useCharacter(
    assetPath.character(developer.model),
    VILLAGER_HEIGHT,
    { gear: CHARACTER_GEAR[developer.model] },
  );

  const attack = CHARACTER_ATTACK[developer.model];
  const clipName =
    activity.kind === "down" ? "Lie_Idle" : activity.kind === "attacking" ? attack.clip : "Walking_A";
  useClip(body, animations, clipName, { fade: 0.35 });

  const group = useRef<THREE.Group>(null);
  const spoke = (index / Math.max(1, total)) * Math.PI * 2;

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (activity.kind === "walking") {
      const a = spoke + clock.elapsedTime * 0.09;
      g.position.set(Math.cos(a) * WALK_RADIUS, GROUND_Y, Math.sin(a) * WALK_RADIUS);
      g.rotation.y = -a + Math.PI / 2;
    } else if (activity.kind === "attacking") {
      // Square up against the skeleton: it faces the wall, so its attacker
      // stands behind it at the reach their weapon allows.
      const [x, , z] = activity.at;
      const back = activity.facing + Math.PI;
      g.position.set(
        x + Math.sin(back) * attack.standoff,
        GROUND_Y,
        z + Math.cos(back) * attack.standoff,
      );
      g.rotation.y = activity.facing;
    } else {
      // Flat out in the plaza.
      const [x, , z] = activity.at;
      g.position.set(x, GROUND_Y, z);
      g.rotation.y = Math.atan2(-x, -z);
    }
  });

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(developer.id);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(developer.id);
      }}
    >
      <primitive object={body} scale={scale} />
      {/* A pad underfoot makes an 0.85-unit person findable in a wide shot. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial
          color={developer.hp < 30 ? "#f85149" : accent}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}
