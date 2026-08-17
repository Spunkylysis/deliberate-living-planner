export type ChoreLibraryItem = {
  id: string;
  household_id: string;
  title: string;
  assigned_member: string | null;
  frequency: "Daily" | "Weekly" | "Monthly" | "One-time";
  auto_recur: boolean;
  recur_weekday: number | null;
  recur_month_day: number | null;
  due_date: string | null;
  steps: string[];
  rec_link: string | null;
};

export type ChoreInstance = {
  id: string;
  household_id: string;
  chore_id: string;
  week_start: string;
  day_of_week: string;
  done: boolean;
  auto_generated: boolean;
};

/**
 * Does this library chore auto-recur onto the given day within the
 * given week? Same logic as the original HTML prototype's
 * generateRecurringChores(), ported server-side so instances get
 * created once per week rather than re-derived client-side each render.
 */
export function choreAppliesOnDay(
  chore: ChoreLibraryItem,
  dayIndex: number, // 0 = Mon ... 6 = Sun
  dateOnThatDay: Date
): boolean {
  if (!chore.auto_recur || chore.frequency === "One-time") return false;
  if (chore.frequency === "Daily") return true;
  if (chore.frequency === "Weekly") return chore.recur_weekday === dayIndex;
  if (chore.frequency === "Monthly") return dateOnThatDay.getDate() === chore.recur_month_day;
  return false;
}
