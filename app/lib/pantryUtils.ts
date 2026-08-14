export type DietaryRestriction = { item: string; severity: "avoid_always" | "prefer_not" };
export type Substitution = { original_ingredient: string; restriction: string; substitute: string };

export type RestrictionCheck = {
  hardBlocked: boolean;
  blockedBy: string[]; // restriction items that hard-excluded this recipe
  softFlags: string[]; // restriction items that are only a soft deprioritize
};

/**
 * Best-effort restriction check — see NEXTJS_PLAN.md "Dietary restrictions"
 * for the full reasoning. This is deliberately disclosed as best-effort,
 * not presented as guaranteed-safe: it does simple substring matching
 * against ingredient names, plus a lookup against known hidden sources
 * via ingredient_substitutions (e.g. "soy sauce" flagged for "gluten"
 * even though the word "gluten" never appears in the ingredient name).
 *
 * What this CANNOT catch: cross-contact (shared equipment/kitchen
 * practices) — that's explicitly out of scope for any recipe-data system.
 */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/s$/, "");
}

export function checkRestrictions(
  ingredientNames: string[],
  restrictions: DietaryRestriction[],
  substitutions: Substitution[]
): RestrictionCheck {
  const lowerIngredients = ingredientNames.map((n) => n.toLowerCase());
  const blockedBy: string[] = [];
  const softFlags: string[] = [];

  for (const r of restrictions) {
    const term = r.item.toLowerCase();
    const termNorm = normalizeWord(term);
    const directHit = lowerIngredients.some((name) => {
      // Word-level match handles singular/plural mismatches
      // ("onions" restriction vs. "Red onion" ingredient) that a raw
      // substring check misses. Whole-string substring check still runs
      // too, for multi-word restriction terms.
      const words = name.split(/\s+/).map(normalizeWord);
      return words.includes(termNorm) || name.includes(term);
    });
    const hiddenHit = substitutions.some(
      (s) =>
        s.restriction.toLowerCase() === term &&
        lowerIngredients.some((name) =>
          name.includes(s.original_ingredient.toLowerCase())
        )
    );
    if (directHit || hiddenHit) {
      if (r.severity === "avoid_always") blockedBy.push(r.item);
      else softFlags.push(r.item);
    }
  }

  return { hardBlocked: blockedBy.length > 0, blockedBy, softFlags };
}

export type PantryItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  qty_on_hand: number;
  par_level: number;
};

export type RecipeIngredient = { name: string; qty: number; unit: string | null };

export type ShoppingRow = {
  name: string;
  category: string;
  unit: string;
  neededForMeals: number;
  onHand: number;
  restock: number;
  total: number;
};

/**
 * Combines par-level restock needs with this week's selected-meal
 * ingredient needs into one shopping list — same logic as the original
 * HTML prototype's computeShoppingList(), now server-side against real data.
 */
export function computeShoppingList(
  pantry: PantryItem[],
  selectedRecipeIngredients: RecipeIngredient[][]
): ShoppingRow[] {
  const neededMap = new Map<string, number>();
  for (const ingredients of selectedRecipeIngredients) {
    for (const ing of ingredients) {
      neededMap.set(ing.name, (neededMap.get(ing.name) ?? 0) + ing.qty);
    }
  }

  const allNames = new Set<string>([
    ...pantry.map((p) => p.name),
    ...neededMap.keys(),
  ]);

  const rows: ShoppingRow[] = [];
  for (const name of allNames) {
    const p = pantry.find((x) => x.name === name);
    const onHand = p?.qty_on_hand ?? 0;
    const par = p?.par_level ?? 0;
    const needed = neededMap.get(name) ?? 0;
    const neededForMeals = Math.max(needed - onHand, 0);
    const restock = Math.max(par - onHand, 0);
    const total = neededForMeals + restock;
    if (total > 0) {
      rows.push({
        name,
        category: p?.category ?? "",
        unit: p?.unit ?? "",
        neededForMeals: needed,
        onHand,
        restock,
        total,
      });
    }
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
