import { amountToInput, formatMoney, parseAmountInput } from "@/utils/money";

describe("parseAmountInput", () => {
  it.each([
    ["100,50", "es", 2, "100.50"],
    ["100,5", "es", 2, "100.50"],
    ["100.5", "es", 2, "100.50"],
    ["1.234,50", "es", 2, "1234.50"],
    ["1.234", "es", 2, "1234.00"],
    ["100.50", "en", 2, "100.50"],
    ["1,234.50", "en", 2, "1234.50"],
    ["1,234", "en", 2, "1234.00"],
    ["0,01", "es", 2, "0.01"],
    [" 1500 ", "es", 0, "1500"],
    ["1.500", "es", 0, "1500"],
    ["10,0", "es", 0, "10"],
    ["1.234", "es", 3, "1.234"],
    ["999999999,99", "es", 2, "999999999.99"],
  ])("%s in %s with %i decimals is %s", (text, locale, decimals, value) => {
    expect(parseAmountInput(text, locale, decimals)).toEqual({ ok: true, value });
  });

  it.each([
    ["", "es", 2, "amountEmpty"],
    ["   ", "es", 2, "amountEmpty"],
    ["abc", "es", 2, "amountInvalid"],
    ["1e3", "es", 2, "amountInvalid"],
    ["1,2,3,4", "es", 2, "amountInvalid"],
    ["10,555", "es", 2, "amountTooManyDecimals"],
    ["10,5", "es", 0, "amountTooManyDecimals"],
    ["0", "es", 2, "amountNotPositive"],
    ["0,00", "es", 2, "amountNotPositive"],
    ["-5", "es", 2, "amountNotPositive"],
    ["1000000000", "es", 2, "amountTooLarge"],
  ])("%s in %s with %i decimals fails with %s", (text, locale, decimals, error) => {
    expect(parseAmountInput(text, locale, decimals)).toEqual({ ok: false, error });
  });
});

it("formats decimal text without losing precision", () => {
  expect(formatMoney("100.50", "ARS", 2, "es")).toMatch(/100,50/);
  expect(formatMoney("1500", "JPY", 0, "en")).toMatch(/1,500/);
  expect(formatMoney("999999999.99", "USD", 2, "en")).toMatch(/999,999,999\.99/);
  expect(formatMoney("1.234", "KWD", 3, "en")).toMatch(/1\.234/);
});

it("turns API amounts back into the user's format", () => {
  expect(amountToInput("100.50", "es")).toBe("100,50");
  expect(amountToInput("100.50", "en")).toBe("100.50");
});
