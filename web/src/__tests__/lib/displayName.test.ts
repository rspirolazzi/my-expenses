import { displayName } from "@/lib/displayName";

describe("displayName", () => {
  it("joins first and last name", () => {
    expect(displayName({ email: "ana@mail.com", firstName: "Ana", lastName: "García" })).toBe(
      "Ana García",
    );
  });

  it("uses only the part that exists", () => {
    expect(displayName({ email: "ana@mail.com", firstName: null, lastName: "García" })).toBe(
      "García",
    );
  });

  it("falls back to the email when there is no name", () => {
    expect(displayName({ email: "ana@mail.com", firstName: null, lastName: "  " })).toBe(
      "ana@mail.com",
    );
  });
});
