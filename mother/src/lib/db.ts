import { Pool, type QueryResultRow } from "pg";
import fs from "fs";
import path from "path";

// Minimal Queryable surface shared by node-postgres and PGlite.
type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

declare global {
  // eslint-disable-next-line no-var
  var __cozeneDb: Promise<Queryable> | undefined;
}

/**
 * Local-dev fallback: when DATABASE_URL is unset (or "pglite"), use PGlite —
 * an in-process WASM Postgres that needs no server/Docker. Production sets a
 * real DATABASE_URL and gets node-postgres. Both expose the same query() below,
 * so route/query code is identical either way.
 */
function usePglite(): boolean {
  const url = process.env.DATABASE_URL;
  return !url || url.startsWith("pglite");
}

async function makePglite(): Promise<Queryable> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".pglite-data");
  const db = new PGlite(dir);
  await db.waitReady;

  // Bootstrap schema + seed (idempotent: migrations use IF NOT EXISTS, seed ON CONFLICT).
  // Every migration runs in filename order, so adding 000N_*.sql is enough — no
  // need to touch this file again.
  const root = path.join(process.cwd(), "..", "db");
  const dirPath = path.join(root, "migrations");
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs
      .readFileSync(path.join(dirPath, file), "utf8")
      // pgcrypto isn't bundled in PGlite; gen_random_uuid() is core in PG16 anyway.
      .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, "");
    await db.exec(sql);
  }
  const seed = fs.readFileSync(path.join(root, "seed.sql"), "utf8");
  await db.exec(seed);

  return { query: (text, params) => db.query(text, (params as unknown[]) ?? []) };
}

function makePgPool(): Queryable {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
  return { query: (text, params) => pool.query(text, (params as never[]) ?? []) };
}

function getDb(): Promise<Queryable> {
  if (!global.__cozeneDb) {
    global.__cozeneDb = usePglite() ? makePglite() : Promise.resolve(makePgPool());
  }
  return global.__cozeneDb;
}

/** Typed query helper. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getDb();
  const res = await db.query(text, params);
  return res.rows as T[];
}

/** Query expecting at most one row. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Resolve a store slug (e.g. "store_001") to its uuid, or null if unknown. */
export async function resolveStoreId(slug: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    "SELECT id FROM stores WHERE slug = $1",
    [slug]
  );
  return row?.id ?? null;
}
