"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DOW, TIME_BLOCKS, isoMonday, isoKey, addDays, fmtDate } from "@/lib/weekUtils";
import type { DayOfWeek, TimeBlock } from "@/lib/weekUtils";

type BlockType =
  | "other"
  | "workout"
  | "mealprep"
  | "hobby"
  | "project"
  | "appointment"
  | "work";

type Block = {
  id?: string;
  household_id: string;
  week_start: string;
  day_of_week: DayOfWeek;
  time_block: TimeBlock;
  type: BlockType;
  title: string;
  note: string | null;
  assigned_member: string | null;
  done: boolean;
};

type RecurringTemplate = {
  id: string;
  day_of_week: DayOfWeek;
  time_block: TimeBlock;
  type: BlockType;
  title: string;
  note: string | null;
  assigned_member: string | null;
};

type Member = { id: string; display_name: string; color: string };

const TYPE_STYLES: Record<BlockType, string> = {
  other: "bg-panel-2",
  workout: "bg-sage/15 [&_.title]:text-sage",
  mealprep: "bg-brass/15 [&_.title]:text-brass",
  hobby: "bg-danger/10 [&_.title]:text-[#d98d82]",
  project: "bg-[#7882a0]/15 [&_.title]:text-[#9aa6d6]",
  appointment: "bg-danger/15 border border-danger/35 [&_.title]:text-[#e2857a]",
  work: "bg-[#5b6b8c]/25 border border-[#5b6b8c]/40 [&_.title]:text-[#9fb3d9]",
};

export default function WeeklyGrid({
  householdId,
  weekStart,
  initialBlocks,
  members,
  initialTemplates,
}: {
  householdId: string;
  weekStart: string;
  initialBlocks: Block[];
  members: Member[];
  initialTemplates: RecurringTemplate[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [templates, setTemplates] = useState<RecurringTemplate[]>(initialTemplates);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{
    day: DayOfWeek;
    block: TimeBlock;
  } | null>(null);

  const monday = new Date(weekStart + "T00:00:00");
  const weekEnd = addDays(monday, 6);

  function blockAt(day: DayOfWeek, block: TimeBlock) {
    return blocks.find((b) => b.day_of_week === day && b.time_block === block);
  }

  function templateAt(day: DayOfWeek, block: TimeBlock) {
    return templates.find((t) => t.day_of_week === day && t.time_block === block);
  }

  function memberOf(id: string | null) {
    return members.find((m) => m.id === id);
  }

  function goToWeek(offsetDays: number) {
    const next = addDays(monday, offsetDays);
    router.push(`/grid?week=${isoKey(isoMonday(next))}`);
  }

  async function saveBlock(data: {
    type: BlockType;
    title: string;
    note: string;
    assigned_member: string;
    done: boolean;
    repeatWeekly: boolean;
  }) {
    if (!editing) return;
    setSaving(true);
    const supabase = createClient();
    const existingTemplate = templateAt(editing.day, editing.block);

    if (!data.title.trim()) {
      // Empty title = clear only THIS WEEK's block. Deliberately does
      // NOT touch any recurring template — skipping one week (a
      // holiday, a day off) shouldn't silently kill the recurrence for
      // every future week. To actually stop recurring, uncheck "Repeat
      // this every week" and Save instead of clearing.
      await supabase
        .from("weekly_blocks")
        .delete()
        .match({
          household_id: householdId,
          week_start: weekStart,
          day_of_week: editing.day,
          time_block: editing.block,
        });
      setBlocks((prev) =>
        prev.filter(
          (b) =>
            !(b.day_of_week === editing.day && b.time_block === editing.block)
        )
      );
      setSaving(false);
      setEditing(null);
      return;
    }

    const newBlock: Block = {
      household_id: householdId,
      week_start: weekStart,
      day_of_week: editing.day,
      time_block: editing.block,
      type: data.type,
      title: data.title,
      note: data.note || null,
      assigned_member: data.assigned_member || null,
      done: data.done,
    };

    const { error } = await supabase
      .from("weekly_blocks")
      .upsert(newBlock, {
        onConflict: "household_id,week_start,day_of_week,time_block",
      });

    if (!error) {
      setBlocks((prev) => [
        ...prev.filter(
          (b) =>
            !(b.day_of_week === editing.day && b.time_block === editing.block)
        ),
        newBlock,
      ]);
    }

    // Recurring template: create/update if checked, remove if unchecked
    if (data.repeatWeekly) {
      const { data: upsertedTemplate } = await supabase
        .from("recurring_block_templates")
        .upsert(
          {
            household_id: householdId,
            day_of_week: editing.day,
            time_block: editing.block,
            type: data.type,
            title: data.title,
            note: data.note || null,
            assigned_member: data.assigned_member || null,
          },
          { onConflict: "household_id,day_of_week,time_block" }
        )
        .select()
        .single();
      if (upsertedTemplate) {
        setTemplates((prev) => [
          ...prev.filter((t) => !(t.day_of_week === editing.day && t.time_block === editing.block)),
          upsertedTemplate,
        ]);
      }
    } else if (existingTemplate) {
      await supabase.from("recurring_block_templates").delete().eq("id", existingTemplate.id);
      setTemplates((prev) => prev.filter((t) => t.id !== existingTemplate.id));
    }

    setSaving(false);
    setEditing(null);
  }

  const current = editing ? blockAt(editing.day, editing.block) : undefined;
  const currentTemplate = editing ? templateAt(editing.day, editing.block) : undefined;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => goToWeek(-7)}
          className="font-mono text-xs border border-line rounded px-3 py-1.5 hover:border-brass hover:text-brass"
        >
          ← prev
        </button>
        <span className="font-mono text-sm">
          {fmtDate(monday)} – {fmtDate(weekEnd)}
        </span>
        <button
          onClick={() => goToWeek(7)}
          className="font-mono text-xs border border-line rounded px-3 py-1.5 hover:border-brass hover:text-brass"
        >
          next →
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid gap-px bg-line border border-line min-w-[1100px]"
          style={{ gridTemplateColumns: "110px repeat(7, minmax(140px, 1fr))" }}
        >
          <div className="bg-panel-2" />
          {DOW.map((day, i) => (
            <div key={day} className="bg-panel-2 text-center py-2.5 font-mono text-xs">
              <div className="font-bold">{day}</div>
              <div className="text-paper-dim text-[10.5px] mt-0.5">
                {fmtDate(addDays(monday, i))}
              </div>
            </div>
          ))}

          {TIME_BLOCKS.map((block) => (
            <div key={block} className="contents">
              <div className="bg-panel-2 flex items-center justify-center font-mono text-[11px] uppercase tracking-wide text-paper-dim text-center p-1.5">
                {block}
              </div>
              {DOW.map((day) => {
                const b = blockAt(day, block);
                const member = b ? memberOf(b.assigned_member) : null;
                const hasTemplate = !!templateAt(day, block);
                return (
                  <div key={day + block} className="bg-panel p-2 min-h-[78px]">
                    <button
                      onClick={() => setEditing({ day, block })}
                      className={`w-full h-full text-left rounded p-1.5 text-[12.5px] leading-snug border border-transparent hover:border-brass relative ${
                        b
                          ? TYPE_STYLES[b.type]
                          : "text-paper-dim italic flex items-center justify-center border-dashed border-line"
                      } ${b?.done ? "opacity-55" : ""}`}
                    >
                      {hasTemplate && (
                        <span
                          className="absolute top-1 right-1 font-mono text-[9px] text-brass"
                          title="Repeats every week"
                        >
                          ↻
                        </span>
                      )}
                      {b ? (
                        <>
                          <div className="title font-semibold">{b.title}</div>
                          {b.note && (
                            <div className="text-paper-dim text-[11px]">
                              {b.note}
                            </div>
                          )}
                          {member && (
                            <div className="font-mono text-[9.5px] uppercase tracking-wide text-paper-dim mt-0.5">
                              {member.display_name}
                            </div>
                          )}
                        </>
                      ) : (
                        "+ add"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <BlockModal
          dayLabel={`${editing.day} · ${editing.block}`}
          initial={current}
          initialTemplate={currentTemplate}
          members={members}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={saveBlock}
        />
      )}
    </div>
  );
}

function BlockModal({
  dayLabel,
  initial,
  initialTemplate,
  members,
  saving,
  onCancel,
  onSave,
}: {
  dayLabel: string;
  initial?: Block;
  initialTemplate?: RecurringTemplate;
  members: Member[];
  saving: boolean;
  onCancel: () => void;
  onSave: (data: {
    type: BlockType;
    title: string;
    note: string;
    assigned_member: string;
    done: boolean;
    repeatWeekly: boolean;
  }) => void;
}) {
  const [type, setType] = useState<BlockType>(initial?.type ?? initialTemplate?.type ?? "other");
  const [title, setTitle] = useState(initial?.title ?? initialTemplate?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? initialTemplate?.note ?? "");
  const [assignedMember, setAssignedMember] = useState(
    initial?.assigned_member ?? initialTemplate?.assigned_member ?? ""
  );
  const [done, setDone] = useState(initial?.done ?? false);
  const [repeatWeekly, setRepeatWeekly] = useState(!!initialTemplate);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-brass-dim rounded-lg p-5 w-full max-w-sm">
        <h3 className="font-serif text-lg mb-3">{dayLabel}</h3>

        <label className="font-mono text-[10px] uppercase tracking-wide text-paper-dim block mt-2 mb-1">
          Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as BlockType)}
          className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm"
        >
          <option value="other">General</option>
          <option value="work">Work</option>
          <option value="workout">Workout</option>
          <option value="mealprep">Meal Prep</option>
          <option value="hobby">Creative / Hobby</option>
          <option value="project">Home Project</option>
          <option value="appointment">Appointment</option>
        </select>

        <label className="font-mono text-[10px] uppercase tracking-wide text-paper-dim block mt-2 mb-1">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., 5k tempo run"
          className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm"
        />

        <label className="font-mono text-[10px] uppercase tracking-wide text-paper-dim block mt-2 mb-1">
          Assigned to
        </label>
        <select
          value={assignedMember}
          onChange={(e) => setAssignedMember(e.target.value)}
          className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm"
        >
          <option value="">Household / Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>

        <label className="font-mono text-[10px] uppercase tracking-wide text-paper-dim block mt-2 mb-1">
          Notes
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Details…"
          className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm min-h-[50px]"
        />

        <label className="flex items-center gap-2 mt-3 text-sm">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
            className="accent-brass"
          />
          Mark done
        </label>

        <label className="flex items-center gap-2 mt-2 text-sm">
          <input
            type="checkbox"
            checked={repeatWeekly}
            onChange={(e) => setRepeatWeekly(e.target.checked)}
            className="accent-brass"
          />
          Repeat this every week
        </label>
        <p className="font-mono text-[10px] text-paper-dim mt-1 ml-6">
          Good for a fixed work shift or anything on a set schedule.
          &quot;Clear&quot; below only skips this one week — to stop it
          recurring for good, uncheck this box and Save instead.
        </p>

        <div className="flex justify-between mt-4 gap-2">
          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={() =>
                onSave({ type, title, note, assigned_member: assignedMember, done, repeatWeekly })
              }
              className="rounded px-3.5 py-2 text-xs bg-brass-dim hover:bg-brass disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={onCancel}
              className="rounded px-3.5 py-2 text-xs text-paper-dim hover:text-paper"
            >
              Cancel
            </button>
          </div>
          {(initial || initialTemplate) && (
            <button
              onClick={() =>
                onSave({
                  type,
                  title: "",
                  note: "",
                  assigned_member: "",
                  done: false,
                  repeatWeekly: false,
                })
              }
              className="rounded px-3.5 py-2 text-xs border border-line text-paper-dim hover:border-danger hover:text-danger"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
