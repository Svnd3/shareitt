import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Verifies a Paystack transaction server-side before ever granting host/join
// capacity — the client's own "payment successful" callback is never trusted
// on its own (that's exactly the manual/unverified M-Pesa code problem that
// sank the old KSh 90 reliability fee, see docs/PAYMENT_STRATEGY.md). Nothing
// is written to payment_grants unless Paystack itself confirms the charge.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIERS: Record<
  string,
  {
    amount: number;
    hostSlotsTotal: number;
    joinSlotsTotal: number;
    isUnlimited: boolean;
  }
> = {
  join: { amount: 80, hostSlotsTotal: 0, joinSlotsTotal: 1, isUnlimited: false },
  host: { amount: 90, hostSlotsTotal: 1, joinSlotsTotal: 0, isUnlimited: false },
  combo: { amount: 110, hostSlotsTotal: 1, joinSlotsTotal: 1, isUnlimited: false },
  power: { amount: 170, hostSlotsTotal: 4, joinSlotsTotal: 3, isUnlimited: false },
  unlimited: { amount: 249, hostSlotsTotal: 0, joinSlotsTotal: 0, isUnlimited: true },
};

const UNLIMITED_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

// Marketplace shop tiers — kept in sync with SHOP_PRICING_TIERS in
// src/lib/payments.js. Handled separately from TIERS above because a shop
// charge doesn't write to payment_grants at all — it creates/renews a shops
// row via create_shop_paid()/extend_shop_subscription() instead (see
// supabase_rls_policies.sql).
const SHOP_TIERS: Record<string, { amount: number }> = {
  shop_setup: { amount: 449 },
  shop_subscription: { amount: 299 },
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { reference, tier, shop, shopId } = await req.json();

    if (!reference || typeof reference !== "string") {
      return jsonResponse({ error: "Missing payment reference." }, 400);
    }

    const tierConfig = TIERS[tier];
    const shopTierConfig = SHOP_TIERS[tier];
    if (!tierConfig && !shopTierConfig) {
      return jsonResponse({ error: "Unknown tier." }, 400);
    }

    if (tier === "shop_setup" && (!shop?.category || !shop?.shopName || !shop?.ownerName || !shop?.ownerPhone || !shop?.ownerEmail)) {
      return jsonResponse({ error: "Missing shop details." }, 400);
    }
    if (tier === "shop_subscription" && !shopId) {
      return jsonResponse({ error: "Missing shopId." }, 400);
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return jsonResponse({ error: "PAYSTACK_SECRET_KEY is not configured." }, 500);
    }

    // Identify the caller from their own session token — never trust a
    // client-supplied user id.
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") as string,
      Deno.env.get("SUPABASE_ANON_KEY") as string,
      {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      },
    );
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Not signed in." }, 401);
    }

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
    );
    const verifyBody = await verifyResponse.json();

    // Paystack returns 401 here if PAYSTACK_SECRET_KEY is missing/wrong or
    // doesn't match the mode (test vs live) of the key used on the client —
    // logged so a failed payment is diagnosable from the function logs
    // instead of just showing "could not be verified" with no reason.
    if (!verifyResponse.ok) {
      console.error(
        "Paystack verify HTTP error",
        verifyResponse.status,
        JSON.stringify(verifyBody),
      );
      return jsonResponse({ error: "Payment could not be verified." }, 402);
    }

    const expectedAmount = (tierConfig?.amount ?? shopTierConfig?.amount ?? 0) * 100;
    const paidSuccessfully =
      verifyBody?.status === true &&
      verifyBody?.data?.status === "success" &&
      verifyBody?.data?.amount === expectedAmount;

    if (!paidSuccessfully) {
      console.error("Paystack verify rejected", {
        tier,
        reference,
        expectedAmount,
        paystackStatus: verifyBody?.status,
        transactionStatus: verifyBody?.data?.status,
        transactionAmount: verifyBody?.data?.amount,
        gatewayResponse: verifyBody?.data?.gateway_response,
        message: verifyBody?.message,
      });
      return jsonResponse({ error: "Payment could not be verified." }, 402);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") as string,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
    );

    if (tier === "shop_setup") {
      // paystack_reference is unique on shop_contacts (see
      // supabase_rls_policies.sql) — same replay protection payment_grants
      // gets from its own unique paystack_reference column. A reused
      // reference fails the insert inside create_shop_paid with a unique
      // violation instead of silently creating a second shop.
      const { data: newShop, error: shopError } = await adminClient.rpc("create_shop_paid", {
        p_owner_id: user.id,
        p_category: shop.category,
        p_shop_name: shop.shopName,
        p_owner_name: shop.ownerName,
        p_owner_phone: shop.ownerPhone,
        p_owner_email: shop.ownerEmail,
        p_paystack_reference: reference,
      });

      if (shopError) {
        return jsonResponse({ error: shopError.message }, 409);
      }

      return jsonResponse({ shop: newShop });
    }

    if (tier === "shop_subscription") {
      const { data: ownedShop, error: ownershipError } = await adminClient
        .from("shops")
        .select("id")
        .eq("id", shopId)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (ownershipError || !ownedShop) {
        return jsonResponse({ error: "Shop not found." }, 404);
      }

      const { data: newExpiry, error: extendError } = await adminClient.rpc(
        "extend_shop_subscription",
        { p_shop_id: shopId, p_paystack_reference: reference },
      );

      if (extendError) {
        return jsonResponse({ error: extendError.message }, 409);
      }

      return jsonResponse({ subscriptionActiveUntil: newExpiry });
    }

    const { data: grant, error: insertError } = await adminClient
      .from("payment_grants")
      .insert({
        user_id: user.id,
        tier,
        amount: tierConfig!.amount,
        paystack_reference: reference,
        host_slots_total: tierConfig!.hostSlotsTotal,
        join_slots_total: tierConfig!.joinSlotsTotal,
        is_unlimited: tierConfig!.isUnlimited,
        expires_at: tierConfig!.isUnlimited
          ? new Date(Date.now() + UNLIMITED_DURATION_MS).toISOString()
          : null,
      })
      .select()
      .single();

    if (insertError) {
      // Unique violation on paystack_reference means this reference was
      // already redeemed for a grant — not a new payment to honor again.
      return jsonResponse({ error: insertError.message }, 409);
    }

    return jsonResponse({ grant });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Verification failed." },
      500,
    );
  }
});
