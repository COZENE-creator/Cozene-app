import crypto from "crypto";

// Staff PIN: staff type it on the guest's phone to confirm a benefit.
// Stored as scrypt "salt.hash"; a 4–8 digit PIN is weak on its own, so wrong
// guesses are rate-limited per guest+store.

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(pin, salt, 32).toString("base64url");
  return `${salt}.${hash}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(".");
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "base64url");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// In-memory limiter: enough for a single-instance deployment. Move to the DB
// (or Redis) before running several instances.
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, number[]>();

function recent(key: string): number[] {
  const now = Date.now();
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, list);
  return list;
}

export function pinLocked(key: string): boolean {
  return recent(key).length >= MAX_FAILURES;
}

export function notePinFailure(key: string): void {
  recent(key).push(Date.now());
}

export function clearPinFailures(key: string): void {
  failures.delete(key);
}
