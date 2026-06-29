import { useState, useEffect } from "react";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import type { BSAViewMode } from "@/contexts/BSAContext";

interface UseBSAKpisParams {
  viewMode: BSAViewMode;
  selectedAnalyst: string | null;
  selectedTeamLeader: string | null;
  selectedMonth: string;
  refreshKey: number;
}

interface BSAKpis {
  billable: number | null;
  meta: number | null;
  monthRawMeta: number | null;
  monthDiscountHours: number;
  monthWorkdays: number;
  isOnFerias: boolean;
  isOnRampup: boolean;
}

export function useBSAKpis({
  viewMode,
  selectedAnalyst,
  selectedTeamLeader,
  selectedMonth,
  refreshKey,
}: UseBSAKpisParams): BSAKpis {
  const [billable,          setBillable]          = useState<number | null>(null);
  const [meta,              setMeta]              = useState<number | null>(null);
  const [monthRawMeta,      setMonthRawMeta]      = useState<number | null>(null);
  const [monthDiscountHours,setMonthDiscountHours]= useState<number>(0);
  const [monthWorkdays,     setMonthWorkdays]     = useState<number>(0);
  const [isOnFerias,        setIsOnFerias]        = useState(false);
  const [isOnRampup,        setIsOnRampup]        = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBillable(null);
    setMeta(null);

    if ((viewMode === "analyst" && !selectedAnalyst) ||
        (viewMode === "team_leader" && !selectedTeamLeader)) {
      setMonthRawMeta(null);
      setMonthDiscountHours(0);
      setMonthWorkdays(0);
      setIsOnFerias(false);
      setIsOnRampup(false);
      return;
    }

    async function fetchKpis() {
      const [year, month] = selectedMonth.split("-").map(Number);
      const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay  = new Date(year, month, 0).getDate();
      const dateTo   = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const allRows = await getDummyImplantacaoRows();
      let rows = allRows.filter((r) => r.report_date >= dateFrom && r.report_date <= dateTo);
      if (viewMode === "analyst" && selectedAnalyst)             rows = rows.filter((r) => r.user_name    === selectedAnalyst);
      else if (viewMode === "team_leader" && selectedTeamLeader) rows = rows.filter((r) => r.manager_name === selectedTeamLeader);
      if (cancelled) return;

      setBillable(rows.reduce((s, r) => s + (r.billable_hours ?? 0), 0));
      setMeta(rows.reduce((s, r) => s + (r.skip_record ? 0 : Math.max(0, (r.expected_billable_hours ?? 0) - (r.discount_hours ?? 0))), 0));
      setMonthRawMeta(rows.reduce((s, r) => s + (r.skip_record ? 0 : (r.expected_billable_hours ?? 0)), 0));
      setMonthDiscountHours(rows.reduce((s, r) => s + (r.skip_record ? 0 : (r.discount_hours ?? 0)), 0));
      setMonthWorkdays(rows.filter((r) => !r.skip_record && (r.expected_billable_hours ?? 0) > 0).length);

      if (viewMode === "analyst") {
        setIsOnFerias(rows.some((r) => r.skip_record));
        setIsOnRampup(rows.some((r) => r.is_rampup));
      } else {
        setIsOnFerias(false);
        setIsOnRampup(false);
      }
    }

    fetchKpis();
    return () => { cancelled = true; };
  }, [selectedMonth, viewMode, selectedAnalyst, selectedTeamLeader, refreshKey]);

  return { billable, meta, monthRawMeta, monthDiscountHours, monthWorkdays, isOnFerias, isOnRampup };
}
