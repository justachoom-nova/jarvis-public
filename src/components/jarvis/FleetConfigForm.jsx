import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

const DEFAULTS = {
  pricePerThousandSqFt: 3.5,
  hourlyLaborRatePerWorker: 25,
  crewSizeCount: 2,
  baseMowSpeedSqFtPerHour: 30000,
  truckAverageMpg: 10,
  currentFuelPricePerGallon: 3.85,
  vehicleWearRatePerMile: 0.65,
  minimumTripFee: 45,
  flatConvenienceFee: 25,
  targetGrossMargin: 0.6,
  maxDensityRadiusMiles: 5.0,
  depotAddress: "",
};

const GROUPS = [
  {
    title: "Labor & Crew",
    fields: [
      { key: "hourlyLaborRatePerWorker", label: "Hourly Labor Rate ($/worker)", step: "0.01" },
      { key: "crewSizeCount", label: "Crew Size (workers)", step: "1" },
      { key: "baseMowSpeedSqFtPerHour", label: "Base Mow Speed (sq ft/hr)", step: "100" },
    ],
  },
  {
    title: "Fleet & Fuel",
    fields: [
      { key: "truckAverageMpg", label: "Truck Average MPG", step: "0.1" },
      { key: "currentFuelPricePerGallon", label: "Current Fuel Price ($/gal)", step: "0.001" },
      { key: "vehicleWearRatePerMile", label: "Vehicle Wear Rate ($/mile)", step: "0.01" },
    ],
  },
  {
    title: "Pricing & Margin",
    fields: [
      { key: "pricePerThousandSqFt", label: "Price per 1,000 sq ft ($)", step: "0.01" },
      { key: "minimumTripFee", label: "Minimum Trip Fee ($)", step: "0.01" },
      { key: "flatConvenienceFee", label: "Flat Convenience Fee ($)", step: "0.01" },
      { key: "targetGrossMargin", label: "Target Gross Margin (0–1)", step: "0.01" },
      { key: "maxDensityRadiusMiles", label: "Max Density Radius (mi)", step: "0.1" },
    ],
  },
];

export default function FleetConfigForm() {
  const [config, setConfig] = useState(null);
  const [existingId, setExistingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.FleetConfig.list("-updated_date", 1);
        if (list[0]) {
          setExistingId(list[0].id);
          setConfig({ ...DEFAULTS, ...list[0] });
        } else {
          setConfig({ ...DEFAULTS });
        }
      } catch (err) {
        setError(err?.message || "Failed to load config");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const payload = { ...config };
      GROUPS.flatMap((g) => g.fields).forEach(({ key }) => {
        payload[key] = Number(payload[key]);
      });
      if (existingId) {
        await base44.entities.FleetConfig.update(existingId, payload);
      } else {
        const created = await base44.entities.FleetConfig.create(payload);
        setExistingId(created.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Fleet Operational Configuration</CardTitle>
        <CardDescription>
          V3 hybrid engine inputs — rate-card baseline, cost-plus margin floor, and fleet logistics constants.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-6">
          {GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">{group.title}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {group.fields.map(({ key, label, step }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="text-sm">{label}</Label>
                    <Input id={key} type="number" step={step} value={config[key]} onChange={(e) => set(key, e.target.value)} required />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-3">
            <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">Depot</p>
            <div className="space-y-2">
              <Label htmlFor="depotAddress" className="text-sm">Depot / Nearest Route Origin</Label>
              <Input id="depotAddress" placeholder="Your yard / depot address" value={config.depotAddress || ""} onChange={(e) => set("depotAddress", e.target.value)} required />
              <p className="text-xs text-muted-foreground">Used as the origin for live distance & traffic lookups (when API keys are set).</p>
            </div>
          </div>
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving} className="font-semibold">
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Configuration</>
              )}
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-driverCostPlus">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}