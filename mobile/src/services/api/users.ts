import { apiRequest } from "./client";
import type { UpdateMeRequest, UserResponse } from "./types";

export const usersApi = {
  getMe: () => apiRequest<UserResponse>("/users/me", { authenticated: true }),
  updateMe: (patch: UpdateMeRequest) =>
    apiRequest<UserResponse>("/users/me", { method: "PATCH", body: patch, authenticated: true }),
  requestEmailChange: (newEmail: string) =>
    apiRequest<void>("/users/me/email-change", {
      method: "POST",
      body: { newEmail },
      authenticated: true,
    }),
  confirmEmailChange: (code: string) =>
    apiRequest<UserResponse>("/users/me/email-change/confirm", {
      method: "POST",
      body: { code },
      authenticated: true,
    }),
};
