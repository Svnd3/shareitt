import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
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

function buildEmail(type: string, payload: Record<string, unknown>) {
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
    case "sign_in": {
      const { to, name } = payload as Record<string, unknown>;
      if (!to) {
        throw new Error("Missing sign-in email fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: "New sign-in to your ShareIt account",
        html: `
          <p>Hi ${String(name || "there")},</p>
          <p>We noticed a new sign-in to your ShareIt account.</p>
          <p>If this was you, no action is needed. If you don't recognize this activity, please reset your password right away.</p>
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
    emailPayload = buildEmail(type, payload ?? {});
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
