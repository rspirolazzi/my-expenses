import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import { authApi } from "../api/auth";
import { ApiError, type AuthResponse } from "../api/types";

let configured = false;

function configure() {
  if (configured) return;
  // The web client ID makes Google issue an ID token whose audience the backend accepts (R3).
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

export type GoogleSignInResult = { cancelled: true } | { cancelled: false; auth: AuthResponse };

/** Native Google Sign-In (development build only) followed by POST /auth/google. */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  configure();
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return { cancelled: true };
    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw new ApiError(401, "invalid_google_token");
    }
    const auth = await authApi.loginWithGoogle(response.data.idToken);
    return { cancelled: false, auth };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { cancelled: true };
    }
    throw error;
  }
}

export async function signOutFromGoogle(): Promise<void> {
  configure();
  await GoogleSignin.signOut().catch(() => undefined);
}

/** Exposed for tests. */
export function resetGoogleConfiguration(): void {
  configured = false;
}
