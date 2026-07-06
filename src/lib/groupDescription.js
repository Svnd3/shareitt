// Falls back to an auto-generated description for listings created before
// this field existed (or where the host left it blank), so every group card
// always has something to show.
export function buildDefaultGroupDescription(family) {
  const service = family?.service_name?.trim() || "this subscription";
  const price = family?.price_per_slot;

  return price
    ? `Split ${service} with the group and pay only KSh ${price}/month.`
    : `Split the cost of ${service} with other verified members.`;
}

export const GROUP_DESCRIPTION_EXAMPLES = [
  "Family plan with slots open now — pay monthly via M-Pesa, verified members only.",
  "Reliable group, active since 2024. Fast WhatsApp replies and on-time renewals.",
  "Split 4 ways, first come first served. Payment confirmation shared in the group.",
  "Small trusted group run by a verified host — new members welcome.",
];
