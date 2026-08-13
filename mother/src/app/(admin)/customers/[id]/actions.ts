"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/auth-server";
import { setUserTag } from "@/lib/tags";

export type ToggleTagResult =
  | { ok: true; assigned: boolean }
  | { ok: false; error: string; unauthorized?: boolean };

/**
 * Toggle a tag from the customer detail UI.
 *
 * A server action rather than a fetch to /api/tags/assign so revalidatePath can
 * invalidate the client Router Cache too — otherwise the Tags column on
 * /customers and the usage counts on /tags stay stale until a manual reload.
 */
export async function toggleTagAction(
  userId: string,
  tagId: string,
  action: "assign" | "unassign"
): Promise<ToggleTagResult> {
  if (!currentAdmin()) return { ok: false, error: "Session expired — sign in again.", unauthorized: true };

  const result = await setUserTag(userId, tagId, action);
  if (!result.ok) return result;

  revalidatePath("/customers");
  revalidatePath(`/customers/${userId}`);
  revalidatePath("/tags");
  return result;
}
