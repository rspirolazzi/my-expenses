import { screen } from "@testing-library/react";

import { LoginForm } from "@/components/LoginForm";
import { loginErrorKey } from "@/lib/loginError";
import { safeCallbackUrl } from "@/lib/safeCallbackUrl";

import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/auth", () => ({ credentialsSignInAction: jest.fn() }));

describe("loginErrorKey", () => {
  it("treats a cancelled Google consent as cancellation (US2, scenario 4)", () => {
    expect(loginErrorKey("AccessDenied")).toBe("auth.google.cancelled");
    expect(loginErrorKey("OAuthCallbackError")).toBe("auth.google.cancelled");
  });

  it("maps backend codes and unknown values", () => {
    expect(loginErrorKey("google_email_not_verified")).toBe("errors.google_email_not_verified");
    expect(loginErrorKey("whatever")).toBe("errors.internal_error");
    expect(loginErrorKey(undefined)).toBeNull();
  });
});

describe("login page errors", () => {
  it("shows the cancellation message", () => {
    renderWithIntl(<LoginForm initialErrorKey={loginErrorKey("AccessDenied")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Cancelaste el inicio con Google");
  });

  it("shows google_email_not_verified", () => {
    renderWithIntl(<LoginForm initialErrorKey={loginErrorKey("google_email_not_verified")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Google no confirmó tu email");
  });
});

describe("safeCallbackUrl", () => {
  it("only allows internal paths", () => {
    expect(safeCallbackUrl("/profile?tab=1")).toBe("/profile?tab=1");
    expect(safeCallbackUrl("https://evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl(undefined)).toBe("/dashboard");
  });
});
