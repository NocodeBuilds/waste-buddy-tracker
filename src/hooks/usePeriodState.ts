import { useMemo, useState } from "react";
import type { AnalyticsPeriod, PeriodKind } from "@/lib/wasteTypes";
import {
  ALL_TIME_PERIOD,
  monthPeriod,
  rangePeriod,
  fyPeriod,
  currentFyStartYear,
} from "@/lib/wasteTypes";

export interface PeriodState {
  periodKind: PeriodKind;
  setPeriodKind: (v: PeriodKind) => void;
  selectedYear: number;
  setSelectedYear: (v: number) => void;
  selectedMonth: number;
  setSelectedMonth: (v: number) => void;
  rangeStart: string;
  setRangeStart: (v: string) => void;
  rangeEnd: string;
  setRangeEnd: (v: string) => void;
  rangeOpenStart: boolean;
  setRangeOpenStart: (v: boolean) => void;
  selectedFy: number;
  setSelectedFy: (v: number) => void;
  period: AnalyticsPeriod;
}

export function usePeriodState(): PeriodState {
  const [periodKind, setPeriodKind] = useState<PeriodKind>("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeOpenStart, setRangeOpenStart] = useState(false);
  const [selectedFy, setSelectedFy] = useState(currentFyStartYear());

  const period = useMemo<AnalyticsPeriod>(() => {
    if (periodKind === "all") return ALL_TIME_PERIOD;
    if (periodKind === "month") return monthPeriod(selectedYear, selectedMonth);
    if (periodKind === "range" && rangeStart && rangeEnd) return rangePeriod(rangeStart, rangeEnd);
    if (periodKind === "fy") return fyPeriod(selectedFy);
    return ALL_TIME_PERIOD;
  }, [periodKind, selectedYear, selectedMonth, rangeStart, rangeEnd, selectedFy]);

  return {
    periodKind,
    setPeriodKind,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    rangeOpenStart,
    setRangeOpenStart,
    selectedFy,
    setSelectedFy,
    period,
  };
}