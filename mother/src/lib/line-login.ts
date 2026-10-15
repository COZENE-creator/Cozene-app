// Verify a LIFF / Mini App ID token server-side.
//
// The guest-facing Mini App API never trusts a userId sent by the client — a
// free glass of wine makes forging one worthwhile. The client sends
// liff.getIDToken(); LINE verifies it and tells us who it really belongs to.
//
// Env:
//   LINE_LOGIN_CHANNEL_IDS  comma-separated channel ids allowed as `aud`
//                           (the Mini App channel, plus the legacy LIFF channel
//                           during migration). A LIFF id "1234567890-abcd" has
//                           channel id "1234567890".
//   LINE_ID_TOKEN_DEV=1     local dev only: also accept "dev:<userId>" tokens so
//                           the app can be exercised without LINE. Never in prod.

const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type LineIdentity = { userId: string; name: string | null; picture: string | null };

export class IdTokenError extends Error {}

function allowedChannelIds(): string[] {
  return (process.env.LINE_LOGIN_CHANNEL_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Read `aud` without verifying, only to pick which channel id to verify against. */
function peekAudience(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
    return typeof payload.aud === "string" ? payload.aud : null;
  } catch {
    return null;
  }
}

export async function verifyIdToken(idToken: string): Promise<LineIdentity> {
  if (!idToken) throw new IdTokenError("id_token is required");

  if (idToken.startsWith("dev:")) {
    if (process.env.LINE_ID_TOKEN_DEV !== "1" || process.env.NODE_ENV === "production") {
      throw new IdTokenError("dev tokens are disabled");
    }
    const userId = idToken.slice(4);
    if (!userId) throw new IdTokenError("empty dev token");
    return { userId, name: `Dev ${userId.slice(-4)}`, picture: null };
  }

  const allowed = allowedChannelIds();
  if (allowed.length === 0) throw new Error("LINE_LOGIN_CHANNEL_IDS is not set");
  const aud = peekAudience(idToken);
  if (!aud || !allowed.includes(aud)) throw new IdTokenError("id_token was issued for another channel");

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: aud }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    sub?: string;
    name?: string;
    picture?: string;
    error_description?: string;
  };
  // LINE answers 400 for expired / tampered tokens; the client re-logs in on 401.
  if (!res.ok || !data.sub) throw new IdTokenError(data.error_description || `verify failed (HTTP ${res.status})`);
  return { userId: data.sub, name: data.name ?? null, picture: data.picture ?? null };
}
