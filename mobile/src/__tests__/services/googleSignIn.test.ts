import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";

import { authApi } from "@/services/api/auth";
import { ApiError } from "@/services/api/types";
import { resetGoogleConfiguration, signInWithGoogle } from "@/services/auth/googleSignIn";

import { authResponse } from "../support/render";

jest.mock("@/services/api/auth", () => ({ authApi: { loginWithGoogle: jest.fn() } }));

const signInMock = GoogleSignin.signIn as jest.Mock;
const loginMock = authApi.loginWithGoogle as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetGoogleConfiguration();
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "web-client-id";
});

it("configures the web client ID and sends the ID token to the backend", async () => {
  signInMock.mockResolvedValue({ type: "success", data: { idToken: "google-id-token" } });
  loginMock.mockResolvedValue(authResponse);
  const result = await signInWithGoogle();
  expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: "web-client-id" });
  expect(loginMock).toHaveBeenCalledWith("google-id-token");
  expect(result).toEqual({ cancelled: false, auth: authResponse });
});

it("returns cancelled without calling the API", async () => {
  signInMock.mockResolvedValue({ type: "cancelled", data: null });
  await expect(signInWithGoogle()).resolves.toEqual({ cancelled: true });
  signInMock.mockRejectedValue({ code: statusCodes.SIGN_IN_CANCELLED });
  await expect(signInWithGoogle()).resolves.toEqual({ cancelled: true });
  expect(loginMock).not.toHaveBeenCalled();
});

it("propagates google_email_not_verified from the backend", async () => {
  signInMock.mockResolvedValue({ type: "success", data: { idToken: "t" } });
  loginMock.mockRejectedValue(new ApiError(403, "google_email_not_verified"));
  await expect(signInWithGoogle()).rejects.toMatchObject({ code: "google_email_not_verified" });
});
