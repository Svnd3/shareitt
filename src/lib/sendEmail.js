import { supabase } from "./supabaseClient";

const EMAIL_FUNCTION_NAME = "send-email";

async function invokeEmailFunction(type, payload) {
  const { error } = await supabase.functions.invoke(EMAIL_FUNCTION_NAME, {
    body: JSON.stringify({ type, payload }),
  });

  if (error) {
    throw error;
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
