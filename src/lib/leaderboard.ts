/**
 * Ranking. One place, so the billboard in the square and the panel in the HUD
 * can never disagree about who is winning.
 */
import type { Developer } from "./seed.ts";

export type Board = "performance" | "finders" | "xp";

export const BOARDS: { id: Board; title: string; short: string }[] = [
  { id: "performance", title: "Performance · this release", short: "Performance" },
  { id: "finders", title: "Finders · this release", short: "Finders" },
  { id: "xp", title: "All-time XP", short: "All-time" },
];

export interface Ranked {
  /** 1-based. Ties share a rank, and the next rank skips accordingly. */
  rank: number;
  developer: Developer;
  value: number;
  /** True when this row ties with the one above it. */
  tied: boolean;
}

export function boardValue(developer: Developer, board: Board): number {
  switch (board) {
    case "performance":
      return developer.performance;
    case "finders":
      return developer.found;
    case "xp":
      return developer.xp;
  }
}

export function formatBoardValue(value: number, board: Board): string {
  return board === "performance" ? `${value}` : board === "finders" ? `${value} found` : `${value} XP`;
}

/**
 * Rank a team on one board.
 *
 * Ties share a rank — two developers on equal points are both second, and the
 * next is fourth. Names break ties for ordering only, so the list is stable
 * and the server's prerender matches the browser's.
 */
export function rankDevelopers(developers: Developer[], board: Board): Ranked[] {
  const sorted = [...developers].sort((a, b) => {
    const diff = boardValue(b, board) - boardValue(a, board);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  const out: Ranked[] = [];
  let lastValue: number | null = null;
  let lastRank = 0;

  sorted.forEach((developer, index) => {
    const value = boardValue(developer, board);
    const tied = lastValue !== null && value === lastValue;
    const rank = tied ? lastRank : index + 1;
    out.push({ rank, developer, value, tied });
    lastValue = value;
    lastRank = rank;
  });

  return out;
}

/** Podium colours for the top three; null for everyone else. */
export function podiumColor(rank: number): string | null {
  return rank === 1 ? "#e3b341" : rank === 2 ? "#c9d1d9" : rank === 3 ? "#cd7f32" : null;
}
