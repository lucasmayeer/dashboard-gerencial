import { useState, useEffect } from "react";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import type { ChartPoint } from "@/pages/bsa/views/BSAShared";
import type { BSAViewMode } from "@/contexts/BSAContext";

interface UseBSAChartDataParams {
  viewMode: BSAViewMode;
  selectedAnalyst: string | null;
  selectedTeamLeader: string | null;
  selectedChartAnalyst: string | null;
  selectedChartTeam: string | null;
  selectedMonth: string;
  refreshKey: number;
}

export function useBSAChartData({
  viewMode,
  selectedAnalyst,
  selectedTeamLeader,
  selectedChartAnalyst,
  selectedChartTeam,
  selectedMonth,
  refreshKey,
}: UseBSAChartDataParams): ChartPoint[] {
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    const isAnalyst    = viewMode === "analyst"     && !!selectedAnalyst;
    const isTeamLeader = viewMode === "team_leader" && !!selectedTeamLeader;
    const isManager    = viewMode === "manager";
    if (!isAnalyst && !isTeamLeader && !isManager) { setChartData([]); return; }
    let cancelled = false;

    async function fetchChart() {
      const [year, month] = selectedMonth.split("-").map(Number);
      const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay  = new Date(year, month, 0).getDate();
      const dateTo   = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const allRows = await getDummyImplantacaoRows();
      let rows = allRows.filter((r) => r.report_date >= dateFrom && r.report_date <= dateTo);
      if (isAnalyst) {
        rows = rows.filter((r) => r.user_name === selectedAnalyst);
      } else if (isTeamLeader) {
        rows = selectedChartAnalyst
          ? rows.filter((r) => r.user_name    === selectedChartAnalyst)
          : rows.filter((r) => r.manager_name === selectedTeamLeader);
      } else {
        if (selectedChartAnalyst)  rows = rows.filter((r) => r.user_name  === selectedChartAnalyst);
        else if (selectedChartTeam) rows = rows.filter((r) => r.team_name === selectedChartTeam);
      }
      if (cancelled) return;

      const byDate: Record<string, { b: number; e: number }> = {};
      for (const r of rows) {
        if (!byDate[r.report_date]) byDate[r.report_date] = { b: 0, e: 0 };
        byDate[r.report_date].b += r.billable_hours ?? 0;
        byDate[r.report_date].e += r.skip_record ? 0 : Math.max(0, (r.expected_billable_hours ?? 0) - (r.discount_hours ?? 0));
      }

      const points: ChartPoint[] = [];
      let cumB = 0, cumE = 0;
      for (let d = 1; d <= lastDay; d++) {
        const dd  = String(d).padStart(2, "0");
        const mm  = String(month).padStart(2, "0");
        const key = `${year}-${mm}-${dd}`;
        const day = byDate[key] ?? { b: 0, e: 0 };
        cumB += day.b;
        cumE += day.e;
        points.push({
          dateLabel:   `${dd}/${mm}`,
          dateKey:     key,
          cumBillable: parseFloat(cumB.toFixed(1)),
          cumMeta:     parseFloat(cumE.toFixed(1)),
        });
      }

      setChartData(points);
    }

    fetchChart();
    return () => { cancelled = true; };
  }, [viewMode, selectedAnalyst, selectedTeamLeader, selectedChartAnalyst, selectedChartTeam, selectedMonth, refreshKey]);

  return chartData;
}
