// Loose plausibility filter for host/member social handles used for
// verification — catches obvious placeholder junk (e.g. "test", "xxxx",
// "123456") before it's stored. Not a guarantee the account is real.
const HANDLE_PATTERN = /^[a-zA-Z0-9._-]{2,30}$/;

const PLACEHOLDER_PATTERNS = [
  /^test/i,
  /^demo/i,
  /^sample/i,
  /^example/i,
  /^placeholder/i,
  /^fake/i,
  /^n\.?a\.?$/i,
  /^none$/i,
  /^username$/i,
  /^handle$/i,
  /^asdf/i,
  /^qwerty/i,
  /^abc123/i,
];

export function isPlausibleSocialHandle(rawHandle) {
  const handle = (rawHandle ?? "").trim().replace(/^@/, "");
  if (!handle) return false;
  if (!HANDLE_PATTERN.test(handle)) return false;
  if (/^(.)\1+$/.test(handle)) return false;
  if (/^\d+$/.test(handle)) return false;
  if (!/[a-zA-Z]/.test(handle)) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(handle));
}
