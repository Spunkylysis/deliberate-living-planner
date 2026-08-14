import { createClient } from "@/lib/supabase/server";
import { isoMonday, isoKey } from "@/lib/weekUtils";
import { checkRestrictions } from "@/lib/pantryUtils";
import type { DietaryRestriction } from "@/lib/pantryUtils";
import PantryMeals from "@/components/PantryMeals";

export default async function PantryPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const monday = week ? isoMonday(new Date(week)) : isoMonday(new Date());
  const weekStart = isoKey(monday);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id, dietary_restrictions")
    .eq("id", user!.id)
    .single();

  const householdId = profile!.household_id as string;
  const restrictions = (profile!.dietary_restrictions ?? []) as DietaryRestriction[];

  const [
    { data: pantry },
    { data: recipes },
    { data: recipeIngredients },
    { data: substitutions },
    { data: mealPlan },
  ] = await Promise.all([
    supabase
      .from("pantry_items")
      .select("*")
      .eq("household_id", householdId)
      .order("category"),
    supabase.from("recipes").select("*").eq("household_id", householdId),
    supabase
      .from("recipe_ingredients")
      .select("*, recipes!inner(household_id)")
      .eq("recipes.household_id", householdId),
    supabase.from("ingredient_substitutions").select("*"),
    supabase
      .from("meal_plan")
      .select("*")
      .eq("household_id", householdId)
      .eq("week_start", weekStart),
  ]);

  // Attach ingredients + a restriction check to each recipe. This runs
  // server-side so the client never has to re-derive it, and so a recipe
  // that's hard-blocked never even reaches the browser as "available."
  const recipesWithCheck = (recipes ?? []).map((r) => {
    const ingredients = (recipeIngredients ?? []).filter(
      (ri) => ri.recipe_id === r.id
    );
    const check = checkRestrictions(
      ingredients.map((i) => i.name),
      restrictions,
      substitutions ?? []
    );
    return { ...r, ingredients, restrictionCheck: check };
  });

  return (
    <PantryMeals
      householdId={householdId}
      weekStart={weekStart}
      initialPantry={pantry ?? []}
      initialRecipes={recipesWithCheck}
      initialMealPlan={mealPlan ?? []}
    />
  );
}
