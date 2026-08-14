"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-brass mb-1">
            Deliberate Living
          </p>
          <h1 className="font-serif text-3xl">Sign in</h1>
        </div>

        {status === "sent" ? (
          <div className="rounded-md border border-line bg-panel p-5 text-sm text-paper-dim">
            Check <span className="text-paper">{email}</span> for a sign-in
            link. You can close this tab.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-brass"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-2 rounded-md bg-brass-dim px-4 py-2 text-sm hover:bg-brass disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-danger">{errorMessage}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
