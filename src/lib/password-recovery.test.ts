import { describe, expect, it } from "vitest";

import {
  CHECK_EMAIL_PATH,
  forgotPasswordRedirectTarget,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  resetPasswordOutcome,
  SIGN_IN_PATH,
} from "@/lib/password-recovery";

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

describe("resetPasswordOutcome", () => {
  const ready = {
    hasSession: true,
    hasRecoveryMarker: true,
    password: "secret1",
    confirmPassword: "secret1",
    updateError: null,
  };

  it("keeps a missing session or recovery marker on the invalid-link state", () => {
    expect(resetPasswordOutcome({ ...ready, hasSession: false })).toEqual({
      redirect: `${RESET_PASSWORD_PATH}?error=link_invalid`,
      signOut: false,
    });
    expect(resetPasswordOutcome({ ...ready, hasRecoveryMarker: false })).toEqual({
      redirect: `${RESET_PASSWORD_PATH}?error=link_invalid`,
      signOut: false,
    });
  });

  it("keeps a short or mismatched password on the reset form", () => {
    expect(resetPasswordOutcome({ ...ready, password: "short", confirmPassword: "short" })).toEqual({
      redirect: `${RESET_PASSWORD_PATH}?error=weak_password`,
      signOut: false,
    });
    expect(resetPasswordOutcome({ ...ready, confirmPassword: "secret2" })).toEqual({
      redirect: `${RESET_PASSWORD_PATH}?error=weak_password`,
      signOut: false,
    });
  });

  it("maps an update error and does not sign out", () => {
    expect(
      resetPasswordOutcome({
        ...ready,
        updateError: { message: "upstream unavailable" },
      }),
    ).toEqual({
      redirect: `${RESET_PASSWORD_PATH}?error=generic`,
      signOut: false,
    });
  });

  it("signs out and returns to sign-in after a successful password update", () => {
    expect(resetPasswordOutcome(ready)).toEqual({
      redirect: `${SIGN_IN_PATH}?notice=password_updated`,
      signOut: true,
    });
  });
});
