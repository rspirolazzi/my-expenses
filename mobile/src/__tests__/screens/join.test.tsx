import { fireEvent, renderHook, screen, waitFor } from "@testing-library/react-native";

import { useAuth } from "@/hooks/useAuth";
import { setPendingInvite, takePendingInvite, usePendingInvite } from "@/hooks/usePendingInvite";
import i18n from "@/i18n";
import { InvitationScreen, JoinScreen } from "@/screens/accounts/JoinScreens";
import { accountsApi } from "@/services/api/accounts";
import { ApiError } from "@/services/api/types";
import { extractInviteCode } from "@/utils/accountIcons";

import { makeAccount, preview } from "../support/accounts";
import { renderScreen } from "../support/render";

const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/api/accounts", () => ({
  accountsApi: { previewInvitation: jest.fn(), acceptInvitation: jest.fn() },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  takePendingInvite();
  await i18n.changeLanguage("es");
});

describe("usePendingInvite (FR-009)", () => {
  it("opens a remembered invitation once the user is signed in", () => {
    (useAuth as jest.Mock).mockReturnValue({ status: "unauthenticated" });
    setPendingInvite("CODE12345");
    const { rerender } = renderHook(() => usePendingInvite());
    expect(mockRouter.push).not.toHaveBeenCalled();

    (useAuth as jest.Mock).mockReturnValue({ status: "authenticated" });
    rerender({});
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/invite/[code]",
      params: { code: "CODE12345" },
    });
    expect(takePendingInvite()).toBeNull();
  });
});

describe("JoinScreen", () => {
  it("accepts a pasted link or a bare code", () => {
    expect(extractInviteCode("chepagame://invite/abcDEF_12345")).toBe("abcDEF_12345");
    expect(extractInviteCode("http://localhost:3000/invite/abcDEF_12345")).toBe("abcDEF_12345");
    renderScreen(<JoinScreen />);
    fireEvent.changeText(screen.getByLabelText("Código o enlace de invitación"), "abcDEF_12345");
    fireEvent.press(screen.getByText("Continuar"));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/invite/[code]",
      params: { code: "abcDEF_12345" },
    });
  });
});

describe("InvitationScreen (US2)", () => {
  it("links to the chosen participant", async () => {
    (accountsApi.previewInvitation as jest.Mock).mockResolvedValue(preview());
    (accountsApi.acceptInvitation as jest.Mock).mockResolvedValue(makeAccount());
    renderScreen(<InvitationScreen code="CODE12345" />);
    fireEvent.press(await screen.findByLabelText("Leandro"));
    fireEvent.press(screen.getByText("Unirme"));
    await waitFor(() =>
      expect(accountsApi.acceptInvitation).toHaveBeenCalledWith("CODE12345", {
        participantId: "p-leandro",
      }),
    );
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/accounts/[accountId]",
      params: { accountId: "acc1" },
    });
  });

  it("adds the user as a new participant and handles participant_taken", async () => {
    (accountsApi.previewInvitation as jest.Mock).mockResolvedValue(preview());
    (accountsApi.acceptInvitation as jest.Mock).mockRejectedValue(
      new ApiError(409, "participant_taken"),
    );
    renderScreen(<InvitationScreen code="CODE12345" />);
    fireEvent.changeText(await screen.findByLabelText("Tu nombre"), "Pablo");
    fireEvent.press(screen.getByText("Agregarme"));
    expect(await screen.findByText(/ya no está disponible/)).toBeTruthy();
    expect(accountsApi.previewInvitation).toHaveBeenCalledTimes(2);
  });

  it("sends existing members to the account", async () => {
    (accountsApi.previewInvitation as jest.Mock).mockResolvedValue(
      preview({ alreadyMember: true, accountId: "acc1" }),
    );
    renderScreen(<InvitationScreen code="CODE12345" />);
    fireEvent.press(await screen.findByText("Ir a la Cuenta"));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/accounts/[accountId]",
      params: { accountId: "acc1" },
    });
  });
});
