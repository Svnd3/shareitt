// Plan pricing/slot counts used to autofill the host form when a matching
// service is picked — hosts can still edit either value afterward, this
// just saves them looking up the numbers themselves.
// totalSlots is "slots for others, not including the host's own seat".
export const SERVICE_PRESETS = {
  "Spotify Premium": { totalSlots: 6, pricePerSlot: 120 },
  "Netflix Premium": { totalSlots: 6, pricePerSlot: 225 },
  "Prime Video": { totalSlots: 6, pricePerSlot: 95 },
  "ChatGPT Plus": { totalSlots: 2, pricePerSlot: 1517 },
  "Duolingo Plus": { totalSlots: 6, pricePerSlot: 220 },
};
