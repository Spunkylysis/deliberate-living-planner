"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * First-run flow for a signed-in user with no household yet.
 *
 * "Create" mirrors the exact sequence verified against the RLS schema:
 * insert into households (created_by = auth.uid() via column default),
 * then update the caller's own profile to link household_id.
 *
 * "Join" is a placeholder — real invite-code lookup is a later addition
 * (see NEXTJS_PLAN.md "Multi-family onboarding"); for now it takes a raw
 * household UUID, which is enough for the two real households using this
 * today without building invite-code infrastructure prematurely.
 */
export default function OnboardingPage() {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();

    const { data: household, error: createError } = await supabase
      .from("households")
      .insert({ name })
      .select("id")
      .single();

    if (createError || !household) {
      setError(createError?.message ?? "Could not create household.");
      setBusy(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: linkError } = await supabase
      .from("profiles")
      .update({ household_id: household.id })
      .eq("id", user!.id);

    if (linkError) {
      setError(linkError.message);
      setBusy(false);
      return;
    }

    router.push("/grid");
    router.refresh();
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: linkError } = await supabase
      .from("profiles")
      .update({ household_id: joinId })
      .eq("id", user!.id);

    if (linkError) {
      setError(
        "Couldn't join that household — check the ID, or ask whoever created it."
      );
      setBusy(false);
      return;
    }

    router.push("/grid");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-brass mb-1">
            Deliberate Living
          </p>
          <h1 className="font-serif text-3xl">Get started</h1>
        </div>

        {mode === "choose" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode("create")}
              className="rounded-md border border-line bg-panel px-4 py-3 text-left text-sm hover:border-brass"
            >
              <span className="block font-medium">Create a household</span>
              <span className="block text-paper-dim text-xs mt-1">
                Start fresh — you&apos;ll be the first member.
              </span>
            </button>
            <button
              onClick={() => setMode("join")}
              className="rounded-md border border-line bg-panel px-4 py-3 text-left text-sm hover:border-brass"
            >
              <span className="block font-medium">Join a household</span>
              <span className="block text-paper-dim text-xs mt-1">
                Someone already set one up and shared the ID with you.
              </span>
            </button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <label className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
              Household name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., The Smith Family"
              className="rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-brass"
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-2 rounded-md bg-brass-dim px-4 py-2 text-sm hover:bg-brass disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create household"}
            </button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <label className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
              Household ID
            </label>
            <input
              required
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="Paste the ID you were given"
              className="rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-brass"
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-2 rounded-md bg-brass-dim px-4 py-2 text-sm hover:bg-brass disabled:opacity-50"
            >
              {busy ? "Joining…" : "Join household"}
            </button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
