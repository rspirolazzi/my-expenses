interface NamedUser {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

/** First and last name; falls back to the email while both are empty (FR-017). */
export function displayName(user: NamedUser): string {
  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || user.email;
}
