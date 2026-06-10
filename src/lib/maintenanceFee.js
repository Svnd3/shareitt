// Tiered ShareIt fee (KSh) charged on top of price_per_slot when a family
// uses the "escrow" hosting method.
export function getMaintenanceFee(pricePerSlot) {
  const price = Number(pricePerSlot) || 0;
  if (price < 200) return 9;
  if (price <= 600) return 12;
  if (price <= 1200) return 17;
  return 22;
}

export function getEscrowTotal(pricePerSlot) {
  const serviceAmount = Number(pricePerSlot) || 0;
  const maintenanceFee = getMaintenanceFee(serviceAmount);
  return {
    serviceAmount,
    maintenanceFee,
    total: serviceAmount + maintenanceFee,
  };
}
