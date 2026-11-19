import { NextResponse } from "next/server";

/** JSON success/error helpers so route handlers stay terse and consistent. */
export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Read a request body that may arrive as text/plain (the Phase-1 LIFF client
 * sends JSON with Content-Type text/plain to dodge the CORS preflight — see
 * web/app.js). Falls back to JSON parsing regardless of the header.
 */
export async function readJsonBody<T = unknown>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) throw new Error("Empty request body");
  return JSON.parse(text) as T;
}

/**
 * This app's public origin for links in LINE messages: APP_BASE_URL
 * (https://app.cozene.jp), else what the reverse proxy forwarded.
 */
export function publicBaseUrl(req: Request): string {
  const env = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
