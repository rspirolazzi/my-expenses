import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { acceptInvitationAction, previewInvitationAction } from "@/app/actions/accounts";
import { extractInviteCode } from "@/components/accounts/JoinByCodeForm";
import { JoinAccountForm } from "@/components/accounts/JoinAccountForm";

import { makeAccount, makePreview } from "../support/accounts";
import { router } from "../support/mocks";
import { renderWithIntl } from "../support/render";

jest.mock("next/navigation", () => ({ useRouter: () => require("../support/mocks").router }));
jest.mock("@/app/actions/accounts", () => ({
  acceptInvitationAction: jest.fn(),
  previewInvitationAction: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  router.push.mockReset();
});

it("links to the chosen participant and opens the account", async () => {
  (acceptInvitationAction as jest.Mock).mockResolvedValue({ ok: true, data: makeAccount() });
  renderWithIntl(<JoinAccountForm code="CODE1234" initialPreview={makePreview()} />);
  expect(screen.getByText("Invitación a Viaje")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("radio", { name: "Leandro" }));
  await userEvent.click(screen.getByRole("button", { name: "Unirme" }));
  expect(acceptInvitationAction).toHaveBeenCalledWith("CODE1234", { participantId: "p-leandro" });
  expect(router.push).toHaveBeenCalledWith("/accounts/acc1");
});

it("adds the user as a new participant", async () => {
  (acceptInvitationAction as jest.Mock).mockResolvedValue({ ok: true, data: makeAccount() });
  renderWithIntl(<JoinAccountForm code="CODE1234" initialPreview={makePreview()} />);
  await userEvent.type(screen.getByPlaceholderText("Tu nombre"), "Pablo");
  await userEvent.click(screen.getByRole("button", { name: "Agregarme" }));
  expect(acceptInvitationAction).toHaveBeenCalledWith("CODE1234", { newParticipantName: "Pablo" });
});

it("refreshes the list when the participant was taken", async () => {
  (acceptInvitationAction as jest.Mock).mockResolvedValue({ ok: false, code: "participant_taken" });
  (previewInvitationAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: makePreview({ availableParticipants: [{ id: "p-martina", name: "Martina" }] }),
  });
  renderWithIntl(<JoinAccountForm code="CODE1234" initialPreview={makePreview()} />);
  await userEvent.click(screen.getByRole("radio", { name: "Leandro" }));
  await userEvent.click(screen.getByRole("button", { name: "Unirme" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("ya no está disponible");
  expect(screen.queryByRole("radio", { name: "Leandro" })).not.toBeInTheDocument();
});

it("sends existing members to the account", () => {
  renderWithIntl(
    <JoinAccountForm
      code="CODE1234"
      initialPreview={makePreview({ alreadyMember: true, accountId: "acc1" })}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Ya sos miembro");
  expect(screen.getByRole("link", { name: "Ir a la Cuenta" })).toHaveAttribute(
    "href",
    "/accounts/acc1",
  );
});

it("extracts the code from a pasted link or a bare code", () => {
  expect(extractInviteCode("https://x.com/invite/abcDEF_123-xyz")).toBe("abcDEF_123-xyz");
  expect(extractInviteCode("  abcDEF_123-xyz ")).toBe("abcDEF_123-xyz");
  expect(extractInviteCode("no")).toBeNull();
});
