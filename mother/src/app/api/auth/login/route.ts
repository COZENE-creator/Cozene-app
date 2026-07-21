import { cookies } from "next/headers";
import { checkCredentials, issueSession, SESSION_COOKIE } from "@/lib/auth";
import { ok, fail, readJsonBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await readJsonBody(req);
  } catch {
    return fail("invalid body");
  }
  const email = String(body.email || "");
  const password = String(body.password || "");
  if (!checkCredentials(email, password)) {
    return fail("Invalid email or password", 401);
  }
  const { token, maxAge } = issueSession(email);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return ok();
}
