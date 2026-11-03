"use client";

import { useCallback, useMemo, useState } from "react";
import { Village } from "@/components/Village";
import { Interior } from "@/components/Interior";
import { LeaderboardPopup } from "@/components/LeaderboardPopup";
import { ProfileForm } from "@/components/ProfileForm";
import {
  Card,
  DeveloperPanel,
  FeatureRooms,
  HoverTip,
  InteriorBar,
  Leaderboard,
  Legend,
  MeCard,
  MePanel,
  ModuleList,
  ModulePanel,
  ProjectBar,
  SolvedCard,
  TaskCard,
  useElapsedHours,
} from "@/components/Hud";
import { buildTown } from "@/lib/seed";
import { DEATH_MS } from "@/components/Attacker";
import { useProfile } from "@/lib/profile";
import { roleById } from "@/lib/roles";
import type { Board } from "@/lib/leaderboard";

type SidePanel = "modules" | "team";
type Selection =
  | { kind: "module"; id: string }
  | { kind: "developer"; id: string }
  | { kind: "me" }
  | null;

export default function Home() {
  /** Bugs you've resolved this session. Local only; nothing is persisted. */
  const [solvedIds, setSolvedIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  /** Mid-death-animation, after which the skeleton becomes a skull. */
  const [dyingIds, setDyingIds] = useState<ReadonlySet<string>>(() => new Set<string>());

  // Health is derived, so resolving a bug recomputes the whole town: the
  // feature heals, the module's roof may change colour, the fire may go out.
  const town = useMemo(() => buildTown(solvedIds), [solvedIds]);
  const elapsed = useElapsedHours();
  const { profile, ready, save, clear } = useProfile();

  const [editingProfile, setEditingProfile] = useState(false);
  const [panel, setPanel] = useState<SidePanel>("modules");
  const [selection, setSelection] = useState<Selection>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [hoveredDeveloper, setHoveredDeveloper] = useState<string | null>(null);
  const [followMe, setFollowMe] = useState(false);
  const [myLocation, setMyLocation] = useState<string | null>(null);
  /** The bug your character has taken on. Local only — nothing is persisted. */
  const [myBugId, setMyBugId] = useState<string | null>(null);
  /** Set while you're inside a module looking at its rooms. */
  const [insideModuleId, setInsideModuleId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  /** Shared by the notice board in the square, the Team panel and the popup. */
  const [board, setBoard] = useState<Board>("performance");
  const [standingsOpen, setStandingsOpen] = useState(false);

  const selectedModuleId = selection?.kind === "module" ? selection.id : null;
  const module = town.modules.find((m) => m.id === selectedModuleId) ?? null;
  const inside = town.modules.find((m) => m.id === insideModuleId) ?? null;
  const atModule = town.modules.find((m) => m.id === myLocation) ?? null;
  const myBug = town.modules.flatMap((m) => m.bugs).find((b) => b.id === myBugId) ?? null;
  const myBugModule = town.modules.find((m) => m.bugs.some((b) => b.id === myBugId)) ?? null;
  const myBugFeature =
    myBugModule?.features.find((f) => f.bugs.some((b) => b.id === myBugId)) ?? null;
  const solvedBugs = town.modules
    .flatMap((m) => m.bugs)
    .filter((b) => b.solved)
    .map((b) => ({ key: b.key, title: b.title, severity: b.severity }));

  const clearSelection = useCallback(() => setSelection(null), []);
  const selectModule = useCallback((id: string) => setSelection({ kind: "module", id }), []);
  const selectDeveloper = useCallback((id: string) => setSelection({ kind: "developer", id }), []);
  const selectMe = useCallback(() => setSelection({ kind: "me" }), []);
  const hoverMe = useCallback(
    (hovering: boolean) => setHoveredDeveloper(hovering ? "__me" : null),
    [],
  );

  const enterModule = useCallback((id: string) => {
    setInsideModuleId(id);
    setSelectedFeatureId(null);
    setSelection(null);
  }, []);

  const leaveModule = useCallback(() => {
    setInsideModuleId(null);
    setSelectedFeatureId(null);
  }, []);

  /** Taking a bug on also opens the card for the room it's in. */
  const takeBug = useCallback(
    (bugId: string | null) => {
      // An already-solved bug has nothing left to fight.
      if (bugId && solvedIds.has(bugId)) return;
      setMyBugId(bugId);
      if (bugId) {
        const feature = town.modules
          .flatMap((m) => m.features)
          .find((f) => f.bugs.some((b) => b.id === bugId));
        if (feature) setSelectedFeatureId(feature.id);
      }
    },
    [town.modules, solvedIds],
  );

  /**
   * Resolve the bug you're on: the skeleton plays its death, and once that has
   * landed it is replaced by its skull where it stood.
   */
  const completeBug = useCallback(() => {
    const bugId = myBugId;
    if (!bugId) return;
    setDyingIds((prev) => new Set(prev).add(bugId));
    setSolvedIds((prev) => new Set(prev).add(bugId));
    setMyBugId(null);
    window.setTimeout(() => {
      setDyingIds((prev) => {
        const next = new Set(prev);
        next.delete(bugId);
        return next;
      });
    }, DEATH_MS);
  }, [myBugId]);

  /** Clicking the notice board in the square opens the full standings. */
  const openLeaderboard = useCallback(() => setStandingsOpen(true), []);

  const showForm = ready && (!profile || editingProfile);

  return (
    <main className="relative flex-1 overflow-hidden bg-[#0a0e14] text-white">
      <div className="absolute inset-0">
        {inside ? (
          <Interior
            module={inside}
            profile={profile}
            myBugId={myBugId}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            dyingBugIds={dyingIds as Set<string>}
            onHoverBug={setHoveredModule}
            onSelectBug={takeBug}
          />
        ) : (
          <Village
            town={town}
            selectedModule={selectedModuleId}
            onHoverModule={setHoveredModule}
            onSelectModule={selectModule}
            onHoverDeveloper={setHoveredDeveloper}
            onSelectDeveloper={selectDeveloper}
            onClearSelection={clearSelection}
            profile={profile}
            roleTitle={profile ? roleById(profile.role).title : ""}
            followMe={followMe}
            onMyLocation={setMyLocation}
            onSelectMe={selectMe}
            onHoverMe={hoverMe}
            myBugId={myBugId}
            dyingBugIds={dyingIds as Set<string>}
            board={board}
            onOpenLeaderboard={openLeaderboard}
          />
        )}
      </div>

      {/* Overlay. pointer-events-none so the canvas keeps the drag. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex w-full max-w-sm flex-col gap-3">
            {inside ? (
              <InteriorBar module={inside} onLeave={leaveModule} />
            ) : (
              <>
                <ProjectBar town={town} />
                {profile && (
                  <MeCard
                    profile={profile}
                    location={atModule}
                    fighting={myBug}
                    follow={followMe}
                    onToggleFollow={() => setFollowMe((v) => !v)}
                    onEdit={() => setEditingProfile(true)}
                    onOpen={selectMe}
                  />
                )}
              </>
            )}

            {/* The bug you're on, wherever you are — village or interior. */}
            {myBug && myBugModule && myBugFeature && (
              <TaskCard
                bug={myBug}
                module={myBugModule}
                feature={myBugFeature}
                elapsed={elapsed}
                onComplete={completeBug}
                onStandDown={() => setMyBugId(null)}
              />
            )}
            <SolvedCard bugs={solvedBugs} onShow={() => setStandingsOpen(false)} />
          </div>

          <Card className="hidden w-80 overflow-hidden sm:block">
            {inside ? (
              <FeatureRooms
                module={inside}
                elapsed={elapsed}
                myBugId={myBugId}
                selectedFeatureId={selectedFeatureId}
                onSelectFeature={setSelectedFeatureId}
                onTake={takeBug}
              />
            ) : module ? (
              <ModulePanel
                module={module}
                elapsed={elapsed}
                myBugId={myBugId}
                onTake={takeBug}
                onEnter={() => enterModule(module.id)}
                onClose={clearSelection}
              />
            ) : selection?.kind === "developer" ? (
              <DeveloperPanel id={selection.id} town={town} onClose={clearSelection} />
            ) : selection?.kind === "me" && profile ? (
              <MePanel
                profile={profile}
                location={atModule}
                onEdit={() => setEditingProfile(true)}
                onReset={() => {
                  clear();
                  clearSelection();
                  setFollowMe(false);
                }}
                onClose={clearSelection}
              />
            ) : (
              <>
                <div className="flex gap-1 border-b border-white/5 px-2 py-2 text-[11px]">
                  {(
                    [
                      ["modules", "Modules"],
                      ["team", "Team"],
                    ] as const
                  ).map(([key, title]) => (
                    <button
                      key={key}
                      onClick={() => setPanel(key)}
                      className={`rounded px-2 py-1 transition-colors ${
                        panel === key ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"
                      }`}
                    >
                      {title}
                    </button>
                  ))}
                </div>
                {panel === "modules" ? (
                  <ModuleList
                    town={town}
                    selected={selectedModuleId}
                    onSelect={selectModule}
                    onHover={setHoveredModule}
                  />
                ) : (
                  <Leaderboard
                    town={town}
                    board={board}
                    onBoard={setBoard}
                    onSelect={selectDeveloper}
                    onHover={setHoveredDeveloper}
                  />
                )}
              </>
            )}
          </Card>
        </div>

        {!inside && (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
            <HoverTip
              town={town}
              moduleId={hoveredModule}
              developerId={hoveredDeveloper}
              myName={profile?.name ?? null}
            />
            <div className="hidden sm:block">
              <Legend />
            </div>
          </div>
        )}
      </div>

      {standingsOpen && (
        <LeaderboardPopup
          town={town}
          board={board}
          onBoard={setBoard}
          profile={profile}
          onSelectDeveloper={selectDeveloper}
          onClose={() => setStandingsOpen(false)}
        />
      )}

      {showForm && (
        <ProfileForm
          initial={editingProfile ? profile : null}
          onSave={(draft) => {
            save(draft);
            setEditingProfile(false);
          }}
          onCancel={editingProfile && profile ? () => setEditingProfile(false) : undefined}
        />
      )}
    </main>
  );
}
