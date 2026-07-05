import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { sendViaResend } from "../_shared/resend.ts";

// Supabase Auth "Send Email" hook — replaces Supabase's own (heavily
// rate-limited, unbranded) mailer for every auth email: signup confirmation,
// magic link, password recovery, email change, invite. Once this hook is
// enabled in config.toml, Supabase stops sending these itself and POSTs the
// email details here instead, signed with SEND_EMAIL_HOOK_SECRET so we can
// verify the request really came from Supabase.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildConfirmationUrl(emailData: Record<string, unknown>) {
  const params = new URLSearchParams({
    token: String(emailData.token_hash ?? ""),
    type: String(emailData.email_action_type ?? ""),
    redirect_to: String(emailData.redirect_to ?? ""),
  });
  return `${SUPABASE_URL}/auth/v1/verify?${params.toString()}`;
}

function buildEmail(
  user: Record<string, unknown>,
  emailData: Record<string, unknown>,
) {
  const to = String(user.new_email ?? user.email ?? "");
  if (!to) throw new Error("Missing recipient email.");

  const confirmationUrl = buildConfirmationUrl(emailData);
  const token = String(emailData.token ?? "");
  const actionType = String(emailData.email_action_type ?? "");

  const fallback = token
    ? `<p>Or enter this code: <strong>${token}</strong></p>`
    : "";

  switch (actionType) {
    case "signup":
    case "invite":
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject:
          actionType === "invite"
            ? "You've been invited to ShareIt"
            : "Confirm your ShareIt account",
        html: `
          <p>Hi there,</p>
          <p>${actionType === "invite" ? "You've been invited to join ShareIt." : "Thanks for signing up for ShareIt."} Confirm your email to activate your account:</p>
          <p><a href="${confirmationUrl}">Confirm email</a></p>
          ${fallback}
          <p>If you didn't request this, you can ignore this email.</p>
        `,
      };
    case "recovery":
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: "Reset your ShareIt password",
        html: `
          <p>Hi there,</p>
          <p>We received a request to reset your ShareIt password. Click below to choose a new one:</p>
          <p><a href="${confirmationUrl}">Reset password</a></p>
          ${fallback}
          <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
        `,
      };
    case "magiclink":
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: "Your ShareIt sign-in link",
        html: `
          <p>Hi there,</p>
          <p>Click below to sign in to ShareIt:</p>
          <p><a href="${confirmationUrl}">Sign in</a></p>
          ${fallback}
          <p>If you didn't request this, you can ignore this email.</p>
        `,
      };
    case "email_change":
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: "Confirm your new email for ShareIt",
        html: `
          <p>Hi there,</p>
          <p>Confirm that ${to} should become the new email address for your ShareIt account:</p>
          <p><a href="${confirmationUrl}">Confirm new email</a></p>
          ${fallback}
          <p>If you didn't request this, you can ignore this email.</p>
        `,
      };
    case "reauthentication":
      return {
        from: "ShareIt <no-reply@shareitt.xyz>",
        to,
        subject: "Confirm it's you on ShareIt",
        html: `
          <p>Hi there,</p>
          <p>Use this code to confirm it's you:</p>
          <p><strong>${token}</strong></p>
          <p>If you didn't request this, you can ignore this email.</p>
        `,
      };
    default:
      throw new Error(`Unsupported auth email action type: ${actionType}`);
  }
}

serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(
    "v1,whsec_",
    "",
  );

  let user: Record<string, unknown>;
  let emailData: Record<string, unknown>;

  try {
    if (!hookSecret) throw new Error("SEND_EMAIL_HOOK_SECRET is not configured.");
    const wh = new Webhook(hookSecret);
    const verified = wh.verify(payload, headers) as {
      user: Record<string, unknown>;
      email_data: Record<string, unknown>;
    };
    user = verified.user;
    emailData = verified.email_data;
  } catch (error) {
    return jsonResponse(
      {
        error: {
          http_code: 401,
          message:
            error instanceof Error ? error.message : "Invalid webhook signature.",
        },
      },
      401,
    );
  }

  try {
    const emailPayload = buildEmail(user, emailData);
    await sendViaResend(Deno.env.get("RESEND_API_KEY") as string, emailPayload);
    return jsonResponse({});
  } catch (error) {
    return jsonResponse(
      {
        error: {
          http_code: 500,
          message:
            error instanceof Error ? error.message : "Failed to send auth email.",
        },
      },
      500,
    );
  }
});
