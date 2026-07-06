import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaResend } from "../_shared/resend.ts";

// Sent from shareitt.xyz, verified in Resend (resend.com/domains).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

async function buildEmail(type: string, payload: Record<string, unknown>) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Missing email payload.");
  }

  switch (type) {
    case "host_registration": {
      const {
        to,
        host_name,
        service_name,
        total_slots,
        price_per_slot,
        whatsapp_group_link,
      } = payload as Record<string, unknown>;

      if (!to || !service_name || !host_name) {
        throw new Error("Missing host registration fields.");
      }

      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: `Your ${service_name} family is now live on ShareIt`,
        html: `
          <p>Hi ${String(host_name)},</p>
          <p>Your family listing for <strong>${String(service_name)}</strong> is now live on ShareIt.</p>
          <ul>
            <li>Total slots: ${String(total_slots ?? "N/A")}</li>
            <li>Price per slot: KSh ${String(price_per_slot ?? "N/A")}</li>
          </ul>
          <p>Share your WhatsApp link with members so they can join quickly.</p>
          <p>${whatsapp_group_link ? `Group link: <a href="${String(whatsapp_group_link)}">${String(whatsapp_group_link)}</a>` : "No WhatsApp link was provided."}</p>
          <p>Thank you for hosting with ShareIt.</p>
        `,
      };
    }
    case "first_membership_request": {
      const { to, member_name, service_name, host_name } = payload as Record<
        string,
        unknown
      >;
      if (!to || !member_name || !service_name || !host_name) {
        throw new Error("Missing membership request fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: `You requested to join ${service_name} on ShareIt`,
        html: `
          <p>Hi ${String(member_name)},</p>
          <p>Thanks for requesting to join <strong>${String(service_name)}</strong> hosted by ${String(host_name)}.</p>
          <p>We recorded your request and will share any updates as soon as the host confirms your membership.</p>
          <p>Thank you for using ShareIt.</p>
        `,
      };
    }
    case "welcome": {
      const { to, name } = payload as Record<string, unknown>;
      if (!to) {
        throw new Error("Missing welcome email fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: "Welcome to ShareIt!",
        html: `
          <p>Hi ${String(name || "there")},</p>
          <p>Welcome to ShareIt — Kenya's marketplace for sharing subscription costs.</p>
          <p>Next steps:</p>
          <ul>
            <li>Confirm your email address if you haven't already.</li>
            <li>Browse live families to join, or host your own — both are free.</li>
          </ul>
          <p>Thanks for joining ShareIt.</p>
        `,
      };
    }
    case "admin_login_report": {
      const { user_email, user_name, method, signed_in_at } =
        payload as Record<string, unknown>;
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        // Fixed recipient, not caller-supplied — this is an internal
        // notification, so the destination isn't taken from payload.to.
        to: "keninnofficial@gmail.com",
        subject: "ShareIt login report",
        html: `
          <p>A user just signed in to ShareIt.</p>
          <ul>
            <li>Name: ${String(user_name || "Not provided")}</li>
            <li>Email: ${String(user_email || "Not provided")}</li>
            <li>Method: ${String(method || "Not provided")}</li>
            <li>Signed in at: ${String(signed_in_at || new Date().toISOString())}</li>
          </ul>
        `,
      };
    }
    case "admin_new_signup": {
      const { user_email, user_name, user_phone, method, signed_up_at } =
        payload as Record<string, unknown>;
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        // Fixed recipient, not caller-supplied — this is an internal
        // notification, so the destination isn't taken from payload.to.
        to: "keninnofficial@gmail.com",
        subject: "New ShareIt sign-up",
        html: `
          <p>A new user just signed up on ShareIt.</p>
          <ul>
            <li>Name: ${String(user_name || "Not provided")}</li>
            <li>Email: ${String(user_email || "Not provided")}</li>
            <li>Phone: ${String(user_phone || "Not provided")}</li>
            <li>Method: ${String(method || "Not provided")}</li>
            <li>Signed up at: ${String(signed_up_at || new Date().toISOString())}</li>
          </ul>
        `,
      };
    }
    case "admin_new_member": {
      const { member_name, service_name, host_name } = payload as Record<
        string,
        unknown
      >;
      if (!member_name || !service_name) {
        throw new Error("Missing new member fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to: "keninnofficial@gmail.com",
        subject: `New join request: ${String(service_name)}`,
        html: `
          <p>A new member just requested to join a group on ShareIt.</p>
          <ul>
            <li>Member: ${String(member_name)}</li>
            <li>Service: ${String(service_name)}</li>
            <li>Host: ${String(host_name ?? "N/A")}</li>
          </ul>
        `,
      };
    }
    case "host_new_member": {
      const { family_id, member_name } = payload as Record<string, unknown>;
      if (!family_id || !member_name) {
        throw new Error("Missing host notification fields.");
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Server is not configured to look up the host.");
      }

      // host_email has no anon/authenticated column grant (see Join.jsx), so
      // it's looked up here with the service role key instead of ever being
      // sent to the browser.
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: family, error: lookupError } = await adminClient
        .from("families")
        .select("host_email, host_name, service_name")
        .eq("id", family_id as string)
        .single();

      if (lookupError || !family?.host_email) {
        throw new Error("Could not find a host email for this group.");
      }

      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to: family.host_email,
        subject: `${String(member_name)} wants to join your ${String(family.service_name)} group`,
        html: `
          <p>Hi ${String(family.host_name)},</p>
          <p><strong>${String(member_name)}</strong> just requested to join your <strong>${String(family.service_name)}</strong> group on ShareIt.</p>
          <p>Check your Host dashboard for their contact details.</p>
        `,
      };
    }
    case "admin_family_full": {
      const { service_name, host_name, total_slots } = payload as Record<
        string,
        unknown
      >;
      if (!service_name) {
        throw new Error("Missing family full fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to: "keninnofficial@gmail.com",
        subject: `${String(service_name)} family is now full`,
        html: `
          <p>A family just filled all of its slots on ShareIt.</p>
          <ul>
            <li>Service: ${String(service_name)}</li>
            <li>Host: ${String(host_name ?? "N/A")}</li>
            <li>Total slots: ${String(total_slots ?? "N/A")}</li>
          </ul>
        `,
      };
    }
    case "host_family_full": {
      const { family_id } = payload as Record<string, unknown>;
      if (!family_id) {
        throw new Error("Missing host family full fields.");
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Server is not configured to look up the host.");
      }

      // host_email has no anon/authenticated column grant (see Join.jsx), so
      // it's looked up here with the service role key instead of ever being
      // sent to the browser.
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: family, error: lookupError } = await adminClient
        .from("families")
        .select("host_email, host_name, service_name, total_slots")
        .eq("id", family_id as string)
        .single();

      if (lookupError || !family?.host_email) {
        throw new Error("Could not find a host email for this group.");
      }

      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to: family.host_email,
        subject: `Great news — your ${String(family.service_name)} group is full!`,
        html: `
          <p>Hi ${String(family.host_name)},</p>
          <p>Your <strong>${String(family.service_name)}</strong> family just filled its last slot — all ${String(family.total_slots)} spots are taken. Thank you for hosting with ShareIt!</p>
          <p>Here's what to keep in mind now that you're full:</p>
          <ul>
            <li>New join requests for this group will be turned away automatically until a slot opens up.</li>
            <li>You can manage members, remove inactive ones, and free up slots any time from your Host dashboard.</li>
            <li>Keep an eye on renewals — reminding members ahead of the billing date helps avoid awkward gaps.</li>
          </ul>
          <p>Since this group filled up, there's clearly demand for it. Consider hosting another ${String(family.service_name)} family (or a different service) — it's free to list, and it's a great way to help more people save while earning more for yourself.</p>
          <p>Thanks again for being a great host on ShareIt.</p>
        `,
      };
    }
    case "member_left": {
      const { family_id, member_name, reason } = payload as Record<
        string,
        unknown
      >;
      if (!family_id || !member_name) {
        throw new Error("Missing member left fields.");
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Server is not configured to look up the host.");
      }

      // host_email has no anon/authenticated column grant (see Join.jsx), so
      // it's looked up here with the service role key instead of ever being
      // sent to the browser.
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: family, error: lookupError } = await adminClient
        .from("families")
        .select("host_email, host_name, service_name")
        .eq("id", family_id as string)
        .single();

      if (lookupError || !family?.host_email) {
        throw new Error("Could not find a host email for this group.");
      }

      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        // Sent to both the host and ShareIt's internal address, so it's a
        // fixed recipient list, not caller-supplied.
        to: [family.host_email, "keninnofficial@gmail.com"],
        subject: `${String(member_name)} left your ${String(family.service_name)} group`,
        html: `
          <p>Hi ${String(family.host_name)},</p>
          <p><strong>${String(member_name)}</strong> just left your <strong>${String(family.service_name)}</strong> group on ShareIt, freeing up their slot.</p>
          ${reason ? `<p>Reason given: ${String(reason)}</p>` : ""}
          <p>Check your Host dashboard — the slot is now open for someone new to join.</p>
        `,
      };
    }
    case "member_removed": {
      const { to, member_name, service_name, host_name } = payload as Record<
        string,
        unknown
      >;
      if (!to || !member_name || !service_name || !host_name) {
        throw new Error("Missing member removal fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: `You were removed from ${service_name} on ShareIt`,
        html: `
          <p>Hi ${String(member_name)},</p>
          <p>We wanted to let you know that you were removed from the <strong>${String(service_name)}</strong> family hosted by ${String(host_name)}.</p>
          <p>If this was a mistake, please reach out to the host to rejoin.</p>
          <p>Thank you for being a part of ShareIt.</p>
        `,
      };
    }
    default:
      throw new Error(`Unsupported email type: ${type}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST requests are supported." }, 405);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "RESEND_API_KEY is not configured." }, 500);
  }

  let requestBody: Record<string, unknown>;

  try {
    requestBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const { type, payload } = requestBody as {
    type?: string;
    payload?: Record<string, unknown>;
  };

  if (!type) {
    return jsonResponse({ error: "Email type is required." }, 400);
  }

  let emailPayload;
  try {
    emailPayload = await buildEmail(type, payload ?? {});
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "Invalid email payload.",
      },
      400,
    );
  }

  try {
    const result = await sendViaResend(apiKey, emailPayload);
    return jsonResponse({ success: true, result }, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to send email.",
      },
      502,
    );
  }
});
