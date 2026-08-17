import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { href: "/grid", label: "Weekly Grid" },
  { href: "/pantry", label: "Pantry & Meals" },
  { href: "/chores", label: "Chores" },
  // Outlook lands here once built — see NEXTJS_PLAN.md.
  { href: "/settings", label: "Settings" }, // rightmost, deliberately —
  // holds Members today, and is where future preferences (calorie
  // display toggle, theme, etc.) will live as they're built.
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

  // Header shows the household/family name, not the individual's own
  // name — this is a shared planner, so the identity that matters at
  // a glance is "whose household is this," not "who's currently logged
  // in." Individual identity still shows inside Settings > Your Profile.
  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", profile!.household_id)
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
          {household?.name ?? ""}
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
