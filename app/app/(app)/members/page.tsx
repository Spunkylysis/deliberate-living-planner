import { createClient } from "@/lib/supabase/server";
import MembersPanel from "@/components/MembersPanel";

export default async function MembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const householdId = myProfile!.household_id as string;

  const { data: household } = await supabase
    .from("households")
    .select("id, name")
    .eq("id", householdId)
    .single();

  const { data: members } = await supabase
    .from("profiles")
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
