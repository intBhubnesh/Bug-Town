"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Profile } from "@/lib/profile";
import { GROUND_Y } from "@/lib/hex";
import { CHARACTER_ATTACK, CHARACTER_GEAR } from "@/lib/roles";
import { assetPath, useCharacter, useClip } from "./useModel";
import { VILLAGER_HEIGHT } from "./Villager";

const WALK_SPEED = 1.5; // world units per second
const REST_SECONDS = 2.8;
const ARRIVE = 0.2;
/** How far outside a building to stand, so you don't walk into the wall. */
const STANDOFF = 1.25;

// Scratch vectors, reused every frame instead of allocating.
const destination = new THREE.Vector3();
const step = new THREE.Vector3();

export interface Stop {
  moduleId: string;
  name: string;
  position: [number, number, number];
}

/** The bug you've taken on: where its skeleton stands and which way it faces. */
export interface Target {
  bugId: string;
  moduleId: string;
  position: [number, number, number];
  facing: number;
}

/** A canvas-texture sprite: always faces the camera and needs no font file. */
function NameTag({ text, sub }: { text: string; sub: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(13,17,23,0.9)";
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 148, 26);
    ctx.fill();
    ctx.strokeStyle = "#58a6ff";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#e6edf3";
    ctx.font = "bold 56px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(text, 256, 66);
    ctx.fillStyle = "#58a6ff";
    ctx.font = "34px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(sub, 256, 118);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [text, sub]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, 1.45, 0]} scale={[1.35, 0.42, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}

/**
 * You, in the village.
 *
 * Walks a tour of the modules — pick one, walk there, stand and look at it for
 * a few seconds, move on — so there is always somewhere to follow you to. The
 * beacon and the nametag exist because an 0.85-unit character is otherwise
 * impossible to pick out of a village from this camera height.
 *
 * Position lives in a ref and moves every frame; only the walk/idle flag is
 * state, and that changes every few seconds, not every frame.
 */
export function MyVillager({
  profile,
  roleTitle,
  stops,
  target,
  follow,
  onArrive,
  onSelect,
  onHover,
}: {
  profile: Profile;
  roleTitle: string;
  stops: Stop[];
  /** Set when you've taken a bug on: the tour stops and you go fight it. */
  target: Target | null;
  follow: boolean;
  /** Fires with a module id on arrival and null on departure. */
  onArrive: (moduleId: string | null) => void;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}) {
  const { body, scale, animations } = useCharacter(
    assetPath.character(profile.model),
    VILLAGER_HEIGHT,
    { gear: CHARACTER_GEAR[profile.model] },
  );

  const attack = CHARACTER_ATTACK[profile.model];
  const [walking, setWalking] = useState(true);
  // Three states, and the clip is just a function of them: on the way,
  // standing at a module, or swinging at the bug you took on.
  const clipName = walking ? "Walking_A" : target ? attack.clip : "Idle";
  useClip(body, animations, clipName, { fade: 0.3 });

  const group = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const tour = useRef({ index: 0, resting: 0 });

  const controls = useThree((state) => state.controls) as {
    target: THREE.Vector3;
    update: () => void;
  } | null;

  // Start at a different module each reload, so the tour isn't always identical.
  useEffect(() => {
    if (stops.length > 0) tour.current.index = Math.floor(Math.random() * stops.length);
  }, [stops.length]);

  // Taking a bug on interrupts the tour; dropping it resumes.
  useEffect(() => {
    setWalking(true);
    onArrive(null);
  }, [target?.bugId, onArrive]);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    if (!target && stops.length === 0) return;

    if (target) {
      // Square up behind the skeleton, at the reach your weapon allows.
      const back = target.facing + Math.PI;
      destination.set(
        target.position[0] + Math.sin(back) * attack.standoff,
        GROUND_Y,
        target.position[2] + Math.cos(back) * attack.standoff,
      );
    } else {
      const stop = stops[tour.current.index % stops.length];
      destination.set(stop.position[0], GROUND_Y, stop.position[2]);
      // Stand between the building and the village rim rather than in the wall.
      if (destination.lengthSq() > 0.001) {
        step.copy(destination).normalize().multiplyScalar(STANDOFF);
        destination.add(step);
      }
    }

    if (walking) {
      step.copy(destination).sub(g.position);
      const distance = step.length();
      if (distance < ARRIVE) {
        tour.current.resting = REST_SECONDS;
        setWalking(false);
        onArrive(target ? target.moduleId : stops[tour.current.index % stops.length].moduleId);
      } else {
        step.divideScalar(distance); // normalize, reusing the length
        g.position.addScaledVector(step, Math.min(WALK_SPEED * delta, distance));
        g.rotation.y = Math.atan2(step.x, step.z);
      }
    } else if (target) {
      // Stay and fight. Face the skeleton, not the building behind it.
      g.rotation.y = target.facing;
    } else {
      tour.current.resting -= delta;
      // Face the building you are standing at.
      g.rotation.y = Math.atan2(-g.position.x, -g.position.z);
      if (tour.current.resting <= 0) {
        tour.current.index = (tour.current.index + 1) % stops.length;
        setWalking(true);
        onArrive(null);
      }
    }

    if (beacon.current) {
      beacon.current.rotation.z = clock.elapsedTime * 1.1;
      beacon.current.scale.setScalar(0.85 + Math.sin(clock.elapsedTime * 3) * 0.15);
    }

    if (follow && controls) {
      controls.target.lerp(g.position, Math.min(1, delta * 4));
      controls.update();
    }
  });

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <primitive object={body} scale={scale} />

      {/* Beacon: a spinning hex ring and a shaft of light. */}
      <mesh ref={beacon} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.38, 0.52, 6]} />
        <meshBasicMaterial color="#58a6ff" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.05, 0.16, 2.4, 8, 1, true]} />
        <meshBasicMaterial
          color="#58a6ff"
          transparent
          opacity={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <NameTag text={profile.name} sub={roleTitle} />
    </group>
  );
}
