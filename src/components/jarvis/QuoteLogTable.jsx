import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";

const money = (v) => (typeof v === "number" && !Number.isNaN(v) ? `$${v.toFixed(2)}` : "—");
const yn = (v) => (Number(v) === 1 ? "Yes" : "No");

function DetailCell({ label, children }) {
  return (
    <div>
      <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono tabular-nums text-sm">{children}</p>
    </div>
  );
}

export default function QuoteLogTable({ refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await base44.entities.QuoteLog.list("-created_date", 50);
        setLogs(list || []);
      } catch (err) {
        setError(err?.message || "Failed to load quotes");
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>The 50 most recent Master Operator quotes, newest first. Click a row to expand the full breakdown.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="w-8 h-8 mb-2" />
            <p className="text-sm">No quotes generated yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Final Quote</TableHead>
                  <TableHead>Density</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Man-Hrs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((q) => {
                  const isOpen = expanded === q.id;
                  const isCostPlus = q.pricingDriver === "COST_PLUS_MARGIN";
                  const isPending = q.reviewStatus === "PENDING_OWNER_REVIEW";
                  return (
                    <React.Fragment key={q.id}>
                      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setExpanded(isOpen ? null : q.id)}>
                        <TableCell className="p-2">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(q.created_date).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={q.address}>{q.address}</TableCell>
                        <TableCell>
                          <span className={"inline-flex items-center rounded px-2 py-0.5 text-[0.7rem] font-bold text-white " + (isCostPlus ? "bg-driverCostPlus" : "bg-driverRateCard")}>
                            {isCostPlus ? "COST+" : "RATE"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-mono font-medium text-accentAmber">
                          {q.finalClientQuote == null ? <span className="text-destructive">Pending</span> : money(q.finalClientQuote)}
                        </TableCell>
                        <TableCell>
                          {Number(q.isApprovedForDensity) === 1 ? (
                            <Badge className="bg-driverCostPlus hover:bg-driverCostPlus text-white">Approved</Badge>
                          ) : (
                            <Badge variant="secondary">Review</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <Badge className="bg-destructive hover:bg-destructive text-white">
                              <ShieldAlert className="w-3 h-3 mr-1" /> Escalate to Owner
                            </Badge>
                          ) : (
                            <Badge variant="outline">Ready</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-mono text-sm">
                          {typeof q.totalManHours === "number" ? q.totalManHours.toFixed(2) : "—"}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={8} className="p-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <DetailCell label="Lot sq ft">{Number(q.lotSquareFootage || 0).toLocaleString()}</DetailCell>
                              <DetailCell label="Drive">{q.driveDistanceMiles != null ? `${q.driveDistanceMiles} mi / ${q.driveTimeMinutes} min` : "—"}</DetailCell>
                              <DetailCell label="Narrow gate">{yn(q.narrowGate)}</DetailCell>
                              <DetailCell label="Timing"><span className="capitalize">{(q.priorityTiming || "").replace("-", " ")}</span></DetailCell>
                              <DetailCell label="Review status">{isPending ? "Pending Owner Review" : "Ready"}</DetailCell>
                              <DetailCell label="Labor cost">{money(q.costLabor)}</DetailCell>
                              <DetailCell label="Surcharge">{money(q.costSurcharge)}</DetailCell>
                              <DetailCell label="Logistics">{money(q.costLogistics)}</DetailCell>
                              <DetailCell label="Total direct">{money(q.costTotalDirect)}</DetailCell>
                              <DetailCell label="Rate-card base">{money(q.rateCardBaseline)}</DetailCell>
                              <DetailCell label="Cost-plus base">{money(q.costPlusBaseline)}</DetailCell>
                              <DetailCell label="Base derived">{money(q.basePriceDerived)}</DetailCell>
                              <DetailCell label="Timing premium">{money(q.timingPremium)}</DetailCell>
                              <DetailCell label="Fuel used">{money(q.activeFuelPriceUsed)}/gal</DetailCell>
                              <DetailCell label="Min fee applied">{yn(q.isMinimumFeeApplied)}</DetailCell>
                              <DetailCell label="Clock mow">{q.clockMowMinutes} min</DetailCell>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}