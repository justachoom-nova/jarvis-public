import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calculator, CheckCircle2, XCircle, Fuel, ChevronDown, ChevronUp, ShieldAlert, Lock } from "lucide-react";

const money = (v) => (typeof v === "number" && !Number.isNaN(v) ? `$${v.toFixed(2)}` : "—");
const num = (v, d = 0) => (typeof v === "number" && !Number.isNaN(v) ? v.toFixed(d) : "—");

function FieldCard({ title, step, children }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">Step {step}</p>
        <CardTitle className="text-[1.125rem]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function MiniStat({ label, value, highlight }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={"font-mono text-lg font-semibold tabular-nums " + (highlight ? "text-accentAmber" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function AuthorizePanel({ quoteLogId, manifest, onApproved }) {
  const suggested = manifest.suggestedClientQuote;
  const [price, setPrice] = useState(suggested != null ? String(suggested.toFixed(2)) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const authorize = async () => {
    const v = Number(price);
    if (!Number.isFinite(v) || v <= 0) {
      setErr("Enter a valid quote amount.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const rounded = parseFloat(v.toFixed(2));
      await base44.entities.QuoteLog.update(quoteLogId, {
        reviewStatus: "READY",
        finalClientQuote: rounded,
      });
      onApproved(rounded);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Failed to authorize");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          <CardTitle className="text-[1.125rem] text-destructive">Escalate to Owner — Authorize Panel</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">Owner Audit — Cost-Plus Baseline</p>
            <p className="font-mono text-xl font-semibold tabular-nums text-accentAmber">{money(manifest.dbFields.costPlusBaseline)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">Rate-Card Baseline</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{money(manifest.dbFields.rateCardBaseline)}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="authPrice" className="text-[0.75rem] uppercase tracking-wider">Authorized Client Quote ($)</Label>
          <Input
            id="authPrice"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">Prefilled with the floored base price. Adjust for the emergency premium, then release to the client.</p>
        </div>
        {err && <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-sm">{err}</div>}
        <Button type="button" onClick={authorize} disabled={busy} className="w-full h-11 font-semibold">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
          Authorize & Release Quote
        </Button>
      </CardContent>
    </Card>
  );
}

function Manifest({ result }) {
  const { manifest, quoteLogId } = result;
  const db = manifest.dbFields;
  const isCostPlus = manifest.pricingDriver === "COST_PLUS_MARGIN";
  const driverColor = isCostPlus ? "bg-driverCostPlus" : "bg-driverRateCard";
  const [showJson, setShowJson] = useState(false);
  const [approvedPrice, setApprovedPrice] = useState(null);

  const isPending = manifest.reviewStatus === "PENDING_OWNER_REVIEW" && approvedPrice === null;
  const displayPrice = isPending ? null : approvedPrice != null ? approvedPrice : db.finalClientQuote;
  const isNextDay = manifest.timingProfile === "next-day";

  return (
    <div className="space-y-4">
      {/* Top banner: premium quote / pending review */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">
                {isPending ? "Same-Day Emergency" : isNextDay ? "Premium Quote (Next-Day ×1.25)" : "Final Client Quote"}
              </p>
              {isPending ? (
                <p className="font-mono font-semibold tabular-nums text-destructive" style={{ fontSize: "clamp(1.75rem, 3.5vw, 3rem)", lineHeight: 1.1 }}>
                  Pending Owner Review
                </p>
              ) : (
                <p className="font-mono font-semibold tabular-nums text-accentAmber" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.1 }}>
                  {money(displayPrice)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={"inline-flex items-center rounded-md px-3 py-1.5 text-xs font-bold text-white " + driverColor}>
                {manifest.pricingDriver.replace(/_/g, " ")}
              </span>
              {isPending ? (
                <Badge className="bg-destructive hover:bg-destructive text-white">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Escalate to Owner
                </Badge>
              ) : db.isApprovedForDensity === 1 ? (
                <Badge className="bg-driverCostPlus hover:bg-driverCostPlus text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Density Approved
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Off-Route Review
                </Badge>
              )}
              {isNextDay && !isPending && (
                <Badge className="bg-accentAmber hover:bg-accentAmber text-primary-foreground">Next-Day Premium</Badge>
              )}
              {db.isMinimumFeeApplied === 1 && !isPending && (
                <Badge variant="outline">Min Fee Applied</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inline owner authorize panel for same-day */}
      {isPending && quoteLogId && (
        <AuthorizePanel
          quoteLogId={quoteLogId}
          manifest={manifest}
          onApproved={(price) => setApprovedPrice(price)}
        />
      )}

      {/* Baseline comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[1.125rem]">Dual-Baseline Comparison</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className={"rounded-lg border p-4 " + (isCostPlus ? "border-driverCostPlus bg-driverCostPlus/10" : "border-border")}>
            <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">Cost-Plus Margin</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">{money(db.costPlusBaseline)}</p>
            <p className="text-xs text-muted-foreground mt-1">Direct cost ÷ (1 − margin)</p>
          </div>
          <div className={"rounded-lg border p-4 " + (!isCostPlus ? "border-driverRateCard bg-driverRateCard/10" : "border-border")}>
            <p className="text-[0.75rem] uppercase tracking-wider text-muted-foreground">Rate-Card Baseline</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">{money(db.rateCardBaseline)}</p>
            <p className="text-xs text-muted-foreground mt-1">Lot sqft × $/1k</p>
          </div>
        </CardContent>
      </Card>

      {/* Financial breakdown bento 2x2 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[1.125rem]">Financial Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <MiniStat label="Direct Labor" value={money(db.costLabor)} />
          <MiniStat label="Accessibility Surcharge" value={money(db.costSurcharge)} />
          <MiniStat label="Logistics & Wear" value={money(db.costLogistics)} />
          <MiniStat label="Total Direct Cost" value={money(db.costTotalDirect)} highlight />
        </CardContent>
      </Card>

      {/* Audit trail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[1.125rem]">Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">Clock mow time</span>
            <span className="text-right tabular-nums font-mono">{db.clockMowMinutes} min</span>
            <span className="text-muted-foreground">Total man-hours</span>
            <span className="text-right tabular-nums font-mono">{num(db.totalManHours, 2)}</span>
            <span className="text-muted-foreground">Narrow gate / push mower</span>
            <span className="text-right tabular-nums font-mono">{Number(db.narrowGate) === 1 ? "Yes" : "No"}</span>
            <span className="text-muted-foreground">Timing profile</span>
            <span className="text-right tabular-nums font-mono capitalize">{(manifest.timingProfile || "").replace("-", " ")}</span>
            <span className="text-muted-foreground">Timing premium</span>
            <span className="text-right tabular-nums font-mono">{money(db.timingPremium)}</span>
            <span className="text-muted-foreground flex items-center gap-1 justify-end"><Fuel className="w-3.5 h-3.5" /> Fuel price used</span>
            <span className="text-right tabular-nums font-mono">{money(db.activeFuelPriceUsed)}/gal</span>
          </div>
          <button
            type="button"
            onClick={() => setShowJson((s) => !s)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Raw JSON manifest
          </button>
          {showJson && (
            <pre className="text-xs font-mono bg-background/60 border border-border rounded-lg p-3 overflow-x-auto max-h-64">
              {JSON.stringify(manifest, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuoteTester({ onQuoteGenerated }) {
  const [form, setForm] = useState({
    address: "",
    lotSquareFootage: "",
    accessibility: "standard",
    timingProfile: "standard",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!form.address.trim()) {
      setError("Property address is required.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        address: form.address.trim(),
        narrowGate: form.accessibility === "narrow-gate",
        timingProfile: form.timingProfile,
      };
      const sqft = form.lotSquareFootage;
      if (sqft !== "" && sqft != null && !Number.isNaN(Number(sqft))) {
        payload.lotSquareFootage = Number(sqft);
      }
      const res = await base44.functions.invoke("generateQuote", payload);
      setResult(res.data);
      if (onQuoteGenerated) onQuoteGenerated();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to generate quote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* LEFT RAIL: MACRO INPUT SUITE */}
      <div className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <FieldCard title="Property" step="1">
            <div className="space-y-2">
              <Label htmlFor="address" className="text-[0.75rem] uppercase tracking-wider">Property Address</Label>
              <Input id="address" placeholder="123 Main St, Springfield, IL 62701" value={form.address} onChange={(e) => set("address", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotSquareFootage" className="text-[0.75rem] uppercase tracking-wider">Lot Square Footage</Label>
              <Input id="lotSquareFootage" type="number" step="100" placeholder="auto (if API key set)" value={form.lotSquareFootage} onChange={(e) => set("lotSquareFootage", e.target.value)} />
            </div>
          </FieldCard>

          <FieldCard title="Accessibility" step="2">
            <div className="space-y-2">
              <Label className="text-[0.75rem] uppercase tracking-wider">Yard Access Profile</Label>
              <Select value={form.accessibility} onValueChange={(v) => set("accessibility", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard / Open Yard</SelectItem>
                  <SelectItem value="narrow-gate">Narrow Gate / Push Mower Required</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Narrow gate engages the walk-behind mower penalty — base mow speed ×0.65.</p>
            </div>
          </FieldCard>

          <FieldCard title="Timing Profile" step="3">
            <div className="space-y-2">
              <Label className="text-[0.75rem] uppercase tracking-wider">Service Timing</Label>
              <Select value={form.timingProfile} onValueChange={(v) => set("timingProfile", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (3–5 Days)</SelectItem>
                  <SelectItem value="next-day">Next-Day Priority</SelectItem>
                  <SelectItem value="same-day">Same-Day Emergency</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Next-Day applies a 1.25× premium (floor first). Same-Day escalates to owner review and withholds the client price.</p>
            </div>
          </FieldCard>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

          <Button type="submit" disabled={loading} className="w-full h-12 font-semibold">
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating Quote…</>
            ) : (
              <><Calculator className="w-4 h-4 mr-2" /> Calculate Quote</>
            )}
          </Button>
        </form>
      </div>

      {/* RIGHT STAGE: LIVE MANIFEST */}
      <div className="space-y-4">
        <div className="hidden lg:flex items-center gap-2 text-[0.75rem] uppercase tracking-wider text-muted-foreground">
          <Calculator className="w-4 h-4" /> Live Manifest & Audit
        </div>
        {result ? (
          <Manifest result={result} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center">
              <Calculator className="w-10 h-10 mb-3 text-muted-foreground/50" />
              <p className="text-sm max-w-xs">
                Generate a quote to see the Master Operator manifest — premium quote, dual-baseline comparison, pricing driver, and full audit trail.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}