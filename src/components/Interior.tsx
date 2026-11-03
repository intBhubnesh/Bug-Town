"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BAND_HEX, band } from "@/lib/game";
import { CHARACTER_ATTACK, CHARACTER_GEAR } from "@/lib/roles";
import type { Profile } from "@/lib/profile";
import type { ModuleView } from "@/lib/seed";
import {
  FLOOR_Y,
  WALL_HEIGHT,
  boundsSpan,
  decorateHall,
  decorateRoom,
  interiorBugSpots,
  planInterior,
  type InteriorFeature,
  type PropPlacement,
  type RoomPlan,
} from "@/lib/interior";
import { hash01 } from "@/lib/hex";
import { assetPath, useCharacter, useClip, useMerged } from "./useModel";
import { Attacker, attackerModel } from "./Attacker";
import { Trophy, useSolvedLabel } from "./Trophy";

/** Characters are rendered near native height indoors; walls here are 4 tall. */
const INDOOR_HEIGHT = 1.95;
/** The skeleton table is sized for the village, so scale it up to match. */
const SKELETON_SCALE = 2.1;

/* ----------------------------- architecture ---------------------------- */

function Architecture({ plan }: { plan: ReturnType<typeof planInterior> }) {
  const floors = useMerged(assetPath.dungeon("floor_tile_large"), plan.floors);
  const walls = useMerged(assetPath.dungeon("wall"), plan.walls);
  const doorways = useMerged(assetPath.dungeon("wall_doorway"), plan.doorways);
  const torches = useMerged(assetPath.dungeon("torch_mounted"), plan.torches);

  return (
    <group>
      {floors && <mesh geometry={floors.geometry} material={floors.material} receiveShadow />}
      {walls && <mesh geometry={walls.geometry} material={walls.material} castShadow receiveShadow />}
      {doorways && (
        <mesh geometry={doorways.geometry} material={doorways.material} castShadow receiveShadow />
      )}
      {torches && <mesh geometry={torches.geometry} material={torches.material} />}
      {/* One warm light per torch pair, so rooms read as lit from within. */}
      {plan.torches.map((torch, i) => (
        <pointLight
          key={i}
          position={[torch.position[0], torch.position[1], torch.position[2] - 0.8]}
          color="#ffb45c"
          intensity={26}
          distance={14}
        />
      ))}
    </group>
  );
}

/* -------------------------------- props -------------------------------- */

/** All copies of one prop, baked into a single mesh. */
function PropGroup({ kind, pieces }: { kind: string; pieces: PropPlacement[] }) {
  const merged = useMerged(
    assetPath.dungeon(kind),
    useMemo(() => pieces.map((p) => ({ position: p.position, rotation: p.rotation })), [pieces]),
  );
  if (!merged) return null;
  return <mesh geometry={merged.geometry} material={merged.material} castShadow receiveShadow />;
}

/**
 * Furniture and clutter.
 *
 * Grouped by model, one `PropGroup` per kind — a component each, so the hook
 * count inside any one of them stays fixed however many kinds a room uses.
 */
function Props({ placements }: { placements: PropPlacement[] }) {
  const byKind = useMemo(() => {
    const groups = new Map<string, PropPlacement[]>();
    for (const item of placements) {
      const list = groups.get(item.kind) ?? [];
      list.push(item);
      groups.set(item.kind, list);
    }
    return [...groups.entries()];
  }, [placements]);

  return (
    <group>
      {byKind.map(([kind, pieces]) => (
        <PropGroup key={kind} kind={kind} pieces={pieces} />
      ))}
    </group>
  );
}

/* -------------------------------- signs -------------------------------- */

/** Feature name and health on a board above the door. */
function RoomSign({
  room,
  openCount,
  selected,
}: {
  room: RoomPlan;
  /** Open bugs, not every bug ever placed — a solved one must stop counting. */
  openCount: number;
  selected: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 164;
    const ctx = canvas.getContext("2d")!;
    const colour = BAND_HEX[band(room.health)];
    ctx.fillStyle = "rgba(10,14,20,0.93)";
    ctx.beginPath();
    ctx.roundRect(5, 5, 502, 154, 20);
    ctx.fill();
    ctx.strokeStyle = selected ? "#58a6ff" : colour;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#e6edf3";
    ctx.font = "bold 54px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(room.name, 256, 64);
    ctx.fillStyle = colour;
    ctx.font = "bold 40px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(
      `${Math.round(room.health)} · ${openCount} bug${openCount === 1 ? "" : "s"}`,
      256,
      122,
    );
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [room.name, room.health, openCount, selected]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[room.door[0], WALL_HEIGHT + 1.1, room.door[2]]} scale={[5.2, 1.67, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}

/**
 * A banner on the back wall in the feature's health colour. The pack ships the
 * same banner in green, yellow and red, so a band is a file swap.
 */
function RoomBanner({ room }: { room: RoomPlan }) {
  const colour = band(room.health);
  const file =
    colour === "healthy" ? "banner_green" : colour === "warning" ? "banner_yellow" : "banner_red";
  const pieces = useMemo(
    () => [
      {
        position: [room.center[0], WALL_HEIGHT - 2.1, room.bounds.zMax - 1.05] as [number, number, number],
        rotation: Math.PI,
      },
    ],
    [room.center, room.bounds.zMax],
  );
  const banner = useMerged(assetPath.dungeon(file), pieces);
  if (!banner) return null;
  return <mesh geometry={banner.geometry} material={banner.material} castShadow />;
}

/* ------------------------------ your character ------------------------- */

function You({
  profile,
  target,
  entrance,
}: {
  profile: Profile;
  /** Where the bug you're fighting stands, if any. */
  target: { position: [number, number, number]; facing: number } | null;
  entrance: [number, number, number];
}) {
  const { body, scale, animations } = useCharacter(
    assetPath.character(profile.model),
    INDOOR_HEIGHT,
    { gear: CHARACTER_GEAR[profile.model] },
  );
  const attack = CHARACTER_ATTACK[profile.model];
  const [arrived, setArrived] = useState(false);
  const clip = arrived ? (target ? attack.clip : "Idle") : "Walking_A";
  useClip(body, animations, clip, { fade: 0.3 });

  const group = useRef<THREE.Group>(null);
  const destination = useMemo(() => {
    if (!target) return new THREE.Vector3(entrance[0], FLOOR_Y, entrance[2]);
    // Stand in front of the skeleton, at the reach this character's kit allows.
    const back = target.facing + Math.PI;
    const reach = attack.standoff * 2.1; // dungeon scale
    return new THREE.Vector3(
      target.position[0] + Math.sin(back) * reach,
      FLOOR_Y,
      target.position[2] + Math.cos(back) * reach,
    );
  }, [target, entrance, attack.standoff]);

  // Start at the entrance and walk in.
  useEffect(() => {
    if (group.current && !group.current.userData.placed) {
      group.current.position.set(entrance[0], FLOOR_Y, entrance[2]);
      group.current.userData.placed = true;
    }
    setArrived(false);
  }, [entrance, destination]);

  const step = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    step.copy(destination).sub(g.position);
    const distance = step.length();
    if (distance < 0.25) {
      if (!arrived) setArrived(true);
      g.rotation.y = target ? target.facing : 0;
      return;
    }
    step.divideScalar(distance);
    g.position.addScaledVector(step, Math.min(4.5 * delta, distance));
    g.rotation.y = Math.atan2(step.x, step.z);
  });

  return (
    <group ref={group}>
      <primitive object={body} scale={scale} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.85, 1.15, 6]} />
        <meshBasicMaterial color="#58a6ff" transparent opacity={0.9} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* -------------------------------- scene -------------------------------- */

function Scene({
  module,
  profile,
  myBugId,
  dyingBugIds,
  selectedFeatureId,
  onSelectFeature,
  onHoverBug,
  onSelectBug,
}: {
  module: ModuleView;
  profile: Profile | null;
  myBugId: string | null;
  dyingBugIds: Set<string>;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  onHoverBug: (bugId: string | null) => void;
  onSelectBug: (bugId: string) => void;
}) {
  const plan = useMemo(() => {
    const features: InteriorFeature[] = module.features.map((f) => ({
      id: f.id,
      name: f.name,
      health: f.health,
      ownerName: f.ownerId,
      bugs: f.bugs.map((b) => ({ id: b.id, severity: b.severity })),
    }));
    return planInterior(features);
  }, [module]);

  const spots = useMemo(() => interiorBugSpots(plan), [plan]);

  // Furniture is derived from the plan, so it never clips a skeleton: the
  // decorator is handed the bug positions and refuses to overlap them.
  const decoration = useMemo(
    () => [
      ...plan.rooms.flatMap((room) => decorateRoom(room, hash01)),
      ...decorateHall(plan, hash01),
    ],
    [plan],
  );
  const myTarget = myBugId ? spots.get(myBugId) ?? null : null;

  const span = boundsSpan(plan.bounds);
  const centre = useMemo<[number, number, number]>(
    () => [
      (plan.bounds.xMin + plan.bounds.xMax) / 2,
      0,
      (plan.bounds.zMin + plan.bounds.zMax) / 2,
    ],
    [plan.bounds],
  );

  // Who else is in here: teammates fighting bugs in this module.
  const claimed = useMemo(
    () => module.openBugs.filter((b) => b.claimedBy).map((b) => b.id),
    [module.openBugs],
  );
  const engaged = useMemo(
    () => new Set<string>([...claimed, ...(myBugId ? [myBugId] : [])]),
    [claimed, myBugId],
  );
  const solvedLabel = useSolvedLabel(profile?.name ?? null);

  return (
    <>
      <color attach="background" args={["#0a0d12"]} />
      <fog attach="fog" args={["#0a0d12", span * 1.3, span * 3]} />
      {/* Interiors were far too dark on the first pass: a dungeon kit is
          authored for torchlight, and torches alone leave the floor black.
          Hemisphere fill + a stronger key, with the torches as warm accent. */}
      <hemisphereLight args={["#cfe0ff", "#2b2418", 1.15]} />
      <ambientLight intensity={0.5} color="#b9ccea" />
      <directionalLight
        position={[centre[0] + 14, 30, centre[2] - 10]}
        intensity={1.5}
        color="#ffeedd"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />

      <Suspense fallback={null}>
        <Architecture plan={plan} />
        <Props placements={decoration} />

        {plan.rooms.map((room) => (
          <group key={room.featureId}>
            {/* One soft light per room, so a room is never a black box. */}
            <pointLight
              position={[room.center[0], WALL_HEIGHT - 0.7, room.center[2]]}
              color="#ffd9a8"
              intensity={22}
              distance={Math.max(14, room.bounds.xMax - room.bounds.xMin + 6)}
            />
            <RoomSign
              room={room}
              openCount={
                module.features.find((f) => f.id === room.featureId)?.openBugs.length ?? 0
              }
              selected={selectedFeatureId === room.featureId}
            />
            <RoomBanner room={room} />
            {/* The floor of the room carries its health colour. */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[room.center[0], FLOOR_Y + 0.015, room.center[2]]}
              onPointerOver={(e) => {
                e.stopPropagation();
                onSelectFeature(room.featureId);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectFeature(room.featureId);
              }}
            >
              <planeGeometry
                args={[room.bounds.xMax - room.bounds.xMin - 1.2, room.bounds.zMax - room.bounds.zMin - 1.2]}
              />
              <meshBasicMaterial
                color={BAND_HEX[band(room.health)]}
                transparent
                opacity={selectedFeatureId === room.featureId ? 0.26 : 0.12}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}

        {[...spots.values()].map((spot) => {
          const bug = module.bugs.find((b) => b.id === spot.bugId);
          const dying = dyingBugIds.has(spot.bugId);
          if (bug?.solved && !dying) {
            return (
              <Trophy
                key={spot.bugId}
                model={attackerModel(spot.severity)}
                position={spot.position}
                facing={spot.facing}
                height={0.62}
                label={solvedLabel}
              />
            );
          }
          return (
            <group
              key={spot.bugId}
              onPointerOver={(e) => {
                e.stopPropagation();
                onHoverBug(spot.bugId);
              }}
              onPointerOut={() => onHoverBug(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBug(spot.bugId);
              }}
            >
              <Attacker
                id={spot.bugId}
                severity={spot.severity}
                position={spot.position}
                facing={spot.facing}
                phase={(spot.position[0] * 0.17 + spot.position[2] * 0.29) % 1}
                engaged={engaged.has(spot.bugId)}
                dying={dying}
                heightScale={SKELETON_SCALE}
              />
            </group>
          );
        })}

        {profile && (
          <You
            profile={profile}
            target={myTarget ? { position: myTarget.position, facing: myTarget.facing } : null}
            entrance={plan.hall.entrance}
          />
        )}
      </Suspense>

      <OrbitControls
        makeDefault
        target={centre}
        minDistance={span * 0.35}
        maxDistance={span * 1.9}
        maxPolarAngle={Math.PI / 2.3}
      />
    </>
  );
}

export function Interior(props: {
  module: ModuleView;
  profile: Profile | null;
  myBugId: string | null;
  dyingBugIds: Set<string>;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  onHoverBug: (bugId: string | null) => void;
  onSelectBug: (bugId: string) => void;
}) {
  // The plan starts at the origin and grows right, so it isn't centred there.
  // Without this offset the opening shot looks at the corner of the building.
  const { span, camera } = useMemo(() => {
    const features: InteriorFeature[] = props.module.features.map((f) => ({
      id: f.id,
      name: f.name,
      health: f.health,
      ownerName: f.ownerId,
      bugs: f.bugs.map((b) => ({ id: b.id, severity: b.severity })),
    }));
    const { bounds } = planInterior(features);
    const reach = boundsSpan(bounds);
    return {
      span: reach,
      camera: [
        (bounds.xMin + bounds.xMax) / 2,
        reach * 0.8,
        (bounds.zMin + bounds.zMax) / 2 + reach * 0.9,
      ] as [number, number, number],
    };
  }, [props.module]);

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: camera, fov: 40 }}
      onPointerMissed={() => props.onSelectFeature(null)}
      className="cursor-grab active:cursor-grabbing"
    >
      <Scene {...props} />
    </Canvas>
  );
}
