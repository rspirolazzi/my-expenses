import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CodeInput, ResendButton } from "@/components/CodeInput";

import { renderWithIntl } from "../support/render";

describe("CodeInput", () => {
  it("accepts only digits and submits when 6 are entered", async () => {
    const onComplete = jest.fn();
    renderWithIntl(<CodeInput label="Código" onComplete={onComplete} />);
    const input = screen.getByLabelText("Código");
    await userEvent.type(input, "12a34");
    expect(input).toHaveValue("1234");
    expect(onComplete).not.toHaveBeenCalled();
    await userEvent.type(input, "56");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("supports pasting the whole code", () => {
    const onComplete = jest.fn();
    renderWithIntl(<CodeInput label="Código" onComplete={onComplete} />);
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: " 654 321 " } });
    expect(onComplete).toHaveBeenCalledWith("654321");
  });
});

describe("ResendButton", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("waits for the cooldown and honours retryAfterSeconds", async () => {
    const onResend = jest.fn().mockResolvedValue({
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: 30,
    });
    renderWithIntl(<ResendButton onResend={onResend} initialCooldown={2} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Reenviar en 2 s");

    // Each second schedules the next tick after re-rendering.
    act(() => jest.advanceTimersByTime(1000));
    act(() => jest.advanceTimersByTime(1000));
    expect(button).toBeEnabled();

    await act(async () => {
      button.click();
    });
    expect(onResend).toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Reenviar en 30 s");
  });
});
