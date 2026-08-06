import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TIERS: Record<string, { amount: number; host: number; join: number; unlimited: boolean }> = {
  join: { amount: 80, host: 0, join: 1, unlimited: false },
  host: { amount: 90, host: 1, join: 0, unlimited: false },
  combo: { amount: 110, host: 1, join: 1, unlimited: false },
  power: { amount: 170, host: 4, join: 3, unlimited: false },
  unlimited: { amount: 249, host: 0, join: 0, unlimited: true },
};

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) return new Response("Not configured", { status: 500 });

  const rawBody = await req.text();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const expectedSignature = hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
  );
  if (req.headers.get("x-paystack-signature") !== expectedSignature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event?.event !== "charge.success") return new Response("ok");

  const payment = event.data;
  const reference = payment?.reference;
  const metadata = typeof payment?.metadata === "string"
    ? JSON.parse(payment.metadata || "{}")
    : payment?.metadata ?? {};
  const tier = metadata.tier;
  const config = TIERS[tier];
  if (!reference || !config || payment?.status !== "success" || payment?.amount !== config.amount * 100) {
    return new Response("Ignored invalid charge", { status: 200 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") as string,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
  );
  const { data: attempt } = await admin
    .from("payment_attempts")
    .select("user_id,tier")
    .eq("reference", reference)
    .maybeSingle();
  const userId = attempt?.user_id ?? metadata.user_id;
  if (!userId || (attempt && attempt.tier !== tier)) {
    console.error("Paystack charge has no valid ShareIt payment attempt", { reference, tier });
    return new Response("Missing payment owner", { status: 200 });
  }

  const { error } = await admin.from("payment_grants").upsert({
    user_id: userId,
    tier,
    amount: config.amount,
    paystack_reference: reference,
    host_slots_total: config.host,
    join_slots_total: config.join,
    is_unlimited: config.unlimited,
    expires_at: config.unlimited
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      : null,
  }, { onConflict: "paystack_reference", ignoreDuplicates: true });

  if (error) {
    console.error("Could not grant Paystack payment", { reference, error });
    return new Response("Database error", { status: 500 });
  }

  await admin.from("payment_attempts")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("reference", reference);
  return new Response("ok");
});
