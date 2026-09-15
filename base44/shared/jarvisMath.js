/**
 * JARVIS OS V3 — MASTER OPERATOR MATHEMATICAL ENGINE
 * Hybrid rate-card floor vs. cost-plus-margin ceiling (whichever is higher),
 * with macro accessibility (narrow-gate speed penalty) and timing-profile premiums.
 * Shared server-side module — imported by backend functions.
 *
 * @param {object} input  Property + market + macro profile payload
 * @param {object} config FleetOperationalConfig (V3)
 * @returns {object} V3 Financial Manifest with flattened dbFields
 */
const NEXT_DAY_MULTIPLIER = 1.25;
const NARROW_GATE_SPEED_FACTOR = 0.65;

export function calculateJarvisQuote(input, config) {
  // --- 1. CORE SANITIZATION & SAFE DEFAULTS ---
  const address = input.address || "Unknown Coordinate";
  const lotSquareFootage = Number(input.lotSquareFootage) || 0;
  const driveTimeMinutes = Number(input.driveTimeMinutes) || 0;
  const driveDistanceMiles = Number(input.driveDistanceMiles) || 0;

  const narrowGate = !!input.narrowGate;
  const timingProfile = input.timingProfile || "standard";
  const isSameDay = timingProfile === "same-day";
  const isNextDay = timingProfile === "next-day";

  // Optional live fuel override; falls back to static config baseline
  const activeFuelCost =
    Number(input.liveGasOverride) || config.currentFuelPricePerGallon;

  // --- 2. TRADITIONAL MARKET RATE-CARD BASELINE ---
  const traditionalBasePrice =
    (lotSquareFootage / 1000) * config.pricePerThousandSqFt;

  // --- 3. LABOR MATRICES (narrow gate = walk-behind speed penalty) ---
  const effectiveMowSpeed = narrowGate
    ? config.baseMowSpeedSqFtPerHour * NARROW_GATE_SPEED_FACTOR
    : config.baseMowSpeedSqFtPerHour;

  // Wall-clock hours (time elapsed on location / in transit)
  const clockMowHours =
    lotSquareFootage / (effectiveMowSpeed * config.crewSizeCount);
  const clockDriveHours = (driveTimeMinutes * 2) / 60; // round trip

  // Combined man-hours (crew cancels for mow, scales for transit)
  const totalMowManHours = clockMowHours * config.crewSizeCount;
  const totalDriveManHours = clockDriveHours * config.crewSizeCount;
  const totalDeployedManHours = totalMowManHours + totalDriveManHours;

  // Labor cost allocation
  const totalMowLaborCost = totalMowManHours * config.hourlyLaborRatePerWorker;
  const totalDriveLaborCost =
    totalDriveManHours * config.hourlyLaborRatePerWorker;
  const coreLaborCostBase = totalMowLaborCost + totalDriveLaborCost;

  // --- 4. ACCESSIBILITY SURCHARGE (retired — slope gone, narrow gate is speed-based) ---
  const accessibilitySurcharge = 0;

  // --- 5. LOGISTICS OPERATIONAL OVERHEAD (unconditional) ---
  const totalRoundTripMiles = driveDistanceMiles * 2;
  const fuelCost =
    (totalRoundTripMiles / config.truckAverageMpg) * activeFuelCost;
  const wearCost = totalRoundTripMiles * config.vehicleWearRatePerMile;
  const totalLogisticsCost = fuelCost + wearCost;

  // --- 6. COST-PLUS MARGIN vs RATE-CARD CEILING ---
  const totalDirectCost =
    coreLaborCostBase + accessibilitySurcharge + totalLogisticsCost;
  const costPlusMarginMinimumPrice =
    totalDirectCost / (1 - config.targetGrossMargin);

  const pricingDriverUsed =
    costPlusMarginMinimumPrice > traditionalBasePrice
      ? "COST_PLUS_MARGIN"
      : "RATE_CARD";
  const targetBasePrice = Math.max(
    costPlusMarginMinimumPrice,
    traditionalBasePrice
  );

  // --- 7. MINIMUM-TRIP FLOOR (applied first), THEN TIMING PREMIUM ---
  const flooredBase = Math.max(targetBasePrice, config.minimumTripFee);
  const isMinimumFeeApplied = config.minimumTripFee > targetBasePrice + 0.001;

  let finalClientQuote = null;
  let timingPremium = 0;
  let reviewStatus = "READY";
  let suggestedClientQuote = null;

  if (isSameDay) {
    // Withhold client price; escalate to owner for approval
    reviewStatus = "PENDING_OWNER_REVIEW";
    finalClientQuote = null;
    suggestedClientQuote = parseFloat(flooredBase.toFixed(2));
  } else if (isNextDay) {
    // Floor first, then 1.25x premium markup
    finalClientQuote = parseFloat((flooredBase * NEXT_DAY_MULTIPLIER).toFixed(2));
    timingPremium = parseFloat((finalClientQuote - flooredBase).toFixed(2));
  } else {
    finalClientQuote = parseFloat(flooredBase.toFixed(2));
  }

  // --- 8. ROUTING DENSITY GATE (same-day bypasses — force off-route review) ---
  const isApprovedForDensity = isSameDay
    ? false
    : driveDistanceMiles <= config.maxDensityRadiusMiles;

  // --- 9. FLATTENED MANIFEST (DB-ready) ---
  return {
    timestamp: new Date().toISOString(),
    status: "SUCCESS",
    pricingDriver: pricingDriverUsed,
    reviewStatus,
    timingProfile,
    narrowGate,
    suggestedClientQuote,
    dbFields: {
      address,
      lotSquareFootage,
      driveTimeMinutes,
      driveDistanceMiles,
      narrowGate: narrowGate ? 1 : 0,
      priorityTiming: timingProfile,
      reviewStatus,
      isApprovedForDensity: isApprovedForDensity ? 1 : 0,
      isMinimumFeeApplied: isMinimumFeeApplied ? 1 : 0,
      clockMowMinutes: Math.round(clockMowHours * 60),
      totalManHours: parseFloat(totalDeployedManHours.toFixed(2)),
      costLabor: parseFloat(coreLaborCostBase.toFixed(2)),
      costSurcharge: parseFloat(accessibilitySurcharge.toFixed(2)),
      costLogistics: parseFloat(totalLogisticsCost.toFixed(2)),
      costTotalDirect: parseFloat(totalDirectCost.toFixed(2)),
      basePriceDerived: parseFloat(targetBasePrice.toFixed(2)),
      rateCardBaseline: parseFloat(traditionalBasePrice.toFixed(2)),
      costPlusBaseline: parseFloat(costPlusMarginMinimumPrice.toFixed(2)),
      timingPremium: parseFloat(timingPremium.toFixed(2)),
      activeFuelPriceUsed: parseFloat(activeFuelCost.toFixed(2)),
      finalClientQuote:
        finalClientQuote === null ? null : parseFloat(finalClientQuote.toFixed(2)),
    },
  };
}