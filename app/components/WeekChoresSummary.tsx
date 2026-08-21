"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DOW } from "@/lib/weekUtils";

type ChoreLibraryItem = {
  id: string;
  title: string;
  assigned_member: string | null;
  steps: string[];
  rec_link: string | null;
};

type Instance = {
  id: string;
  chore_id: string;
  day_of_week: string;
  done: boolean;
};

type Member = { id: string; display_name: string; color: string };

export default function WeekChoresSummary({
  library,
  instances,
  members,
}: {
  library: ChoreLibraryItem[];
  instances: Instance[];
  members: Member[];
}) {
  const [localInstances, setLocalInstances] = useState(instances);

  function choreOf(id: string) {
    return library.find((c) => c.id === id);
  }
  function memberOf(id: string | null) {
    return members.find((m) => m.id === id);
  }

  async function toggleDone(instance: Instance) {
    const supabase = createClient();
    const { error } = await supabase
      .from("chore_instances")
      .update({ done: !instance.done })
      .eq("id", instance.id);
    if (!error) {
      setLocalInstances((prev) =>
        prev.map((i) => (i.id === instance.id ? { ...i, done: !i.done } : i))
      );
    }
  }

  const totalCount = localInstances.length;
  if (totalCount === 0) return null;

  return (
    <section className="bg-panel border border-line rounded-md p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-lg">This Week&apos;s Chores</h2>
        <a href="/chores" className="font-mono text-[10.5px] text-brass hover:underline">
          Manage in Chores →
        </a>
      </div>
      <div className="grid grid-cols-7 gap-3 overflow-x-auto">
        {DOW.map((day) => {
          const dayInstances = localInstances.filter((i) => i.day_of_week === day);
          return (
            <div key={day} className="min-w-[130px]">
              <div className="font-mono text-[10.5px] uppercase text-paper-dim mb-1.5">{day}</div>
              {dayInstances.length === 0 ? (
                <div className="text-paper-dim text-[11px] italic">—</div>
              ) : (
                dayInstances.map((inst) => {
                  const chore = choreOf(inst.chore_id);
                  if (!chore) return null;
                  const m = memberOf(chore.assigned_member);
                  return (
                    <label
                      key={inst.id}
                      className="flex items-center gap-1.5 text-[12px] mb-1 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={inst.done}
                        onChange={() => toggleDone(inst)}
                        className="accent-brass flex-shrink-0"
                      />
                      <span className={inst.done ? "line-through text-paper-dim" : ""}>
                        {chore.title}
                      </span>
                      {m && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: m.color }}
                        />
                      )}
                    </label>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
