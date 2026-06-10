import { hasSupabaseConfig, supabaseUrl, supabaseAnonKey } from "./supabaseClient";

const EMAIL_FUNCTION_URL = `${supabaseUrl}/functions/v1/send-email`;

// Raw fetch (not supabase.functions.invoke) — these are fire-and-forget
// notifications that only need the anon key, and must not depend on the
// main client's auth state/lock, which can be busy or hung after sign-in.
async function invokeEmailFunction(type, payload) {
  if (!hasSupabaseConfig) return;

  const response = await fetch(EMAIL_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ type, payload }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `Email request failed (${response.status}).`);
  }
}

export async function sendHostRegistrationEmail({ email, family }) {
  if (!email) {
    throw new Error("Missing host email.");
  }

  await invokeEmailFunction("host_registration", {
    to: email,
    host_name: family.host_name,
    service_name: family.service_name,
    total_slots: family.total_slots,
    price_per_slot: family.price_per_slot,
    whatsapp_group_link: family.whatsapp_group_link,
  });
}

export async function sendMembershipRequestEmail({
  email,
  memberName,
  family,
}) {
  if (!email) {
    throw new Error("Missing member email.");
  }

  await invokeEmailFunction("first_membership_request", {
    to: email,
    member_name: memberName,
    service_name: family.service_name,
    host_name: family.host_name,
  });
}

export async function sendPaymentConfirmationEmail({
  email,
  memberName,
  amount,
}) {
  if (!email) {
    throw new Error("Missing member email.");
  }

  await invokeEmailFunction("payment_confirmation", {
    to: email,
    member_name: memberName,
    amount,
  });
}

export async function sendPaymentReminderEmail({
  email,
  memberName,
  serviceName,
  hostName,
}) {
  if (!email) {
    throw new Error("Missing member email.");
  }

  await invokeEmailFunction("payment_reminder", {
    to: email,
    member_name: memberName,
    service_name: serviceName,
    host_name: hostName,
  });
}

export async function sendWelcomeEmail({ email, name }) {
  if (!email) {
    throw new Error("Missing user email.");
  }

  await invokeEmailFunction("welcome", {
    to: email,
    name,
  });
}

export async function sendSignInEmail({ email, name }) {
  if (!email) {
    throw new Error("Missing user email.");
  }

  await invokeEmailFunction("sign_in", {
    to: email,
    name,
  });
}

export async function sendEscrowPaymentReceivedEmail({
  email,
  hostName,
  memberName,
  serviceName,
  amount,
  mpesaCode,
}) {
  if (!email) {
    throw new Error("Missing host email.");
  }

  await invokeEmailFunction("escrow_payment_received", {
    to: email,
    host_name: hostName,
    member_name: memberName,
    service_name: serviceName,
    amount,
    mpesa_code: mpesaCode,
  });
}

export async function sendMemberRemovedEmail({
  email,
  memberName,
  serviceName,
  hostName,
}) {
  if (!email) {
    throw new Error("Missing member email.");
  }

  await invokeEmailFunction("member_removed", {
    to: email,
    member_name: memberName,
    service_name: serviceName,
    host_name: hostName,
  });
}
