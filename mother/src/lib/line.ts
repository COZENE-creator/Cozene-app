import crypto from "crypto";

// LINE Messaging API client + webhook signature verification.
// The channel access token is read here (server-only) and never sent to the browser.

const LINE_API = "https://api.line.me/v2/bot";

function token(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  return t;
}

/**
 * Verify the X-Line-Signature header: base64(HMAC-SHA256(channelSecret, rawBody)).
 * Pass the RAW request body (not re-serialized JSON) or verification will fail.
 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false; // length mismatch → not equal
  }
}

export type PushResult = {
  ok: boolean;
  requestId?: string;
  status: number;
  errorCode?: string;
  errorMessage?: string;
};

/** Push a text message to a single user. */
export async function pushText(to: string, text: string): Promise<PushResult> {
  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });

  const requestId = res.headers.get("x-line-request-id") ?? undefined;
  if (res.ok) return { ok: true, requestId, status: res.status };

  // LINE error body: { message, details?: [{ message, property }] }
  let errorMessage = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) errorMessage = body.message;
  } catch {
    /* ignore parse errors */
  }
  return { ok: false, requestId, status: res.status, errorCode: String(res.status), errorMessage };
}

/** Fetch a follower's display name (best-effort; returns null on failure). */
export async function getProfileDisplayName(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${LINE_API}/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { displayName?: string };
    return body.displayName ?? null;
  } catch {
    return null;
  }
}
