import { queryOne } from "@/lib/db";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Health check — confirms the process is up and the DB is reachable. */
export async function GET() {
  try {
    const row = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM stores");
    return ok({ service: "cozene-mother", stores: row?.n ?? 0 });
  } catch (err) {
    return fail("DB unreachable: " + String(err), 500);
  }
}
