import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { href: "/grid", label: "Weekly Grid" },
  { href: "/pantry", label: "Pantry & Meals" },
  // Chores, Members, Outlook land here as they're built —
  // see NEXTJS_PLAN.md for the agreed build order.
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
    .select("household_id, display_name")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) {
    redirect("/onboarding");
  }

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
          {profile.display_name}
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
