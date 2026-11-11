import type { CategoryIcon } from "./api/types";

/** Fixed set of expense categories (research R11; same order and names as the backend). */
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

export const CATEGORY_GLYPHS: Record<CategoryIcon, string> = {
  other: "🧾",
  home: "🏠",
  car: "🚗",
  hotel: "🏨",
  beach: "🏖️",
  food: "🍽️",
  money: "💰",
  travel: "✈️",
  party: "🎉",
  shopping: "🛍️",
  sports: "⚽",
};
