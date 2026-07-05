// Supabase/GoTrue error messages are written for developers, not end users —
// e.g. raw PKCE/SSR internals, or the password policy error that spells out
// every allowed character class verbatim. Translate the ones we recognize
// into plain language. Anything unrecognized is passed through as-is by
// default (most of Supabase's own messages, like "User already registered"
// or "Invalid login credentials", are already reasonably user-facing) —
// callers that see more internal/unexpected errors (e.g. an OAuth/email
// link callback) can pass a `fallback` to replace anything unrecognized
// instead of risking a stray technical string.
export function friendlyAuthError(message, { fallback } = {}) {
  if (!message) return fallback ?? "Something went wrong. Please try again.";

  const lower = message.toLowerCase();

  if (lower.includes("timed out")) return message;

  if (lower.includes("code verifier") || lower.includes("pkce")) {
    return "This link only works in the same browser you used to sign up or request it. Please open the email and click the link there, or sign in below if your email is already confirmed.";
  }

  if (
    lower.includes("expired") ||
    lower.includes("already used") ||
    lower.includes("invalid flow state")
  ) {
    return "This link has expired or was already used. Please request a new one.";
  }

  if (lower.includes("should contain at least one character of each")) {
    return "Password must include uppercase and lowercase letters, a number, and a symbol.";
  }

  if (lower.includes("rate limit")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  return fallback ?? message;
}
