import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  WasteEntry,
  DisposalBatch,
  fmtNum,
  WASTE_TYPES,
  formatDateDDMMYYYY,
  getMeasureUnit,
  getDaysStored,
  isDisposed,
  isEntryOverdue,
  isEntryWarning,
  getStorageLimitDays,
} from "@/lib/wasteTypes";
import { useSite } from "@/contexts/SiteContext";
import { Site } from "@/types";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Globe,
  Clock,
  ArrowRight,
  Filter,
  Plus,
  TrendingUp,
  Droplets,
  Package,
  Trash2,
  FileSpreadsheet,
  Search,
  Check,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  entries: WasteEntry[];
  batches: DisposalBatch[];
  onLogWaste?: () => void;
  onNavigateToInventory?: () => void;
}

export default function RegionalCoordinatorDashboard({
  entries,
  batches,
  onLogWaste,
  onNavigateToInventory,
}: Props) {
  const { sites, setCurrentSite } = useSite();
  const [filterAtRiskOnly, setFilterAtRiskOnly] = useState(false);
  const [siteSearch, setSiteSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");

  const siteMap = useMemo(() => {
    const map = new Map<string, Site>();
    sites.forEach((s) => map.set(s.id, s));
    return map;
  }, [sites]);

  // Undisposed active entries
  const activeEntries = useMemo(() => {
    return entries.filter((e) => !isDisposed(e));
  }, [entries]);

  // Compute Per-Site Statistics
  const siteStats = useMemo(() => {
    return sites.map((site) => {
      const siteAll = entries.filter((e) => e.site_id === site.id);
      const siteActive = siteAll.filter((e) => !isDisposed(e));
      const overdue = siteActive.filter((e) => isEntryOverdue(e));
      const warning = siteActive.filter((e) => isEntryWarning(e));

      const hazKg = siteActive
        .filter((e) => e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
        .reduce((sum, e) => sum + Number(e.weight_kg ?? 0), 0);

      const nonHazKg = siteActive
        .filter((e) => e.waste_category === "non_hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
        .reduce((sum, e) => sum + Number(e.weight_kg ?? 0), 0);

      const liquidsL = siteActive
        .filter((e) => getMeasureUnit(e.waste_type_id) === "litres")
        .reduce((sum, e) => sum + Number(e.weight_kg ?? 0), 0);

      let maxDays = 0;
      let oldestEntry: WasteEntry | null = null;
      siteActive.forEach((e) => {
        const d = getDaysStored(e.generated_date);
        if (d > maxDays) {
          maxDays = d;
          oldestEntry = e;
        }
      });

      return {
        site,
        totalEntries: siteAll.length,
        activeCount: siteActive.length,
        overdueCount: overdue.length,
        overdueWeightKg: overdue.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
        warningCount: warning.length,
        warningWeightKg: warning.reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
        hazKg,
        nonHazKg,
        liquidsL,
        maxDays,
        oldestEntry,
        isAtRisk: overdue.length > 0 || warning.length > 0,
      };
    });
  }, [sites, entries]);

  // Regional Aggregates
  const totalOverdueEntries = useMemo(
    () => activeEntries.filter((e) => isEntryOverdue(e)),
    [activeEntries]
  );
  const totalWarningEntries = useMemo(
    () => activeEntries.filter((e) => isEntryWarning(e)),
    [activeEntries]
  );

  const totalOverdueSolidsKg = useMemo(
    () =>
      totalOverdueEntries
        .filter((e) => getMeasureUnit(e.waste_type_id) !== "litres")
        .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
    [totalOverdueEntries]
  );
  const totalOverdueLiquidsL = useMemo(
    () =>
      totalOverdueEntries
        .filter((e) => getMeasureUnit(e.waste_type_id) === "litres")
        .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
    [totalOverdueEntries]
  );

  const totalWarningSolidsKg = useMemo(
    () =>
      totalWarningEntries
        .filter((e) => getMeasureUnit(e.waste_type_id) !== "litres")
        .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
    [totalWarningEntries]
  );
  const totalWarningLiquidsL = useMemo(
    () =>
      totalWarningEntries
        .filter((e) => getMeasureUnit(e.waste_type_id) === "litres")
        .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
    [totalWarningEntries]
  );

  const totalHazSolidsKg = useMemo(
    () =>
      activeEntries
        .filter((e) => e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
        .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
    [activeEntries]
  );

  const totalNonHazSolidsKg = useMemo(
    () =>
      activeEntries
        .filter((e) => e.waste_category === "non_hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
        .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
    [activeEntries]
  );

  const totalLiquidsLitres = useMemo(
    () =>
      activeEntries
        .filter((e) => getMeasureUnit(e.waste_type_id) === "litres")
        .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
    [activeEntries]
  );

  const totalEWasteKg = useMemo(
    () =>
      activeEntries
        .filter((e) => e.waste_category === "e_waste")
        .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0),
    [activeEntries]
  );

  // Activity breakdown (Preventive vs Breakdown vs 5S)
  const activityBreakdown = useMemo(() => {
    let bm = 0;
    let pm = 0;
    let s5 = 0;
    let oth = 0;
    entries.forEach((e) => {
      const w = Number(e.weight_kg ?? 0);
      if (e.activity_type === "breakdown") bm += w;
      else if (e.activity_type === "preventive") pm += w;
      else if (e.activity_type === "5s") s5 += w;
      else oth += w;
    });
    const total = bm + pm + s5 + oth || 1;
    return {
      bmKg: bm,
      pmKg: pm,
      s5Kg: s5,
      othKg: oth,
      bmPct: Math.round((bm / total) * 100),
      pmPct: Math.round((pm / total) * 100),
      s5Pct: Math.round((s5 / total) * 100),
    };
  }, [entries]);

  // Oldest lot across entire region
  const regionalOldest = useMemo(() => {
    let max = 0;
    let item: WasteEntry | null = null;
    activeEntries.forEach((e) => {
      const d = getDaysStored(e.generated_date);
      if (d > max) {
        max = d;
        item = e;
      }
    });
    return { days: max, entry: item };
  }, [activeEntries]);

  // Pending batches across all sites
  const pendingBatchesCount = useMemo(() => {
    return batches.filter((b) => (b as any).status === "pending").length;
  }, [batches]);

  // Filtered Site List for the Scorecard Table
  const filteredSites = useMemo(() => {
    return siteStats
      .filter((s) => {
        if (filterAtRiskOnly && !s.isAtRisk) return false;
        if (selectedSiteId !== "all" && s.site.id !== selectedSiteId) return false;
        if (siteSearch.trim()) {
          const q = siteSearch.toLowerCase();
          const matchName = s.site.name.toLowerCase().includes(q);
          const matchLoc = (s.site.location ?? "").toLowerCase().includes(q);
          if (!matchName && !matchLoc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Prioritize sites with overdue first, then warnings, then max storage days
        if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
        if (b.warningCount !== a.warningCount) return b.warningCount - a.warningCount;
        return b.maxDays - a.maxDays;
      });
  }, [siteStats, filterAtRiskOnly, selectedSiteId, siteSearch]);

  // Recent entries across all sites
  const recentEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => b.generated_date.localeCompare(a.generated_date))
      .slice(0, 6);
  }, [entries]);

  const atRiskSitesCount = siteStats.filter((s) => s.isAtRisk).length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* ── Regional Coordinator Banner ── */}
      <div className="bg-gradient-to-r from-card via-card/90 to-primary/5 border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Regional Coordinator Dashboard
                </h2>
                <Badge variant="secondary" className="text-[10px] font-mono font-semibold">
                  {sites.length} Facilities Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consolidated statutory compliance radar, inventory volume, and cross-site telemetry.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 1: 4 Core Coordinator Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Statutory Compliance Radar */}
        <Card
          className={cn(
            "border transition-all shadow-xs relative overflow-hidden",
            totalOverdueEntries.length > 0
              ? "border-rose-500/40 bg-rose-500/[0.03]"
              : totalWarningEntries.length > 0
              ? "border-amber-500/40 bg-amber-500/[0.03]"
              : "border-border/80 bg-card"
          )}
        >
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldAlert
                  className={cn(
                    "h-4 w-4",
                    totalOverdueEntries.length > 0
                      ? "text-rose-500"
                      : totalWarningEntries.length > 0
                      ? "text-amber-500"
                      : "text-emerald-500"
                  )}
                />
                <span className="text-xs font-bold text-foreground">Compliance Radar</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                90-Day HOWM
              </span>
            </div>

            {/* Primary Stat: Highlight Quantity Metric instead of raw lot count */}
            {totalOverdueEntries.length > 0 ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
                    {fmtNum(totalOverdueSolidsKg)}
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-bold mr-0.5">kg</span>
                  {totalOverdueLiquidsL > 0 && (
                    <>
                      <span className="text-xs font-semibold text-rose-500/70">+</span>
                      <span className="text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
                        {fmtNum(totalOverdueLiquidsL)}
                      </span>
                      <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">L</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Exceeding 90-day statutory limit</span>
                </div>
              </div>
            ) : totalWarningEntries.length > 0 ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
                    {fmtNum(totalWarningSolidsKg)}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-bold mr-0.5">kg</span>
                  {totalWarningLiquidsL > 0 && (
                    <>
                      <span className="text-xs font-semibold text-amber-500/70">+</span>
                      <span className="text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
                        {fmtNum(totalWarningLiquidsL)}
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">L</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Approaching 90-day limit (75–89 days)</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                    0
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">kg</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="success" className="text-[10px] h-4.5 px-1.5 font-semibold">
                    100% Compliant
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">Within statutory window</span>
                </div>
              </div>
            )}

            {/* Secondary Context Row */}
            <div className="pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
              {totalOverdueEntries.length > 0 ? (
                <>
                  <span>⚠️ In Warning (75–89d):</span>
                  <span className="font-semibold text-foreground font-mono">
                    {fmtNum(totalWarningSolidsKg)} kg {totalWarningLiquidsL > 0 ? `+ ${fmtNum(totalWarningLiquidsL)} L` : ""}
                  </span>
                </>
              ) : totalWarningEntries.length > 0 ? (
                <>
                  <span>🚨 Overdue (&gt;90d):</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    0 kg
                  </span>
                </>
              ) : (
                <>
                  <span>Storage Status:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    All sites within safe window
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Regional Active Storage Volume */}
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-bold text-foreground">Active Storage</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                On Premises
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                {fmtNum(totalHazSolidsKg)}
              </span>
              <span className="text-xs text-muted-foreground font-medium">kg Haz Solids</span>
            </div>

            <div className="pt-1 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Used Oil & Liquids:</span>
                <span className="font-semibold text-foreground font-mono">
                  {fmtNum(totalLiquidsLitres)} L
                </span>
              </div>
              <div className="flex justify-between">
                <span>Non-Hazardous:</span>
                <span className="font-semibold text-foreground font-mono">
                  {fmtNum(totalNonHazSolidsKg)} kg
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Maintenance Drivers */}
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Generation Split</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Activity
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tracking-tight text-primary">
                {activityBreakdown.pmPct}%
              </span>
              <span className="text-xs text-muted-foreground font-medium">Preventive (PM)</span>
            </div>

            <div className="pt-1 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Breakdown (BM):</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                  {activityBreakdown.bmPct}% ({fmtNum(activityBreakdown.bmKg)} kg)
                </span>
              </div>
              <div className="flex justify-between">
                <span>5S Housekeeping:</span>
                <span className="font-semibold text-foreground font-mono">
                  {activityBreakdown.s5Pct}% ({fmtNum(activityBreakdown.s5Kg)} kg)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Disposal Logistics & Pipeline */}
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold text-foreground">Disposal Pipeline</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                TSDF Logistics
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                {batches.length}
              </span>
              <span className="text-xs text-muted-foreground font-medium">Total Batches</span>
            </div>

            <div className="pt-1 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Pending Approval:</span>
                <Badge
                  variant={pendingBatchesCount > 0 ? "destructive" : "secondary"}
                  className="text-[10px] h-4 px-1 font-mono"
                >
                  {pendingBatchesCount} awaiting sign-off
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Disposed Historical:</span>
                <span className="font-semibold text-foreground font-mono">
                  {batches.length - pendingBatchesCount} batches
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 2: Cross-Facility Scorecard ── */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-border/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/15">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Facility Performance Scorecard</h3>
              <p className="text-[11px] text-muted-foreground">
                Ranked by statutory compliance risk, active on-site storage, and storage duration.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Filter: Show At-Risk Only */}
            <Button
              variant={filterAtRiskOnly ? "destructive" : "outline"}
              size="sm"
              onClick={() => setFilterAtRiskOnly(!filterAtRiskOnly)}
              className="h-8 text-xs gap-1.5 font-medium rounded-lg"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>At-Risk Only</span>
              {atRiskSitesCount > 0 && (
                <Badge
                  variant={filterAtRiskOnly ? "secondary" : "destructive"}
                  className="text-[10px] h-4 px-1 ml-0.5"
                >
                  {atRiskSitesCount}
                </Badge>
              )}
            </Button>

            {/* Quick Search */}
            <div className="relative w-full sm:w-44">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter site..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg bg-card"
              />
            </div>
          </div>
        </div>

        {/* Scorecard Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider border-b border-border/60">
              <tr>
                <th className="py-2.5 px-3.5">Facility Name</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3 text-right">Haz Solids</th>
                <th className="py-2.5 px-3 text-right">Liquids (Oil)</th>
                <th className="py-2.5 px-3 text-center">Oldest Lot</th>
                <th className="py-2.5 px-3 text-center">Compliance Status</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredSites.map((item) => {
                const status =
                  item.overdueCount > 0
                    ? { label: "Breach (>90d)", variant: "destructive" as const, dot: "bg-rose-500" }
                    : item.warningCount > 0
                    ? { label: "Attention (75–89d)", variant: "warning" as const, dot: "bg-amber-500" }
                    : { label: "Compliant", variant: "success" as const, dot: "bg-emerald-500" };

                return (
                  <tr key={item.site.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", status.dot)} />
                        <span>{item.site.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground pl-4">
                        {item.activeCount} active lots on-site
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate">
                      {item.site.location || "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-foreground">
                      {fmtNum(item.hazKg)}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">kg</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-foreground">
                      {fmtNum(item.liquidsL)}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">L</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.maxDays > 0 ? (
                        <span
                          className={cn(
                            "font-mono font-bold px-1.5 py-0.5 rounded text-[11px]",
                            item.maxDays >= 90
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              : item.maxDays >= 75
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {item.maxDays}d
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={status.variant} className="text-[10px] px-2 py-0.5">
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentSite(item.site)}
                        className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 rounded-lg group-hover:translate-x-0.5 transition-all"
                      >
                        <span>Drill Down</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredSites.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    No facilities matched the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── ROW 3: Recent Cross-Site Telemetry ── */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-3 border-b border-border/70 flex items-center justify-between bg-muted/15">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Recent Cross-Facility Logs
            </h3>
          </div>
          {onNavigateToInventory && (
            <Button
              variant="link"
              size="sm"
              onClick={onNavigateToInventory}
              className="text-xs text-primary p-0 h-auto font-medium"
            >
              Open Consolidated Inventory →
            </Button>
          )}
        </div>

        <div className="divide-y divide-border/50 text-xs">
          {recentEntries.map((e) => {
            const siteName = siteMap.get(e.site_id)?.name ?? "Facility";
            const wasteName = WASTE_TYPES.find((w) => w.id === e.waste_type_id)?.name || e.waste_type_id;
            const isLiquid = getMeasureUnit(e.waste_type_id) === "litres";
            const days = getDaysStored(e.generated_date);

            return (
              <div
                key={e.id}
                className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <Badge variant="outline" className="text-[10px] font-medium shrink-0 bg-card">
                    {siteName}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{wasteName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {e.location || "Standard Area"} • Generated on {formatDateDDMMYYYY(e.generated_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0 font-mono">
                  <span className="font-bold text-foreground">
                    {fmtNum(Number(e.weight_kg ?? 0))} {isLiquid ? "L" : "kg"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                      days >= 90
                        ? "bg-rose-500/10 text-rose-600"
                        : days >= 75
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {days}d age
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
