// Accounts with elevated access across the app: no paywall (see
// payments.js) and the ability to edit any family's listing, not just
// their own (see Host.jsx). Kept as the client-side mirror of the
// auth.email() carve-out in the families_update_own RLS policy — see
// supabase_rls_policies.sql.
export const ADMIN_EMAILS = new Set([
  "hezronsande2@gmail.com",
  "keninnofficial@gmail.com",
]);

export function isAdminEmail(email) {
  return Boolean(email) && ADMIN_EMAILS.has(email.toLowerCase());
}
