import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signSessionToken, verifySessionToken } from "@/lib/auth";

describe("세션 쿠키 HMAC", () => {
  const prev = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-at-least-16";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prev;
  });

  it("서명된 토큰을 검증해 sessionId 를 복원한다", () => {
    const id = "clxxxxxxxxxxxxxxxxxxxx";
    const token = signSessionToken(id);
    expect(token).toContain(".");
    expect(verifySessionToken(token)).toBe(id);
  });

  it("변조된 서명은 거부한다", () => {
    const token = signSessionToken("session-a");
    const [id] = token.split(".");
    expect(verifySessionToken(`${id}.deadbeef`)).toBeNull();
    expect(verifySessionToken("raw-session-id")).toBeNull();
  });
});
