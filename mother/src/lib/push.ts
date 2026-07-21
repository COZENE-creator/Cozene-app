import { query, queryOne } from "./db";
import { resolveAudience } from "./queries";
import { pushText } from "./line";

export type SendInput = {
  storeId: string;
  title: string;
  body: string;
  audienceType: "all" | "tag" | "segment";
  audienceSpec: { tag_ids?: string[] };
  createdBy: string;
};

export type SendSummary = {
  campaignId: string;
  recipients: number;
  sent: number;
  failed: number;
};

/**
 * Create a campaign and deliver it now. Uses per-recipient push (not multicast)
 * so each delivery's status + LINE request id / error is recorded — that per-row
 * detail is what powers the results dashboard and future retries.
 */
export async function sendCampaignNow(input: SendInput): Promise<SendSummary> {
  const campaign = await queryOne<{ id: string }>(
    `INSERT INTO push_campaigns (store_id, title, body, audience_type, audience_spec, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'sending', $6) RETURNING id`,
    [input.storeId, input.title, input.body, input.audienceType,
     JSON.stringify(input.audienceSpec), input.createdBy]
  );
  const campaignId = campaign!.id;

  const audience = await resolveAudience(input.audienceType, input.audienceSpec);

  let sent = 0;
  let failed = 0;

  // Modest concurrency to stay well under LINE rate limits.
  const CONCURRENCY = 5;
  for (let i = 0; i < audience.length; i += CONCURRENCY) {
    const batch = audience.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (u) => {
        const result = await pushText(u.line_user_id, input.body);
        if (result.ok) sent++;
        else failed++;
        await query(
          `INSERT INTO push_deliveries
             (campaign_id, store_id, user_id, line_user_id, status, line_request_id, error_code, error_message, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $5 = 'sent' THEN now() ELSE NULL END)
           ON CONFLICT (campaign_id, user_id) DO UPDATE
             SET status = EXCLUDED.status, line_request_id = EXCLUDED.line_request_id,
                 error_code = EXCLUDED.error_code, error_message = EXCLUDED.error_message,
                 sent_at = EXCLUDED.sent_at`,
          [campaignId, u.store_id, u.id, u.line_user_id,
           result.ok ? "sent" : "failed", result.requestId ?? null,
           result.errorCode ?? null, result.errorMessage ?? null]
        );
      })
    );
  }

  await query(
    `UPDATE push_campaigns SET status = $2, sent_at = now() WHERE id = $1`,
    [campaignId, failed > 0 && sent === 0 ? "failed" : "sent"]
  );

  return { campaignId, recipients: audience.length, sent, failed };
}

export type CampaignRow = {
  id: string;
  title: string;
  body: string;
  audience_type: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  recipients: number;
  sent: number;
  failed: number;
};

export function listCampaigns(): Promise<CampaignRow[]> {
  return query<CampaignRow>(
    `SELECT c.id, c.title, c.body, c.audience_type, c.status, c.created_at, c.sent_at,
            COALESCE(d.recipients, 0)::int AS recipients,
            COALESCE(d.sent, 0)::int AS sent,
            COALESCE(d.failed, 0)::int AS failed
       FROM push_campaigns c
       LEFT JOIN (
         SELECT campaign_id, count(*) AS recipients,
                count(*) FILTER (WHERE status = 'sent')   AS sent,
                count(*) FILTER (WHERE status = 'failed') AS failed
           FROM push_deliveries GROUP BY campaign_id
       ) d ON d.campaign_id = c.id
      ORDER BY c.created_at DESC`
  );
}

export type DeliveryRow = {
  user_id: string;
  display_name: string | null;
  line_user_id: string;
  status: string;
  line_request_id: string | null;
  error_message: string | null;
  sent_at: string | null;
};

export async function getCampaign(id: string) {
  const campaign = await queryOne<CampaignRow>(
    `SELECT id, title, body, audience_type, status, created_at, sent_at,
            0 AS recipients, 0 AS sent, 0 AS failed
       FROM push_campaigns WHERE id = $1`,
    [id]
  );
  if (!campaign) return null;
  const deliveries = await query<DeliveryRow>(
    `SELECT d.user_id, u.display_name, d.line_user_id, d.status,
            d.line_request_id, d.error_message, d.sent_at
       FROM push_deliveries d
       LEFT JOIN users u ON u.id = d.user_id
      WHERE d.campaign_id = $1
      ORDER BY d.status, u.display_name NULLS LAST`,
    [id]
  );
  return { campaign, deliveries };
}
