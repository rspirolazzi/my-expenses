import { mergeCookieHeader, parseSetCookie } from "@/lib/forwardCookies";

it("parses a Set-Cookie header", () => {
  expect(parseSetCookie("authjs.session-token=abc; Path=/; HttpOnly; SameSite=Lax")).toEqual({
    name: "authjs.session-token",
    value: "abc",
    deleted: false,
  });
  expect(parseSetCookie("authjs.session-token.1=; Max-Age=0; Path=/")?.deleted).toBe(true);
  expect(parseSetCookie("a=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/")?.deleted).toBe(true);
  expect(parseSetCookie("broken")).toBeNull();
});

it("the page sees the refreshed session cookie, not the expired one", () => {
  const merged = mergeCookieHeader(
    "NEXT_LOCALE=es; authjs.session-token=old; authjs.session-token.1=x",
    ["authjs.session-token=new; Path=/; HttpOnly", "authjs.session-token.1=; Max-Age=0; Path=/"],
  );
  expect(merged).toBe("NEXT_LOCALE=es; authjs.session-token=new");
});

it("keeps the request cookies when nothing is set", () => {
  expect(mergeCookieHeader("a=1; b=2", [])).toBe("a=1; b=2");
  expect(mergeCookieHeader(null, ["c=3; Path=/"])).toBe("c=3");
});
