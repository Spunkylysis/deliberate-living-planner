"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeShoppingList } from "@/lib/pantryUtils";

type PantryItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  qty_on_hand: number;
  par_level: number;
};

type RecipeIngredient = { id: string; recipe_id: string; name: string; qty: number; unit: string | null };

type Recipe = {
  id: string;
  name: string;
  stars: number | null;
  chili_level: number | null;
  calories_per_serving: number | null;
  ingredients: RecipeIngredient[];
  restrictionCheck: { hardBlocked: boolean; blockedBy: string[]; softFlags: string[] };
};

type MealPlanRow = { id: string; slot: number; recipe_id: string | null };

export default function PantryMeals({
  householdId,
  weekStart,
  initialPantry,
  initialRecipes,
  initialMealPlan,
}: {
  householdId: string;
  weekStart: string;
  initialPantry: PantryItem[];
  initialRecipes: Recipe[];
  initialMealPlan: MealPlanRow[];
}) {
  const [pantry, setPantry] = useState<PantryItem[]>(initialPantry);
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [picks, setPicks] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const row of initialMealPlan) {
      if (row.recipe_id) m[row.slot] = row.recipe_id;
    }
    return m;
  });
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const availableRecipes = recipes.filter((r) => !r.restrictionCheck.hardBlocked);
  const blockedRecipes = recipes.filter((r) => r.restrictionCheck.hardBlocked);

  const shoppingList = useMemo(() => {
    const selectedIngredients = Object.values(picks)
      .map((recipeId) => recipes.find((r) => r.id === recipeId))
      .filter((r): r is Recipe => !!r)
      .map((r) => r.ingredients.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit ?? "" })));
    return computeShoppingList(
      pantry.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        qty_on_hand: p.qty_on_hand,
        par_level: p.par_level,
      })),
      selectedIngredients
    );
  }, [pantry, picks, recipes]);

  async function updatePantryField(id: string, field: "qty_on_hand" | "par_level", value: number) {
    setPantry((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    const supabase = createClient();
    await supabase.from("pantry_items").update({ [field]: value }).eq("id", id);
  }

  async function addPantryItem(data: { name: string; category: string; unit: string; qty_on_hand: number; par_level: number }) {
    const supabase = createClient();
    const { data: inserted, error } = await supabase
      .from("pantry_items")
      .insert({ household_id: householdId, ...data })
      .select()
      .single();
    if (!error && inserted) setPantry((prev) => [...prev, inserted]);
  }

  async function addRecipe(name: string, rawIngredients: string) {
    const supabase = createClient();
    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({ household_id: householdId, name })
      .select()
      .single();
    if (error || !recipe) return;

    const ingredients = rawIngredients
      .split("\n")
      .map((line) => line.split(",").map((s) => s.trim()))
      .filter((parts) => parts[0])
      .map((parts) => ({
        recipe_id: recipe.id,
        name: parts[0],
        qty: parseFloat(parts[1]) || 1,
        unit: parts[2] || null,
      }));

    if (ingredients.length) {
      await supabase.from("recipe_ingredients").insert(ingredients);
    }

    setRecipes((prev) => [
      ...prev,
      {
        ...recipe,
        ingredients: ingredients.map((i, idx) => ({ id: `local-${idx}`, ...i })),
        restrictionCheck: { hardBlocked: false, blockedBy: [], softFlags: [] },
      },
    ]);
  }

  async function setPick(slot: number, recipeId: string) {
    setPicks((prev) => ({ ...prev, [slot]: recipeId }));
    const supabase = createClient();
    await supabase
      .from("meal_plan")
      .upsert(
        { household_id: householdId, week_start: weekStart, slot, recipe_id: recipeId || null },
        { onConflict: "household_id,week_start,slot" }
      );
  }

  async function requestAiSuggestion() {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai-suggest", { method: "POST" });
      const data = await res.json();
      setAiResult(data.suggestion ?? data.error ?? "No suggestion returned.");
    } catch {
      setAiResult("Couldn't reach the suggestion service right now.");
    }
    setAiLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Pantry */}
      <section className="bg-panel border border-line rounded-md p-5">
        <h2 className="font-serif text-lg mb-1">Pantry & Staples</h2>
        <p className="font-mono text-[10.5px] text-paper-dim mb-3">
          Rows below par level feed the shopping list automatically
        </p>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase text-paper-dim border-b border-line">
              <th className="py-1.5">Item</th>
              <th>Category</th>
              <th>Unit</th>
              <th>On Hand</th>
              <th>Par</th>
            </tr>
          </thead>
          <tbody>
            {pantry.map((item) => {
              const short = item.par_level - item.qty_on_hand > 0;
              return (
                <tr key={item.id} className={`border-b border-line ${short ? "bg-danger/10" : ""}`}>
                  <td className="py-1.5">{item.name}</td>
                  <td className="text-paper-dim">{item.category}</td>
                  <td className="text-paper-dim">{item.unit}</td>
                  <td>
                    <input
                      type="number"
                      step="0.25"
                      defaultValue={item.qty_on_hand}
                      onBlur={(e) => updatePantryField(item.id, "qty_on_hand", parseFloat(e.target.value) || 0)}
                      className="w-16 bg-panel-2 border border-line rounded px-1.5 py-0.5"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.25"
                      defaultValue={item.par_level}
                      onBlur={(e) => updatePantryField(item.id, "par_level", parseFloat(e.target.value) || 0)}
                      className="w-16 bg-panel-2 border border-line rounded px-1.5 py-0.5"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <AddPantryForm onAdd={addPantryItem} />
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recipes */}
        <section className="bg-panel border border-line rounded-md p-5">
          <h2 className="font-serif text-lg mb-1">Saved Recipes</h2>
          <p className="font-mono text-[10.5px] text-paper-dim mb-3">
            Hard-restricted recipes are hidden from meal picks, shown below for transparency
          </p>
          {availableRecipes.map((r) => (
            <div key={r.id} className="border border-line rounded p-2.5 mb-2 text-[12.5px]">
              <div className="font-semibold flex items-center gap-2 flex-wrap">
                {r.name}
                {r.stars && <span className="text-brass">{"★".repeat(r.stars)}</span>}
                {r.chili_level ? <span>{"🌶️".repeat(r.chili_level)}</span> : null}
                {r.calories_per_serving && (
                  <span className="font-mono text-[10px] text-paper-dim">
                    {r.calories_per_serving} cal/serving
                  </span>
                )}
              </div>
              {r.restrictionCheck.softFlags.length > 0 && (
                <div className="text-[11px] text-paper-dim mt-1">
                  Contains preferences to avoid: {r.restrictionCheck.softFlags.join(", ")}
                </div>
              )}
            </div>
          ))}
          {blockedRecipes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line">
              <p className="font-mono text-[10px] uppercase text-paper-dim mb-2">
                Excluded — hard dietary restriction
              </p>
              {blockedRecipes.map((r) => (
                <div key={r.id} className="text-[12px] text-paper-dim mb-1">
                  {r.name} — contains {r.restrictionCheck.blockedBy.join(", ")}
                </div>
              ))}
            </div>
          )}
          <AddRecipeForm onAdd={addRecipe} />
        </section>

        {/* This week's meals + AI */}
        <section className="bg-panel border border-line rounded-md p-5">
          <h2 className="font-serif text-lg mb-3">This Week&apos;s Meals</h2>
          {[1, 2, 3].map((slot) => (
            <div key={slot} className="mb-2.5">
              <label className="font-mono text-[10px] uppercase text-paper-dim block mb-1">
                Meal {slot}
              </label>
              <select
                value={picks[slot] ?? ""}
                onChange={(e) => setPick(slot, e.target.value)}
                className="w-full bg-panel-2 border border-line rounded px-2.5 py-2 text-sm"
              >
                <option value="">—</option>
                {availableRecipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className="mt-4 pt-4 border-t border-dashed border-brass-dim">
            <p className="font-mono text-[10.5px] uppercase text-brass mb-2">AI Suggestions</p>
            <button
              onClick={requestAiSuggestion}
              disabled={aiLoading}
              className="rounded bg-brass-dim px-4 py-2 text-sm hover:bg-brass disabled:opacity-50"
            >
              {aiLoading ? "Thinking…" : "Suggest a meal from what I have"}
            </button>
            {aiResult && <p className="text-sm mt-3 leading-relaxed">{aiResult}</p>}
          </div>
        </section>
      </div>

      {/* Shopping list */}
      <section className="bg-panel border border-line rounded-md p-5">
        <h2 className="font-serif text-lg mb-3">Shopping List</h2>
        {shoppingList.length === 0 ? (
          <p className="text-paper-dim text-sm">Nothing needed right now — pantry covers this week.</p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase text-paper-dim border-b border-line">
                <th className="py-1.5">Item</th>
                <th>Category</th>
                <th>Need for Meals</th>
                <th>On Hand</th>
                <th>Restock</th>
                <th>Total to Buy</th>
              </tr>
            </thead>
            <tbody>
              {shoppingList.map((row) => (
                <tr key={row.name} className="border-b border-line">
                  <td className="py-1.5">{row.name}</td>
                  <td className="text-paper-dim">{row.category}</td>
                  <td>{row.neededForMeals || ""}</td>
                  <td>{row.onHand}</td>
                  <td>{row.restock || ""}</td>
                  <td className="font-semibold">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function AddPantryForm({
  onAdd,
}: {
  onAdd: (data: { name: string; category: string; unit: string; qty_on_hand: number; par_level: number }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [onHand, setOnHand] = useState("");
  const [par, setPar] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd({
      name,
      category,
      unit,
      qty_on_hand: parseFloat(onHand) || 0,
      par_level: parseFloat(par) || 0,
    });
    setName("");
    setCategory("");
    setUnit("");
    setOnHand("");
    setPar("");
  }

  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ingredient…" className="flex-1 min-w-[120px] bg-panel-2 border border-line rounded px-2 py-1.5 text-xs" />
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-28 bg-panel-2 border border-line rounded px-2 py-1.5 text-xs" />
      <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="w-20 bg-panel-2 border border-line rounded px-2 py-1.5 text-xs" />
      <input value={onHand} onChange={(e) => setOnHand(e.target.value)} placeholder="On hand" type="number" className="w-20 bg-panel-2 border border-line rounded px-2 py-1.5 text-xs" />
      <input value={par} onChange={(e) => setPar(e.target.value)} placeholder="Par" type="number" className="w-20 bg-panel-2 border border-line rounded px-2 py-1.5 text-xs" />
      <button onClick={submit} className="rounded bg-brass-dim px-3 py-1.5 text-xs hover:bg-brass">
        Add
      </button>
    </div>
  );
}

function AddRecipeForm({ onAdd }: { onAdd: (name: string, ingredients: string) => void }) {
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState("");

  function submit() {
    if (!name.trim() || !ingredients.trim()) return;
    onAdd(name, ingredients);
    setName("");
    setIngredients("");
  }

  return (
    <div className="flex flex-col gap-2 mt-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name…" className="bg-panel-2 border border-line rounded px-2.5 py-2 text-xs" />
      <textarea
        value={ingredients}
        onChange={(e) => setIngredients(e.target.value)}
        placeholder={"One ingredient per line: name, qty, unit\ne.g. Chicken breasts, 1.5, lb"}
        className="bg-panel-2 border border-line rounded px-2.5 py-2 text-xs min-h-[60px]"
      />
      <button onClick={submit} className="self-start rounded bg-brass-dim px-3 py-1.5 text-xs hover:bg-brass">
        Save Recipe
      </button>
    </div>
  );
}
