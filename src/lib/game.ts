/**
 * Game rules from the PRD. Pure functions only — no data, no React.
 * Every tunable here is a RuleConfig candidate once there's a database.
 */

export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY: Record<
  Severity,
  {
    /** ₹ ceiling for the fixer's bounty stack */
    cap: number;
    /** hours for the stack to climb from ₹1 to cap */
    capHours: number;
    /** feature health subtracted when the bug is verified */
    healthDamage: number;
    /** HP the feature owner loses per hour while it stays open past the golden window */
    hpDrainPerHour: number;
    /** performance points before the golden-window multiplier */
    perfBase: number;
    /** XP to the reporter when the bug is verified legit */
    finderXp: number;
  }
> = {
  critical: { cap: 3, capHours: 4, healthDamage: 20, hpDrainPerHour: 1, perfBase: 40, finderXp: 20 },
  high: { cap: 5, capHours: 24, healthDamage: 10, hpDrainPerHour: 0.25, perfBase: 25, finderXp: 15 },
  medium: { cap: 8, capHours: 72, healthDamage: 5, hpDrainPerHour: 0.1, perfBase: 15, finderXp: 10 },
  low: { cap: 10, capHours: 168, healthDamage: 2, hpDrainPerHour: 0.02, perfBase: 10, finderXp: 5 },
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export const GOLDEN_WINDOW_HOURS = 3;
/** Flat ₹ the reporter earns when a bug is verified legit. */
export const FINDER_REWARD = 10;

/**
 * ₹ the fixer earns for a bug reported `hours` ago.
 * stack(t) = min(cap, 1 + (cap - 1) · t / capHours), floored to whole rupees.
 */
export function bountyStack(severity: Severity, hours: number): number {
  const { cap, capHours } = SEVERITY[severity];
  const t = Math.max(0, hours);
  return Math.floor(Math.min(cap, 1 + (cap - 1) * (t / capHours)));
}

/**
 * Performance multiplier: 3× at the moment of report, sliding linearly to 1× at
 * 3 hours, then flat. Measured from fix_submitted_at so reviewer delay is free.
 */
export function multiplier(hours: number): number {
  const t = Math.min(Math.max(0, hours), GOLDEN_WINDOW_HOURS);
  return 3 - 2 * (t / GOLDEN_WINDOW_HOURS);
}

/** Performance points a fixer banks for resolving this bug at `hours` after report. */
export function performancePoints(severity: Severity, hours: number): number {
  return Math.round(SEVERITY[severity].perfBase * multiplier(hours));
}

/** Total XP needed to reach level n: 50·n·(n−1). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

/** Inverse of xpForLevel — the highest level this much XP has paid for. */
export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / 50)) / 2));
}

/** Progress through the current level, 0–1, for the XP bar. */
export function levelProgress(xp: number): number {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  return ceiling === floor ? 1 : (xp - floor) / (ceiling - floor);
}

export type Band = "healthy" | "warning" | "critical";

export function band(health: number): Band {
  return health >= 80 ? "healthy" : health >= 50 ? "warning" : "critical";
}

/** KayKit ships every building in these colourways, so a band is an asset swap. */
export const BAND_VARIANT: Record<Band, "green" | "yellow" | "red"> = {
  healthy: "green",
  warning: "yellow",
  critical: "red",
};

export const BAND_HEX: Record<Band, string> = {
  healthy: "#3fb950",
  warning: "#d29922",
  critical: "#f85149",
};

export const SEVERITY_HEX: Record<Severity, string> = {
  critical: "#f85149",
  high: "#d29922",
  medium: "#d2a8ff",
  low: "#3fb950",
};

/** Rolled-up health is a plain average, per the PRD. Empty rolls up as 100. */
export function average(values: number[]): number {
  if (values.length === 0) return 100;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** HP drain per hour on a feature owner, capped at 5 HP/hour across all their bugs. */
export function ownerDrainPerHour(openBugs: { severity: Severity; ageHours: number }[]): number {
  const raw = openBugs
    .filter((b) => b.ageHours > GOLDEN_WINDOW_HOURS)
    .reduce((sum, b) => sum + SEVERITY[b.severity].hpDrainPerHour, 0);
  return Math.min(5, raw);
}

/** No Intl here on purpose: client components prerender on the server, and a
 *  locale that groups differently in Node than in the browser desyncs hydration. */
export function formatRupees(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const digits = String(Math.abs(Math.round(amount)));
  const grouped = digits.length > 3 ? `${digits.slice(0, -3)},${digits.slice(-3)}` : digits;
  return `${sign}₹${grouped}`;
}

export function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${Math.floor(hours / 24)}d`;
}
