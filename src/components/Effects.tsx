"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hash01 } from "@/lib/hex";

/**
 * Rising smoke. Shown whenever a module has open bugs — a building with
 * skeletons on it should look like it is taking damage even at a glance, and
 * density scales with how many.
 */
export function Smoke({
  height,
  radius,
  density = 1,
  seed,
}: {
  height: number;
  radius: number;
  density?: number;
  seed: string;
}) {
  const group = useRef<THREE.Group>(null);
  const count = Math.max(4, Math.min(12, Math.round(5 * density)));

  const puffs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (hash01(`sx:${seed}:${i}`) - 0.5) * radius,
        z: (hash01(`sz:${seed}:${i}`) - 0.5) * radius,
        size: 0.13 + hash01(`ss:${seed}:${i}`) * 0.1,
        offset: i / count,
        drift: (hash01(`sd:${seed}:${i}`) - 0.5) * 0.5,
      })),
    [count, radius, seed],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const puff = puffs[i];
      if (!puff) return;
      const p = (clock.elapsedTime * 0.23 + puff.offset) % 1;
      child.position.set(puff.x + puff.drift * p, height + p * 2.4, puff.z + puff.drift * p * 0.6);
      child.scale.setScalar(0.4 + p * 1.8);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      // Fade in fast, out slow, so puffs don't pop into existence.
      material.opacity = 0.3 * Math.min(1, p * 6) * (1 - p);
    });
  });

  return (
    <group ref={group}>
      {puffs.map((puff, i) => (
        <mesh key={i}>
          <sphereGeometry args={[puff.size, 7, 5]} />
          <meshBasicMaterial color="#5a5a66" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

const FLAME_COLORS = ["#ff4a1c", "#ff7b29", "#ffab3d", "#ffd05c"];

/**
 * Fire, for a module whose health has fallen under 30. Deliberately loud: this
 * is the one state that should make someone put their coffee down.
 *
 * ponytail: additive cones, no particle system and no texture. Looks right at
 * this camera distance; swap for a shader or a sprite sheet only if someone
 * actually flies the camera down to street level.
 */
export function Fire({
  height,
  radius,
  seed,
}: {
  height: number;
  radius: number;
  seed: string;
}) {
  const flames = useRef<THREE.Group>(null);
  const embers = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);

  const tongues = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: (hash01(`fx:${seed}:${i}`) - 0.5) * radius * 1.5,
        z: (hash01(`fz:${seed}:${i}`) - 0.5) * radius * 1.5,
        y: hash01(`fy:${seed}:${i}`) * height * 0.75,
        size: 0.17 + hash01(`fs:${seed}:${i}`) * 0.16,
        speed: 5 + hash01(`fv:${seed}:${i}`) * 7,
        phase: hash01(`fp:${seed}:${i}`) * Math.PI * 2,
        color: FLAME_COLORS[i % FLAME_COLORS.length],
      })),
    [height, radius, seed],
  );

  const sparks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: (hash01(`ex:${seed}:${i}`) - 0.5) * radius * 1.4,
        z: (hash01(`ez:${seed}:${i}`) - 0.5) * radius * 1.4,
        offset: i / 14,
        rise: 1.4 + hash01(`er:${seed}:${i}`) * 1.4,
      })),
    [radius, seed],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    flames.current?.children.forEach((child, i) => {
      const tongue = tongues[i];
      if (!tongue) return;
      // Two out-of-step sines: one fast flicker, one slow breath.
      const flicker = 0.68 + Math.sin(t * tongue.speed + tongue.phase) * 0.22 + Math.sin(t * 1.7 + tongue.phase) * 0.12;
      child.scale.set(flicker * 0.85, flicker * 1.5, flicker * 0.85);
      child.position.y = tongue.y + Math.sin(t * tongue.speed * 0.5 + tongue.phase) * 0.05;
      child.rotation.y = t * 0.8 + tongue.phase;
    });

    embers.current?.children.forEach((child, i) => {
      const spark = sparks[i];
      if (!spark) return;
      const p = (t * 0.42 + spark.offset) % 1;
      child.position.set(
        spark.x + Math.sin(t * 2 + spark.offset * 9) * 0.14,
        height * 0.3 + p * spark.rise,
        spark.z + Math.cos(t * 1.7 + spark.offset * 7) * 0.14,
      );
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = (1 - p) * 0.9;
    });

    if (light.current) {
      light.current.intensity = 7 + Math.sin(t * 11) * 2.4 + Math.sin(t * 3.3) * 1.4;
    }
  });

  return (
    <group>
      <group ref={flames}>
        {tongues.map((tongue, i) => (
          <mesh key={i} position={[tongue.x, tongue.y, tongue.z]}>
            <coneGeometry args={[tongue.size, tongue.size * 2.8, 7, 1, true]} />
            <meshBasicMaterial
              color={tongue.color}
              transparent
              opacity={0.78}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <group ref={embers}>
        {sparks.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.028, 5, 4]} />
            <meshBasicMaterial
              color="#ffc14d"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <pointLight ref={light} position={[0, height * 0.5, 0]} color="#ff6a2a" intensity={7} distance={radius * 7} />
      {/* Heavy black smoke on top of the ordinary damage smoke. */}
      <Smoke height={height * 0.85} radius={radius} density={2} seed={`fire:${seed}`} />
    </group>
  );
}
