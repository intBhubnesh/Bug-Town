/**
 * Seeded town. This is the only place fake data lives.
 *
 * Health is never stored — it is derived from the open bugs, so the village can
 * never disagree with the bug list. When a real database arrives, replace the
 * four arrays below and everything downstream keeps working.
 *
 * The spread is deliberate. With the PRD's damage table a Critical costs a
 * feature 20 health and a Low costs 2, so a module only falls below 50 when it
 * has Criticals sitting open. Records is the designated disaster (health 25, so
 * it burns), Payments / Appointments / Prescriptions sit in the warning band,
 * and Reports is spotless.
 */
import { SEVERITY, average, type Severity } from "./game";
import type { CharacterModel } from "./roles";

export type DeveloperId = string;

export interface Developer {
  id: DeveloperId;
  name: string;
  /** Which KayKit Adventurers model represents this person in the village. */
  model: CharacterModel;
  xp: number;
  hp: number;
  /** Performance points this release. Resets when the release closes. */
  performance: number;
  /** ₹ balance — the sum of their ledger, so feature owners run negative. */
  wallet: number;
  streak: number;
  found: number;
  fixed: number;
  /** Fixes submitted inside the 3-hour golden window. */
  goldenHits: number;
}

export interface Feature {
  id: string;
  moduleId: string;
  name: string;
  ownerId: DeveloperId;
}

export type ModuleKind =
  | "building_market"
  | "building_tavern"
  | "building_church"
  | "building_blacksmith"
  | "building_tower_A"
  | "building_tower_B"
  | "building_mine"
  | "building_barracks"
  | "building_archeryrange"
  | "building_home_B";

export interface Module {
  id: string;
  name: string;
  ownerId: DeveloperId;
  /** Which KayKit building represents it — a fixed choice, never derived. */
  kind: ModuleKind;
  /** Axial hex coordinate on the village grid. */
  cell: [q: number, r: number];
  /** Retired modules render as ruins, modules still being built as scaffolding. */
  state?: "live" | "retired" | "building";
}

export type BugStatus = "open" | "in_progress" | "in_review";

export interface Bug {
  id: string;
  key: string;
  title: string;
  severity: Severity;
  featureId: string;
  reporterId: DeveloperId;
  status: BugStatus;
  claimedBy?: DeveloperId;
  /** Hours since report, at page load. The live clock takes over after that. */
  ageHours: number;
}

export const RELEASE = { name: "2.4", day: 6 };

export const DEVELOPERS: Developer[] = [
  { id: "kavya", name: "Kavya Iyer",   model: "Barbarian",    xp: 4620, hp: 96,  performance: 501, wallet: 320,  streak: 21, found: 18, fixed: 24, goldenHits: 19 },
  { id: "ravi",  name: "Ravi Shankar", model: "Knight",       xp: 3120, hp: 61,  performance: 438, wallet: -240, streak: 12, found: 9,  fixed: 21, goldenHits: 12 },
  { id: "meera", name: "Meera Nair",   model: "Mage",         xp: 2340, hp: 91,  performance: 388, wallet: 180,  streak: 9,  found: 22, fixed: 14, goldenHits: 11 },
  { id: "arjun", name: "Arjun Das",    model: "Rogue",        xp: 1480, hp: 28,  performance: 265, wallet: -95,  streak: 3,  found: 7,  fixed: 11, goldenHits: 4  },
  { id: "dev",   name: "Dev Patel",    model: "Rogue_Hooded", xp: 870,  hp: 77,  performance: 198, wallet: 60,   streak: 5,  found: 11, fixed: 8,  goldenHits: 6  },
  { id: "nisha", name: "Nisha Rao",    model: "Mage",         xp: 640,  hp: 88,  performance: 142, wallet: 110,  streak: 7,  found: 14, fixed: 5,  goldenHits: 4  },
  { id: "imran", name: "Imran Shaikh", model: "Rogue",        xp: 310,  hp: 100, performance: 96,  wallet: 70,   streak: 2,  found: 8,  fixed: 3,  goldenHits: 3  },
];

export const MODULES: Module[] = [
  { id: "patients",       name: "Patients",       ownerId: "kavya", kind: "building_market",      cell: [2, 0] },
  { id: "appointments",   name: "Appointments",   ownerId: "meera", kind: "building_tavern",      cell: [0, 2] },
  { id: "prescriptions",  name: "Prescriptions",  ownerId: "ravi",  kind: "building_church",      cell: [-2, 2] },
  { id: "payments",       name: "Payments",       ownerId: "ravi",  kind: "building_blacksmith",  cell: [-2, 0] },
  { id: "reports",        name: "Reports",        ownerId: "kavya", kind: "building_tower_A",     cell: [0, -2] },
  { id: "notifications",  name: "Notifications",  ownerId: "dev",   kind: "building_mine",        cell: [2, -2] },
  { id: "auth",           name: "Auth",           ownerId: "meera", kind: "building_barracks",    cell: [1, 2] },
  { id: "records",        name: "Records",        ownerId: "arjun", kind: "building_archeryrange", cell: [-3, 1] },
  { id: "lab-orders",     name: "Lab Orders",     ownerId: "nisha", kind: "building_home_B",      cell: [2, -3], state: "building" },
  { id: "legacy-billing", name: "Legacy Billing", ownerId: "ravi",  kind: "building_home_B",      cell: [-1, -2], state: "retired" },
];

export const FEATURES: Feature[] = [
  { id: "pat-search",   moduleId: "patients",       name: "Search",      ownerId: "kavya" },
  { id: "pat-profile",  moduleId: "patients",       name: "Profile",     ownerId: "nisha" },
  { id: "apt-slots",    moduleId: "appointments",   name: "Slot engine", ownerId: "dev" },
  { id: "apt-booking",  moduleId: "appointments",   name: "Booking",     ownerId: "meera" },
  { id: "apt-general",  moduleId: "appointments",   name: "General",     ownerId: "meera" },
  { id: "rx-write",     moduleId: "prescriptions",  name: "Write Rx",    ownerId: "ravi" },
  { id: "rx-export",    moduleId: "prescriptions",  name: "PDF export",  ownerId: "arjun" },
  { id: "pay-refunds",  moduleId: "payments",       name: "Refunds",     ownerId: "ravi" },
  { id: "pay-checkout", moduleId: "payments",       name: "Checkout",    ownerId: "kavya" },
  { id: "pay-invoices", moduleId: "payments",       name: "Invoices",    ownerId: "dev" },
  { id: "rep-general",  moduleId: "reports",        name: "Daily sheet", ownerId: "kavya" },
  { id: "not-push",     moduleId: "notifications",  name: "Push",        ownerId: "dev" },
  { id: "not-sms",      moduleId: "notifications",  name: "SMS",         ownerId: "imran" },
  { id: "auth-login",   moduleId: "auth",           name: "Login",       ownerId: "meera" },
  { id: "auth-general", moduleId: "auth",           name: "General",     ownerId: "meera" },
  { id: "rec-upload",   moduleId: "records",        name: "Upload",      ownerId: "arjun" },
  { id: "rec-viewer",   moduleId: "records",        name: "Viewer",      ownerId: "arjun" },
  { id: "lab-spec",     moduleId: "lab-orders",     name: "Spec",        ownerId: "nisha" },
  { id: "bill-general", moduleId: "legacy-billing", name: "General",     ownerId: "ravi" },
];

export const BUGS: Bug[] = [
  // Records — the disaster. Upload 20 health, Viewer 30, module 25, so it burns.
  { id: "r1", key: "CUR-815", title: "Upload fails silently over 10 MB",              severity: "critical", featureId: "rec-upload", reporterId: "meera", status: "open",        ageHours: 8.4 },
  { id: "r2", key: "CUR-791", title: "Multipart upload corrupts files over 50 MB",     severity: "critical", featureId: "rec-upload", reporterId: "kavya", status: "open",        ageHours: 31 },
  { id: "r3", key: "CUR-818", title: "Upload accepts executable attachments",          severity: "critical", featureId: "rec-upload", reporterId: "imran", status: "open",        ageHours: 2.4 },
  { id: "r4", key: "CUR-804", title: "Upload progress bar sticks at 99%",              severity: "high",     featureId: "rec-upload", reporterId: "dev",   status: "open",        ageHours: 26 },
  { id: "r5", key: "CUR-786", title: "Retrying an upload duplicates the record",       severity: "high",     featureId: "rec-upload", reporterId: "nisha", status: "open",        ageHours: 44 },
  { id: "r6", key: "CUR-813", title: "Viewer renders blank for TIFF scans",            severity: "critical", featureId: "rec-viewer", reporterId: "kavya", status: "open",        ageHours: 3.6 },
  { id: "r7", key: "CUR-819", title: "Wrong patient's scan shown after a fast switch", severity: "critical", featureId: "rec-viewer", reporterId: "meera", status: "in_progress", claimedBy: "kavya", ageHours: 1.1 },
  { id: "r8", key: "CUR-780", title: "Viewer leaks memory until the tab dies",         severity: "critical", featureId: "rec-viewer", reporterId: "dev",   status: "open",        ageHours: 52 },
  { id: "r9", key: "CUR-807", title: "Record list pagination skips page 2",            severity: "high",     featureId: "rec-viewer", reporterId: "nisha", status: "open",        ageHours: 19 },

  // Payments — warning band. Refunds 65, Checkout 70, Invoices 75, module 70.
  { id: "p1", key: "CUR-812", title: "Refund total ignores partial payments",          severity: "critical", featureId: "pay-refunds",  reporterId: "meera", status: "in_progress", claimedBy: "ravi", ageHours: 0.7 },
  { id: "p2", key: "CUR-801", title: "Refund button enabled on settled invoices",      severity: "high",     featureId: "pay-refunds",  reporterId: "dev",   status: "in_review",   ageHours: 29 },
  { id: "p3", key: "CUR-788", title: "Refund receipt omits the GST line",              severity: "medium",   featureId: "pay-refunds",  reporterId: "imran", status: "open",        ageHours: 61 },
  { id: "p4", key: "CUR-809", title: "Double charge when retrying checkout",           severity: "critical", featureId: "pay-checkout", reporterId: "kavya", status: "open",        ageHours: 5.2 },
  { id: "p5", key: "CUR-806", title: "Checkout hangs on a UPI timeout",                severity: "high",     featureId: "pay-checkout", reporterId: "nisha", status: "open",        ageHours: 13 },
  { id: "p6", key: "CUR-805", title: "Invoice PDF shows the previous patient's name",  severity: "high",     featureId: "pay-invoices", reporterId: "nisha", status: "open",        ageHours: 11 },
  { id: "p7", key: "CUR-784", title: "Invoice totals round down by a rupee",           severity: "high",     featureId: "pay-invoices", reporterId: "imran", status: "open",        ageHours: 37 },
  { id: "p8", key: "CUR-776", title: "Invoice date shown in US format",                severity: "medium",   featureId: "pay-invoices", reporterId: "meera", status: "open",        ageHours: 70 },

  // Appointments — warning band. Slots 60, Booking 75, General 93, module 76.
  { id: "a1", key: "CUR-814", title: "Slot engine double-books across timezones",      severity: "critical", featureId: "apt-slots",   reporterId: "kavya", status: "in_progress", claimedBy: "dev", ageHours: 1.4 },
  { id: "a2", key: "CUR-803", title: "Slots not released when a booking fails",        severity: "high",     featureId: "apt-slots",   reporterId: "meera", status: "open",        ageHours: 20 },
  { id: "a3", key: "CUR-772", title: "DST shift moves every slot by an hour",          severity: "high",     featureId: "apt-slots",   reporterId: "imran", status: "open",        ageHours: 48 },
  { id: "a4", key: "CUR-802", title: "Booking form loses notes on a validation error", severity: "high",     featureId: "apt-booking", reporterId: "imran", status: "open",        ageHours: 40 },
  { id: "a5", key: "CUR-810", title: "Reminder sent for a cancelled appointment",      severity: "high",     featureId: "apt-booking", reporterId: "nisha", status: "open",        ageHours: 14 },
  { id: "a6", key: "CUR-782", title: "Cannot book for a patient with no phone number", severity: "medium",   featureId: "apt-booking", reporterId: "dev",   status: "open",        ageHours: 55 },
  { id: "a7", key: "CUR-797", title: "Calendar starts on Sunday for some users",        severity: "medium",   featureId: "apt-general", reporterId: "dev",   status: "open",        ageHours: 96 },
  { id: "a8", key: "CUR-761", title: "Time shown without AM/PM on mobile",             severity: "low",      featureId: "apt-general", reporterId: "meera", status: "open",        ageHours: 110 },

  // Prescriptions — warning band. Write 75, Export 80, module 77.5.
  { id: "x1", key: "CUR-793", title: "Drug search returns retired medicines",          severity: "high",     featureId: "rx-write",  reporterId: "kavya", status: "open",        ageHours: 33 },
  { id: "x2", key: "CUR-799", title: "Dosage field accepts negative numbers",          severity: "high",     featureId: "rx-write",  reporterId: "meera", status: "open",        ageHours: 25 },
  { id: "x3", key: "CUR-794", title: "Rx print margin cuts off the signature",         severity: "medium",   featureId: "rx-write",  reporterId: "nisha", status: "open",        ageHours: 80 },
  { id: "x4", key: "CUR-811", title: "Rx PDF drops the dosage on the second page",     severity: "critical", featureId: "rx-export", reporterId: "meera", status: "in_review",   ageHours: 16 },

  // Patients — healthy. Search 90, Profile 93, module 91.5.
  { id: "t1", key: "CUR-808", title: "Patient search ignores middle names",            severity: "high",     featureId: "pat-search",  reporterId: "arjun", status: "open", ageHours: 22 },
  { id: "t2", key: "CUR-798", title: "Profile photo rotates 90° on iOS upload",        severity: "medium",   featureId: "pat-profile", reporterId: "dev",   status: "open", ageHours: 52 },
  { id: "t3", key: "CUR-754", title: "Blood group shows as 'undefined' when unset",    severity: "low",      featureId: "pat-profile", reporterId: "imran", status: "open", ageHours: 130 },

  // Notifications — healthy. Push 90, SMS 95, module 92.5.
  { id: "n1", key: "CUR-800", title: "Push token not refreshed after a reinstall",     severity: "high",     featureId: "not-push", reporterId: "imran", status: "open", ageHours: 27 },
  { id: "n2", key: "CUR-796", title: "SMS sender ID wrong for Kerala numbers",         severity: "medium",   featureId: "not-sms",  reporterId: "meera", status: "open", ageHours: 58 },

  // Auth — healthy overall, but a Critical reported minutes ago: the golden
  // window is live and the multiplier is near 3×.
  { id: "u1", key: "CUR-820", title: "Session survives a password change",             severity: "critical", featureId: "auth-login", reporterId: "kavya", status: "open", ageHours: 0.4 },

  // Reports has no open bugs on purpose — one clean building to compare against.
];

/* ------------------------------------------------------------------ */
/* Derived views. Health comes from the bug list, never from storage.  */
/* ------------------------------------------------------------------ */

/** Health under this and the building is on fire, not just smoking. */
export const BURNING_HEALTH = 30;

/** A bug plus whether it has been resolved in this session. */
export interface BugView extends Bug {
  solved: boolean;
}

export interface FeatureView extends Feature {
  /** Every bug ever placed here, solved included — layout must not shift. */
  bugs: BugView[];
  /** The ones still costing health. */
  openBugs: BugView[];
  health: number;
}

export interface ModuleView extends Module {
  features: FeatureView[];
  bugs: BugView[];
  openBugs: BugView[];
  health: number;
  criticalCount: number;
  /** Has open bugs, so skeletons are hitting it and it smokes. */
  underAttack: boolean;
  /** Health under 30 — the building burns. */
  burning: boolean;
  /** A Critical still open past its 3-hour golden window. */
  overdueCritical: boolean;
}

export interface TownView {
  modules: ModuleView[];
  developers: Developer[];
  health: number;
  openBugs: number;
  release: typeof RELEASE;
}

function featureHealth(openBugs: Bug[]): number {
  const damage = openBugs.reduce((sum, b) => sum + SEVERITY[b.severity].healthDamage, 0);
  return Math.max(0, Math.min(100, 100 - damage));
}

/**
 * Derive the whole town.
 *
 * `solved` is the set of bugs resolved in this session. Solved bugs stay in
 * `bugs` so the village and the floor plans don't reshuffle around the gap —
 * their skeleton is replaced by a skull where it stood — but they stop counting
 * towards health, towards the smoke and the fire, and towards every total. That
 * falls out of health being derived rather than stored: a solved bug simply
 * isn't open any more.
 */
export function buildTown(solved: ReadonlySet<string> = new Set()): TownView {
  const bugsByFeature = new Map<string, Bug[]>();
  for (const bug of BUGS) {
    const list = bugsByFeature.get(bug.featureId) ?? [];
    list.push(bug);
    bugsByFeature.set(bug.featureId, list);
  }

  const modules: ModuleView[] = MODULES.map((module) => {
    const features: FeatureView[] = FEATURES.filter((f) => f.moduleId === module.id).map((f) => {
      const bugs: BugView[] = (bugsByFeature.get(f.id) ?? []).map((b) => ({
        ...b,
        solved: solved.has(b.id),
      }));
      const openBugs = bugs.filter((b) => !b.solved);
      return { ...f, bugs, openBugs, health: featureHealth(openBugs) };
    });
    const bugs = features.flatMap((f) => f.bugs);
    const openBugs = features.flatMap((f) => f.openBugs);
    const retired = module.state === "retired";
    // A retired module is a ruin; health is meaningless there, so it reads 0.
    const health = retired ? 0 : average(features.map((f) => f.health));
    return {
      ...module,
      features,
      bugs,
      openBugs,
      health,
      criticalCount: openBugs.filter((b) => b.severity === "critical").length,
      underAttack: openBugs.length > 0,
      // A ruin doesn't burn — it was decommissioned, not abandoned on fire.
      burning: !retired && health < BURNING_HEALTH,
      overdueCritical: openBugs.some((b) => b.severity === "critical" && b.ageHours > 3),
    };
  });

  const live = modules.filter((m) => m.state !== "retired" && m.state !== "building");

  return {
    modules,
    developers: [...DEVELOPERS].sort((a, b) => b.performance - a.performance),
    health: average(live.map((m) => m.health)),
    openBugs: modules.reduce((n, m) => n + m.openBugs.length, 0),
    release: RELEASE,
  };
}

export const developerById = (id: DeveloperId): Developer | undefined =>
  DEVELOPERS.find((d) => d.id === id);

export const developerName = (id: DeveloperId): string => developerById(id)?.name ?? id;
