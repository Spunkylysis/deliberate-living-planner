import { createClient } from "@/lib/supabase/server";
import MembersPanel from "@/components/MembersPanel";

export default async function MembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user!.id)
    .single();

  const householdId = myProfile!.household_id as string;

  const { data: household } = await supabase
    .from("households")
    .select("id, name")
    .eq("id", householdId)
    .single();

  // household_members is the roster: linked rows (profile_id set) are
  // real signed-in adults; unlinked rows are placeholders — kids or
  // anyone who shouldn't have their own login. See migration 0008 for
  // the full reasoning and the RLS trust model behind this split.
  const { data: members } = await supabase
    .from("household_members")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at");

  return (
    <MembersPanel
      currentUserId={user!.id}
      household={household!}
      initialMembers={members ?? []}
    />
  );
}
