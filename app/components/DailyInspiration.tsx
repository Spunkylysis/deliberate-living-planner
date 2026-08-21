"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Quote = { id: string; text: string; author: string | null; source_type: string | null };

export default function DailyInspiration({
  householdId,
  todaysQuote,
  todaysReminder,
}: {
  householdId: string;
  todaysQuote: Quote | null;
  todaysReminder: string | null;
}) {
  const [addingQuote, setAddingQuote] = useState(false);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [sourceType, setSourceType] = useState("motivational");
  const [saved, setSaved] = useState(false);

  async function submitQuote() {
    if (!text.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("quotes").insert({
      household_id: householdId,
      text: text.trim(),
      author: author.trim() || null,
      source_type: sourceType,
    });
    if (!error) {
      setSaved(true);
      setText("");
      setAuthor("");
      setTimeout(() => {
        setSaved(false);
        setAddingQuote(false);
      }, 1500);
    }
  }

  if (!todaysQuote && !todaysReminder) return null;

  return (
    <section className="bg-panel border border-line rounded-md p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          {todaysQuote && (
            <p className="font-serif italic text-[15px] leading-snug">
              &ldquo;{todaysQuote.text}&rdquo;
              <span className="font-mono not-italic text-[10.5px] text-paper-dim ml-2">
                — {todaysQuote.author ?? "unknown"}
              </span>
            </p>
          )}
          {todaysReminder && (
            <p className="font-mono text-[11px] text-sage mt-2">{todaysReminder}</p>
          )}
        </div>
        <button
          onClick={() => setAddingQuote((v) => !v)}
          className="font-mono text-[10px] uppercase text-paper-dim hover:text-brass whitespace-nowrap"
        >
          {addingQuote ? "Close" : "+ Add a quote"}
        </button>
      </div>

      {addingQuote && (
        <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="A quote worth keeping around…"
            className="bg-panel-2 border border-line rounded px-2.5 py-2 text-sm min-h-[50px]"
          />
          <div className="flex gap-2 flex-wrap">
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author (optional)"
              className="flex-1 min-w-[140px] bg-panel-2 border border-line rounded px-2.5 py-2 text-xs"
            />
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="bg-panel-2 border border-line rounded px-2.5 py-2 text-xs"
            >
              <option value="religious">Religious</option>
              <option value="literary">Literary</option>
              <option value="philosophical">Philosophical</option>
              <option value="motivational">Motivational</option>
            </select>
            <button
              onClick={submitQuote}
              className="rounded bg-brass-dim px-3 py-2 text-xs hover:bg-brass"
            >
              {saved ? "Added" : "Add"}
            </button>
          </div>
          <p className="font-mono text-[10px] text-paper-dim">
            Only your household sees this one — it goes into the same daily
            rotation as the starter set.
          </p>
        </div>
      )}
    </section>
  );
}
