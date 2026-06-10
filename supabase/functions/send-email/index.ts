import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { sendViaResend } from "../_shared/resend.ts";

// Sent from shareitt.xyz, verified in Resend (resend.com/domains).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
          <p>If you paid the reliability fee, your spot is ready to be activated.</p>
          <p>Thank you for using ShareIt.</p>
        `,
      };
    }
    case "payment_confirmation": {
      const { to, member_name, amount } = payload as Record<string, unknown>;
      if (!to || !member_name || !amount) {
        throw new Error("Missing payment confirmation fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: "Payment confirmed — thank you for supporting ShareIt",
        html: `
          <p>Hi ${String(member_name)},</p>
          <p>We received your payment of <strong>KSh ${String(amount)}</strong>.</p>
          <p>Your reliability fee is confirmed and your ShareIt account is in good standing.</p>
          <p>Browse available families or return to your dashboard to continue.</p>
        `,
      };
    }
    case "payment_reminder": {
      const { to, member_name, service_name, host_name } = payload as Record<
        string,
        unknown
      >;
      if (!to || !member_name || !service_name || !host_name) {
        throw new Error("Missing payment reminder fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: `Reminder: pay your reliability fee for ${service_name}`,
        html: `
          <p>Hi ${String(member_name)},</p>
          <p>This is a friendly reminder to complete the KSh 90 reliability fee for <strong>${String(service_name)}</strong> hosted by ${String(host_name)}.</p>
          <p>Once your payment is confirmed, you will remain in good standing with ShareIt and keep access to the family service.</p>
          <p>If you need help, reply to this email or contact your host directly.</p>
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
            <li>Pay the one-time KSh 90 reliability fee to activate your account.</li>
            <li>Browse live families to join, or host your own for free.</li>
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
    case "escrow_payment_received": {
      const {
        to,
        host_name,
        member_name,
        service_name,
        amount,
        mpesa_code,
      } = payload as Record<string, unknown>;
      if (!to || !member_name || !service_name || !amount || !mpesa_code) {
        throw new Error("Missing escrow payment received fields.");
      }
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: `New escrow payment for ${service_name}`,
        html: `
          <p>Hi ${String(host_name || "there")},</p>
          <p><strong>${String(member_name)}</strong> has paid <strong>KSh ${String(amount)}</strong> via ShareIt Escrow for <strong>${String(service_name)}</strong>.</p>
          <p>M-Pesa code: <strong>${String(mpesa_code)}</strong></p>
          <p>ShareIt will verify this payment and activate their slot shortly.</p>
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
