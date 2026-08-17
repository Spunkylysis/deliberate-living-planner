import { createClient } from "@/lib/supabase/server";
import { DOW, isoMonday, isoKey, addDays } from "@/lib/weekUtils";
import { choreAppliesOnDay } from "@/lib/choreUtils";
import type { ChoreLibraryItem } from "@/lib/choreUtils";
import ChoresPanel from "@/components/ChoresPanel";

export default async function ChoresPage({
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

  const [{ data: library }, { data: members }, { data: existingInstances }] =
    await Promise.all([
      supabase.from("chore_library").select("*").eq("household_id", householdId),
      supabase.from("profiles").select("id, display_name, color").eq("household_id", householdId),
      supabase
        .from("chore_instances")
        .select("*")
        .eq("household_id", householdId)
        .eq("week_start", weekStart),
    ]);

  // Auto-generate any missing recurring instances for this week. Runs
  // as part of the page load (same pragmatic pattern as the rest of
  // this app) rather than a separate cron — cheap since it's an
  // idempotent check-then-insert, and it's exactly how the original
  // HTML prototype's client-side version worked too.
  const toInsert: {
    household_id: string;
    chore_id: string;
    week_start: string;
    day_of_week: string;
    auto_generated: boolean;
  }[] = [];

  (library ?? []).forEach((chore: ChoreLibraryItem) => {
    DOW.forEach((day, idx) => {
      const dateOnDay = addDays(monday, idx);
      if (!choreAppliesOnDay(chore, idx, dateOnDay)) return;
      const already = (existingInstances ?? []).some(
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

  let instances = existingInstances ?? [];
  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from("chore_instances")
      .insert(toInsert)
      .select();
    instances = [...instances, ...(inserted ?? [])];
  }

  return (
    <ChoresPanel
      householdId={householdId}
      weekStart={weekStart}
      library={library ?? []}
      members={members ?? []}
      initialInstances={instances}
    />
  );
}
