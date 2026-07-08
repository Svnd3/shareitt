import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaResend } from "../_shared/resend.ts";

// Runs daily via pg_cron (see the "Unlimited-plan expiry reminders" comment
// block at the end of supabase_schema.sql for the scheduling SQL). Emails
// Unlimited-plan holders once when their plan has 5 days left, and once more
// at 3 days left. Each threshold is tracked by the reminder_5day_sent_at /
// reminder_3day_sent_at columns on payment_grants so a threshold is never
// emailed twice, even if the cron run is late or repeats a day.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const THRESHOLDS = [
  { days: 5, column: "reminder_5day_sent_at" as const },
  { days: 3, column: "reminder_3day_sent_at" as const },
];

function reminderEmail(to: string, daysLeft: number, expiresAt: string) {
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    from: "ShareIt <no-reply@shareitt.xyz>",
    to,
    subject: `Your ShareIt Unlimited plan expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: `
      <p>Hi,</p>
      <p>Your ShareIt Unlimited plan (host &amp; join unlimited groups) expires in <strong>${daysLeft} days</strong>, on ${expiryDate}.</p>
      <p>After that, hosting or joining a new group will require paying again. Renew any time from your ShareIt account to keep uninterrupted access.</p>
      <p>Thanks for using ShareIt.</p>
    `,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY is not configured." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") as string,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
  );

  const now = new Date();
  const sentCounts: Record<string, number> = { "5day": 0, "3day": 0 };
  const errors: string[] = [];

  for (const { days, column } of THRESHOLDS) {
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    // is_unlimited grants only ever have expires_at set 90 days out at
    // purchase time (see verify-payment) — this catches anything that has
    // now drifted within `days` of that expiry and hasn't been reminded yet.
    const { data: grants, error } = await adminClient
      .from("payment_grants")
      .select("id, user_id, expires_at")
      .eq("is_unlimited", true)
      .is(column, null)
      .lte("expires_at", cutoff)
      .gt("expires_at", now.toISOString());

    if (error) {
      errors.push(`${column} query: ${error.message}`);
      continue;
    }

    for (const grant of grants ?? []) {
      const { data: userData, error: userError } =
        await adminClient.auth.admin.getUserById(grant.user_id);

      if (userError || !userData?.user?.email) {
        errors.push(
          `No email for user ${grant.user_id} (grant ${grant.id}): ${userError?.message ?? "missing email"}`,
        );
        continue;
      }

      try {
        await sendViaResend(
          resendApiKey,
          reminderEmail(userData.user.email, days, grant.expires_at as string),
        );

        await adminClient
          .from("payment_grants")
          .update({ [column]: new Date().toISOString() })
          .eq("id", grant.id);

        sentCounts[`${days}day`] += 1;
      } catch (sendError) {
        errors.push(
          `Failed to email grant ${grant.id}: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
        );
      }
    }
  }

  return new Response(JSON.stringify({ sent: sentCounts, errors }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
