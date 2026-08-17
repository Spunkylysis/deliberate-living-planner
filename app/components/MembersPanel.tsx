"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DietaryRestriction = { item: string; severity: "avoid_always" | "prefer_not" };

type Profile = {
  id: string;
  household_id: string;
  display_name: string;
  color: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  dietary_restrictions: DietaryRestriction[];
};

type Household = { id: string; name: string };

function restrictionsToText(restrictions: DietaryRestriction[], severity: string) {
  return restrictions
    .filter((r) => r.severity === severity)
    .map((r) => r.item)
    .join(", ");
}

function textToRestrictions(avoidText: string, preferText: string): DietaryRestriction[] {
  const parse = (text: string, severity: "avoid_always" | "prefer_not") =>
    text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => ({ item, severity }));
  return [...parse(avoidText, "avoid_always"), ...parse(preferText, "prefer_not")];
}

export default function MembersPanel({
  currentUserId,
  household,
  initialMembers,
}: {
  currentUserId: string;
  household: Household;
  initialMembers: Profile[];
}) {
  const [members, setMembers] = useState<Profile[]>(initialMembers);
  const [copied, setCopied] = useState(false);
  const me = members.find((m) => m.id === currentUserId);
  const others = members.filter((m) => m.id !== currentUserId);

  async function copyHouseholdId() {
    try {
      await navigator.clipboard.writeText(household.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API can be blocked in some contexts — the ID is
      // still visible in the box below to copy manually either way
    }
  }

  async function saveMyProfile(data: {
    display_name: string;
    color: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    avoidText: string;
    preferText: string;
  }) {
    if (!me) return;
    const dietary_restrictions = textToRestrictions(data.avoidText, data.preferText);
    const update = {
      display_name: data.display_name,
      color: data.color,
      role: data.role,
      phone: data.phone,
      email: data.email,
      dietary_restrictions,
    };
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(update).eq("id", currentUserId);
    if (!error) {
      setMembers((prev) =>
        prev.map((m) => (m.id === currentUserId ? { ...m, ...update } : m))
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-panel border border-line rounded-md p-5">
        <h2 className="font-serif text-lg mb-1">{household.name}</h2>
        <p className="font-mono text-[10.5px] text-paper-dim mb-3">
          Share this ID with someone else — they sign up, then choose &quot;Join a
          household&quot; during onboarding and paste this in. There&apos;s no
          separate way to add a person who won&apos;t sign in themselves — every
          member here is tied to a real login, since dietary filtering and
          per-person assignment both depend on knowing who&apos;s actually
          signed in.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-panel-2 border border-line rounded px-3 py-2 text-xs break-all">
            {household.id}
          </code>
          <button
            onClick={copyHouseholdId}
            className="rounded bg-brass-dim px-3 py-2 text-xs hover:bg-brass whitespace-nowrap"
          >
            {copied ? "Copied" : "Copy ID"}
          </button>
        </div>
      </section>

      {me && (
        <section className="bg-panel border border-line rounded-md p-5">
          <h2 className="font-serif text-lg mb-1">Your Profile</h2>
          <p className="font-mono text-[10.5px] text-paper-dim mb-3">
            Only you can edit this — everyone in the household can see it
          </p>
          <SelfProfileForm profile={me} onSave={saveMyProfile} />
        </section>
      )}

      <section className="bg-panel border border-line rounded-md p-5">
        <h2 className="font-serif text-lg mb-3">Other Members</h2>
        {others.length === 0 ? (
          <p className="text-paper-dim text-sm">
            Nobody else has joined yet — share the household ID above.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {others.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ background: m.color }}
                />
                <div>
                  <div className="text-sm font-medium">{m.display_name}</div>
                  <div className="font-mono text-[10.5px] text-paper-dim">
                    {[m.role, m.phone, m.email].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SelfProfileForm({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (data: {
    display_name: string;
    color: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    avoidText: string;
    preferText: string;
  }) => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [color, setColor] = useState(profile.color);
  const [role, setRole] = useState(profile.role ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [avoidText, setAvoidText] = useState(
    restrictionsToText(profile.dietary_restrictions ?? [], "avoid_always")
  );
  const [preferText, setPreferText] = useState(
    restrictionsToText(profile.dietary_restrictions ?? [], "prefer_not")
  );
  const [saved, setSaved] = useState(false);

  function submit() {
    onSave({
      display_name: name,
      color,
      role: role || null,
      phone: phone || null,
      email: email || null,
      avoidText,
      preferText,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm" />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-14 h-9 bg-panel-2 border border-line rounded p-1" />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Role</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Spouse, Kid" className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm" />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Email (optional, separate from login email)</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm" />
        </div>
      </div>

      <div className="pt-2 border-t border-dashed border-line">
        <p className="font-mono text-[10px] uppercase text-paper-dim mb-2">
          Dietary restrictions — hard excludes recipes, soft just deprioritizes them
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Always avoid (comma-separated)</label>
            <input value={avoidText} onChange={(e) => setAvoidText(e.target.value)} placeholder="gluten, peanuts" className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Prefer not (comma-separated)</label>
            <input value={preferText} onChange={(e) => setPreferText(e.target.value)} placeholder="onions, cilantro" className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm" />
          </div>
        </div>
      </div>

      <button onClick={submit} className="self-start mt-2 rounded bg-brass-dim px-4 py-2 text-sm hover:bg-brass">
        {saved ? "Saved" : "Save Profile"}
      </button>
    </div>
  );
}
