/**
 * Signed session cookie.
 *
 * The cookie only stores a user id plus an HMAC. We do not put emails or roles
 * in it, so a leaked cookie still has to hit the database for anything useful.
 * SESSION_SECRET should be set in production; the fallback is for local/dev.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "paper_session";

const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "paper-dev-secret-not-for-production";

export function encodeSession(userId: string): string {
  const body = Buffer.from(JSON.stringify({ userId }), "utf8").toString(
    "base64url",
  );
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function decodeSession(token: string | undefined): string | null {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId?: unknown;
    };
    return typeof parsed.userId === "string" ? parsed.userId : null;
  } catch {
    return null;
  }
}

function sign(body: string): string {
  return createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
}
