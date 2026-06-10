import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaResend } from "../_shared/resend.ts";

// Triggered by a Supabase Database Webhook on escrow_payments UPDATE.
// Sends a "payment confirmed" email to the joiner when staff flip
// payment_confirmed from false to true.
//
// Sending from Resend's shared "onboarding@resend.dev" address until
// shareit.app is verified at resend.com/domains. Once verified, switch
// the "from" value back to "ShareIt <no-reply@shareit.app>".
serve(async (req) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
    });
  }

  const { type, table, record, old_record } = body as {
    type?: string;
    table?: string;
    record?: Record<string, unknown>;
    old_record?: Record<string, unknown>;
  };

  if (
    type !== "UPDATE" ||
    table !== "escrow_payments" ||
    !record?.payment_confirmed ||
    old_record?.payment_confirmed
  ) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing required environment variables." }),
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: member } = await supabase
    .from("members")
    .select("name, email")
    .eq("id", record.member_id)
    .single();

  const { data: family } = await supabase
    .from("families")
    .select("service_name")
    .eq("id", record.family_id)
    .single();

  let recipient = member?.email as string | undefined;
  if (!recipient && record.user_id) {
    const { data: userData } = await supabase.auth.admin.getUserById(
      record.user_id as string,
    );
    recipient = userData?.user?.email;
  }

  if (!recipient) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "No recipient email found." }),
      { status: 200 },
    );
  }

  const serviceName = family?.service_name ?? "your family";

  try {
    await sendViaResend(resendApiKey, {
      from: "ShareIt <onboarding@resend.dev>",
      to: recipient,
      subject: `Payment confirmed for ${serviceName}`,
      html: `
        <p>Hi ${String(member?.name ?? "there")},</p>
        <p>Your ShareIt Escrow payment of <strong>KSh ${String(record.total_amount)}</strong> for <strong>${String(serviceName)}</strong> has been confirmed.</p>
        <p>Your slot is now active. Enjoy!</p>
      `,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to send email.",
      }),
      { status: 502 },
    );
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
