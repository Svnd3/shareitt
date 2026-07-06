// Family/group plans where one missed payment can put the whole plan at risk
// (the provider can flag or dissolve the plan if it isn't renewed on time).
const RENEWAL_RISK_SERVICES = new Set([
  "Spotify Family",
  "Netflix Standard",
  "Netflix Premium",
  "YouTube Premium",
  "Prime Video",
  "Disney+ Hotstar",
  "Showmax",
  "Apple Music",
  "Apple TV+",
]);

// Services where members share a login, seat, or device slot rather than
// just splitting a bill — account security matters more here.
const SHARED_LOGIN_SERVICES = new Set([
  "ChatGPT Plus",
  "Claude Pro",
  "Canva Pro",
  "Microsoft 365",
  "Google One",
  "Notion Plus",
  "Adobe Creative Cloud",
  "Grammarly Premium",
  "NordVPN",
  "PlayStation Plus",
  "Xbox Game Pass",
]);

export function buildGroupRulesMessage({ serviceName, hostName }) {
  const service = serviceName?.trim() || "the subscription";
  const host = hostName?.trim() || "the host";

  const lines = [
    `${service} Group Rules`,
    "",
    "A few simple rules to keep this group running smoothly for everyone:",
    "",
    `1. Pay by the date ${host} sets each month. A missed payment can mean losing your slot so the rest of the group isn't affected.`,
    "2. Share your payment confirmation in this group once you've paid, so everyone can see the group is settled before renewal.",
    "3. If you haven't paid for this month yet, please don't add yourself to the plan — you'll be removed if you do.",
  ];

  if (RENEWAL_RISK_SERVICES.has(service)) {
    lines.push(
      `4. ${host} handles renewing the subscription on time, so please don't wait until the last day to pay.`,
    );
  } else if (SHARED_LOGIN_SERVICES.has(service)) {
    lines.push(
      "4. Please don't change the account password, email, or security settings without checking with " +
        host +
        " first — it can lock everyone out.",
    );
  } else {
    lines.push(
      `4. ${host} is responsible for keeping the subscription active and applying everyone's slot correctly.`,
    );
  }

  lines.push(
    "5. These rules aren't fixed — everyone in the group, including " +
      host +
      ", can agree to change them at any time if something works better.",
    "",
    "Thanks for being part of the group!",
  );

  return lines.join("\n");
}
