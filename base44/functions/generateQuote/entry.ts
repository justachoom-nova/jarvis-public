import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { calculateJarvisQuote } from '../../shared/jarvisMath.js';

function num(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

// Google Maps Distance Matrix: distance + live-traffic duration from depot to the property.
async function fetchRouteData(address, depotAddress, apiKey) {
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(depotAddress)}` +
    `&destinations=${encodeURIComponent(address)}` +
    `&departure_time=now&traffic_model=best_guess&units=imperial&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Distance Matrix HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Google Distance Matrix: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}`);
  }
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== 'OK') {
    throw new Error(`Google Distance Matrix element: ${el?.status || 'missing'}`);
  }
  const miles = el.distance.value / 1609.34;
  const minutes = (el.duration_in_traffic?.value ?? el.duration.value) / 60;
  return { miles, minutes };
}

// Regrid parcel search: lot square footage from an address.
async function fetchLotSqft(address, apiKey) {
  const url =
    `https://data.regrid.com/api/v2/parcel/search` +
    `?query=${encodeURIComponent(address)}&token=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Regrid HTTP ${res.status}`);
  const data = await res.json();
  const parcel =
    data.results?.[0]?.properties?.parcel || data.results?.[0]?.parcel || {};
  let sqft = parcel.parcel_size_sqft ?? parcel.lot_size_sqft ?? parcel.sqft ?? null;
  const acres = parcel.parcel_size_acres ?? parcel.acres ?? parcel.lot_size_acres ?? null;
  if (!sqft && acres != null) sqft = acres * 43560;
  if (!sqft) throw new Error('lot square footage not found for address');
  return Math.round(sqft);
}

const TIMING_PROFILES = ['standard', 'next-day', 'same-day'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // ---- Auth: trusted webhook secret OR authenticated admin ----
    const webhookSecret = secrets.get('WEBHOOK_SECRET');
    const url = new URL(req.url);
    const providedSecret =
      url.searchParams.get('secret') || req.headers.get('x-webhook-secret');
    if (!(providedSecret && webhookSecret && providedSecret === webhookSecret)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
      }
    }

    // ---- Validate input ----
    const address = (body.address || '').trim();
    if (!address) {
      return Response.json({ error: 'address is required' }, { status: 400 });
    }

    // ---- Macro accessibility + timing profile (Master Operator) ----
    const narrowGate = !!body.narrowGate;
    const timingProfile = TIMING_PROFILES.includes(body.timingProfile)
      ? body.timingProfile
      : 'standard';

    // ---- Load active FleetOperationalConfig (latest) ----
    const configs = await base44.asServiceRole.entities.FleetConfig.list('-updated_date', 1);
    const config = configs[0];
    if (!config) {
      return Response.json(
        { error: 'No FleetOperationalConfig found. Admin must configure the fleet first.' },
        { status: 503 }
      );
    }

    // ---- Resolve market variables: manual override > live API > required ----
    let lotSquareFootage = num(body.lotSquareFootage, null);
    let driveDistanceMiles = num(body.driveDistanceMiles, null);
    let driveTimeMinutes = num(body.driveTimeMinutes, null);
    const liveGasOverride = num(body.liveGasOverride, null);

    const gKey = secrets.get('GOOGLE_MAPS_API_KEY');
    const rKey = secrets.get('REGID_API_KEY');

    // Lot square footage
    if (lotSquareFootage == null) {
      if (rKey) {
        try {
          lotSquareFootage = await fetchLotSqft(address, rKey);
        } catch (e) {
          return Response.json(
            { error: `Unable to fetch lot square footage: ${e.message}. Provide lotSquareFootage manually.` },
            { status: 422 }
          );
        }
      } else {
        return Response.json(
          { error: 'lotSquareFootage is required (REGID_API_KEY not configured).' },
          { status: 422 }
        );
      }
    }

    // Distance & live traffic minutes
    if (driveDistanceMiles == null || driveTimeMinutes == null) {
      if (gKey) {
        try {
          const r = await fetchRouteData(address, config.depotAddress, gKey);
          if (driveDistanceMiles == null) driveDistanceMiles = r.miles;
          if (driveTimeMinutes == null) driveTimeMinutes = r.minutes;
        } catch (e) {
          return Response.json(
            { error: `Unable to fetch routing data: ${e.message}. Provide driveDistanceMiles and driveTimeMinutes manually.` },
            { status: 422 }
          );
        }
      } else {
        return Response.json(
          { error: 'driveDistanceMiles and driveTimeMinutes are required (GOOGLE_MAPS_API_KEY not configured).' },
          { status: 422 }
        );
      }
    }

    // ---- Run the Jarvis Master Operator Math Engine ----
    const input = {
      address,
      lotSquareFootage,
      driveTimeMinutes,
      driveDistanceMiles,
      liveGasOverride,
      narrowGate,
      timingProfile,
    };
    const manifest = calculateJarvisQuote(input, {
      pricePerThousandSqFt: config.pricePerThousandSqFt,
      hourlyLaborRatePerWorker: config.hourlyLaborRatePerWorker,
      crewSizeCount: config.crewSizeCount,
      baseMowSpeedSqFtPerHour: config.baseMowSpeedSqFtPerHour,
      truckAverageMpg: config.truckAverageMpg,
      currentFuelPricePerGallon: config.currentFuelPricePerGallon,
      vehicleWearRatePerMile: config.vehicleWearRatePerMile,
      minimumTripFee: config.minimumTripFee,
      targetGrossMargin: config.targetGrossMargin,
      maxDensityRadiusMiles: config.maxDensityRadiusMiles,
    });

    // ---- Persist quote log (flattened V3 dbFields) ----
    const logRecord = await base44.asServiceRole.entities.QuoteLog.create({
      pricingDriver: manifest.pricingDriver,
      ...manifest.dbFields,
    });

    return Response.json({ manifest, market: input, quoteLogId: logRecord.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}