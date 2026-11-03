"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CHARACTER_GEAR, CHARACTERS, ROLES, type CharacterModel, type RoleId } from "@/lib/roles";
import { NAME_MAX, normalizeName, type Profile } from "@/lib/profile";
import { assetPath, useCharacter, useClip } from "./useModel";

/** A slowly idling character, so the chooser shows the thing you're choosing. */
function Preview({ model }: { model: CharacterModel }) {
  const { body, scale, animations } = useCharacter(assetPath.character(model), 1.6, {
    gear: CHARACTER_GEAR[model],
  });
  useClip(body, animations, "Idle");
  return <primitive object={body} scale={scale} position={[0, -0.85, 0]} />;
}

function PreviewStage({ model }: { model: CharacterModel }) {
  return (
    <Canvas shadows={false} dpr={[1, 2]} camera={{ position: [0, 0.35, 3.1], fov: 34 }}>
      <hemisphereLight args={["#cfe3ff", "#1d2415", 1.1]} />
      <directionalLight position={[2, 4, 3]} intensity={1.5} color="#fff2d6" />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} color="#8fc9ff" />
      <Suspense fallback={null}>
        <group rotation={[0, 0.5, 0]}>
          <Preview model={model} />
        </group>
      </Suspense>
    </Canvas>
  );
}

/**
 * First-run profile. No accounts in phase 1, so this is the whole sign-up: who
 * you are, what you do, and which character walks the village as you.
 *
 * Picking a role preselects that role's character but never locks it — people
 * care which one is theirs, and the mapping is a suggestion, not a rule.
 */
export function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Profile | null;
  onSave: (profile: Omit<Profile, "createdAt">) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<RoleId>(initial?.role ?? "fullstack");
  const [model, setModel] = useState<CharacterModel>(
    initial?.model ?? ROLES.find((r) => r.id === "fullstack")!.model,
  );
  /** True once the user overrides the character, so the role stops changing it. */
  const [modelPinned, setModelPinned] = useState(Boolean(initial));
  const [touched, setTouched] = useState(false);

  const valid = normalizeName(name) !== null;
  const editing = Boolean(initial);

  const chooseRole = (id: RoleId) => {
    setRole(id);
    if (!modelPinned) setModel(ROLES.find((r) => r.id === id)!.model);
  };

  const submit = () => {
    const clean = normalizeName(name);
    if (!clean) {
      setTouched(true);
      return;
    }
    onSave({ name: clean, role, model });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#06090d]/85 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <h1 className="text-base font-semibold">
            {editing ? "Edit your character" : "Welcome to Bug Town"}
          </h1>
          <p className="mt-1 text-xs text-white/50">
            {editing
              ? "Change your name, role or character. Everything else stays."
              : "Tell us who you are. Your character walks the village and stops at each module, so you can see where the work is."}
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_15rem]">
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-[11px] uppercase tracking-wide text-white/45">
                Your name
              </label>
              <input
                id="name"
                value={name}
                autoFocus
                maxLength={NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Santosh"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-[#58a6ff]"
              />
              {touched && !valid && (
                <p className="mt-1 text-[11px] text-[#f85149]">A name is required.</p>
              )}
            </div>

            <fieldset>
              <legend className="mb-1.5 text-[11px] uppercase tracking-wide text-white/45">
                Your role
              </legend>
              <div className="space-y-1.5">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => chooseRole(r.id)}
                    aria-pressed={role === r.id}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      role === r.id
                        ? "border-[#58a6ff] bg-[#58a6ff]/10"
                        : "border-white/10 hover:border-white/25 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        role === r.id ? "bg-[#58a6ff]" : "bg-white/20"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{r.title}</span>
                      <span className="block text-[11px] text-white/45">{r.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-white/45">Your character</p>
            <div className="h-56 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#161b22] to-[#0a0e14]">
              <PreviewStage model={model} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setModel(c.id);
                    setModelPinned(true);
                  }}
                  aria-pressed={model === c.id}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                    model === c.id
                      ? "border-[#58a6ff] bg-[#58a6ff]/10 text-white"
                      : "border-white/10 text-white/60 hover:border-white/25 hover:bg-white/5"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {!modelPinned && (
              <p className="text-[10px] text-white/35">
                Suggested for your role. Pick another and it stays.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-2 text-sm text-white/55 hover:text-white"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="rounded-lg bg-[#58a6ff] px-4 py-2 text-sm font-medium text-[#06090d] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {editing ? "Save" : "Enter the village"}
          </button>
        </div>
      </div>
    </div>
  );
}
