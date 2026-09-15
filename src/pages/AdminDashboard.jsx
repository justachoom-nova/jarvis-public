import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Fuel, ShieldCheck } from "lucide-react";
import QuoteTester from "@/components/jarvis/QuoteTester";
import FleetConfigForm from "@/components/jarvis/FleetConfigForm";
import QuoteLogTable from "@/components/jarvis/QuoteLogTable";

export default function AdminDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [gasPrice, setGasPrice] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.FleetConfig.list("-updated_date", 1);
        if (list[0]) setGasPrice(list[0].currentFuelPricePerGallon);
      } catch (e) {
        /* ignore — ticker is non-critical */
      }
    })();
  }, [refreshKey]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">JARVIS V3 HYBRID ENGINE</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Margin-protected dynamic lawn-care quoting infrastructure</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-driverCostPlus" /> ADMIN SESSION
            </Badge>
            {gasPrice != null && (
              <Badge className="gap-1 text-xs bg-accentAmber text-primary-foreground hover:bg-accentAmber">
                <Fuel className="w-3.5 h-3.5" /> ${Number(gasPrice).toFixed(2)}/gal
              </Badge>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="tester">
          <TabsList className="mb-6">
            <TabsTrigger value="tester">Quote Engine</TabsTrigger>
            <TabsTrigger value="config">Fleet Configuration</TabsTrigger>
            <TabsTrigger value="log">Audit Log</TabsTrigger>
          </TabsList>
          <TabsContent value="tester">
            <QuoteTester onQuoteGenerated={() => setRefreshKey((k) => k + 1)} />
          </TabsContent>
          <TabsContent value="config">
            <FleetConfigForm />
          </TabsContent>
          <TabsContent value="log">
            <QuoteLogTable refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}