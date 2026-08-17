"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DietaryRestriction = { item: string; severity: "avoid_always" | "prefer_not" };

type Member = {
  id: string;
  household_id: string;
  profile_id: string | null;
  display_name: string;
  color: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  dietary_restrictions: DietaryRestriction[];
};

type Household = { id: string; name: string };

function restrictionsToText(restrictions: DietaryRestriction[], severity: string) {
  return restrictions.filter((r) => r.severity === severity).map((r) => r.item).join(", ");
}

function textToRestrictions(avoidText: string, preferText: string): DietaryRestriction[] {
  const parse = (text: string, severity: "avoid_always" | "prefer_not") =>
    text.split(",").map((s) => s.trim()).filter(Boolean).map((item) => ({ item, severity }));
  return [...parse(avoidText, "avoid_always"), ...parse(preferText, "prefer_not")];
}

export default function MembersPanel({
  currentUserId,
  household,
  initialMembers,
}: {
  currentUserId: string;
  household: Household;
  initialMembers: Member[];
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [copied, setCopied] = useState(false);
  const me = members.find((m) => m.profile_id === currentUserId);
  const others = members.filter((m) => m.profile_id !== currentUserId);

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

  async function saveMember(memberId: string, data: {
    display_name: string;
    color: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    avoidText: string;
    preferText: string;
  }) {
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
    const { error } = await supabase.from("household_members").update(update).eq("id", memberId);
    if (!error) {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...update } : m)));
    }
  }

  async function addPlaceholder(data: { display_name: string; color: string; role: string; phone: string; email: string }) {
    const supabase = createClient();
    const { data: inserted, error } = await supabase
      .from("household_members")
      .insert({
        household_id: household.id,
        display_name: data.display_name,
        color: data.color,
        role: data.role || null,
        phone: data.phone || null,
        email: data.email || null,
      })
      .select()
      .single();
    if (!error && inserted) setMembers((prev) => [...prev, inserted]);
  }

  async function removePlaceholder(memberId: string) {
    const supabase = createClient();
    await supabase.from("household_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-panel border border-line rounded-md p-5">
        <h2 className="font-serif text-lg mb-1">{household.name}</h2>
        <p className="font-mono text-[10.5px] text-paper-dim mb-3">
          Share this ID with another adult — they sign up, then choose &quot;Join a
          household&quot; during onboarding. For kids or anyone who shouldn&apos;t
          have their own login, add them directly below instead — no account
          needed for them to be assigned chores or shown on the schedule.
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
          <MemberForm member={me} onSave={(data) => saveMember(me.id, data)} />
        </section>
      )}

      <section className="bg-panel border border-line rounded-md p-5">
        <h2 className="font-serif text-lg mb-1">Household Members</h2>
        <p className="font-mono text-[10.5px] text-paper-dim mb-3">
          Members with their own login are read-only here — they manage their
          own profile above. Anyone without a login (kids, etc.) can be
          edited by any adult in the household.
        </p>
        {others.length === 0 ? (
          <p className="text-paper-dim text-sm">
            Nobody else yet — share the household ID above, or add a placeholder member below.
          </p>
        ) : (
          <div className="flex flex-col gap-3 mb-4">
            {others.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                editable={m.profile_id === null}
                onSave={(data) => saveMember(m.id, data)}
                onRemove={() => removePlaceholder(m.id)}
              />
            ))}
          </div>
        )}
        <AddPlaceholderForm onAdd={addPlaceholder} />
      </section>
    </div>
  );
}

function MemberRow({
  member,
  editable,
  onSave,
  onRemove,
}: {
  member: Member;
  editable: boolean;
  onSave: (data: {
    display_name: string; color: string; role: string | null;
    phone: string | null; email: string | null; avoidText: string; preferText: string;
  }) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!editable) {
    return (
      <div className="flex items-center gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: member.color }} />
        <div>
          <div className="text-sm font-medium">{member.display_name}</div>
          <div className="font-mono text-[10.5px] text-paper-dim">
            {[member.role, member.phone, member.email].filter(Boolean).join(" · ")}
            {" · has own login"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: member.color }} />
          <div>
            <div className="text-sm font-medium">{member.display_name}</div>
            <div className="font-mono text-[10.5px] text-paper-dim">
              {[member.role, member.phone, member.email].filter(Boolean).join(" · ") || "no account — placeholder"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setExpanded((v) => !v)} className="font-mono text-[10.5px] border border-line rounded px-2 py-1 text-paper-dim hover:border-brass hover:text-brass">
            {expanded ? "Close" : "Edit"}
          </button>
          <button onClick={onRemove} className="font-mono text-[10.5px] border border-line rounded px-2 py-1 text-paper-dim hover:border-danger hover:text-danger">
            Remove
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3">
          <MemberForm member={member} onSave={onSave} />
        </div>
      )}
    </div>
  );
}

function MemberForm({
  member,
  onSave,
}: {
  member: Member;
  onSave: (data: {
    display_name: string; color: string; role: string | null;
    phone: string | null; email: string | null; avoidText: string; preferText: string;
  }) => void;
}) {
  const [name, setName] = useState(member.display_name);
  const [color, setColor] = useState(member.color);
  const [role, setRole] = useState(member.role ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [avoidText, setAvoidText] = useState(restrictionsToText(member.dietary_restrictions ?? [], "avoid_always"));
  const [preferText, setPreferText] = useState(restrictionsToText(member.dietary_restrictions ?? [], "prefer_not"));
  const [saved, setSaved] = useState(false);

  function submit() {
    onSave({
      display_name: name, color, role: role || null, phone: phone || null,
      email: email || null, avoidText, preferText,
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
          <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">Email (optional)</label>
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
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

function AddPlaceholderForm({ onAdd }: { onAdd: (data: { display_name: string; color: string; role: string; phone: string; email: string }) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7fa07a");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd({ display_name: name, color, role, phone, email });
    setName(""); setRole(""); setPhone(""); setEmail("");
  }

  return (
    <div className="pt-3 border-t border-line">
      <p className="font-mono text-[10px] uppercase text-brass mb-2">Add a member without a login</p>
      <p className="font-mono text-[10.5px] text-paper-dim mb-2">
        Works for a co-parent or roommate too — email/phone here are just
        contact info, not a login. They can always sign up for their own
        account later, which links to a fresh row instead of this one.
      </p>
      <div className="flex gap-2 flex-wrap items-center">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name…" className="flex-1 min-w-[120px] bg-panel-2 border border-line rounded px-2.5 py-2 text-xs" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-9 bg-panel-2 border border-line rounded p-1" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. Kid, Roommate)" className="w-40 bg-panel-2 border border-line rounded px-2.5 py-2 text-xs" />
      </div>
      <div className="flex gap-2 flex-wrap items-center mt-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="flex-1 min-w-[140px] bg-panel-2 border border-line rounded px-2.5 py-2 text-xs" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional, contact only)" className="flex-1 min-w-[180px] bg-panel-2 border border-line rounded px-2.5 py-2 text-xs" />
        <button onClick={submit} className="rounded bg-brass-dim px-3 py-2 text-xs hover:bg-brass">Add</button>
      </div>
    </div>
  );
}
