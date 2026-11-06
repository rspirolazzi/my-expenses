import * as SecureStore from "expo-secure-store";

import type { TokenPair } from "../api/types";

// Tokens live only in the device's secure storage (Keychain / Keystore), never in AsyncStorage.
const KEY = "myexpenses.tokens";

export async function saveTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
}

export async function getTokens(): Promise<TokenPair | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenPair;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
