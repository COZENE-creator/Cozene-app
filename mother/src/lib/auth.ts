import crypto from "crypto";

// Minimal MVP auth: an email allowlist + shared password, sealed into a signed
// HTTP-only cookie. No user table, no external auth provider. Swap for Auth.js
// / SSO later without touching the route handlers (they only call these).

export const SESSION_COOKIE = "cozene_session";
const MAX_AGE_SEC = 60 * 60 * 12; // 12h

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function allowedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Validate email+password against the configured allowlist/shared password. */
export function checkCredentials(email: string, password: string): boolean {
  const emailOk = allowedEmails().includes(email.trim().toLowerCase());
  const expected = process.env.ADMIN_PASSWORD ?? "";
  let passOk = false;
  try {
    passOk =
      expected.length > 0 &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    passOk = false;
  }
  return emailOk && passOk;
}

/** Build a signed session token: base64url(payload).signature */
export function issueSession(email: string): { token: string; maxAge: number } {
  const payload = { email: email.trim().toLowerCase(), exp: nowSec() + MAX_AGE_SEC };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${encoded}.${sign(encoded)}`, maxAge: MAX_AGE_SEC };
}

/** Verify a session token; returns the email or null. */
export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sign(encoded)), Buffer.from(sig))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as {
      email: string;
      exp: number;
    };
    if (payload.exp < nowSec()) return null;
    return payload.email;
  } catch {
    return null;
  }
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
