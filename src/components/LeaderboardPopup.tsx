"use client";

import { useEffect } from "react";
import { formatRupees, levelFromXp } from "@/lib/game";
import {
  BOARDS,
  formatBoardValue,
  podiumColor,
  rankDevelopers,
  type Board,
} from "@/lib/leaderboard";
import type { Profile } from "@/lib/profile";
import { characterLabel, roleById } from "@/lib/roles";
import type { TownView } from "@/lib/seed";

/**
 * The full standings, as a modal — what the notice board in the square points
 * at. The board itself only has room for the podium.
 */
export function LeaderboardPopup({
  town,
  board,
  onBoard,
  profile,
  onSelectDeveloper,
  onClose,
}: {
  town: TownView;
  board: Board;
  onBoard: (board: Board) => void;
  profile: Profile | null;
  onSelectDeveloper: (id: string) => void;
  onClose: () => void;
}) {
  const ranked = rankDevelopers(town.developers, board);
  const top = ranked[0]?.value || 1;

  // Escape closes it, like every other modal anyone has ever used.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-[#06090d]/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Standings"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Standings</h2>
            <p className="mt-0.5 text-xs text-white/50">
              Release {town.release.name} · day {town.release.day} · {town.developers.length} developers
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-white/40 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/10 px-4 py-3 text-xs">
          {BOARDS.map(({ id, title, short }) => (
            <button
              key={id}
              onClick={() => onBoard(id)}
              title={title}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                board === id
                  ? "bg-[#58a6ff]/15 text-white ring-1 ring-[#58a6ff]/50"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              {short}
            </button>
          ))}
        </div>

        <div className="max-h-[56vh] overflow-y-auto">
          {ranked.map(({ rank, developer, value, tied }) => {
            const medal = podiumColor(rank);
            const level = levelFromXp(developer.xp);
            return (
              <button
                key={developer.id}
                onClick={() => {
                  onSelectDeveloper(developer.id);
                  onClose();
                }}
                className="flex w-full items-center gap-4 border-b border-white/5 px-5 py-3 text-left last:border-0 hover:bg-white/5"
              >
                <span
                  className="w-7 shrink-0 text-center text-base font-semibold tabular-nums"
                  style={{ color: medal ?? "rgba(255,255,255,0.3)" }}
                  title={tied ? `tied for ${rank}` : undefined}
                >
                  {tied ? "=" : rank}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{developer.name}</span>
                    <span className="shrink-0 text-[11px] text-white/35">
                      L{level} · {developer.model}
                    </span>
                  </span>
                  {/* Score as a bar, so the gaps between people are visible. */}
                  <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (value / top) * 100)}%`,
                        background: medal ?? "#58a6ff",
                      }}
                    />
                  </span>
                  <span className="mt-1 block text-[11px] text-white/40">
                    HP {Math.round(developer.hp)} · {developer.streak}d streak · {developer.found} found ·{" "}
                    {developer.fixed} fixed
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums">
                    {formatBoardValue(value, board)}
                  </span>
                  <span
                    className="block text-[11px] tabular-nums"
                    style={{ color: developer.wallet < 0 ? "#f85149" : "#3fb950" }}
                  >
                    {formatRupees(developer.wallet)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {profile && (
          <div className="flex items-center gap-4 border-t border-white/10 bg-white/[0.03] px-5 py-3">
            <span className="w-7 shrink-0 text-center text-base font-semibold text-white/25">—</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">{profile.name}</span>
                <span className="shrink-0 text-[11px] text-white/35">
                  you · {roleById(profile.role).title} · {characterLabel(profile.model)}
                </span>
              </span>
              <span className="mt-1 block text-[11px] text-white/40">
                Unranked — reporting and fixing don&apos;t exist yet, so there is nothing to score.
              </span>
            </span>
            <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-white/30">
              {formatBoardValue(0, board)}
            </span>
          </div>
        )}

        {!profile && (
          <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/35">
            Create a profile to appear here.
          </div>
        )}
      </div>
    </div>
  );
}
