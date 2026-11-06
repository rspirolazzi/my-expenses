import { validateCode, validateEmail, validateName, validatePassword } from "@/lib/validation";

describe("validation", () => {
  it("validates emails", () => {
    expect(validateEmail("ana@mail.com")).toBeNull();
    expect(validateEmail("ana@")).toBe("emailInvalid");
  });

  it("applies FR-007 to passwords", () => {
    expect(validatePassword("1234567", "ana@mail.com")).toBe("passwordTooShort");
    expect(validatePassword("Ana@Mail.com", "ana@mail.com")).toBe("passwordEqualsEmail");
    expect(validatePassword("x".repeat(129), "ana@mail.com")).toBe("passwordTooLong");
    expect(validatePassword("12345678", "ana@mail.com")).toBeNull();
  });

  it("limits names to 60 characters", () => {
    expect(validateName("x".repeat(60))).toBeNull();
    expect(validateName("x".repeat(61))).toBe("nameTooLong");
  });

  it("requires 6-digit codes", () => {
    expect(validateCode("123456")).toBeNull();
    expect(validateCode("12345a")).toBe("codeInvalid");
  });
});
