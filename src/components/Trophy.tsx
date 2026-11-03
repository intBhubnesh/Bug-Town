"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { assetPath } from "./useModel";

/** Skull, jaw and eye sockets — the pieces of a skeleton's head. */
const HEAD = /(_Skull|_Head|_Jaw|_Eyes)$/i;

/**
 * A skull left where a bug died.
 *
 * None of the three packs ships a skull prop, but every skeleton GLB has its
 * own skull, jaw and eyes as separately named meshes. So this loads the model
 * the bug was, hides everything except the head, measures what's left and drops
 * it onto the floor — the same art, the same atlas, no new asset.
 */
function useSkull(model: string, targetHeight: number) {
  const { scene } = useGLTF(assetPath.skeleton(model));

  return useMemo(() => {
    const body = cloneSkinned(scene);
    const bounds = new THREE.Box3();
    body.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const keep = HEAD.test(mesh.name);
      mesh.visible = keep;
      mesh.castShadow = keep;
      if (keep) {
        mesh.frustumCulled = false;
        bounds.expandByObject(mesh);
      }
    });
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const scale = size.y > 0.01 ? targetHeight / size.y : 0.3;
    // The head sits at head height in the bind pose; drop it to the ground.
    return { body, scale, lift: -bounds.min.y * scale };
  }, [scene, targetHeight]);
}

/**
 * The marker left behind when you resolve a bug: its skull, on its back, where
 * it stood. Proof of the fix, in the place the problem was.
 */
export function Trophy({
  model,
  position,
  facing,
  /** Village scale by default; interiors pass a larger size. */
  height = 0.3,
  label,
}: {
  model: string;
  position: [number, number, number];
  facing: number;
  height?: number;
  label?: THREE.Texture | null;
}) {
  const { body, scale, lift } = useSkull(model, height);
  const halo = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (halo.current) {
      const pulse = 0.9 + Math.sin(clock.elapsedTime * 1.6) * 0.1;
      halo.current.scale.setScalar(pulse);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + (pulse - 0.9) * 1.2;
    }
  });

  return (
    <group position={position} rotation={[0, facing, 0]}>
      {/* Tipped onto its side, so it reads as a trophy and not a live enemy. */}
      <group position={[0, lift * 0.7, 0]} rotation={[-0.5, 0.3, 0.25]}>
        <primitive object={body} scale={scale} />
      </group>

      {/* A quiet green ring: this ground is cleared. */}
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[height * 0.9, height * 1.25, 24]} />
        <meshBasicMaterial color="#3fb950" transparent opacity={0.35} toneMapped={false} />
      </mesh>

      {label && (
        <sprite position={[0, height * 2.4, 0]} scale={[height * 7, height * 1.9, 1]}>
          <spriteMaterial map={label} transparent depthTest={false} toneMapped={false} />
        </sprite>
      )}
    </group>
  );
}

/**
 * "Solved by <name>" on a small plaque. One texture shared by every trophy,
 * since they all say the same thing.
 */
export function useSolvedLabel(name: string | null): THREE.Texture | null {
  const texture = useMemo(() => {
    if (!name) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 560;
    canvas.height = 152;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(13,17,23,0.9)";
    ctx.beginPath();
    ctx.roundRect(6, 6, 548, 140, 26);
    ctx.fill();
    ctx.strokeStyle = "#3fb950";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3fb950";
    ctx.font = "bold 46px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("✓ SOLVED", 280, 52);
    ctx.fillStyle = "#e6edf3";
    ctx.font = "36px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(`by ${name}`, 280, 106);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [name]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}
