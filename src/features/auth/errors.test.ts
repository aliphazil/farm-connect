import { describe, expect, it } from "vitest";
import { dictionaries } from "@shared/i18n";
import { AUTH_ERROR_KEYS, AuthFlowError, authErrorKey } from "./errors";

describe("authErrorKey", () => {
  it("maps Firebase and API error codes to friendly keys", () => {
    expect(authErrorKey({ code: "auth/invalid-credential" })).toBe(
      "invalidCredentials",
    );
    expect(authErrorKey({ code: "auth/user-disabled" })).toBe("accountBlocked");
    expect(authErrorKey({ code: "auth/email-already-in-use" })).toBe(
      "emailInUse",
    );
    expect(authErrorKey(new AuthFlowError("account_blocked"))).toBe(
      "accountBlocked",
    );
    expect(authErrorKey(new Error("Firebase is not configured. Set …"))).toBe(
      "notConfigured",
    );
    expect(authErrorKey(new TypeError("Failed to fetch"))).toBe("network");
    expect(authErrorKey({ code: "something/unknown" })).toBe("generic");
  });

  it("has a message for every key in both languages", () => {
    for (const dict of Object.values(dictionaries)) {
      for (const key of AUTH_ERROR_KEYS)
        expect(dict.authErrors[key], key).toBeTruthy();
    }
  });
});
