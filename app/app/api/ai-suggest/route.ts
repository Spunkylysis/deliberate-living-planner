import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side AI suggestion endpoint. Unlike the original HTML prototype
 * (which called api.anthropic.com directly from the browser — fine inside
 * a Claude.ai artifact, where that call is proxied automatically, but not
 * a pattern that works outside one), this holds ANTHROPIC_API_KEY as a
 * server-only env var, per the two-mode AI split in NEXTJS_PLAN.md:
 * prefer a saved recipe that fits the pantry, invent something new only
 * when nothing does.
 *
 * NOTE: this route has not been exercised against a live API call —
 * ANTHROPIC_API_KEY isn't configured in the build/test environment this
 * was written in. The code follows Anthropic's documented request shape,
 * but "compiles and matches the API docs" isn't the same claim as
 * "confirmed working against a live response" — that check happens once
 * a real key is wired up.
 */
export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI suggestions aren't configured yet (missing ANTHROPIC_API_KEY)." },
      { status: 501 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id, dietary_restrictions")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) {
    return NextResponse.json({ error: "No household yet." }, { status: 400 });
  }

  const [{ data: pantry }, { data: recipes }, { data: ingredients }] = await Promise.all([
    supabase.from("pantry_items").select("name, qty_on_hand, unit").eq("household_id", profile.household_id),
    supabase.from("recipes").select("id, name").eq("household_id", profile.household_id),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, name")
      .in("recipe_id", (await supabase.from("recipes").select("id").eq("household_id", profile.household_id)).data?.map((r) => r.id) ?? []),
  ]);

  const pantrySummary =
    pantry?.map((p) => `${p.name}: ${p.qty_on_hand} ${p.unit ?? ""} on hand`).join("; ") || "pantry is empty";

  const recipeSummary =
    recipes
      ?.map((r) => {
        const ing = ingredients?.filter((i) => i.recipe_id === r.id).map((i) => i.name) ?? [];
        return `"${r.name}" needs: ${ing.join(", ")}`;
      })
      .join(" | ") || "no saved recipes";

  const restrictions = profile.dietary_restrictions ?? [];
  const restrictionSummary = Array.isArray(restrictions) && restrictions.length
    ? restrictions.map((r: { item: string; severity: string }) => `${r.item} (${r.severity})`).join(", ")
    : "none listed";

  const prompt = `You are helping plan a meal for a household. Pantry: ${pantrySummary}
Saved recipes: ${recipeSummary}
Dietary restrictions to respect (hard-exclude "avoid_always" items entirely): ${restrictionSummary}

First check if a saved recipe fits well given what's on hand and respects the restrictions. If one fits, recommend it and explain briefly why. If none fit well or all safe options are excluded by restrictions, invent ONE new simple, healthy meal idea using mostly what's on hand, respecting the restrictions.

Respond in 2-3 plain sentences, no markdown, no JSON — just the suggestion and a brief reason.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Suggestion service returned an error." }, { status: 502 });
    }

    const data = await response.json();
    const textBlock = (data.content ?? []).find((c: { type: string }) => c.type === "text");
    return NextResponse.json({ suggestion: textBlock?.text ?? "No suggestion returned." });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the suggestion service." }, { status: 502 });
  }
}
