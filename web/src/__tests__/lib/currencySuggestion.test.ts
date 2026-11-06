import { suggestCurrency } from "@/lib/currencySuggestion";

describe("suggestCurrency", () => {
  it("uses the region of the language tag", () => {
    expect(suggestCurrency(["es-AR"])).toBe("ARS");
    expect(suggestCurrency(["pt-BR", "en"])).toBe("BRL");
  });

  it("maximizes a language without region", () => {
    expect(suggestCurrency(["en"])).toBe("USD");
  });

  it("returns null when the region is unknown", () => {
    expect(suggestCurrency(["xx"])).toBeNull();
    expect(suggestCurrency([])).toBeNull();
  });
});
