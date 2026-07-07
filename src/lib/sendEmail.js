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

export async function sendWelcomeEmail({ email, name }) {
  if (!email) {
    throw new Error("Missing user email.");
  }

  await invokeEmailFunction("welcome", {
    to: email,
    name,
  });
}

export async function sendAdminLoginReportEmail({
  userEmail,
  userName,
  method,
  signedInAt,
}) {
  await invokeEmailFunction("admin_login_report", {
    user_email: userEmail,
    user_name: userName,
    method,
    signed_in_at: signedInAt,
  });
}

export async function sendAdminNewSignupEmail({
  userEmail,
  userName,
  userPhone,
  method,
  signedUpAt,
}) {
  await invokeEmailFunction("admin_new_signup", {
    user_email: userEmail,
    user_name: userName,
    user_phone: userPhone,
    method,
    signed_up_at: signedUpAt,
  });
}

export async function sendAdminNewMemberEmail({ memberName, family }) {
  await invokeEmailFunction("admin_new_member", {
    member_name: memberName,
    service_name: family.service_name,
    host_name: family.host_name,
  });
}

export async function sendHostNewMemberEmail({ familyId, memberName }) {
  await invokeEmailFunction("host_new_member", {
    family_id: familyId,
    member_name: memberName,
  });
}

export async function sendAdminFamilyFullEmail({ family }) {
  await invokeEmailFunction("admin_family_full", {
    service_name: family.service_name,
    host_name: family.host_name,
    total_slots: family.total_slots,
  });
}

export async function sendHostFamilyFullEmail({ familyId }) {
  await invokeEmailFunction("host_family_full", {
    family_id: familyId,
  });
}

export async function sendMemberLeftEmail({ familyId, memberName, reason }) {
  await invokeEmailFunction("member_left", {
    family_id: familyId,
    member_name: memberName,
    reason,
  });
}

export async function sendNetflixSlotMismatchHostEmail({ familyId }) {
  await invokeEmailFunction("netflix_slot_mismatch_host", {
    family_id: familyId,
  });
}

export async function sendNetflixSlotMismatchAdminEmail({
  familyId,
  hostName,
  totalSlots,
  pricePerSlot,
}) {
  await invokeEmailFunction("netflix_slot_mismatch_admin", {
    family_id: familyId,
    host_name: hostName,
    total_slots: totalSlots,
    price_per_slot: pricePerSlot,
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
