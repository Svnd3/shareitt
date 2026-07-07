// Netflix Premium (~KSh 1,100/month) covers up to 6 people sharing the
// plan. A "Netflix Premium" listing with fewer slots than that is really
// priced/sized like Netflix Standard, which only supports 2 devices —
// mislabeling that misleads members into expecting Premium capacity.
const NETFLIX_PREMIUM_REQUIRED_SLOTS = 6;

export function isNetflixPremiumSlotMismatch(serviceName, totalSlots) {
  return (
    serviceName === "Netflix Premium" &&
    Number(totalSlots) < NETFLIX_PREMIUM_REQUIRED_SLOTS
  );
}
