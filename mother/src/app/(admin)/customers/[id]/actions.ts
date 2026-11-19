"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/auth-server";
import { setUserTag } from "@/lib/tags";
import { getTr } from "@/lib/lang-server";

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
  const tr = getTr();
  if (!currentAdmin())
    return { ok: false, error: tr("セッションの有効期限が切れました。もう一度ログインしてください。", "Session expired — sign in again."), unauthorized: true };

  const result = await setUserTag(userId, tagId, action);
  if (!result.ok) {
    // setUserTag returns fixed English codes (also used by /api/tags/assign).
    const error =
      result.error === "unknown tag"
        ? tr("タグが見つかりません", "unknown tag")
        : result.error === "user_id and tag_id are required"
          ? tr("顧客とタグを指定してください", "user_id and tag_id are required")
          : result.error;
    return { ok: false, error };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${userId}`);
  revalidatePath("/tags");
  return result;
}
