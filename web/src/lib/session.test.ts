import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession } from "./session";

describe("session cookie", () => {
  it("round-trips a user id", () => {
    const token = encodeSession("user-alex");
    expect(decodeSession(token)).toBe("user-alex");
  });

  it("rejects a tampered or empty token", () => {
    const token = encodeSession("user-alex");
    expect(decodeSession(`${token}x`)).toBeNull();
    expect(decodeSession("not-a-token")).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });
});
