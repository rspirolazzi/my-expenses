import type { ExpenseListItem } from "@/lib/api/types";
import { formatDay, groupByDay, mergePages, today } from "@/lib/expenseGroups";

function item(id: string, date: string): ExpenseListItem {
  return {
    id,
    date,
    title: id,
    categoryIcon: "food",
    amount: "10.00",
    paidBy: null,
    isPending: true,
  };
}

it("merges pages without repeated ids", () => {
  const first = [item("a", "2026-11-11"), item("b", "2026-11-10")];
  const second = [item("b", "2026-11-10"), item("c", "2026-11-10")];
  expect(mergePages(first, second).map((i) => i.id)).toEqual(["a", "b", "c"]);
});

it("keeps a day split across pages in one group", () => {
  const items = mergePages(
    [item("a", "2026-11-11"), item("b", "2026-11-10")],
    [item("c", "2026-11-10"), item("d", "2026-11-09")],
  );
  expect(groupByDay(items).map((g) => [g.date, g.items.map((i) => i.id)])).toEqual([
    ["2026-11-11", ["a"]],
    ["2026-11-10", ["b", "c"]],
    ["2026-11-09", ["d"]],
  ]);
});

describe("formatDay in a negative time zone", () => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Argentina/Buenos_Aires";
  });
  afterAll(() => {
    process.env.TZ = original;
  });

  it("shows the same calendar day, never the day before", () => {
    expect(formatDay("2026-11-11", "es", { day: "numeric", month: "long" })).toBe(
      "11 de noviembre",
    );
    expect(formatDay("2026-01-01", "en", { day: "numeric", month: "long", year: "numeric" })).toBe(
      "January 1, 2026",
    );
  });
});

it("today is the device's calendar day", () => {
  expect(today(new Date(2026, 10, 11, 23, 30))).toBe("2026-11-11");
  expect(today(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
});
