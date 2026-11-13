import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serve the guest Mini App (../web/miniapp) from the Mother System itself, so
// one domain (e.g. a free ngrok static domain) carries both the page and the
// API. GitHub Pages hosting of web/ keeps working unchanged.

const ROOT = path.join(process.cwd(), "..", "web", "miniapp");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

export async function GET(_req: Request, { params }: { params: { path?: string[] } }) {
  const rel = (params.path ?? []).join("/") || "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  const type = TYPES[path.extname(file)];
  if (!file.startsWith(ROOT + path.sep) || !type) return new Response("Not found", { status: 404 });

  let body: Buffer | string;
  try {
    body = await fs.readFile(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (rel === "index.html") {
    // Next serves this at /miniapp (no trailing slash), so pin relative URLs
    // (miniapp.css, ../config.js) to the folder they live in.
    body = body.toString("utf8").replace("<head>", '<head>\n  <base href="/miniapp/" />');
  }
  return new Response(typeof body === "string" ? body : new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "no-cache" } });
}
