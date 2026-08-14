import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route. Never rendered directly — routes the visitor to
 * wherever they actually belong based on auth + onboarding state.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) {
    redirect("/onboarding");
  }

  redirect("/grid");
}
