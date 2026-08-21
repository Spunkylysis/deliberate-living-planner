import { createClient } from "@/lib/supabase/server";
import { DOW, isoMonday, isoKey } from "@/lib/weekUtils";
import { choreAppliesOnDay } from "@/lib/choreUtils";
import type { ChoreLibraryItem } from "@/lib/choreUtils";
import { pickForToday, WELLBEING_REMINDERS } from "@/lib/dailyContent";
import WeeklyGrid from "@/components/WeeklyGrid";
import WeekChoresSummary from "@/components/WeekChoresSummary";
import DailyInspiration from "@/components/DailyInspiration";

export default async function GridPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const monday = week ? isoMonday(new Date(week)) : isoMonday(new Date());
  const weekStart = isoKey(monday);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user!.id)
    .single();

  const householdId = profile!.household_id as string;

  const [
    { data: blocks },
    { data: members },
    { data: templates },
    { data: presets },
    { data: quotes },
    { data: choreLibrary },
    { data: choreInstances },
  ] = await Promise.all([
    supabase
      .from("weekly_blocks")
      .select("*")
      .eq("household_id", householdId)
      .eq("week_start", weekStart),
    supabase
      .from("household_members")
      .select("id, display_name, color")
      .eq("household_id", householdId),
    supabase
      .from("recurring_block_templates")
      .select("*")
      .eq("household_id", householdId),
    supabase
      .from("block_presets")
      .select("*")
      .eq("household_id", householdId)
      .order("label"),
    supabase.from("quotes").select("id, text, author, source_type"),
    supabase.from("chore_library").select("*").eq("household_id", householdId),
    supabase
      .from("chore_instances")
      .select("*")
      .eq("household_id", householdId)
      .eq("week_start", weekStart),
  ]);

  // Auto-fill any cell that has a recurring template but no block yet
  // this week. ON CONFLICT DO NOTHING respects a manual entry already
  // sitting in that cell — recurring fills gaps, never overwrites.
  let finalBlocks = blocks ?? [];
  if (templates && templates.length > 0) {
    const missing = templates.filter(
      (t) =>
        !finalBlocks.some(
          (b) => b.day_of_week === t.day_of_week && b.time_block === t.time_block
        )
    );
    if (missing.length > 0) {
      const { data: inserted } = await supabase
        .from("weekly_blocks")
        .upsert(
          missing.map((t) => ({
            household_id: householdId,
            week_start: weekStart,
            day_of_week: t.day_of_week,
            time_block: t.time_block,
            type: t.type,
            title: t.title,
            note: t.note,
            assigned_member: t.assigned_member,
            done: false,
          })),
          { onConflict: "household_id,week_start,day_of_week,time_block", ignoreDuplicates: true }
        )
        .select();
      finalBlocks = [...finalBlocks, ...(inserted ?? [])];
    }
  }

  // Same auto-recurring generation as the Chores tab, run here too so
  // the compact summary below the grid always reflects the full week,
  // not just chores someone happened to open the Chores tab to trigger.
  let finalInstances = choreInstances ?? [];
  if (choreLibrary && choreLibrary.length > 0) {
    const toInsert: {
      household_id: string;
      chore_id: string;
      week_start: string;
      day_of_week: string;
      auto_generated: boolean;
    }[] = [];
    (choreLibrary as ChoreLibraryItem[]).forEach((chore) => {
      DOW.forEach((day, idx) => {
        const dateOnDay = new Date(monday);
        dateOnDay.setDate(dateOnDay.getDate() + idx);
        if (!choreAppliesOnDay(chore, idx, dateOnDay)) return;
        const already = finalInstances.some(
          (i) => i.chore_id === chore.id && i.day_of_week === day
        );
        if (!already) {
          toInsert.push({
            household_id: householdId,
            chore_id: chore.id,
            week_start: weekStart,
            day_of_week: day,
            auto_generated: true,
          });
        }
      });
    });
    if (toInsert.length > 0) {
      const { data: inserted } = await supabase
        .from("chore_instances")
        .insert(toInsert)
        .select();
      finalInstances = [...finalInstances, ...(inserted ?? [])];
    }
  }

  const today = new Date();
  const todaysQuote = quotes ? pickForToday(quotes, today) : null;
  const todaysReminder = pickForToday(WELLBEING_REMINDERS, today);

  return (
    <div className="flex flex-col gap-6">
      <DailyInspiration
        householdId={householdId}
        todaysQuote={todaysQuote}
        todaysReminder={todaysReminder}
      />
      <WeeklyGrid
        householdId={householdId}
        weekStart={weekStart}
        initialBlocks={finalBlocks}
        members={members ?? []}
        initialTemplates={templates ?? []}
        initialPresets={presets ?? []}
      />
      <WeekChoresSummary
        library={choreLibrary ?? []}
        instances={finalInstances}
        members={members ?? []}
      />
    </div>
  );
}
