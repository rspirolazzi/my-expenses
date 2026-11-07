export const PARTICIPANT_NAME_MAX = 40;
export const ACCOUNT_NAME_MAX = 80;

/** Same normalization as the backend: names are unique ignoring case and outer spaces. */
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
