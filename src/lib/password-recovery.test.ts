import { describe, expect, it } from "vitest";

import { CHECK_EMAIL_PATH, forgotPasswordRedirectTarget, FORGOT_PASSWORD_PATH } from "@/lib/password-recovery";

describe("forgotPasswordRedirectTarget", () => {
  it("sends a valid address with no error to the same check-email page", () => {
    expect(forgotPasswordRedirectTarget("reader@example.com", null)).toBe(CHECK_EMAIL_PATH);
  });

  it("keeps a rate-limit error on the request form", () => {
    expect(forgotPasswordRedirectTarget("reader@example.com", { code: "over_request_rate_limit" })).toBe(
      `${FORGOT_PASSWORD_PATH}?error=rate_limit`,
    );
  });

  it("keeps an empty or malformed address on the request form", () => {
    expect(forgotPasswordRedirectTarget("", null)).toBe(`${FORGOT_PASSWORD_PATH}?error=email_invalid`);
    expect(forgotPasswordRedirectTarget("   ", null)).toBe(`${FORGOT_PASSWORD_PATH}?error=email_invalid`);
    expect(forgotPasswordRedirectTarget("not-an-email", null)).toBe(`${FORGOT_PASSWORD_PATH}?error=email_invalid`);
  });

  it("maps any other error through toAuthErrorKey", () => {
    expect(forgotPasswordRedirectTarget("reader@example.com", { message: "upstream unavailable" })).toBe(
      `${FORGOT_PASSWORD_PATH}?error=generic`,
    );
  });
});
