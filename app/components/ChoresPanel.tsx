"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DOW, isoMonday, isoKey, addDays, fmtDate } from "@/lib/weekUtils";
import type { DayOfWeek } from "@/lib/weekUtils";

type ChoreLibraryItem = {
  id: string;
  title: string;
  assigned_member: string | null;
  frequency: "Daily" | "Weekly" | "Monthly" | "One-time";
  auto_recur: boolean;
  recur_weekday: number | null;
  recur_month_day: number | null;
  due_date: string | null;
  steps: string[];
  rec_link: string | null;
};

type Instance = {
  id: string;
  chore_id: string;
  week_start: string;
  day_of_week: string;
  done: boolean;
  auto_generated: boolean;
};

type Member = { id: string; display_name: string; color: string };

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ChoresPanel({
  householdId,
  weekStart,
  library,
  members,
  initialInstances,
}: {
  householdId: string;
  weekStart: string;
  library: ChoreLibraryItem[];
  members: Member[];
  initialInstances: Instance[];
}) {
  const router = useRouter();
  const [choreLibrary, setChoreLibrary] = useState(library);
  const [instances, setInstances] = useState(initialInstances);
  const [modalInstance, setModalInstance] = useState<Instance | null>(null);

  const monday = new Date(weekStart + "T00:00:00");
  const weekEnd = addDays(monday, 6);

  function memberOf(id: string | null) {
    return members.find((m) => m.id === id);
  }
  function choreOf(id: string) {
    return choreLibrary.find((c) => c.id === id);
  }

  function goToWeek(offsetDays: number) {
    const next = addDays(monday, offsetDays);
    router.push(`/chores?week=${isoKey(isoMonday(next))}`);
  }

  async function addChoreToLibrary(data: Omit<ChoreLibraryItem, "id">) {
    const supabase = createClient();
    const { data: inserted, error } = await supabase
      .from("chore_library")
      .insert({ household_id: householdId, ...data })
      .select()
      .single();
    if (!error && inserted) setChoreLibrary((prev) => [...prev, inserted]);
  }

  async function removeChoreFromLibrary(id: string) {
    const supabase = createClient();
    await supabase.from("chore_library").delete().eq("id", id);
    setChoreLibrary((prev) => prev.filter((c) => c.id !== id));
    setInstances((prev) => prev.filter((i) => i.chore_id !== id));
  }

  async function addToDay(day: DayOfWeek, choreId: string) {
    const supabase = createClient();
    const { data: inserted, error } = await supabase
      .from("chore_instances")
      .insert({
        household_id: householdId,
        chore_id: choreId,
        week_start: weekStart,
        day_of_week: day,
        auto_generated: false,
      })
      .select()
      .single();
    if (!error && inserted) setInstances((prev) => [...prev, inserted]);
  }

  async function toggleDone(instance: Instance) {
    const supabase = createClient();
    const { error } = await supabase
      .from("chore_instances")
      .update({ done: !instance.done })
      .eq("id", instance.id);
    if (!error) {
      setInstances((prev) =>
        prev.map((i) => (i.id === instance.id ? { ...i, done: !i.done } : i))
      );
      setModalInstance((prev) => (prev ? { ...prev, done: !prev.done } : prev));
    }
  }

  async function removeFromDay(instance: Instance) {
    const supabase = createClient();
    await supabase.from("chore_instances").delete().eq("id", instance.id);
    setInstances((prev) => prev.filter((i) => i.id !== instance.id));
    setModalInstance(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-panel border border-line rounded-md p-5">
        <h2 className="font-serif text-lg mb-1">Chore Library</h2>
        <p className="font-mono text-[10.5px] text-paper-dim mb-3">
          Think of each one as a mini project — a quick one-liner or a full multi-step process. Steps are optional.
        </p>
        {choreLibrary.length === 0 ? (
          <p className="text-paper-dim text-sm">No chores defined yet.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {choreLibrary.map((c) => {
              const m = memberOf(c.assigned_member);
              let recurTxt = c.frequency as string;
              if (c.frequency === "Weekly") recurTxt += ` · ${WEEKDAY_LABELS[c.recur_weekday ?? 0]}${c.auto_recur ? " · auto" : ""}`;
              else if (c.frequency === "Monthly") recurTxt += ` · day ${c.recur_month_day ?? 1}${c.auto_recur ? " · auto" : ""}`;
              else if (c.frequency === "Daily") recurTxt += c.auto_recur ? " · auto" : "";
              else if (c.frequency === "One-time" && c.due_date) recurTxt += ` · due ${c.due_date}`;
              return (
                <div key={c.id} className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {m && <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />}
                      {c.title}
                    </div>
                    <div className="font-mono text-[10.5px] text-paper-dim">
                      {recurTxt}{m ? ` · ${m.display_name}` : ""}{c.steps.length ? ` · ${c.steps.length} steps` : " · quick task"}
                    </div>
                  </div>
                  <button
                    onClick={() => removeChoreFromLibrary(c.id)}
                    className="font-mono text-[10.5px] border border-line rounded px-2 py-1 text-paper-dim hover:border-danger hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <AddChoreForm members={members} onAdd={addChoreToLibrary} />
      </section>

      <section className="bg-panel border border-line rounded-md p-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => goToWeek(-7)} className="font-mono text-xs border border-line rounded px-3 py-1.5 hover:border-brass hover:text-brass">
            ← prev
          </button>
          <span className="font-mono text-sm">{fmtDate(monday)} – {fmtDate(weekEnd)}</span>
          <button onClick={() => goToWeek(7)} className="font-mono text-xs border border-line rounded px-3 py-1.5 hover:border-brass hover:text-brass">
            next →
          </button>
        </div>
        <h2 className="font-serif text-lg mb-3">This Week&apos;s Chores</h2>
        <div className="grid grid-cols-7 gap-3 overflow-x-auto">
          {DOW.map((day) => {
            const dayInstances = instances.filter((i) => i.day_of_week === day);
            return (
              <div key={day} className="bg-panel-2 border border-line rounded-md p-3 min-w-[150px]">
                <div className="font-mono text-[11px] uppercase text-paper-dim border-b border-line pb-2 mb-2">{day}</div>
                {dayInstances.map((inst) => {
                  const chore = choreOf(inst.chore_id);
                  if (!chore) return null;
                  const m = memberOf(chore.assigned_member);
                  return (
                    <div
                      key={inst.id}
                      onClick={() => setModalInstance(inst)}
                      className={`rounded p-2 mb-1.5 text-[12.5px] cursor-pointer border-l-[3px] ${inst.done ? "opacity-50" : ""}`}
                      style={{ borderLeftColor: m?.color ?? "#c9974c", background: "var(--panel)" }}
                    >
                      <div className={`font-semibold ${inst.done ? "line-through" : ""}`}>{chore.title}</div>
                      {m && <div className="font-mono text-[9.5px] uppercase text-paper-dim">{m.display_name}</div>}
                    </div>
                  );
                })}
                <ChoreAddSelect library={choreLibrary} onAdd={(choreId) => addToDay(day, choreId)} />
              </div>
            );
          })}
        </div>
      </section>

      {modalInstance && (() => {
        const chore = choreOf(modalInstance.chore_id);
        if (!chore) return null;
        const m = memberOf(chore.assigned_member);
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setModalInstance(null)}>
            <div className="bg-panel border border-brass-dim rounded-lg p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-serif text-lg mb-1">{chore.title}</h3>
              <p className="font-mono text-[10.5px] text-paper-dim mb-3">
                {chore.frequency}{m ? ` · ${m.display_name}` : ""}{chore.due_date ? ` · due ${chore.due_date}` : ""}
              </p>
              <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Process</label>
              {chore.steps.length ? (
                <ol className="text-sm leading-relaxed pl-4 list-decimal">
                  {chore.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              ) : (
                <p className="text-paper-dim text-sm">No steps recorded — edit in Chore Library.</p>
              )}
              {chore.rec_link && (
                <a href={chore.rec_link} target="_blank" rel="noopener noreferrer" className="text-brass text-sm inline-block mt-2">
                  Open how-to link ↗
                </a>
              )}
              <div className="flex justify-between mt-4 gap-2">
                <div className="flex gap-2">
                  <button onClick={() => toggleDone(modalInstance)} className="rounded px-3.5 py-2 text-xs bg-brass-dim hover:bg-brass">
                    {modalInstance.done ? "Mark not done" : "Mark done"}
                  </button>
                  <button onClick={() => setModalInstance(null)} className="rounded px-3.5 py-2 text-xs text-paper-dim hover:text-paper">
                    Close
                  </button>
                </div>
                <button onClick={() => removeFromDay(modalInstance)} className="rounded px-3.5 py-2 text-xs border border-line text-paper-dim hover:border-danger hover:text-danger">
                  Remove from day
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ChoreAddSelect({ library, onAdd }: { library: ChoreLibraryItem[]; onAdd: (choreId: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-1 mt-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 bg-panel border border-line rounded px-1.5 py-1 text-[11px]"
      >
        <option value="">Add chore…</option>
        {library.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <button
        onClick={() => { if (value) { onAdd(value); setValue(""); } }}
        className="bg-brass-dim rounded px-2 py-1 text-[11px] hover:bg-brass"
      >
        +
      </button>
    </div>
  );
}

function AddChoreForm({
  members,
  onAdd,
}: {
  members: Member[];
  onAdd: (data: Omit<ChoreLibraryItem, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [assignedMember, setAssignedMember] = useState("");
  const [frequency, setFrequency] = useState<ChoreLibraryItem["frequency"]>("Weekly");
  const [autoRecur, setAutoRecur] = useState(true);
  const [recurWeekday, setRecurWeekday] = useState(0);
  const [recurMonthDay, setRecurMonthDay] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [recLink, setRecLink] = useState("");

  function submit() {
    if (!title.trim()) return;
    const steps = stepsText.split("\n").map((s) => s.trim()).filter(Boolean);
    onAdd({
      title,
      assigned_member: assignedMember || null,
      frequency,
      auto_recur: frequency === "One-time" ? false : autoRecur,
      recur_weekday: frequency === "Weekly" ? recurWeekday : null,
      recur_month_day: frequency === "Monthly" ? recurMonthDay : null,
      due_date: frequency === "One-time" ? (dueDate || null) : null,
      steps,
      rec_link: recLink || null,
    });
    setTitle(""); setStepsText(""); setRecLink(""); setDueDate("");
  }

  return (
    <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-line">
      <div className="flex gap-2 flex-wrap">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chore / project name…" className="flex-1 min-w-[140px] bg-panel-2 border border-line rounded px-2.5 py-2 text-xs" />
        <select value={assignedMember} onChange={(e) => setAssignedMember(e.target.value)} className="bg-panel-2 border border-line rounded px-2 py-2 text-xs">
          <option value="">Household / Everyone</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
        </select>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as ChoreLibraryItem["frequency"])} className="bg-panel-2 border border-line rounded px-2 py-2 text-xs">
          <option>Daily</option><option>Weekly</option><option>Monthly</option><option>One-time</option>
        </select>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {frequency !== "One-time" && (
          <label className="flex items-center gap-1.5 text-[11.5px] text-paper-dim">
            <input type="checkbox" checked={autoRecur} onChange={(e) => setAutoRecur(e.target.checked)} className="accent-brass" />
            Auto-recurring
          </label>
        )}
        {frequency === "Weekly" && (
          <select value={recurWeekday} onChange={(e) => setRecurWeekday(Number(e.target.value))} className="bg-panel-2 border border-line rounded px-2 py-1 text-[11px]">
            {WEEKDAY_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        )}
        {frequency === "Monthly" && (
          <input type="number" min={1} max={31} value={recurMonthDay} onChange={(e) => setRecurMonthDay(Number(e.target.value))} placeholder="Day of month" className="w-28 bg-panel-2 border border-line rounded px-2 py-1 text-[11px]" />
        )}
        {frequency === "One-time" && (
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-panel-2 border border-line rounded px-2 py-1 text-[11px]" />
        )}
      </div>
      <textarea
        value={stepsText}
        onChange={(e) => setStepsText(e.target.value)}
        placeholder={"Process steps — optional, one per line. Leave blank for a simple task."}
        className="bg-panel-2 border border-line rounded px-2.5 py-2 text-xs min-h-[50px]"
      />
      <input value={recLink} onChange={(e) => setRecLink(e.target.value)} placeholder="Link to a how-to video/voice note (optional)" className="bg-panel-2 border border-line rounded px-2.5 py-2 text-xs" />
      <button onClick={submit} className="self-start rounded bg-brass-dim px-4 py-2 text-sm hover:bg-brass">
        Save Chore
      </button>
    </div>
  );
}
