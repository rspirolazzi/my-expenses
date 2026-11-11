import type { ExpenseListItem } from "../services/api/types";

export interface DayGroup {
  date: string;
  items: ExpenseListItem[];
}

/** Appends a page, dropping ids already loaded (an edited date can move one between pages). */
export function mergePages(
  existing: ExpenseListItem[],
  page: ExpenseListItem[],
): ExpenseListItem[] {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...page.filter((item) => !seen.has(item.id))];
}

/** Groups by day keeping the API order; a day split across pages stays one group (FR-035). */
export function groupByDay(items: ExpenseListItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

/**
 * Expense dates are calendar days ("2026-11-11") without a time zone (research R3). They are
 * formatted in UTC so the day never shifts: `new Date("2026-11-11")` is UTC midnight, which in
 * Argentina (UTC−3) would otherwise show as the 10th.
 */
export function formatDay(
  day: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "full" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** Today in the device's time zone, as a calendar day. */
export function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
