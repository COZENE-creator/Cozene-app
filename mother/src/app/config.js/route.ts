export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * window.COZENE_CONFIG for the Mini App when it is served by this app
 * (/miniapp). Same origin, so ENDPOINT_BASE is empty and API calls are relative.
 *
 * MINIAPP_PAGE_LIFF_ID: the LIFF id this endpoint is opened through — the
 * Developing one while testing, the Published one in production.
 */
export function GET() {
  const config = {
    MINIAPP_LIFF_ID: process.env.MINIAPP_PAGE_LIFF_ID || process.env.MINIAPP_LIFF_ID || "",
    ENDPOINT_BASE: "",
    STORE_ID: process.env.DEFAULT_STORE_SLUG || "",
  };
  return new Response(`window.COZENE_CONFIG = ${JSON.stringify(config)};\n`, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
  });
}
