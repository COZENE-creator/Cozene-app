import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The privacy policy (../privacy.html at the repo root), public at /privacy.
 * Linked from the Mini App consent sheet and member page, and the URL to give
 * LINE for the Mini App listing.
 */
export function GET() {
  const file = path.join(process.cwd(), "..", "privacy.html");
  try {
    return new Response(fs.readFileSync(file), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return new Response("Privacy policy not found", { status: 404 });
  }
}
