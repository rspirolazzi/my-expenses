import type { AccountIcon } from "./api/types";

/** Fixed set of account icons (constitution v4.4.0; same order and names as the backend). */
export const ACCOUNT_ICONS: readonly AccountIcon[] = [
  "group",
  "home",
  "car",
  "hotel",
  "beach",
  "food",
  "money",
  "travel",
  "party",
  "shopping",
  "work",
  "sports",
];

export const DEFAULT_ACCOUNT_ICON: AccountIcon = "group";

export const ACCOUNT_ICON_GLYPHS: Record<AccountIcon, string> = {
  group: "👥",
  home: "🏠",
  car: "🚗",
  hotel: "🏨",
  beach: "🏖️",
  food: "🍽️",
  money: "💰",
  travel: "✈️",
  party: "🎉",
  shopping: "🛍️",
  work: "💼",
  sports: "⚽",
};
