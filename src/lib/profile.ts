"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLES, type CharacterModel, type RoleId } from "./roles";

/**
 * Who you are in the village.
 *
 * Phase 1 has no accounts, so this lives in localStorage on your own machine.
 * When sign-in with company Google accounts arrives (NFR: Access), the shape
 * stays and the storage swaps for the session's user.
 */
export interface Profile {
  name: string;
  role: RoleId;
  model: CharacterModel;
  createdAt: string;
}

const KEY = "bugtown.profile.v1";
export const NAME_MAX = 40;

/** Trim, collapse whitespace, cap length. Returns null if there's nothing left. */
export function normalizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
  return name.length > 0 ? name : null;
}

function isRole(value: unknown): value is RoleId {
  return ROLES.some((r) => r.id === value);
}

/** Anything in localStorage is user-editable, so validate on the way in. */
function parse(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Profile>;
    const name = typeof value.name === "string" ? normalizeName(value.name) : null;
    if (!name || !isRole(value.role)) return null;
    const role = ROLES.find((r) => r.id === value.role)!;
    return {
      name,
      role: value.role,
      // An unknown model would silently fail to load, so fall back to the role's.
      model: typeof value.model === "string" ? (value.model as CharacterModel) : role.model,
      createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export interface ProfileState {
  profile: Profile | null;
  /**
   * False until localStorage has been read. The page prerenders on the server
   * where there is no localStorage, so rendering the form before this is true
   * would flash it at people who already have a profile.
   */
  ready: boolean;
  save: (draft: Omit<Profile, "createdAt">) => void;
  clear: () => void;
}

export function useProfile(): ProfileState {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setProfile(parse(window.localStorage.getItem(KEY)));
    } catch {
      setProfile(null); // private mode, or storage disabled
    }
    setReady(true);
  }, []);

  const save = useCallback((draft: Omit<Profile, "createdAt">) => {
    const name = normalizeName(draft.name);
    if (!name) return;
    const next: Profile = { ...draft, name, createdAt: new Date().toISOString() };
    setProfile(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Not worth blocking the village over; it just won't survive a reload.
    }
  }, []);

  const clear = useCallback(() => {
    setProfile(null);
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* nothing to do */
    }
  }, []);

  return { profile, ready, save, clear };
}
