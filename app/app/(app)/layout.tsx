import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { href: "/grid", label: "Weekly Grid" },
  { href: "/pantry", label: "Pantry & Meals" },
  { href: "/members", label: "Members" },
  { href: "/chores", label: "Chores" },
  // Outlook lands here once built — see NEXTJS_PLAN.md.
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // household_members is the canonical source for display info now
  // (name/color/role/etc), not profiles — editing your name in the
  // Members tab writes there, so the header reads from there too,
  // rather than risking a stale name if profiles isn't also updated.
  const { data: myMember } = await supabase
    .from("household_members")
    .select("display_name")
    .eq("profile_id", user.id)
    .single();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brass">
            Deliberate Living
          </p>
          <h1 className="font-serif text-2xl">Weekly Planner</h1>
        </div>
        <p className="font-mono text-xs text-paper-dim">
          {myMember?.display_name ?? ""}
        </p>
      </header>

      <nav className="flex gap-1 px-5 pt-4">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="font-mono text-xs uppercase tracking-wide px-4 py-2 rounded-t-md bg-panel text-paper-dim hover:text-brass border border-line border-b-0"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <main className="p-5">{children}</main>
    </div>
  );
}
