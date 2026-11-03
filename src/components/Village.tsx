"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Clone, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BAND_VARIANT, band } from "@/lib/game";
import { cellToWorld, hash01, GROUND_Y } from "@/lib/hex";
import { footprintFor } from "@/lib/buildings";
import type { ModuleView, TownView } from "@/lib/seed";
import type { Board } from "@/lib/leaderboard";
import type { Profile } from "@/lib/profile";
import { assetPath, useModel } from "./useModel";
import { Attacker, attackerModel, locateBugs, placeAttackers } from "./Attacker";
import { Trophy, useSolvedLabel } from "./Trophy";
import { Fire, Smoke } from "./Effects";
import { Billboard } from "./Billboard";
import { CityWall } from "./CityWall";
import { Ground, type KeepClear } from "./Ground";
import { MyVillager, type Stop } from "./MyVillager";
import { Villager, type Activity } from "./Villager";

const ACCENTS = ["#58a6ff", "#d2a8ff", "#3fb950", "#e3b341", "#ff7b72", "#79c0ff", "#ffa657"];

const xz = ([x, , z]: [number, number, number]) => ({ x, z });

/* ------------------------------ town hall ------------------------------ */

function TownHall({ health }: { health: number }) {
  const hall = useModel(assetPath.townHall);
  const ring = useRef<THREE.Mesh>(null);

  // The clock face on the tower is the project health dial.
  useFrame(({ clock }) => {
    if (ring.current) {
      const m = ring.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 1.6) * 0.25;
    }
  });

  return (
    <group position={cellToWorld([0, 0])}>
      <Clone object={hall.scene} position={[0, hall.lift, 0]} />
      <mesh
        ref={ring}
        position={[0, 0.06, 0]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      >
        <ringGeometry args={[1.08, 1.22, 48, 1, 0, Math.PI * 2 * (health / 100)]} />
        <meshStandardMaterial
          color={band(health) === "healthy" ? "#3fb950" : band(health) === "warning" ? "#d29922" : "#f85149"}
          emissive={band(health) === "healthy" ? "#3fb950" : band(health) === "warning" ? "#d29922" : "#f85149"}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* --------------------------- module building --------------------------- */

function ModuleBuilding({
  module,
  selected,
  engagedBugIds,
  dyingBugIds,
  solvedLabel,
  onHover,
  onSelect,
}: {
  module: ModuleView;
  selected: boolean;
  /** Every bug currently being fought — more than one per module is normal. */
  engagedBugIds: Set<string>;
  /** Bugs playing their death animation, and bugs already resolved. */
  dyingBugIds: Set<string>;
  solvedLabel: THREE.Texture | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const retired = module.state === "retired";
  const building = module.state === "building";
  const url = retired
    ? assetPath.ruin
    : building
      ? assetPath.scaffolding
      : assetPath.building(module.kind, BAND_VARIANT[band(module.health)]);

  const model = useModel(url);
  const flag = useModel(assetPath.flag);
  const [x, , z] = cellToWorld(module.cell);

  // Layout uses the measured table, not this instance, so that the skeletons
  // land in exactly the places `locateBugs` told the villagers they would.
  const footprint = footprintFor(module.kind, module.state);
  const top = model.size.y;

  // One skeleton per open bug, besieging the building. The count is the real
  // open-bug count — nothing is scaled down to keep the picture tidy.
  const mob = useMemo(() => placeAttackers(module.bugs, footprint, hash01), [module.bugs, footprint]);

  // The mob stands outside the walls, so the selection ring has to clear it.
  const ringRadius = footprint * 0.5 + 0.44 + Math.floor((module.bugs.length - 1) / 7) * 0.6 + 0.45;

  return (
    <group
      position={[x, GROUND_Y, z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(module.id);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(module.id);
      }}
    >
      {/* Face the town hall. */}
      <group rotation={[0, Math.atan2(-x, -z), 0]}>
        <Clone object={model.scene} position={[0, model.lift, 0]} />
      </group>

      {mob.map((placement) => {
        const bug = module.bugs.find((b) => b.id === placement.id);
        // A solved bug keeps its spot: its skeleton becomes a skull, so the
        // rest of the mob never shuffles to fill the gap.
        if (bug?.solved && !dyingBugIds.has(placement.id)) {
          return (
            <Trophy
              key={placement.id}
              model={attackerModel(placement.severity)}
              position={placement.position}
              facing={placement.facing}
              label={solvedLabel}
            />
          );
        }
        return (
          <Attacker
            key={placement.id}
            {...placement}
            dimmed={retired}
            engaged={engagedBugIds.has(placement.id)}
            dying={dyingBugIds.has(placement.id)}
          />
        );
      })}

      {/* Under attack smokes. Under 30 health burns. */}
      {module.underAttack && !module.burning && (
        <Smoke
          height={top * 0.85}
          radius={footprint * 0.5}
          density={module.overdueCritical ? 1.8 : 1}
          seed={module.id}
        />
      )}
      {module.burning && <Fire height={top} radius={footprint * 0.42} seed={module.id} />}

      {!retired && !building && (
        <Clone object={flag.scene} position={[footprint * 0.42, 0, -footprint * 0.42]} />
      )}

      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[ringRadius, ringRadius + 0.1, 48]} />
          <meshBasicMaterial color="#58a6ff" transparent opacity={0.85} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/* --------------------------------- scene -------------------------------- */

interface SceneProps {
  town: TownView;
  selectedModule: string | null;
  onHoverModule: (id: string | null) => void;
  onSelectModule: (id: string) => void;
  onHoverDeveloper: (id: string | null) => void;
  onSelectDeveloper: (id: string) => void;
  /** Null until the profile form is done. */
  profile: Profile | null;
  roleTitle: string;
  followMe: boolean;
  onMyLocation: (moduleId: string | null) => void;
  onSelectMe: () => void;
  onHoverMe: (hovering: boolean) => void;
  /** The bug you've taken on, if any. */
  myBugId: string | null;
  /** Bugs mid-death animation. */
  dyingBugIds: Set<string>;
  /** Which board the notice board in the square is showing. */
  board: Board;
  onOpenLeaderboard: () => void;
}

function Scene({
  town,
  selectedModule,
  onHoverModule,
  onSelectModule,
  onHoverDeveloper,
  onSelectDeveloper,
  profile,
  roleTitle,
  followMe,
  onMyLocation,
  onSelectMe,
  onHoverMe,
  myBugId,
  dyingBugIds,
  board,
  onOpenLeaderboard,
}: SceneProps) {
  // Ground the forest must leave open: the town hall, the plaza where a
  // developer at zero HP lies down, and every module — whose skeleton mob
  // needs room around it, so the radius grows with the bug count.
  const keepClear = useMemo<KeepClear[]>(() => {
    const spots: KeepClear[] = [
      { x: 0, z: 0, radius: 3.0 },
      { ...xz(cellToWorld([0, 1])), radius: 1.2 },
    ];
    for (const m of town.modules) {
      const mobRings = Math.floor(Math.max(0, m.bugs.length - 1) / 7);
      spots.push({ ...xz(cellToWorld(m.cell)), radius: 1.9 + mobRings * 0.6 });
    }
    return spots;
  }, [town.modules]);

  // Where every bug's skeleton stands, in world space. Computed from the
  // footprint table so it is known before a single model has loaded, which is
  // what lets a villager walk to one specific bug.
  const bugSpots = useMemo(
    () =>
      locateBugs(
        town.modules.map((m) => ({
          id: m.id,
          cell: m.cell,
          bugs: m.bugs,
          footprint: footprintFor(m.kind, m.state),
        })),
        cellToWorld,
        hash01,
      ),
    [town.modules],
  );

  /** Where each developer is and what they're doing. */
  const activities = useMemo(() => {
    const map = new Map<string, Activity>();
    for (const dev of town.developers) {
      if (dev.hp < 30) {
        map.set(dev.id, { kind: "down", at: cellToWorld([0, 1]) });
        continue;
      }
      // A claim sends you to that exact skeleton, not just to the building.
      const claimed = town.modules
        .flatMap((m) => m.bugs)
        .find((b) => b.claimedBy === dev.id);
      const spot = claimed ? bugSpots.get(claimed.id) : undefined;
      map.set(
        dev.id,
        spot ? { kind: "attacking", at: spot.position, facing: spot.facing } : { kind: "walking" },
      );
    }
    return map;
  }, [town, bugSpots]);

  // Every skeleton a villager is currently fighting, so it can turn around.
  const engagedBugIds = useMemo(() => {
    const ids = new Set<string>();
    for (const bug of town.modules.flatMap((m) => m.bugs)) {
      if (bug.claimedBy && town.developers.some((d) => d.id === bug.claimedBy && d.hp >= 30)) {
        ids.add(bug.id);
      }
    }
    if (myBugId) ids.add(myBugId);
    return ids;
  }, [town, myBugId]);

  const solvedLabel = useSolvedLabel(profile?.name ?? null);

  const myTarget = useMemo(() => {
    if (!myBugId) return null;
    const spot = bugSpots.get(myBugId);
    return spot
      ? { bugId: spot.bugId, moduleId: spot.moduleId, position: spot.position, facing: spot.facing }
      : null;
  }, [myBugId, bugSpots]);

  // Your tour visits the live modules only — walking up to a ruin to admire it
  // isn't informative.
  const stops = useMemo<Stop[]>(
    () =>
      town.modules
        .filter((m) => m.state !== "retired")
        .map((m) => ({ moduleId: m.id, name: m.name, position: cellToWorld(m.cell) })),
    [town.modules],
  );

  return (
    <>
      <color attach="background" args={["#0a0e14"]} />
      {/* Starts beyond the village so buildings stay crisp, and fades the
          treeline into the dark rather than showing the edge of the disc. */}
      <fog attach="fog" args={["#0a0e14", 22, 44]} />

      <hemisphereLight args={["#aecbff", "#1d2415", 0.8]} />
      <directionalLight
        position={[12, 18, 10]}
        intensity={1.6}
        color="#fff2d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />

      <Suspense fallback={null}>
        <Ground keepClear={keepClear} />
        <CityWall />
        {/* In the square between the town hall and the gate, facing the way in. */}
        <Billboard
          developers={town.developers}
          board={board}
          releaseName={town.release.name}
          position={[-2.3, 0, 2.5]}
          rotation={0.42}
          onClick={onOpenLeaderboard}
        />
        <TownHall health={town.health} />
        {town.modules.map((module) => (
          <ModuleBuilding
            key={module.id}
            module={module}
            selected={selectedModule === module.id}
            engagedBugIds={engagedBugIds}
            dyingBugIds={dyingBugIds}
            solvedLabel={solvedLabel}
            onHover={onHoverModule}
            onSelect={onSelectModule}
          />
        ))}
        {town.developers.map((dev, i) => (
          <Villager
            key={dev.id}
            developer={dev}
            activity={activities.get(dev.id) ?? { kind: "walking" }}
            accent={ACCENTS[i % ACCENTS.length]}
            index={i}
            total={town.developers.length}
            onHover={onHoverDeveloper}
            onSelect={onSelectDeveloper}
          />
        ))}
        {profile && (
          <MyVillager
            profile={profile}
            roleTitle={roleTitle}
            stops={stops}
            target={myTarget}
            follow={followMe}
            onArrive={onMyLocation}
            onSelect={onSelectMe}
            onHover={onHoverMe}
          />
        )}
      </Suspense>

      <OrbitControls
        makeDefault
        target={[0, 0.6, 0]}
        minDistance={followMe ? 2.5 : 6}
        maxDistance={34}
        maxPolarAngle={Math.PI / 2.15}
        // Following drives the target itself, and auto-rotate fights a pan.
        enablePan={!followMe}
        autoRotate={!followMe}
        autoRotateSpeed={0.22}
      />
    </>
  );
}

export function Village(props: SceneProps & { onClearSelection: () => void }) {
  const { onClearSelection, ...scene } = props;
  return (
    <Canvas
      // "percentage" is PCFShadowMap. three 0.187 removed PCFSoftShadowMap,
      // which is what r3f's `shadows` boolean still asks for.
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [0, 13, 17], fov: 42 }}
      onPointerMissed={onClearSelection}
      className="cursor-grab active:cursor-grabbing"
    >
      <Scene {...scene} />
    </Canvas>
  );
}
