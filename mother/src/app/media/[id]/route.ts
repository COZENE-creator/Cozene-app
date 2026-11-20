import { getMedia } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Uploaded photos, public (guests see them in the Mini App). Never change, so cache for good. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const media = await getMedia(params.id);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.content_type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
