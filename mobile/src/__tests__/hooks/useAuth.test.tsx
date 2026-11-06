import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { authApi } from "@/services/api/auth";
import { usersApi } from "@/services/api/users";
import { clearTokens, getTokens, saveTokens } from "@/services/auth/tokenStorage";

import { authResponse, user } from "../support/render";

let expire: () => void = () => undefined;

jest.mock("@/services/api/users", () => ({ usersApi: { getMe: jest.fn() } }));
jest.mock("@/services/api/auth", () => ({ authApi: { logout: jest.fn() } }));
jest.mock("@/services/api/client", () => ({
  setRequestLanguage: jest.fn(),
  onSessionExpired: (listener: () => void) => {
    expire = listener;
    return () => undefined;
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(async () => {
  jest.clearAllMocks();
  await clearTokens();
});

it("loads the user when tokens are stored", async () => {
  await saveTokens(authResponse.tokens);
  (usersApi.getMe as jest.Mock).mockResolvedValue(user);
  const { result } = renderHook(() => useAuth(), { wrapper });
  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  expect(result.current.user).toEqual(user);
});

it("is unauthenticated without tokens", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  expect(usersApi.getMe).not.toHaveBeenCalled();
});

it("signInWithTokens stores the tokens in secure storage", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  await act(() => result.current.signInWithTokens(authResponse));
  expect(result.current.status).toBe("authenticated");
  expect(await getTokens()).toEqual(authResponse.tokens);
});

it("an expired session signs out and is flagged", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  await act(() => result.current.signInWithTokens(authResponse));
  act(() => expire());
  expect(result.current.status).toBe("unauthenticated");
  expect(result.current.sessionExpired).toBe(true);
});

it("logout revokes the refresh token, clears storage and Google, even if the API fails", async () => {
  (authApi.logout as jest.Mock).mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  await act(() => result.current.signInWithTokens(authResponse));
  await act(() => result.current.logout());
  expect(authApi.logout).toHaveBeenCalledWith("refresh");
  expect(GoogleSignin.signOut).toHaveBeenCalled();
  expect(await getTokens()).toBeNull();
  expect(result.current.status).toBe("unauthenticated");
  expect(result.current.sessionExpired).toBe(false);
});
