import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, Leaf, Droplets, Cpu, Battery, Recycle, Scale } from "lucide-react";
import { fmtNum } from "@/lib/wasteTypes";

interface Props {
  hazKg: number;
  nonHazKg: number;
  totals: { kg: number; litres: number };
  eWasteKg: number;
  batteryKg: number;
  otherKg: number;
  byType: Array<{
    id: string;
    name: string;
    total: number;
    measureUnit: string;
    wasteCategory: string;
  }>;
}

export default function StorageBreakdownView({
  hazKg,
  nonHazKg,
  totals,
  eWasteKg,
  batteryKg,
  otherKg,
  byType,
}: Props) {
  return (
    <div className="space-y-3.5">
      {/* 6 Statutory Category Cards */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          In Storage by Statutory Category
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Card className="border-border/90 hover:border-rose-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(hazKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Hazardous Solids</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-emerald-600/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Leaf className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(nonHazKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Non-Hazardous</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-cyan-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(totals.litres)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">L</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Liquid Waste</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-violet-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(eWasteKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">E-Waste</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-amber-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Battery className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(batteryKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Battery Waste</p>
            </CardContent>
          </Card>

          <Card className="border-border/90 hover:border-slate-500/40 transition-colors">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1.5">
                <Recycle className="h-4 w-4 text-slate-600 dark:text-slate-400 shrink-0" />
                <p className="text-lg font-bold font-mono text-foreground leading-tight">
                  {fmtNum(otherKg)}
                  <span className="text-[10px] font-sans font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Other Wastes</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Waste Type Progress Breakdown */}
      {byType.length > 0 && (
        <Card className="border-border/90 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-primary" /> Active Waste Type Weight Breakdown ({byType.length})
              </h3>
            </div>

            <div className="space-y-2 py-1">
              {byType.map((w) => {
                const max = Math.max(...byType.map((x) => x.total));
                const suffix = w.measureUnit === "litres" ? "L" : "kg";
                const isOil = w.id === "waste-oil" || w.id === "waste-grease";
                const barColor = isOil
                  ? "bg-rose-500"
                  : w.measureUnit === "litres"
                  ? "bg-cyan-500"
                  : w.wasteCategory === "hazardous"
                  ? "bg-rose-500"
                  : w.wasteCategory === "other_wastes"
                  ? "bg-amber-500"
                  : "bg-emerald-600";
                return (
                  <div key={w.id} className="flex items-center gap-2.5 text-xs">
                    <span className="flex-1 truncate font-medium text-foreground">{w.name}</span>
                    <div className="flex-[2] bg-muted/80 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${barColor} h-full rounded-full transition-all duration-300`}
                        style={{ width: `${(w.total / max) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono font-semibold w-24 text-right text-foreground">
                      {fmtNum(w.total)} {suffix}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
