import { totalsByCurrency } from "@/utils/balanceTotals";

import { makeSummary } from "../support/accounts";

it("groups by currency and never mixes them", () => {
  const totals = totalsByCurrency([
    makeSummary({ id: "a", currency: "ARS", myBalance: "100.00" }),
    makeSummary({ id: "b", currency: "USD", currencyDecimals: 2, myBalance: "-20.00" }),
    makeSummary({ id: "c", currency: "ARS", myBalance: "-40.50" }),
  ]);
  expect(totals).toEqual([
    { currency: "ARS", decimals: 2, owedToMe: "100.00", iOwe: "40.50" },
    { currency: "USD", decimals: 2, owedToMe: "0.00", iOwe: "20.00" },
  ]);
});

it("adds positives and negatives separately, closed accounts included", () => {
  const totals = totalsByCurrency([
    makeSummary({ id: "a", myBalance: "10.00" }),
    makeSummary({ id: "b", myBalance: "5.25", isClosed: true }),
    makeSummary({ id: "c", myBalance: "-3.00", isClosed: true }),
  ]);
  expect(totals).toEqual([{ currency: "ARS", decimals: 2, owedToMe: "15.25", iOwe: "3.00" }]);
});

it("is exact", () => {
  const [total] = totalsByCurrency([
    makeSummary({ id: "a", myBalance: "0.10" }),
    makeSummary({ id: "b", myBalance: "0.20" }),
  ]);
  expect(total.owedToMe).toBe("0.30");
  const [big] = totalsByCurrency([
    makeSummary({ id: "a", myBalance: "999999999.99" }),
    makeSummary({ id: "b", myBalance: "999999999.99" }),
  ]);
  expect(big.owedToMe).toBe("1999999999.98");
});

it("respects each currency's decimals", () => {
  const totals = totalsByCurrency([
    makeSummary({ id: "a", currency: "JPY", currencyDecimals: 0, myBalance: "1500" }),
    makeSummary({ id: "b", currency: "KWD", currencyDecimals: 3, myBalance: "-1.005" }),
  ]);
  expect(totals).toEqual([
    { currency: "JPY", decimals: 0, owedToMe: "1500", iOwe: "0" },
    { currency: "KWD", decimals: 3, owedToMe: "0.000", iOwe: "1.005" },
  ]);
});

it("gives no totals when everything is zero", () => {
  expect(totalsByCurrency([makeSummary({ myBalance: "0.00" })])).toEqual([]);
  expect(totalsByCurrency([])).toEqual([]);
});
