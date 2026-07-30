import { supabase, supabaseUrl, supabaseAnonKey } from "./supabaseClient";
import { isAdminEmail } from "./adminAccess";

// Flip to true to re-enable the tiered payment paywall for hosting/joining.
export const PAYMENTS_ENABLED = false;

const VERIFY_PAYMENT_URL = `${supabaseUrl}/functions/v1/verify-payment`;

// Kept in sync with supabase/functions/verify-payment/index.ts, which
// re-checks these amounts server-side against what Paystack actually
// confirms — this copy only drives what the UI shows and what amount gets
// sent to Paystack.
export const PRICING_TIERS = [
  {
    id: "join",
    name: "Join Pass",
    amount: 80,
    hostSlots: 0,
    joinSlots: 1,
    description: "Join 1 group",
  },
  {
    id: "host",
    name: "Host Starter",
    amount: 90,
    hostSlots: 1,
    joinSlots: 0,
    description: "Host 1 group",
  },
  {
    id: "combo",
    name: "Combo",
    amount: 49,
    hostSlots: 1,
    joinSlots: 1,
    description: "Host 1 + Join 1",
  },
  {
    id: "power",
    name: "Power Host",
    amount: 119,
    hostSlots: 4,
    joinSlots: 3,
    description: "Host up to 4 + Join up to 3",
    badge: "Best value",
  },
  {
    id: "unlimited",
    name: "Unlimited",
    amount: 249,
    hostSlots: null,
    joinSlots: null,
    description: "Host & join unlimited groups for 3 months",
    badge: "For power users",
  },
];

export async function getUserCapacity(userId, email) {
  if (isAdminEmail(email)) {
    return { hostRemaining: Infinity, joinRemaining: Infinity, unlimitedActive: true };
  }

  if (!userId) {
    return { hostRemaining: 0, joinRemaining: 0, unlimitedActive: false };
  }

  const { data, error } = await supabase
    .from("payment_grants")
    .select(
      "host_slots_total,host_slots_used,join_slots_total,join_slots_used,is_unlimited,expires_at",
    )
    .eq("user_id", userId);

  if (error || !data) {
    return { hostRemaining: 0, joinRemaining: 0, unlimitedActive: false };
  }

  const now = Date.now();
  const unlimitedActive = data.some(
    (grant) => grant.is_unlimited && new Date(grant.expires_at).getTime() > now,
  );

  const hostRemaining = data.reduce(
    (sum, grant) => sum + Math.max(0, grant.host_slots_total - grant.host_slots_used),
    0,
  );
  const joinRemaining = data.reduce(
    (sum, grant) => sum + Math.max(0, grant.join_slots_total - grant.join_slots_used),
    0,
  );

  return { hostRemaining, joinRemaining, unlimitedActive };
}

export async function consumeCapacity(type) {
  const { error } = await supabase.rpc("consume_capacity", { p_type: type });
  if (error) {
    throw new Error(error.message || `Unable to consume ${type} capacity.`);
  }
}

export function generatePaymentReference(tierId) {
  return `SHAREIT_${tierId.toUpperCase()}_${Date.now()}`;
}

export async function verifyPayment({ reference, tier, accessToken }) {
  const response = await fetch(VERIFY_PAYMENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ reference, tier }),
    signal: AbortSignal.timeout(20000),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error || `Payment verification failed (${response.status}).`);
  }

  return body.grant;
}

// Shop setup (KSh 449, one-time — only charged once the first-40-free tier
// for a category is full) and shop subscription renewal (KSh 299/month).
// Kept in sync with the SHOP_TIERS constant in
// supabase/functions/verify-payment/index.ts, which re-checks these amounts
// server-side against what Paystack actually confirms.
export const SHOP_PRICING_TIERS = {
  shop_setup: { id: "shop_setup", name: "Shop Setup", amount: 449 },
  shop_subscription: { id: "shop_subscription", name: "Monthly Subscription", amount: 299 },
};

export function generateShopPaymentReference(tierId) {
  return `SHAREIT_${tierId.toUpperCase()}_${Date.now()}`;
}

// Same verification endpoint as verifyPayment, but for a shop-setup or
// shop-subscription charge — the edge function branches on `tier` and calls
// create_shop_paid()/extend_shop_subscription() instead of writing a
// payment_grants row. `shop` carries the new shop's details for shop_setup;
// `shopId` identifies the shop being renewed for shop_subscription.
export async function verifyShopPayment({ reference, tier, accessToken, shop, shopId }) {
  const response = await fetch(VERIFY_PAYMENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ reference, tier, shop, shopId }),
    signal: AbortSignal.timeout(20000),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error || `Payment verification failed (${response.status}).`);
  }

  return body;
}
