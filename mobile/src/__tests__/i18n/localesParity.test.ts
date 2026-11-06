import en from "@/i18n/locales/en.json";
import es from "@/i18n/locales/es.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

it("es and en have the same keys and no empty values (FR-019)", () => {
  const esFlat = flatten(es as Tree);
  const enFlat = flatten(en as Tree);
  expect(Object.keys(esFlat).sort()).toEqual(Object.keys(enFlat).sort());
  for (const value of [...Object.values(esFlat), ...Object.values(enFlat)]) {
    expect(value.trim()).not.toBe("");
  }
});
