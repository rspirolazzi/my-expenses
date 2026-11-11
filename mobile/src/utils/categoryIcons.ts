import type { CategoryIcon } from "../services/api/types";

/** Fixed set of expense categories (research R11), mapped to Material Community icon names. */
export const CATEGORY_ICONS: readonly CategoryIcon[] = [
  "other",
  "home",
  "car",
  "hotel",
  "beach",
  "food",
  "money",
  "travel",
  "party",
  "shopping",
  "sports",
];

export const DEFAULT_CATEGORY: CategoryIcon = "other";

export const CATEGORY_MATERIAL_ICON: Record<CategoryIcon, string> = {
  other: "receipt",
  home: "home",
  car: "car",
  hotel: "bed",
  beach: "beach",
  food: "silverware-fork-knife",
  money: "cash",
  travel: "airplane",
  party: "party-popper",
  shopping: "shopping",
  sports: "soccer",
};
