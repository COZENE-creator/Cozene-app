import { queryOne } from "./db";

export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Uploads are shrunk in the browser first; this only stops oversized files. */
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A photo field may hold a web link or an uploaded photo's /media/<id> path. */
export const isPhotoUrl = (u: string) => /^https?:\/\/\S+$/i.test(u) || /^\/media\/[0-9a-f-]{36}$/i.test(u);

/** Store a photo; returns its public path (/media/<id>) for image_url columns. */
export async function saveMedia(storeId: string, type: MediaType, bytes: Buffer): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO media (store_id, content_type, bytes, size) VALUES ($1, $2, $3, $4) RETURNING id`,
    [storeId, type, bytes, bytes.length]
  );
  return `/media/${row!.id}`;
}

export async function getMedia(id: string): Promise<{ content_type: string; bytes: Buffer } | null> {
  if (!UUID.test(id)) return null;
  const row = await queryOne<{ content_type: string; bytes: Buffer | Uint8Array }>(
    `SELECT content_type, bytes FROM media WHERE id = $1`,
    [id]
  );
  return row ? { content_type: row.content_type, bytes: Buffer.from(row.bytes) } : null;
}
