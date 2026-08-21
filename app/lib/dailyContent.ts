/**
 * Deterministic day-of-year rotation — same day always shows the same
 * item, no randomness, no state to store. Used for both the quote and
 * the wellbeing reminder so they're stable within a day but change
 * daily without any scheduling logic.
 */
export function pickForToday<T>(items: T[], date: Date = new Date()): T | null {
  if (items.length === 0) return null;
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return items[dayOfYear % items.length];
}

/**
 * Deliberately static text, not data the app tracks or asks you to
 * log — per the explicit ask: gentle reminders to make time for
 * things, not another metric to enter. Science-backed but kept to
 * one clear point each, no numbers to hit or check off.
 */
export const WELLBEING_REMINDERS: string[] = [
  "Aim for something like 8,000-10,000 steps today — even split across a few short walks, it adds up.",
  "Getting outside for a few hours of daylight — even on a cloudy day — helps regulate your body's natural clock.",
  "Unstructured downtime isn't wasted time. It's when your mind actually processes and rests.",
  "Movement spread through the day matters as much as any single workout.",
  "A few minutes away from screens, just sitting with your own thoughts, goes a long way.",
  "Fresh air and a change of scenery can do more for a stuck mood than pushing through at a desk.",
  "Sleep is when the day's effort actually turns into progress. Protect it when you can.",
  "Connection counts as self-care too — a real conversation, not just a message.",
  "You don't have to earn rest. It's part of the work, not a reward for finishing it.",
  "A short walk after a meal is one of the simplest things you can do for how you feel the rest of the day.",
];
