export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const TIME_BLOCKS = [
  "Early AM",
  "Morning",
  "Midday",
  "Evening",
] as const;

export type DayOfWeek = (typeof DOW)[number];
export type TimeBlock = (typeof TIME_BLOCKS)[number];

/** Returns the Monday (00:00) of the week containing the given date. */
export function isoMonday(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** YYYY-MM-DD, matching the date type Postgres/Supabase expects. */
export function isoKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}
