import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./auth";

/** Current admin email from the session cookie, or null. Server-only. */
export function currentAdmin(): string | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** For API route handlers: 401 Response if unauthenticated, else null. */
export function guardApi(): Response | null {
  if (currentAdmin()) return null;
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
