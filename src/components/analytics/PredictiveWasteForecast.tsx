import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  WasteEntry,
  WASTE_TYPES,
  getMeasureUnit,
  fmtNum,
  isDisposed,
  WasteCategory,
  getStatutoryCode,
  parseLocalDate,
  formatDateDDMMYYYY,
} from "@/lib/wasteTypes";
import {
  TrendingUp,
  Sparkles,
  Calendar as CalendarIcon,
  Sliders,
  RotateCcw,
  Info,
  ShieldAlert,
  Droplets,
  Scale,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Activity,
  Plus,
  Minus,
  Box,
  FileSpreadsheet,
  Download,
  MapPin,
  ArrowRight,
  Filter,
} from "lucide-react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSite } from "@/contexts/SiteContext";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  entries: WasteEntry[];
  onNavigateToInventory?: () => void;
}

type ForecastHorizon = "7d" | "30d" | "90d" | "180d" | "365d" | "custom";
type LookbackWindow = "30d" | "90d" | "180d" | "all";

const HORIZON_DAYS: Record<Exclude<ForecastHorizon, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

export default function PredictiveWasteForecast({ entries, onNavigateToInventory }: Props) {
  const { currentSite } = useSite();

  // ── Forecasting Horizon & Baseline Lookback ────────────────────────
  const [horizon, setHorizon] = useState<ForecastHorizon>("30d");
  const [lookback, setLookback] = useState<LookbackWindow>("90d");
  const [customDays, setCustomDays] = useState<number>(45);
  const [customCalendarOpen, setCustomCalendarOpen] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>(addDays(new Date(), 45));

  // Location / Asset Granularity Filter ("all" or specific turbine/location)
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  // Mode: Automatic Run-rate vs Interactive Maintenance Scenario Planner
  const [forecastMode, setForecastMode] = useState<"auto" | "scenario">("auto");

  // Operational Load Variance / Sensitivity Factor (-30% to +50%)
  const [sensitivity, setSensitivity] = useState<number>(0);

  // Sub-view toggle: Chart projection vs Detailed stream matrix vs Logistics
  const [viewTab, setViewTab] = useState<"chart" | "table" | "logistics">("chart");

  // Scenario event overrides
  const [customPM, setCustomPM] = useState<number | null>(null);
  const [customBM, setCustomBM] = useState<number | null>(null);
  const [custom5S, setCustom5S] = useState<number | null>(null);

  // Distinct locations available in dataset
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    entries.forEach((e) => {
      if (e.location && e.location.trim()) {
        locSet.add(e.location.trim());
      }
    });
    return Array.from(locSet).sort();
  }, [entries]);

  // Determine effective target horizon in days
  const horizonDays = useMemo(() => {
    if (horizon === "custom") {
      return Math.max(1, customDays);
    }
    return HORIZON_DAYS[horizon];
  }, [horizon, customDays]);

  // Filter entries by location if specific location selected
  const locationFilteredEntries = useMemo(() => {
    if (selectedLocation === "all") return entries;
    return entries.filter((e) => (e.location ?? "").trim() === selectedLocation);
  }, [entries, selectedLocation]);

  // Active in-storage items for statutory threshold planning
  const activeEntries = useMemo(() => locationFilteredEntries.filter((e) => !isDisposed(e)), [locationFilteredEntries]);

  const activeHazKg = useMemo(() => {
    return activeEntries
      .filter((e) => e.waste_category === "hazardous" && getMeasureUnit(e.waste_type_id) === "kg")
      .reduce((s, e) => s + Number(e.weight_kg ?? 0), 0);
  }, [activeEntries]);

  // ── Baseline Filtering (Lookback Window) ───────────────────────────
  const baselineEntries = useMemo(() => {
    if (lookback === "all" || locationFilteredEntries.length === 0) return locationFilteredEntries;
    const days = lookback === "30d" ? 30 : lookback === "90d" ? 90 : 180;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = locationFilteredEntries.filter((e) => parseLocalDate(e.generated_date).getTime() >= cutoff);
    return filtered.length >= 4 ? filtered : locationFilteredEntries;
  }, [locationFilteredEntries, lookback]);

  // ── Historical Statistical Engine ──────────────────────────────────
  const historyStats = useMemo(() => {
    const dataset = baselineEntries.length > 0 ? baselineEntries : locationFilteredEntries;

    if (dataset.length === 0) {
      return {
        totalDays: 30,
        totalKg: 0,
        totalLitres: 0,
        dailyKg: 0,
        dailyLitres: 0,
        weeklyStdDevKg: 5,
        weeklyStdDevL: 8,
        confidence: "low" as const,
        activityAverages: {
          preventive: { count: 0, avgKg: 18.5, avgLitres: 35 },
          breakdown: { count: 0, avgKg: 28.0, avgLitres: 15 },
          "5s": { count: 0, avgKg: 12.0, avgLitres: 0 },
          others: { count: 0, avgKg: 10.0, avgLitres: 0 },
        },
        categoryRatio: {
          hazardous: 0.35,
          non_hazardous: 0.3,
          e_waste: 0.05,
          other_wastes: 0.3,
        },
        typeDistribution: [] as {
          id: string;
          name: string;
          share: number;
          unit: string;
          category: WasteCategory;
          statutoryCode: string;
          currentStorage: number;
        }[],
      };
    }

    // Determine span in days
    const timestamps = dataset
      .map((e) => parseLocalDate(e.generated_date).getTime())
      .filter((t) => !isNaN(t));

    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps, Date.now());
    const spanWindowDays =
      lookback === "30d"
        ? 30
        : lookback === "90d"
        ? 90
        : lookback === "180d"
        ? 180
        : Math.max(14, Math.round((maxTime - minTime) / (1000 * 60 * 60 * 24)));
    const rawSpanDays = Math.max(14, spanWindowDays);

    let totalKg = 0;
    let totalLitres = 0;

    const activityGroups: Record<string, { kg: number; litres: number; eventDates: Set<string> }> = {
      preventive: { kg: 0, litres: 0, eventDates: new Set() },
      breakdown: { kg: 0, litres: 0, eventDates: new Set() },
      "5s": { kg: 0, litres: 0, eventDates: new Set() },
      others: { kg: 0, litres: 0, eventDates: new Set() },
    };

    const categoryKg: Record<string, number> = {
      hazardous: 0,
      non_hazardous: 0,
      e_waste: 0,
      other_wastes: 0,
    };

    const typeWeights = new Map<string, number>();

    // Weekly grouping for calculating sample standard deviation (variance)
    const weeklyTotals: Record<number, { kg: number; litres: number }> = {};

    for (const e of dataset) {
      const u = getMeasureUnit(e.waste_type_id);
      const w = Number(e.weight_kg ?? 0);
      const act = e.activity_type || "others";
      const cat = e.waste_category || "non_hazardous";
      const dateKey = (e.generated_date || "").slice(0, 10);
      const weekIndex = Math.floor(parseLocalDate(e.generated_date).getTime() / (7 * 24 * 60 * 60 * 1000));

      if (!weeklyTotals[weekIndex]) {
        weeklyTotals[weekIndex] = { kg: 0, litres: 0 };
      }

      if (u === "litres") {
        totalLitres += w;
        weeklyTotals[weekIndex].litres += w;
        if (activityGroups[act]) {
          activityGroups[act].litres += w;
          activityGroups[act].eventDates.add(dateKey);
        }
      } else {
        totalKg += w;
        weeklyTotals[weekIndex].kg += w;
        if (activityGroups[act]) {
          activityGroups[act].kg += w;
          activityGroups[act].eventDates.add(dateKey);
        }
        categoryKg[cat] = (categoryKg[cat] || 0) + w;
      }

      typeWeights.set(e.waste_type_id, (typeWeights.get(e.waste_type_id) || 0) + w);
    }

    const dailyKg = totalKg / rawSpanDays;
    const dailyLitres = totalLitres / rawSpanDays;

    // Standard deviation computation for confidence intervals
    const weekSamples = Object.values(weeklyTotals);
    const meanWeeklyKg = weekSamples.length > 0 ? totalKg / Math.max(1, rawSpanDays / 7) : dailyKg * 7;
    const meanWeeklyL = weekSamples.length > 0 ? totalLitres / Math.max(1, rawSpanDays / 7) : dailyLitres * 7;

    const varWeeklyKg =
      weekSamples.length > 1
        ? weekSamples.reduce((s, w) => s + Math.pow(w.kg - meanWeeklyKg, 2), 0) / (weekSamples.length - 1)
        : Math.pow(meanWeeklyKg * 0.25, 2);

    const varWeeklyL =
      weekSamples.length > 1
        ? weekSamples.reduce((s, w) => s + Math.pow(w.litres - meanWeeklyL, 2), 0) / (weekSamples.length - 1)
        : Math.pow(meanWeeklyL * 0.25, 2);

    const weeklyStdDevKg = Math.sqrt(varWeeklyKg);
    const weeklyStdDevL = Math.sqrt(varWeeklyL);

    // Activity averages per distinct event date
    const calcActivityAvg = (act: string) => {
      const g = activityGroups[act];
      const count = g.eventDates.size;
      return {
        count,
        avgKg: count > 0 ? g.kg / count : act === "preventive" ? 18.5 : act === "breakdown" ? 28.0 : 12.0,
        avgLitres: count > 0 ? g.litres / count : act === "preventive" ? 35.0 : act === "breakdown" ? 15.0 : 0,
      };
    };

    const activityAverages = {
      preventive: calcActivityAvg("preventive"),
      breakdown: calcActivityAvg("breakdown"),
      "5s": calcActivityAvg("5s"),
      others: calcActivityAvg("others"),
    };

    // Category shares
    const sumCat = Object.values(categoryKg).reduce((a, b) => a + b, 0) || 1;
    const categoryRatio = {
      hazardous: (categoryKg.hazardous || 0) / sumCat,
      non_hazardous: (categoryKg.non_hazardous || 0) / sumCat,
      e_waste: (categoryKg.e_waste || 0) / sumCat,
      other_wastes: (categoryKg.other_wastes || 0) / sumCat,
    };

    // Current in-storage weights map
    const activeStorageMap = new Map<string, number>();
    for (const ae of activeEntries) {
      activeStorageMap.set(
        ae.waste_type_id,
        (activeStorageMap.get(ae.waste_type_id) || 0) + Number(ae.weight_kg ?? 0)
      );
    }

    // Type distribution
    const totalAllWeight = Array.from(typeWeights.values()).reduce((a, b) => a + b, 0) || 1;
    const typeDistribution = Array.from(typeWeights.entries())
      .map(([id, weight]) => {
        const wt = WASTE_TYPES.find((w) => w.id === id);
        return {
          id,
          name: wt?.name || id,
          share: weight / totalAllWeight,
          unit: wt?.measureUnit === "litres" ? "L" : "kg",
          category: wt?.wasteCategory || "non_hazardous",
          statutoryCode: getStatutoryCode(id),
          currentStorage: activeStorageMap.get(id) || 0,
        };
      })
      .sort((a, b) => b.share - a.share);

    const confidence: "high" | "medium" | "low" =
      dataset.length >= 30 && rawSpanDays >= 45 ? "high" : dataset.length >= 8 ? "medium" : "low";

    return {
      totalDays: rawSpanDays,
      totalKg,
      totalLitres,
      dailyKg,
      dailyLitres,
      weeklyStdDevKg,
      weeklyStdDevL,
      confidence,
      activityAverages,
      categoryRatio,
      typeDistribution,
    };
  }, [baselineEntries, locationFilteredEntries, lookback, activeEntries]);

  // Proportional default events based on historical frequency
  const defaultEvents = useMemo(() => {
    const { totalDays, activityAverages } = historyStats;
    const pmPerDay = (activityAverages.preventive.count || 1) / totalDays;
    const bmPerDay = (activityAverages.breakdown.count || 0.5) / totalDays;
    const fiveSPerDay = (activityAverages["5s"].count || 1) / totalDays;

    return {
      pm: Math.max(1, Math.round(pmPerDay * horizonDays)),
      bm: Math.max(0, Math.round(bmPerDay * horizonDays)),
      fiveS: Math.max(1, Math.round(fiveSPerDay * horizonDays)),
    };
  }, [historyStats, horizonDays]);

  // Active scenario event counts
  const effectivePM = customPM ?? defaultEvents.pm;
  const effectiveBM = customBM ?? defaultEvents.bm;
  const effective5S = custom5S ?? defaultEvents.fiveS;

  // Reset scenario overrides if horizon changes in auto mode
  useEffect(() => {
    if (forecastMode === "auto") {
      setCustomPM(null);
      setCustomBM(null);
      setCustom5S(null);
    }
  }, [horizon, horizonDays, forecastMode]);

  // ── Forecast Computation (Point + Range Intervals) ─────────────────
  const forecast = useMemo(() => {
    const {
      dailyKg,
      dailyLitres,
      weeklyStdDevKg,
      weeklyStdDevL,
      activityAverages,
      categoryRatio,
      typeDistribution,
    } = historyStats;

    // Sensitivity multiplier: (1 + sensitivity / 100)
    const factor = 1 + sensitivity / 100;

    let baseSolidsKg = 0;
    let baseLiquidsL = 0;

    if (forecastMode === "auto") {
      baseSolidsKg = dailyKg * horizonDays * factor;
      baseLiquidsL = dailyLitres * horizonDays * factor;
    } else {
      const pmKg = effectivePM * activityAverages.preventive.avgKg;
      const pmL = effectivePM * activityAverages.preventive.avgLitres;

      const bmKg = effectiveBM * activityAverages.breakdown.avgKg;
      const bmL = effectiveBM * activityAverages.breakdown.avgLitres;

      const fiveSKg = effective5S * activityAverages["5s"].avgKg;
      const fiveSL = effective5S * activityAverages["5s"].avgLitres;

      const driftKg = dailyKg * 0.15 * horizonDays;
      const driftL = dailyLitres * 0.15 * horizonDays;

      baseSolidsKg = (pmKg + bmKg + fiveSKg + driftKg) * factor;
      baseLiquidsL = (pmL + bmL + fiveSL + driftL) * factor;
    }

    if (baseSolidsKg === 0 && baseLiquidsL === 0) {
      baseSolidsKg = horizonDays * 1.5 * factor;
      baseLiquidsL = horizonDays * 0.8 * factor;
    }

    // Statistical Confidence Intervals (80-85% confidence interval ~ 1.28 * stdDev * sqrt(weeks))
    const weeksCount = Math.max(1, horizonDays / 7);
    const uncertaintyKg = 1.28 * weeklyStdDevKg * Math.sqrt(weeksCount) * factor;
    const uncertaintyL = 1.28 * weeklyStdDevL * Math.sqrt(weeksCount) * factor;

    const solidsLower = Math.max(0, Math.round(baseSolidsKg - uncertaintyKg));
    const solidsUpper = Math.round(baseSolidsKg + uncertaintyKg);

    const liquidsLower = Math.max(0, Math.round(baseLiquidsL - uncertaintyL));
    const liquidsUpper = Math.round(baseLiquidsL + uncertaintyL);

    // Categorical breakdown
    const hazardousKg = baseSolidsKg * categoryRatio.hazardous;
    const nonHazardousKg = baseSolidsKg * categoryRatio.non_hazardous;
    const eWasteKg = baseSolidsKg * categoryRatio.e_waste;
    const otherKg = baseSolidsKg * categoryRatio.other_wastes;

    // Packaging / Container Logistics Calculations
    const barrels200L = Math.max(1, Math.ceil(baseLiquidsL / 200));
    const hazardBags25kg = Math.max(1, Math.ceil(hazardousKg / 25));
    const estimatedPieces = Math.round(
      (effectivePM * 2.5 + effectiveBM * 1.2 + horizonDays * 0.1) * factor
    );

    // Detailed waste stream matrix mapping
    const fallbackStreams = [
      { id: "used-oil", name: "Waste Lubricant Oil", share: 0.35, unit: "L", category: "hazardous" as WasteCategory, statutoryCode: "HOWM Sch-I (Cat 5.1)", currentStorage: 80 },
      { id: "cotton-rags", name: "Oily Cotton Rags", share: 0.25, unit: "kg", category: "hazardous" as WasteCategory, statutoryCode: "HOWM Sch-I (Cat 5.2)", currentStorage: 45 },
      { id: "waste-oil-filters", name: "Used Oil Filters", share: 0.15, unit: "kg", category: "hazardous" as WasteCategory, statutoryCode: "HOWM Sch-I (Cat 35.1)", currentStorage: 18 },
      { id: "ms-scrap", name: "Mild Steel Scrap", share: 0.15, unit: "kg", category: "other_wastes" as WasteCategory, statutoryCode: "Scrap (MS)", currentStorage: 120 },
      { id: "waste-grease", name: "Waste Grease", share: 0.1, unit: "kg", category: "hazardous" as WasteCategory, statutoryCode: "HOWM Sch-I (Cat 5.2)", currentStorage: 12 },
    ];

    const streamsSource = typeDistribution.length > 0 ? typeDistribution : fallbackStreams;

    const streamMatrix = streamsSource.map((t) => {
      const isL = t.unit === "L";
      const totalPool = isL ? baseLiquidsL : baseSolidsKg;
      const addition = Math.max(0.5, totalPool * t.share);
      const totalEnd = (t.currentStorage || 0) + addition;

      let packaging = "General Scrap Bin";
      let disposalRoute = "Authorized Recycler";

      if (isL) {
        const drums = Math.max(1, Math.ceil(addition / 200));
        packaging = `${drums} × 200L MS Drum${drums > 1 ? "s" : ""}`;
        disposalRoute = "Authorized Oil Re-refiner";
      } else if (t.category === "hazardous") {
        const bags = Math.max(1, Math.ceil(addition / 25));
        packaging = `${bags} × 25kg Hazard Bag${bags > 1 ? "s" : ""}`;
        disposalRoute = "TSDF Incineration / Landfill";
      } else if (t.category === "e_waste") {
        packaging = "ESD-Safe Poly Crate";
        disposalRoute = "Registered E-Waste Dismantler";
      }

      return {
        ...t,
        addition,
        totalEnd,
        packaging,
        disposalRoute,
      };
    });

    // Statutory capacity advisory
    const projectedTotalHazKg = activeHazKg + hazardousKg;
    const isApproachingStatutoryDisposal =
      projectedTotalHazKg > 350 || (horizonDays >= 60 && activeHazKg > 150) || projectedTotalHazKg >= 1000;

    return {
      solidsKg: baseSolidsKg,
      solidsLower,
      solidsUpper,
      liquidsL: baseLiquidsL,
      liquidsLower,
      liquidsUpper,
      hazardousKg,
      nonHazardousKg,
      eWasteKg,
      otherKg,
      estimatedPieces,
      barrels200L,
      hazardBags25kg,
      streamMatrix,
      projectedTotalHazKg,
      isApproachingStatutoryDisposal,
    };
  }, [
    historyStats,
    forecastMode,
    horizonDays,
    effectivePM,
    effectiveBM,
    effective5S,
    activeHazKg,
    sensitivity,
  ]);

  // ── Projection Timeline Chart Data ─────────────────────────────────
  const chartData = useMemo(() => {
    const points: {
      label: string;
      actualSolids?: number;
      actualLiquids?: number;
      projectedSolids?: number;
      projectedLiquids?: number;
    }[] = [];

    const now = new Date();

    // Past 4 weeks historical actuals (strictly based on actual physical generated_date)
    for (let w = 4; w >= 1; w--) {
      const end = new Date(now);
      end.setDate(end.getDate() - (w - 1) * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const weekEntries = locationFilteredEntries.filter((e) => {
        if (!e.generated_date) return false;
        const d = parseLocalDate(e.generated_date);
        return d >= start && d <= end;
      });

      let kg = 0, l = 0;
      for (const e of weekEntries) {
        const u = getMeasureUnit(e.waste_type_id);
        const val = Number(e.weight_kg ?? 0);
        if (u === "litres") l += val; else kg += val;
      }

      const dDay = String(end.getDate()).padStart(2, "0");
      const dMonth = String(end.getMonth() + 1).padStart(2, "0");

      points.push({
        label: `${dDay}-${dMonth}`,
        actualSolids: +kg.toFixed(1),
        actualLiquids: +l.toFixed(1),
      });
    }

    // Connect point (current week)
    const currentPoint = points[points.length - 1];
    if (currentPoint) {
      currentPoint.projectedSolids = currentPoint.actualSolids;
      currentPoint.projectedLiquids = currentPoint.actualLiquids;
    }

    // Future weeks ahead
    const weeksAhead = Math.min(8, Math.max(2, Math.ceil(horizonDays / 7)));
    const weeklySolidMean = forecast.solidsKg / (horizonDays / 7);
    const weeklyLiquidMean = forecast.liquidsL / (horizonDays / 7);

    for (let f = 1; f <= weeksAhead; f++) {
      const futDate = new Date(now);
      futDate.setDate(futDate.getDate() + f * 7);

      const variance = 1 + Math.sin(f * 1.5) * 0.08;
      const expectedS = weeklySolidMean * variance;
      const expectedL = weeklyLiquidMean * variance;

      const fDay = String(futDate.getDate()).padStart(2, "0");
      const fMonth = String(futDate.getMonth() + 1).padStart(2, "0");

      points.push({
        label: `+${f}w (${fDay}-${fMonth})`,
        projectedSolids: +expectedS.toFixed(1),
        projectedLiquids: +expectedL.toFixed(1),
      });
    }

    return points;
  }, [locationFilteredEntries, forecast, horizonDays]);

  // ── Export Forecast Summary Report (.xlsx) ─────────────────────────
  const handleExportForecast = () => {
    try {
      const siteName = currentSite?.name || "Facility";
      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive KPI & Parameter Summary
      const summaryRows = [
        { Parameter: "Facility Name", Value: siteName },
        { Parameter: "Location Filter", Value: selectedLocation === "all" ? "All Facility Assets" : selectedLocation },
        { Parameter: "Forecast Target Horizon", Value: `${horizonDays} Days (through ${formatDateDDMMYYYY(addDays(new Date(), horizonDays))})` },
        { Parameter: "Baseline Lookback Window", Value: lookback === "all" ? "All History" : `Last ${lookback}` },
        { Parameter: "Modeling Mode", Value: forecastMode === "auto" ? "Automatic Run-Rate Trend" : "Interactive Maintenance Scenario" },
        { Parameter: "Operational Load Variance", Value: `${sensitivity > 0 ? "+" : ""}${sensitivity}%` },
        { Parameter: "Model Confidence Level", Value: `${historyStats.confidence.toUpperCase()} (${baselineEntries.length} log entries)` },
        { Parameter: "Projected Total Solid Waste (kg)", Value: Math.round(forecast.solidsKg) },
        { Parameter: "Solids Statistical Range (kg)", Value: `${forecast.solidsLower} – ${forecast.solidsUpper}` },
        { Parameter: "Projected Total Liquid Waste (L)", Value: Math.round(forecast.liquidsL) },
        { Parameter: "Liquids Statistical Range (L)", Value: `${forecast.liquidsLower} – ${forecast.liquidsUpper}` },
        { Parameter: "Projected Hazardous Solids (kg)", Value: Math.round(forecast.hazardousKg) },
        { Parameter: "Projected Non-Hazardous Solids (kg)", Value: Math.round(forecast.nonHazardousKg + forecast.otherKg) },
        { Parameter: "Projected E-Waste (kg)", Value: Math.round(forecast.eWasteKg) },
        { Parameter: "Packaging Needed: 200L MS Drums", Value: forecast.barrels200L },
        { Parameter: "Packaging Needed: 25kg Hazard Bags", Value: forecast.hazardBags25kg },
        { Parameter: "Estimated Countable Pieces (nos)", Value: forecast.estimatedPieces },
        { Parameter: "Current Active In-Storage (kg)", Value: Math.round(activeHazKg) },
        { Parameter: "Projected In-Storage at Horizon End (kg)", Value: Math.round(forecast.projectedTotalHazKg) },
        { Parameter: "HOWM Rule 8 Statutory Status", Value: forecast.isApproachingStatutoryDisposal ? "ACTION REQUIRED: TSDF Manifest Booking Advised" : "Compliant (Within Safe Storage Thresholds)" },
      ];

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

      // Sheet 2: Waste Stream Forecast Matrix
      const matrixRows = forecast.streamMatrix.map((item, idx) => ({
        "Sl No": idx + 1,
        "Waste Stream": item.name,
        "Statutory Rule Code": item.statutoryCode,
        "Category":
          item.category === "hazardous"
            ? "Hazardous (HOWM 2016)"
            : item.category === "e_waste"
            ? "E-Waste (EWM 2022)"
            : item.category === "other_wastes"
            ? "Other Operational Waste"
            : "Non-Hazardous",
        "Unit": item.unit,
        "Current In-Storage": Math.round(item.currentStorage),
        "Projected Additional Generation": Math.round(item.addition),
        "Total Projected at Horizon End": Math.round(item.totalEnd),
        "Recommended Packaging": item.packaging,
        "Authorized Disposal Route": item.disposalRoute,
      }));

      const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
      XLSX.utils.book_append_sheet(wb, wsMatrix, "Waste Streams Projection");

      const safeSite = siteName.replace(/[^a-z0-9-_]+/gi, "_");
      const filename = `${safeSite}_Waste_Forecast_${horizonDays}d_${format(new Date(), "yyyyMMdd")}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Forecast spreadsheet exported: ${filename}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export forecast report");
    }
  };

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    borderColor: "hsl(var(--border))",
    borderRadius: "0.625rem",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
    padding: "8px 12px",
  };

  return (
    <Card className="border-border/90 shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* ── Header: Title, Confidence & Export Action ── */}
        <div className="flex items-start sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Predictive Waste Generation Forecast
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono uppercase px-1.5 py-0 shrink-0",
                    historyStats.confidence === "high"
                      ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                      : historyStats.confidence === "medium"
                      ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                      : "border-muted-foreground/40 text-muted-foreground bg-muted/40"
                  )}
                >
                  {historyStats.confidence} confidence
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Statistical projection based on {baselineEntries.length} log entries & scheduled maintenance scenarios
              </p>
            </div>
          </div>

          {/* Export Report CTA - strictly inline on the card header */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportForecast}
            className="h-8 px-2.5 text-xs gap-1.5 border-border/80 shadow-2xs font-medium shrink-0"
            title="Download Excel spreadsheet of forecast"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export Excel</span>
          </Button>
        </div>

        {/* ── Model Controls Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Location Selector (Facility Wide vs Turbine) */}
            {availableLocations.length > 0 && (
              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60 text-xs">
                <MapPin className="h-3 w-3 text-muted-foreground ml-1.5 shrink-0" />
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="h-6 text-[10px] border-none bg-transparent shadow-none px-1.5 focus:ring-0">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="all">All Facility Assets</SelectItem>
                    {availableLocations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Lookback Selector */}
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60 text-xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase px-1.5 flex items-center gap-1">
                <Filter className="h-2.5 w-2.5" /> Baseline:
              </span>
              {(["30d", "90d", "180d", "all"] as const).map((lb) => (
                <button
                  key={lb}
                  type="button"
                  onClick={() => setLookback(lb)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                    lookback === lb
                      ? "bg-card text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {lb === "all" ? "All" : lb}
                </button>
              ))}
            </div>
          </div>

          {/* Mode: Auto vs Scenario */}
          <div className="inline-flex p-0.5 bg-muted/70 rounded-lg border border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => setForecastMode("auto")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                forecastMode === "auto"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="h-3 w-3 text-primary" />
              <span>Auto</span>
            </button>
            <button
              type="button"
              onClick={() => setForecastMode("scenario")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                forecastMode === "scenario"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sliders className="h-3 w-3 text-cyan-600" />
              <span>Scenario</span>
            </button>
          </div>
        </div>

        {/* ── Forecast Horizon Controls & Operational Load Variance Slider ── */}
        <div className="space-y-2 bg-muted/30 p-2 sm:p-2.5 rounded-xl border border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-0.5 sm:mr-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> <span className="hidden sm:inline">Target Horizon:</span><span className="sm:hidden">Horizon:</span>
              </span>

              {(["7d", "30d", "90d", "180d", "365d"] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={cn(
                    "px-2 sm:px-2.5 py-1 text-xs rounded-lg transition-all font-medium",
                    horizon === h
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-background text-muted-foreground hover:text-foreground border border-border/60"
                  )}
                >
                  <span className="sm:hidden">{h}</span>
                  <span className="hidden sm:inline">
                    {h === "7d"
                      ? "1 Week"
                      : h === "30d"
                      ? "1 Month"
                      : h === "90d"
                      ? "1 Quarter"
                      : h === "180d"
                      ? "Half Year"
                      : "1 Year"}
                  </span>
                </button>
              ))}

              {/* Custom Date Range Popover */}
              <Popover open={customCalendarOpen} onOpenChange={setCustomCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setHorizon("custom")}
                    className={cn(
                      "px-2 sm:px-2.5 py-1 text-xs rounded-lg transition-all font-medium flex items-center gap-1 sm:gap-1.5 border",
                      horizon === "custom"
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs border-primary"
                        : "bg-background text-muted-foreground hover:text-foreground border-border/60"
                    )}
                  >
                    <CalendarIcon className="h-3 w-3" />
                    <span>{horizon === "custom" ? `${horizonDays}d` : "Custom"}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 space-y-3" align="start">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Custom Forecast Target</p>
                    <p className="text-[11px] text-muted-foreground">Select a target future date or enter duration</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={730}
                      value={customDays}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value) || 1);
                        setCustomDays(v);
                        setCustomDate(addDays(new Date(), v));
                      }}
                      className="h-8 text-xs w-24"
                    />
                    <span className="text-xs text-muted-foreground">days ahead</span>
                  </div>
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={(d) => {
                      if (d) {
                        setCustomDate(d);
                        const diff = Math.max(1, Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                        setCustomDays(diff);
                        setCustomCalendarOpen(false);
                      }
                    }}
                    disabled={(d) => d <= new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <span className="text-[11px] text-muted-foreground font-mono">
              Target: <strong>{horizonDays}d</strong> <span className="hidden sm:inline">(through {formatDateDDMMYYYY(addDays(new Date(), horizonDays))})</span>
            </span>
          </div>

          {/* Operational Sensitivity / Load Variance Slider */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-border/50 text-xs">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground whitespace-nowrap">Load Variance:</span>
                <span
                  className={cn(
                    "font-mono font-bold text-xs px-2 py-0.5 rounded-md border transition-colors",
                    sensitivity > 0
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : sensitivity < 0
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-foreground border-border/60"
                  )}
                >
                  {sensitivity > 0 ? `+${sensitivity}% Surge` : sensitivity < 0 ? `${sensitivity}% Lean` : "0% Nominal"}
                </span>
                {sensitivity !== 0 && (
                  <button
                    type="button"
                    onClick={() => setSensitivity(0)}
                    className="text-[11px] text-muted-foreground hover:text-primary underline flex items-center gap-1 transition-colors"
                    title="Reset to 0% Nominal"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:block">
                Adjust for expected high-wind output surges, heavy overhaul campaigns, or lean periods.
              </span>
            </div>

            <div className="flex flex-col gap-1.5 shrink-0 sm:items-end w-full sm:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-md shrink-0 select-none hover:bg-muted"
                  disabled={sensitivity <= -30}
                  onClick={() => setSensitivity((s) => Math.max(-30, s - 5))}
                  title="Decrease variance by 5%"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>

                <div className="flex-1 sm:w-44 md:w-52 py-2">
                  <Slider
                    value={[sensitivity]}
                    onValueChange={([val]) => setSensitivity(val)}
                    min={-30}
                    max={50}
                    step={5}
                    className="cursor-grab active:cursor-grabbing touch-none select-none"
                    aria-label="Operational Load Variance Sensitivity"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-md shrink-0 select-none hover:bg-muted"
                  disabled={sensitivity >= 50}
                  onClick={() => setSensitivity((s) => Math.min(50, s + 5))}
                  title="Increase variance by 5%"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Quick Click Simulation Presets */}
              <div className="flex items-center gap-1 self-start sm:self-auto text-[10px] text-muted-foreground overflow-x-auto no-scrollbar w-full sm:w-auto">
                <span className="font-semibold text-foreground/80 mr-0.5">Quick:</span>
                {[
                  { label: "-20% Lean", val: -20 },
                  { label: "0% Nominal", val: 0 },
                  { label: "+25% Heavy", val: 25 },
                  { label: "+50% Overhaul", val: 50 },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setSensitivity(p.val)}
                    className={cn(
                      "px-1.5 py-0.5 rounded border transition-colors font-medium shrink-0",
                      sensitivity === p.val
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted border-border/50"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scenario Interactive Maintenance Planners (when in Scenario Mode) ── */}
        {forecastMode === "scenario" && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/[0.03] p-3 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sliders className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Planned Maintenance Events Over This {horizonDays}-Day Horizon</span>
              </div>

              {/* Quick Scenario Presets */}
              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                <span className="text-muted-foreground font-semibold">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomPM(defaultEvents.pm);
                    setCustomBM(defaultEvents.bm);
                    setCustom5S(defaultEvents.fiveS);
                    setSensitivity(0);
                  }}
                  className="px-2 py-0.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                >
                  Nominal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomPM(Math.max(1, Math.round(defaultEvents.pm * 1.5)));
                    setCustomBM(Math.max(1, Math.round(defaultEvents.bm * 2.0)));
                    setSensitivity(25);
                  }}
                  className="px-2 py-0.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                >
                  Major Overhaul (+25%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustom5S(Math.max(2, Math.round(defaultEvents.fiveS * 2.5)));
                    setSensitivity(10);
                  }}
                  className="px-2 py-0.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                >
                  Site 5S Drive
                </button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Simulate waste output by setting the expected number of scheduled services vs unscheduled turbine breakdowns:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* PM Counter */}
              <div className="bg-card p-2.5 rounded-lg border border-border/80 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1 truncate">
                    <Wrench className="h-3 w-3 text-emerald-600" /> Preventive (PM)
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    avg ~{fmtNum(Math.round(historyStats.activityAverages.preventive.avgKg))} kg / ~{fmtNum(Math.round(historyStats.activityAverages.preventive.avgLitres))} L per event
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6 rounded-md"
                    onClick={() => setCustomPM(Math.max(0, effectivePM - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center font-bold font-mono text-xs">{effectivePM}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6 rounded-md"
                    onClick={() => setCustomPM(effectivePM + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* BM Counter */}
              <div className="bg-card p-2.5 rounded-lg border border-border/80 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1 truncate">
                    <AlertTriangle className="h-3 w-3 text-rose-600" /> Breakdowns (BM)
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    avg ~{fmtNum(Math.round(historyStats.activityAverages.breakdown.avgKg))} kg / ~{fmtNum(Math.round(historyStats.activityAverages.breakdown.avgLitres))} L per event
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6 rounded-md"
                    onClick={() => setCustomBM(Math.max(0, effectiveBM - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center font-bold font-mono text-xs">{effectiveBM}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6 rounded-md"
                    onClick={() => setCustomBM(effectiveBM + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* 5S / Housekeeping Counter */}
              <div className="bg-card p-2.5 rounded-lg border border-border/80 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1 truncate">
                    <Activity className="h-3 w-3 text-cyan-600" /> 5S Drives
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    avg ~{fmtNum(Math.round(historyStats.activityAverages["5s"].avgKg))} kg per drive
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6 rounded-md"
                    onClick={() => setCustom5S(Math.max(0, effective5S - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center font-bold font-mono text-xs">{effective5S}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6 rounded-md"
                    onClick={() => setCustom5S(effective5S + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Projected Output Summary KPIs (with Uncertainty Bounds) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Projected Solids */}
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Scale className="h-3.5 w-3.5 text-emerald-600" /> Projected Solids
              </span>
              <Badge variant="outline" className="text-[9px] font-mono">
                {horizonDays}d
              </Badge>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {fmtNum(Math.round(forecast.solidsKg))}
              </span>{" "}
              <span className="text-xs text-muted-foreground font-medium">kg</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              Range: {fmtNum(forecast.solidsLower)} – {fmtNum(forecast.solidsUpper)} kg
            </span>
          </div>

          {/* Projected Liquids */}
          <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Droplets className="h-3.5 w-3.5 text-cyan-600" /> Projected Liquids
              </span>
              <Badge variant="outline" className="text-[9px] font-mono">
                {horizonDays}d
              </Badge>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {fmtNum(Math.round(forecast.liquidsL))}
              </span>{" "}
              <span className="text-xs text-muted-foreground font-medium">L</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              Range: {fmtNum(forecast.liquidsLower)} – {fmtNum(forecast.liquidsUpper)} L
            </span>
          </div>

          {/* Hazardous Solids Share */}
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.04]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-600" /> Hazardous Solids
              </span>
              <Badge variant="outline" className="text-[9px] font-mono text-rose-600">
                HOWM
              </Badge>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {fmtNum(Math.round(forecast.hazardousKg))}
              </span>{" "}
              <span className="text-xs text-muted-foreground font-medium">kg</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              {Math.round((forecast.hazardousKg / (forecast.solidsKg || 1)) * 100)}% of solid output
            </span>
          </div>

          {/* Container & Logistics Requirements */}
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.04]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Box className="h-3.5 w-3.5 text-amber-600" /> Packaging Needs
              </span>
              <Badge variant="outline" className="text-[9px] font-mono">
                Logistics
              </Badge>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {forecast.barrels200L}
              </span>{" "}
              <span className="text-xs text-muted-foreground font-medium">Drums (200L)</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              + ~{forecast.hazardBags25kg} Bags (25kg) & {forecast.estimatedPieces} pcs
            </span>
          </div>
        </div>

        {/* ── Sub-Tab Switcher: Projection Chart vs Waste Stream Matrix vs Logistics ── */}
        <div className="flex items-center justify-between border-b border-border/60 pb-1.5 pt-1">
          <div className="inline-flex p-1 bg-muted/60 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setViewTab("chart")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                viewTab === "chart"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="h-3 w-3 text-primary" />
              <span>Timeline Projection Chart</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab("table")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                viewTab === "table"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
              <span>Waste Stream Forecast Matrix ({forecast.streamMatrix.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab("logistics")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                viewTab === "logistics"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Box className="h-3 w-3 text-amber-600" />
              <span>Packaging & Logistics</span>
            </button>
          </div>
        </div>

        {/* ──────────────── TAB 1: TIMELINE PROJECTION CHART ──────────────── */}
        {viewTab === "chart" && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Empirical Forecast Timeline (Past Actuals vs Future Projection)
              </h4>
              <span className="text-[10px] text-muted-foreground font-mono">
                Solid = Actuals · Dashed = Median Forecast
              </span>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.6)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any, name: string) => [
                      `${fmtNum(Number(val))} ${name.includes("Solids") ? "kg" : "L"}`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />

                  {/* Vertical Reference separating historical from forecast */}
                  <ReferenceLine
                    x={chartData[3]?.label}
                    stroke="hsl(var(--primary)/0.6)"
                    strokeDasharray="3 3"
                    label={{
                      value: "Forecast Start",
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 10,
                      position: "top",
                    }}
                  />

                  {/* Historical Solid Lines */}
                  <Line
                    type="monotone"
                    dataKey="actualSolids"
                    name="Historical Solids (kg)"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#059669" }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="actualLiquids"
                    name="Historical Liquids (L)"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#0284c7" }}
                    connectNulls
                  />

                  {/* Forecast Dashed Lines */}
                  <Line
                    type="monotone"
                    dataKey="projectedSolids"
                    name="Projected Solids (kg)"
                    stroke="#10b981"
                    strokeWidth={2.2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: "#10b981" }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="projectedLiquids"
                    name="Projected Liquids (L)"
                    stroke="#38bdf8"
                    strokeWidth={2.2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: "#38bdf8" }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ──────────────── TAB 2: DETAILED WASTE STREAM FORECAST MATRIX ────────── */}
        {viewTab === "table" && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Detailed Waste Stream Projections & Destinations
              </h4>
              <span className="text-[11px] text-muted-foreground font-mono">
                Projected over next {horizonDays} days
              </span>
            </div>

            <div className="rounded-xl border border-border/80 overflow-hidden bg-card">
              <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur-xs text-[10px] uppercase font-semibold text-muted-foreground tracking-wider border-b border-border/60">
                    <tr>
                      <th className="py-2 px-3">Waste Stream & Statutory Code</th>
                      <th className="py-2 px-3 text-right">In-Storage Now</th>
                      <th className="py-2 px-3 text-right">Projected Addition</th>
                      <th className="py-2 px-3 text-right font-bold text-foreground">Total At End</th>
                      <th className="py-2 px-3">Primary Packaging</th>
                      <th className="py-2 px-3">Authorized TSDF / Recycling Route</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {forecast.streamMatrix.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                item.category === "hazardous"
                                  ? "bg-rose-500"
                                  : item.category === "e_waste"
                                  ? "bg-violet-500"
                                  : item.unit === "L"
                                  ? "bg-cyan-500"
                                  : "bg-emerald-500"
                              )}
                            />
                            <div>
                              <span className="font-semibold text-foreground block">{item.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{item.statutoryCode}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {fmtNum(Math.round(item.currentStorage))} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">
                          +{fmtNum(Math.round(item.addition))} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {fmtNum(Math.round(item.totalEnd))} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {item.packaging}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px] truncate max-w-[200px]">
                          {item.disposalRoute}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────── TAB 3: PACKAGING & LOGISTICS PLANNING ──────────── */}
        {viewTab === "logistics" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Barrels Card */}
            <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Droplets className="h-4 w-4 text-cyan-600" /> Liquid Storage Drums
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  200L MS
                </Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
                {forecast.barrels200L} <span className="text-xs font-normal text-muted-foreground">barrels</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Required to store projected ~{fmtNum(Math.round(forecast.liquidsL))} L of waste lubricant oil & coolants.
              </p>
            </div>

            {/* Hazard Bags Card */}
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-rose-600" /> Hazard Bags & Liners
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  25kg HDPE
                </Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {forecast.hazardBags25kg} <span className="text-xs font-normal text-muted-foreground">bags</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Required for projected ~{fmtNum(Math.round(forecast.hazardousKg))} kg of oily cotton rags & contaminated filters.
              </p>
            </div>

            {/* Scrap Bins & Piece Count */}
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-amber-600" /> Countable Waste Storage
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Pallets / Crates
                </Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">
                ~{forecast.estimatedPieces} <span className="text-xs font-normal text-muted-foreground">items</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Filters, battery cells, and electronic thyristors requiring segregated scrap crates.
              </p>
            </div>
          </div>
        )}

        {/* ── Statutory Capacity Warning & Form 10 Manifest Advisory ── */}
        {forecast.isApproachingStatutoryDisposal && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                  Statutory Storage Advisory: TSDF Disposal Manifest Recommended (HOWM Rule 8)
                </span>
                <p className="text-amber-800 dark:text-amber-300">
                  Current active hazardous storage ({fmtNum(Math.round(activeHazKg))} kg) plus forecasted generation (+{fmtNum(Math.round(forecast.hazardousKg))} kg) will reach ~{fmtNum(Math.round(forecast.projectedTotalHazKg))} kg. In-storage waste will require booking a Form 10 TSDF disposal manifest before reaching statutory limits.
                </p>
              </div>
            </div>

            {onNavigateToInventory && (
              <Button
                size="sm"
                onClick={onNavigateToInventory}
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-2xs shrink-0 self-start sm:self-auto"
              >
                <span>Draft Form 10 Manifest</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* ── Regulatory Disclaimer Notice ── */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            <strong>Empirical Forecast Notice:</strong> This projection is generated using historical site generation velocity and scheduled maintenance parameters. Actual output may vary based on unforeseen equipment breakdowns, component degradation, site weather conditions, and operational changes.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
