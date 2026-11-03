"use client";

import { useEffect, useState } from "react";
import {
  BAND_HEX,
  FINDER_REWARD,
  GOLDEN_WINDOW_HOURS,
  SEVERITY,
  SEVERITY_HEX,
  SEVERITY_ORDER,
  band,
  bountyStack,
  formatAge,
  formatRupees,
  levelFromXp,
  levelProgress,
  multiplier,
  ownerDrainPerHour,
  performancePoints,
  type Severity,
} from "@/lib/game";
import {
  BURNING_HEALTH,
  developerById,
  developerName,
  type Bug,
  type FeatureView,
  type ModuleView,
  type TownView,
} from "@/lib/seed";
import type { Profile } from "@/lib/profile";
import { characterLabel, roleById } from "@/lib/roles";
import {
  BOARDS,
  formatBoardValue,
  podiumColor,
  rankDevelopers,
  type Board,
} from "@/lib/leaderboard";

/**
 * Hours elapsed since the page opened. Starts at exactly 0 so the server's
 * prerender and the first client render agree, then ticks every second — which
 * is what FR-11 ("live stack and multiplier, at least every minute") wants.
 */
function useElapsedHours(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds((Date.now() - started) / 1000), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds / 3600;
}

/* ------------------------------- atoms --------------------------------- */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-auto rounded-xl border border-white/10 bg-[#0d1117]/85 backdrop-blur-md shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: SEVERITY_HEX[severity], background: `${SEVERITY_HEX[severity]}1f` }}
    >
      {severity[0]}
    </span>
  );
}

/* ----------------------------- project bar ----------------------------- */

export function ProjectBar({ town }: { town: TownView }) {
  const health = Math.round(town.health);
  const criticals = town.modules.reduce((n, m) => n + m.criticalCount, 0);
  const burning = town.modules.filter((m) => m.burning).length;

  return (
    <Card className="px-4 py-3">
      <div className="flex items-start gap-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute h-16 w-16 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ffffff1a" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke={BAND_HEX[band(health)]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(health / 100) * 97.4} 97.4`}
            />
          </svg>
          <span className="text-lg font-semibold tabular-nums">{health}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight">
            Bug Town <span className="font-normal text-white/40">· Curoh</span>
          </h1>
          <p className="mt-0.5 text-xs text-white/50">
            Release {town.release.name} · day {town.release.day} · {town.developers.length} developers
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="text-white/70">
              <b className="font-semibold text-white">{town.openBugs}</b> open
            </span>
            <span style={{ color: SEVERITY_HEX.critical }}>
              <b className="font-semibold">{criticals}</b> critical
            </span>
            {burning > 0 && (
              <span style={{ color: SEVERITY_HEX.critical }}>
                🔥 <b className="font-semibold">{burning}</b> burning
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ module list ---------------------------- */

export function ModuleList({
  town,
  selected,
  onSelect,
  onHover,
}: {
  town: TownView;
  selected: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  // Sickest first — the list answers "where does it hurt" without reading.
  const sorted = [...town.modules].sort((a, b) => a.health - b.health);

  return (
    <div className="max-h-[52vh] overflow-y-auto">
      {sorted.map((m) => {
        const health = Math.round(m.health);
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            onMouseEnter={() => onHover(m.id)}
            onMouseLeave={() => onHover(null)}
            className={`flex w-full flex-col gap-1.5 border-b border-white/5 px-3 py-2.5 text-left transition-colors last:border-0 ${
              selected === m.id ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{m.name}</span>
              <span className="shrink-0 text-xs tabular-nums" style={{ color: BAND_HEX[band(m.health)] }}>
                {m.state === "retired" ? "retired" : m.state === "building" ? "building" : health}
              </span>
            </div>
            <Bar value={health} color={BAND_HEX[band(m.health)]} />
            <div className="flex items-center gap-2 text-[11px] text-white/45">
              <span>{developerName(m.ownerId)}</span>
              <span>·</span>
              <span>{m.openBugs.length} open</span>
              {m.burning ? (
                <span style={{ color: SEVERITY_HEX.critical }}>· 🔥 burning</span>
              ) : (
                m.overdueCritical && (
                  <span style={{ color: SEVERITY_HEX.high }}>· critical overdue</span>
                )
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ leaderboard ---------------------------- */

/**
 * The same ranking the billboard in the square shows — `rankDevelopers` is the
 * single source, so the panel and the board can't disagree.
 */
export function Leaderboard({
  town,
  board,
  onBoard,
  onSelect,
  onHover,
}: {
  town: TownView;
  board: Board;
  onBoard: (board: Board) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const ranked = rankDevelopers(town.developers, board);

  return (
    <div>
      <div className="flex gap-1 border-b border-white/5 px-2 py-2 text-[11px]">
        {BOARDS.map(({ id, short }) => (
          <button
            key={id}
            onClick={() => onBoard(id)}
            className={`rounded px-2 py-1 transition-colors ${
              board === id ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"
            }`}
          >
            {short}
          </button>
        ))}
      </div>
      <div className="max-h-[48vh] overflow-y-auto">
        {ranked.map(({ rank, developer, value, tied }) => {
          const medal = podiumColor(rank);
          return (
            <button
              key={developer.id}
              onClick={() => onSelect(developer.id)}
              onMouseEnter={() => onHover(developer.id)}
              onMouseLeave={() => onHover(null)}
              className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left last:border-0 hover:bg-white/5"
            >
              <span
                className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums"
                style={{ color: medal ?? "rgba(255,255,255,0.35)" }}
                title={tied ? "tied" : undefined}
              >
                {tied ? "=" : rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{developer.name}</span>
                <span className="block text-[11px] text-white/40">
                  L{levelFromXp(developer.xp)} · HP {Math.round(developer.hp)} ·{" "}
                  {formatRupees(developer.wallet)}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-white/70">
                {formatBoardValue(value, board)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- module detail ---------------------------- */

function BugRow({
  bug,
  elapsed,
  mine,
  onTake,
}: {
  bug: Bug;
  elapsed: number;
  /** True when your character is already fighting this one. */
  mine: boolean;
  onTake: (bugId: string | null) => void;
}) {
  const age = bug.ageHours + elapsed;
  const stack = bountyStack(bug.severity, age);
  const mult = multiplier(age);
  const inWindow = age < GOLDEN_WINDOW_HOURS;
  const points = performancePoints(bug.severity, age);
  const minutesLeft = Math.max(0, Math.round((GOLDEN_WINDOW_HOURS - age) * 60));

  return (
    <div className="border-b border-white/5 px-3 py-2 last:border-0">
      <div className="flex items-start gap-2">
        <SeverityChip severity={bug.severity} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-white/85">{bug.title}</p>
          <p className="mt-0.5 text-[10px] text-white/35">
            {bug.key} · {formatAge(age)} old · {developerName(bug.reporterId)}
            {bug.claimedBy && ` · claimed by ${developerName(bug.claimedBy)}`}
            {bug.status === "in_review" && " · in review"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold tabular-nums text-[#3fb950]">{formatRupees(stack)}</p>
          <p
            className="text-[10px] tabular-nums"
            style={{ color: inWindow ? "#e3b341" : "#8b949e" }}
          >
            {mult.toFixed(2)}× · {points}p
          </p>
        </div>
      </div>
      {inWindow && (
        <div className="mt-1.5 flex items-center gap-2">
          <Bar value={(age / GOLDEN_WINDOW_HOURS) * 100} color="#e3b341" />
          <span className="shrink-0 text-[10px] tabular-nums text-[#e3b341]">{minutesLeft}m left</span>
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-2">
        <button
          onClick={() => onTake(mine ? null : bug.id)}
          className={`rounded border px-2 py-1 text-[10px] transition-colors ${
            mine
              ? "border-[#58a6ff] bg-[#58a6ff]/15 text-white"
              : "border-white/15 text-white/55 hover:border-white/35 hover:text-white"
          }`}
        >
          {mine ? "Stand down" : "Take it on"}
        </button>
        {bug.claimedBy && !mine && (
          <span className="text-[10px] text-white/35">
            {developerName(bug.claimedBy)} is on it
          </span>
        )}
        {mine && <span className="text-[10px] text-[#58a6ff]">your character is fighting this</span>}
      </div>
    </div>
  );
}

export function ModulePanel({
  module,
  elapsed,
  myBugId,
  onTake,
  onEnter,
  onClose,
}: {
  module: ModuleView;
  elapsed: number;
  myBugId: string | null;
  onTake: (bugId: string | null) => void;
  /** Walk inside and see a room per feature. */
  onEnter: () => void;
  onClose: () => void;
}) {
  const bySeverity = [...module.openBugs].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const drain = ownerDrainPerHour(
    module.openBugs.map((b) => ({ severity: b.severity, ageHours: b.ageHours + elapsed })),
  );
  const owed = module.openBugs.length * FINDER_REWARD;

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-white/5 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">{module.name}</h2>
          <p className="text-[11px] text-white/45">
            {developerName(module.ownerId)} · {module.features.length} features
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tabular-nums" style={{ color: BAND_HEX[band(module.health)] }}>
            {Math.round(module.health)}
          </span>
          <button onClick={onClose} className="text-white/35 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/5 text-center">
        <div className="bg-[#0d1117] px-2 py-2">
          <p className="text-[10px] uppercase tracking-wide text-white/35">bugs</p>
          <p className="text-sm font-semibold tabular-nums">{module.openBugs.length}</p>
        </div>
        <div className="bg-[#0d1117] px-2 py-2">
          <p className="text-[10px] uppercase tracking-wide text-white/35">owner HP/h</p>
          <p className="text-sm font-semibold tabular-nums text-[#f85149]">−{drain.toFixed(2)}</p>
        </div>
        <div className="bg-[#0d1117] px-2 py-2">
          <p className="text-[10px] uppercase tracking-wide text-white/35">finder ₹ paid</p>
          <p className="text-sm font-semibold tabular-nums">{formatRupees(owed)}</p>
        </div>
      </div>

      <div className="border-b border-white/5 px-3 py-2.5">
        <button
          onClick={onEnter}
          className="mb-3 w-full rounded-lg bg-[#58a6ff] px-3 py-2 text-xs font-medium text-[#06090d] transition-opacity hover:opacity-90"
        >
          Go inside · {module.features.filter((f) => f.name !== "General").length} rooms
        </button>
        <p className="mb-2 text-[10px] uppercase tracking-wide text-white/35">features</p>
        <div className="space-y-2">
          {module.features.map((f) => (
            <div key={f.id}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-white/80">{f.name}</span>
                <span className="shrink-0 tabular-nums" style={{ color: BAND_HEX[band(f.health)] }}>
                  {Math.round(f.health)}
                </span>
              </div>
              <div className="mt-1">
                <Bar value={f.health} color={BAND_HEX[band(f.health)]} />
              </div>
              <p className="mt-0.5 text-[10px] text-white/30">
                {developerName(f.ownerId)} · {f.openBugs.length} open
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wide text-white/35">
        open bugs · live ₹ and multiplier · take one on to go fight it
      </p>
      <div className="max-h-[36vh] overflow-y-auto">
        {bySeverity.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-white/35">No open bugs. Clean module.</p>
        ) : (
          bySeverity.map((bug) => (
            <BugRow
              key={bug.id}
              bug={bug}
              elapsed={elapsed}
              mine={bug.id === myBugId}
              onTake={onTake}
            />
          ))
        )}
      </div>
    </>
  );
}

/* --------------------------- developer detail -------------------------- */

export function DeveloperPanel({
  id,
  town,
  onClose,
}: {
  id: string;
  town: TownView;
  onClose: () => void;
}) {
  const dev = developerById(id);
  if (!dev) return null;

  const level = levelFromXp(dev.xp);
  const owned = town.modules.filter((m) => m.ownerId === dev.id);
  const ownedFeatures = town.modules.flatMap((m) => m.features.filter((f) => f.ownerId === dev.id));
  const liability = ownedFeatures.flatMap((f) => f.openBugs);
  const rank = town.developers.findIndex((d) => d.id === dev.id) + 1;
  const goldenRate = dev.fixed > 0 ? Math.round((dev.goldenHits / dev.fixed) * 100) : 0;

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-white/5 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">{dev.name}</h2>
          <p className="text-[11px] text-white/45">
            Level {level} · rank #{rank} this release · {dev.model}
          </p>
        </div>
        <button onClick={onClose} className="text-white/35 hover:text-white" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="space-y-3 px-3 py-3">
        <div>
          <div className="flex justify-between text-[11px] text-white/50">
            <span>XP {dev.xp}</span>
            <span>L{level + 1}</span>
          </div>
          <div className="mt-1">
            <Bar value={levelProgress(dev.xp) * 100} color="#58a6ff" />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-white/50">
            <span>HP {Math.round(dev.hp)}</span>
            {dev.hp < 30 && <span className="text-[#f85149]">locked out of proposals</span>}
          </div>
          <div className="mt-1">
            <Bar value={dev.hp} color={dev.hp < 30 ? "#f85149" : dev.hp < 50 ? "#d29922" : "#3fb950"} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-white/5 text-center">
        {[
          ["₹", formatRupees(dev.wallet)],
          ["perf", `${dev.performance}`],
          ["streak", `${dev.streak}d`],
          ["golden", `${goldenRate}%`],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#0d1117] px-1 py-2">
            <p className="text-[10px] uppercase tracking-wide text-white/35">{k}</p>
            <p className="text-xs font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="px-3 py-3 text-xs">
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-white/35">accountable for</p>
        {owned.length > 0 && (
          <p className="text-white/70">
            {owned.length} module{owned.length > 1 ? "s" : ""}: {owned.map((m) => m.name).join(", ")}
          </p>
        )}
        <p className="mt-1 text-white/70">
          {ownedFeatures.length} features · {liability.length} open bug{liability.length === 1 ? "" : "s"} they
          pay for
        </p>
        {liability.length > 0 && (
          <p className="mt-1.5 text-[11px] text-[#f85149]">
            −{ownDrain(liability).toFixed(2)} HP/hour while those stay open
          </p>
        )}
        <p className="mt-2 text-[11px] text-white/40">
          {dev.found} found · {dev.fixed} fixed · {dev.goldenHits} inside the golden window
        </p>
      </div>
    </>
  );
}

function ownDrain(bugs: Bug[]): number {
  return ownerDrainPerHour(bugs.map((b) => ({ severity: b.severity, ageHours: b.ageHours })));
}

/* ------------------------------ interior ------------------------------- */

/** Header shown while you're inside a module. */
export function InteriorBar({
  module,
  onLeave,
}: {
  module: ModuleView;
  onLeave: () => void;
}) {
  const general = module.features.find((f) => f.name === "General");
  return (
    <Card className="px-4 py-3">
      <div className="flex items-start gap-3">
        <button
          onClick={onLeave}
          className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] text-white/70 hover:border-white/35 hover:text-white"
        >
          ← Village
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">
            Inside {module.name}{" "}
            <span className="font-normal" style={{ color: BAND_HEX[band(module.health)] }}>
              · {Math.round(module.health)}
            </span>
          </h1>
          <p className="mt-0.5 text-[11px] text-white/50">
            {developerName(module.ownerId)} · {module.features.filter((f) => f.name !== "General").length} rooms ·{" "}
            {module.openBugs.length} open
            {general && general.openBugs.length > 0 &&
              ` · ${general.openBugs.length} module-level in the hall`}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** One card per feature room, mirroring what you see on the floor. */
export function FeatureRooms({
  module,
  elapsed,
  myBugId,
  selectedFeatureId,
  onSelectFeature,
  onTake,
}: {
  module: ModuleView;
  elapsed: number;
  myBugId: string | null;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  onTake: (bugId: string | null) => void;
}) {
  const rooms = [...module.features].sort((a, b) => {
    // General is the hall, not a room, so it goes last.
    if (a.name === "General") return 1;
    if (b.name === "General") return -1;
    return a.health - b.health;
  });

  return (
    <div className="max-h-[72vh] overflow-y-auto">
      {rooms.map((feature) => {
        const open = selectedFeatureId === feature.id;
        const isHall = feature.name === "General";
        return (
          <div key={feature.id} className="border-b border-white/5 last:border-0">
            <button
              onClick={() => onSelectFeature(open ? null : feature.id)}
              className={`flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors ${
                open ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {feature.name}
                  {isHall && <span className="font-normal text-white/35"> · the hall</span>}
                </span>
                <span
                  className="shrink-0 text-xs tabular-nums"
                  style={{ color: BAND_HEX[band(feature.health)] }}
                >
                  {Math.round(feature.health)}
                </span>
              </div>
              <Bar value={feature.health} color={BAND_HEX[band(feature.health)]} />
              <span className="text-[11px] text-white/45">
                {developerName(feature.ownerId)} · {feature.openBugs.length} bug
                {feature.openBugs.length === 1 ? "" : "s"}
                {isHall && " at module level"}
              </span>
            </button>
            {open &&
              (feature.openBugs.length === 0 ? (
                <p className="px-3 pb-3 text-center text-[11px] text-white/35">
                  Empty room. Nothing to fight.
                </p>
              ) : (
                [...feature.openBugs]
                  .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
                  .map((bug) => (
                    <BugRow
                      key={bug.id}
                      bug={bug}
                      elapsed={elapsed}
                      mine={bug.id === myBugId}
                      onTake={onTake}
                    />
                  ))
              ))}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ your task ------------------------------ */

/**
 * The bug you've taken on, in the left column under your own card.
 *
 * Live ₹ and multiplier, because both are still ticking while you work — and
 * the multiplier is the whole point of the golden window. Completing it kills
 * the skeleton in the village and leaves its skull behind.
 */
export function TaskCard({
  bug,
  module,
  feature,
  elapsed,
  onComplete,
  onStandDown,
}: {
  bug: Bug;
  module: ModuleView;
  feature: FeatureView;
  elapsed: number;
  onComplete: () => void;
  onStandDown: () => void;
}) {
  const age = bug.ageHours + elapsed;
  const stack = bountyStack(bug.severity, age);
  const mult = multiplier(age);
  const points = performancePoints(bug.severity, age);
  const inWindow = age < GOLDEN_WINDOW_HOURS;
  const minutesLeft = Math.max(0, Math.round((GOLDEN_WINDOW_HOURS - age) * 60));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#58a6ff]/10 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#58a6ff]">
          Your bug
        </span>
        <span className="ml-auto text-[10px] text-white/40">{bug.key}</span>
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <SeverityChip severity={bug.severity} />
          <p className="min-w-0 flex-1 text-xs text-white/85">{bug.title}</p>
        </div>
        <p className="mt-1 text-[10px] text-white/40">
          {module.name} › {feature.name} · {formatAge(age)} old · reported by{" "}
          {developerName(bug.reporterId)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/5 text-center">
        <div className="bg-[#0d1117] px-1 py-2">
          <p className="text-[10px] uppercase tracking-wide text-white/35">₹ now</p>
          <p className="text-sm font-semibold tabular-nums text-[#3fb950]">{formatRupees(stack)}</p>
        </div>
        <div className="bg-[#0d1117] px-1 py-2">
          <p className="text-[10px] uppercase tracking-wide text-white/35">multiplier</p>
          <p
            className="text-sm font-semibold tabular-nums"
            style={{ color: inWindow ? "#e3b341" : "#8b949e" }}
          >
            {mult.toFixed(2)}×
          </p>
        </div>
        <div className="bg-[#0d1117] px-1 py-2">
          <p className="text-[10px] uppercase tracking-wide text-white/35">points</p>
          <p className="text-sm font-semibold tabular-nums">{points}</p>
        </div>
      </div>

      {inWindow && (
        <div className="flex items-center gap-2 px-3 py-2">
          <Bar value={(age / GOLDEN_WINDOW_HOURS) * 100} color="#e3b341" />
          <span className="shrink-0 text-[10px] tabular-nums text-[#e3b341]">
            {minutesLeft}m of golden window
          </span>
        </div>
      )}

      <div className="flex gap-2 border-t border-white/5 px-3 py-2.5">
        <button
          onClick={onComplete}
          className="flex-1 rounded-lg bg-[#3fb950] px-3 py-2 text-xs font-semibold text-[#06090d] transition-opacity hover:opacity-90"
        >
          Complete the fix
        </button>
        <button
          onClick={onStandDown}
          className="rounded-lg border border-white/15 px-2.5 py-2 text-xs text-white/55 hover:border-white/35 hover:text-white"
        >
          Stand down
        </button>
      </div>
    </Card>
  );
}

/** What you've resolved this session. */
export function SolvedCard({
  bugs,
  onShow,
}: {
  bugs: { key: string; title: string; severity: Severity }[];
  onShow: (bugKey: string) => void;
}) {
  if (bugs.length === 0) return null;
  return (
    <Card className="px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-white/35">
        Solved by you · {bugs.length}
      </p>
      <div className="mt-1.5 space-y-1">
        {bugs.slice(-4).map((bug) => (
          <button
            key={bug.key}
            onClick={() => onShow(bug.key)}
            className="flex w-full items-center gap-2 text-left"
          >
            <span style={{ color: "#3fb950" }}>✓</span>
            <SeverityChip severity={bug.severity} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-white/60">{bug.title}</span>
          </button>
        ))}
      </div>
      {bugs.length > 4 && (
        <p className="mt-1 text-[10px] text-white/30">and {bugs.length - 4} more</p>
      )}
    </Card>
  );
}

/* ---------------------------------- you -------------------------------- */

/**
 * Your own card. Separate from the leaderboard on purpose: the first question
 * anyone asks of a village like this is "where am I".
 */
export function MeCard({
  profile,
  location,
  fighting,
  follow,
  onToggleFollow,
  onEdit,
  onOpen,
}: {
  profile: Profile;
  /** The module your character is standing at, or null while walking. */
  location: ModuleView | null;
  /** The bug your character has taken on, if any. */
  fighting: Bug | null;
  follow: boolean;
  onToggleFollow: () => void;
  onEdit: () => void;
  onOpen: () => void;
}) {
  const role = roleById(profile.role);

  return (
    <Card className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold">
            {profile.name} <span className="font-normal text-white/35">· you</span>
          </p>
          <p className="truncate text-[11px] text-white/45">
            {role.title} · {characterLabel(profile.model)}
          </p>
        </button>
        <button
          onClick={onToggleFollow}
          aria-pressed={follow}
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
            follow
              ? "border-[#58a6ff] bg-[#58a6ff]/15 text-white"
              : "border-white/15 text-white/55 hover:border-white/30 hover:text-white"
          }`}
        >
          {follow ? "Following" : "Follow"}
        </button>
        <button
          onClick={onEdit}
          className="shrink-0 text-white/35 hover:text-white"
          aria-label="Edit your character"
          title="Edit your character"
        >
          ⚙
        </button>
      </div>
      <p className="mt-1.5 truncate text-[11px] text-white/55">
        {fighting ? (
          <>
            Fighting <b className="font-semibold text-white">{fighting.key}</b>
            <span style={{ color: SEVERITY_HEX[fighting.severity] }}> · {fighting.severity}</span>
            <span className="text-white/40"> · {fighting.title}</span>
          </>
        ) : location ? (
          <>
            Standing at <b className="font-semibold text-white">{location.name}</b>
            <span style={{ color: BAND_HEX[band(location.health)] }}>
              {" "}
              · health {Math.round(location.health)}
            </span>
            <span className="text-white/40"> · {location.openBugs.length} open</span>
          </>
        ) : (
          <span className="text-white/40">Walking to the next module…</span>
        )}
      </p>
    </Card>
  );
}

export function MePanel({
  profile,
  location,
  onEdit,
  onReset,
  onClose,
}: {
  profile: Profile;
  location: ModuleView | null;
  onEdit: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const role = roleById(profile.role);
  const joined = new Date(profile.createdAt);

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-white/5 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">{profile.name}</h2>
          <p className="text-[11px] text-white/45">
            {role.title} · {characterLabel(profile.model)}
          </p>
        </div>
        <button onClick={onClose} className="text-white/35 hover:text-white" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-4 gap-px bg-white/5 text-center">
        {[
          ["₹", "₹0"],
          ["perf", "0"],
          ["streak", "0d"],
          ["level", "1"],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#0d1117] px-1 py-2">
            <p className="text-[10px] uppercase tracking-wide text-white/35">{k}</p>
            <p className="text-xs font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 px-3 py-3 text-xs">
        <p className="text-white/70">
          {location ? (
            <>
              You are standing at <b className="font-semibold text-white">{location.name}</b>, health{" "}
              <b style={{ color: BAND_HEX[band(location.health)] }}>{Math.round(location.health)}</b> with{" "}
              {location.openBugs.length} open bug{location.openBugs.length === 1 ? "" : "s"}.
            </>
          ) : (
            "You are walking between modules."
          )}
        </p>
        <p className="text-[11px] text-white/40">{role.blurb}</p>
        <p className="text-[11px] text-white/35">
          Profile created {joined.toLocaleDateString()} · stored on this device only
        </p>
        <p className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] text-white/50">
          Your scores are all zero because reporting and fixing don&apos;t exist yet. Phase 1 is the
          village; the ₹, XP and performance you see on the leaderboard are seeded teammates.
        </p>
      </div>

      <div className="flex gap-2 border-t border-white/5 px-3 py-2.5">
        <button
          onClick={onEdit}
          className="flex-1 rounded-lg border border-white/15 px-2 py-1.5 text-[11px] text-white/70 hover:border-white/30 hover:text-white"
        >
          Edit character
        </button>
        <button
          onClick={onReset}
          className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-white/35 hover:border-[#f85149]/40 hover:text-[#f85149]"
        >
          Start over
        </button>
      </div>
    </>
  );
}

/* ------------------------------- hover tip ----------------------------- */

export function HoverTip({
  town,
  moduleId,
  developerId,
  myName,
}: {
  town: TownView;
  moduleId: string | null;
  developerId: string | null;
  myName: string | null;
}) {
  if (developerId === "__me") {
    return (
      <Card className="px-3 py-2 text-xs">
        <b className="font-semibold">{myName ?? "You"}</b>
        <span className="text-white/50"> · that&apos;s you · click for your profile</span>
      </Card>
    );
  }
  if (developerId) {
    const d = developerById(developerId);
    if (!d) return null;
    return (
      <Card className="px-3 py-2 text-xs">
        <b className="font-semibold">{d.name}</b>
        <span className="text-white/50">
          {" "}
          · L{levelFromXp(d.xp)} · HP {Math.round(d.hp)} · {d.performance}p · {formatRupees(d.wallet)}
        </span>
      </Card>
    );
  }
  if (moduleId) {
    const m = town.modules.find((x) => x.id === moduleId);
    if (!m) return null;
    return (
      <Card className="px-3 py-2 text-xs">
        <b className="font-semibold">{m.name}</b>
        <span className="text-white/50">
          {" "}
          · health {Math.round(m.health)} · {m.openBugs.length} open · {m.criticalCount} critical ·{" "}
          {developerName(m.ownerId)}
        </span>
      </Card>
    );
  }
  return (
    <Card className="px-3 py-2 text-xs text-white/40">
      Drag to orbit · scroll to zoom · click a building or a villager
    </Card>
  );
}

/* -------------------------------- legend ------------------------------- */

const ATTACKER_LABEL: Record<Severity, string> = {
  critical: "Warrior, axe",
  high: "Rogue, blade",
  medium: "Mage, staff",
  low: "Minion, fists",
};

export function Legend() {
  return (
    <Card className="max-w-md px-3 py-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/45">
        <span className="text-white/60">roof</span>
        {(["healthy", "warning", "critical"] as const).map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: BAND_HEX[b] }} />
            {b === "healthy" ? "80–100" : b === "warning" ? "50–79" : "under 50"}
          </span>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/45">
        <span className="text-white/60">one skeleton per bug</span>
        {SEVERITY_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: SEVERITY_HEX[s] }} />
            {ATTACKER_LABEL[s]} · ₹{SEVERITY[s].cap}
          </span>
        ))}
      </div>
      <div className="mt-1 text-[10px] text-white/40">
        smoke = under attack · 🔥 = health under {BURNING_HEALTH} · ruins = retired · scaffolding = being built
      </div>
    </Card>
  );
}

export { useElapsedHours, Card };
