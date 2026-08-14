import { createClient } from "@/lib/supabase/server";
import { isoMonday, isoKey } from "@/lib/weekUtils";
import WeeklyGrid from "@/components/WeeklyGrid";

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

  const [{ data: blocks }, { data: members }] = await Promise.all([
    supabase
      .from("weekly_blocks")
      .select("*")
      .eq("household_id", householdId)
      .eq("week_start", weekStart),
    supabase
      .from("profiles")
      .select("id, display_name, color")
      .eq("household_id", householdId),
  ]);

  return (
    <WeeklyGrid
      householdId={householdId}
      weekStart={weekStart}
      initialBlocks={blocks ?? []}
      members={members ?? []}
    />
  );
}
