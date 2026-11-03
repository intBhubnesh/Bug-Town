/**
 * Job roles on the team, and the character each one gets in the village.
 *
 * These are job titles, not the PRD's permission roles. The PRD's roles
 * (reviewer, feature owner, module owner, admin) are earned through XP gates
 * and ownership; these are what you tell someone when they ask what you do.
 * One person has exactly one of these and any number of the PRD's.
 */

/** The five KayKit Adventurers models shipped in `public/assets/characters`. */
export type CharacterModel = "Knight" | "Mage" | "Rogue" | "Rogue_Hooded" | "Barbarian";

export const CHARACTERS: { id: CharacterModel; label: string }[] = [
  { id: "Knight", label: "Knight" },
  { id: "Mage", label: "Mage" },
  { id: "Rogue", label: "Rogue" },
  { id: "Rogue_Hooded", label: "Hooded Rogue" },
  { id: "Barbarian", label: "Barbarian" },
];

export type RoleId = "pm" | "fullstack" | "app" | "tester" | "manager";

export interface Role {
  id: RoleId;
  title: string;
  /** Shown under the title on the profile form. */
  blurb: string;
  /** The character this role gets by default. The chooser can override it. */
  model: CharacterModel;
}

export const ROLES: Role[] = [
  {
    id: "manager",
    title: "Engineering Manager",
    blurb: "Owns the board and the bad news. Holds the line.",
    model: "Knight",
  },
  {
    id: "pm",
    title: "Product Manager",
    blurb: "Plans two releases ahead and decides what ships.",
    model: "Mage",
  },
  {
    id: "fullstack",
    title: "Full-stack Developer",
    blurb: "Carries the heaviest load, front to back.",
    model: "Barbarian",
  },
  {
    id: "app",
    title: "App Developer",
    blurb: "Ships fast and light on iOS and Android.",
    model: "Rogue",
  },
  {
    id: "tester",
    title: "Tester / QA",
    blurb: "Hunts bugs from the shadows before anyone else sees them.",
    model: "Rogue_Hooded",
  },
];

/**
 * What each character carries.
 *
 * Unlike the skeletons — whose weapons are separate models you bolt onto a
 * `handslot` bone — the Adventurers pack already ships every weapon and shield
 * as a node inside the GLB. They're just all visible at once by default, which
 * is why the loader hides them and this list names the ones to switch back on.
 *
 * Keyed by character, not by role, because the chooser lets anyone pick any
 * character and a Barbarian has no spellbook to hold. One-handed kit on
 * purpose: the generic Idle and Walking clips are posed for it, so a two-handed
 * axe ends up floating beside the hand.
 */
export const CHARACTER_GEAR: Record<CharacterModel, string[]> = {
  Knight: ["1H_Sword", "Badge_Shield"],
  Mage: ["Spellbook"],
  Rogue: ["Knife"],
  Rogue_Hooded: ["1H_Crossbow"],
  Barbarian: ["1H_Axe", "Barbarian_Round_Shield"],
};

/**
 * How each character fights the bug they've claimed.
 *
 * Every Adventurers model shares one rig and all 76 clips, so the clip is a
 * free choice — it just has to match the kit in `CHARACTER_GEAR`, or you get a
 * sword-swing animation from someone holding a book.
 *
 * `standoff` is how far from the skeleton they plant themselves: melee closes
 * in, a crossbow and a spellbook work from range. That reads instantly at a
 * glance, which is the whole point of putting it in 3D.
 */
export const CHARACTER_ATTACK: Record<CharacterModel, { clip: string; standoff: number }> = {
  Knight: { clip: "1H_Melee_Attack_Slice_Diagonal", standoff: 0.8 },
  Mage: { clip: "Spellcasting", standoff: 1.9 },
  Rogue: { clip: "1H_Melee_Attack_Stab", standoff: 0.75 },
  Rogue_Hooded: { clip: "1H_Ranged_Shooting", standoff: 2.2 },
  Barbarian: { clip: "1H_Melee_Attack_Chop", standoff: 0.85 },
};

export const roleById = (id: RoleId): Role => ROLES.find((r) => r.id === id) ?? ROLES[0];

export const characterLabel = (model: CharacterModel): string =>
  CHARACTERS.find((c) => c.id === model)?.label ?? model;
