import type { AccountIcon } from "../services/api/types";

/** Fixed set of account icons (constitution v4.4.0), mapped to Material Community icon names. */
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

export const MATERIAL_ICON: Record<AccountIcon, string> = {
  group: "account-group",
  home: "home",
  car: "car",
  hotel: "bed",
  beach: "beach",
  food: "silverware-fork-knife",
  money: "cash",
  travel: "airplane",
  party: "party-popper",
  shopping: "shopping",
  work: "briefcase",
  sports: "soccer",
};

export const PARTICIPANT_NAME_MAX = 40;
export const ACCOUNT_NAME_MAX = 80;

/** Same normalization as the backend: unique ignoring case and outer spaces. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function hasDuplicateNames(names: readonly string[]): boolean {
  const keys = names.map(nameKey);
  return new Set(keys).size !== keys.length;
}

export function isValidParticipantName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= PARTICIPANT_NAME_MAX;
}

export function isValidAccountName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= ACCOUNT_NAME_MAX;
}

/** Accepts a bare invitation code or a pasted link (web or myexpenses://). */
export function extractInviteCode(value: string): string | null {
  const trimmed = value.trim();
  const fromLink = trimmed.match(/invite\/([A-Za-z0-9_-]+)/);
  const code = fromLink ? fromLink[1] : trimmed;
  return /^[A-Za-z0-9_-]{8,64}$/.test(code) ? code : null;
}

export function webInviteUrl(code: string): string {
  const base = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/invite/${code}`;
}
