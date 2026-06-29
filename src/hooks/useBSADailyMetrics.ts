import { useState, useEffect } from "react";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import { currentMonthKey } from "@/lib/bsaUtils";
import type { BSAViewMode } from "@/contexts/BSAContext";

interface UseBSADailyMetricsParams {
  viewMode: BSAViewMode;
  selectedAnalyst: string | null;
  selectedTeamLeader: string | null;
  selectedMonth: string;
  refreshKey: number;
  selectedDay?: number | null;
}

interface BSAMonthlyPace {
  doneToDate: number | null;
  expectedToDate: number | null;
  saldoAcumulado: number | null;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function useBSADailyMetrics({
  viewMode,
  selectedAnalyst,
  selectedTeamLeader,
  selectedMonth,
  refreshKey,
  selectedDay = null,
}: UseBSADailyMetricsParams): BSAMonthlyPace {
  const [doneToDate,     setDoneToDate]     = useState<number | null>(null);
  const [expectedToDate, setExpectedToDate] = useState<number | null>(null);
  const [saldoAcumulado, setSaldoAcumulado] = useState<number | null>(null);

  useEffect(() => {
    const isAnalyst    = viewMode === "analyst"     && !!selectedAnalyst;
    const isTeamLeader = viewMode === "team_leader" && !!selectedTeamLeader;
    const isManager    = viewMode === "manager";
    if (!isAnalyst && !isTeamLeader && !isManager) {
      setDoneToDate(null);
      setExpectedToDate(null);
      setSaldoAcumulado(null);
      return;
    }

    let cancelled = false;

    async function fetchPace() {
      const [year, month] = selectedMonth.split("-").map(Number);
      const dateFrom   = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay    = new Date(year, month, 0).getDate();
      const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      // selectedDay override → cut at that day; else: today for current month, end-of-month for past
      const cutoffDate = selectedDay != null
        ? `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
        : (selectedMonth === currentMonthKey() ? todayKey() : lastDayStr);

      const allRows = await getDummyImplantacaoRows();
      let rows = allRows.filter(
        (r) => r.report_date >= dateFrom && r.report_date <= cutoffDate
      );
      if (isAnalyst)         rows = rows.filter((r) => r.user_name    === selectedAnalyst);
      else if (isTeamLeader) rows = rows.filter((r) => r.manager_name === selectedTeamLeader);

      if (cancelled) return;

      const done     = rows.reduce((s, r) => s + (r.billable_hours ?? 0), 0);
      const expected = rows.reduce(
        (s, r) => s + (r.skip_record ? 0 : Math.max(0, (r.expected_billable_hours ?? 0) - (r.discount_hours ?? 0))),
        0
      );

      setDoneToDate(done);
      setExpectedToDate(expected);
      setSaldoAcumulado(Math.max(0, expected - done));
    }

    fetchPace();
    return () => { cancelled = true; };
  }, [viewMode, selectedAnalyst, selectedTeamLeader, selectedMonth, refreshKey, selectedDay]);

  return { doneToDate, expectedToDate, saldoAcumulado };
}
