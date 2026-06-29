import { useMemo } from "react";
import { toMonthKeyStr, type RawRow, type SellerMetrics } from "@/lib/desempenhoUtils";
import { MONTH_NAMES } from "@/lib/directSalesUtils";

export interface MonthEntry {
  monthKey: string;
  label: string;
  mrrAchieved: number;
  mrrTarget: number;
  mrrPct: number;
  nrrAchieved: number;
  nrrTarget: number;
  nrrPct: number;
  commission: number;
  mrrCommission: number;
  nrrCommission: number;
  hasTarget: boolean;
  isVacation: boolean;
  isRampUp: boolean;
  teamType: string | null;
  teamName: string | null;
}

export function useEmployeeAnalytics(
  allRaw: RawRow[] | undefined | null,
  seller: SellerMetrics | null | undefined,
  selectedMonth: string | null | undefined,
) {
  const monthlyHistory = useMemo((): MonthEntry[] => {
    if (!allRaw || !seller?.userId) return [];
    const year = (selectedMonth ?? "").slice(0, 4);
    const userRaw = allRaw.filter(
      (r) => r.user_id === seller.userId && (r.date_from ?? "").startsWith(year)
    );

    const byMonth = new Map<string, {
      mrrAch: number; mrrTgt: number;
      nrrAch: number; nrrTgt: number;
      commission: number; mrrCom: number; nrrCom: number;
      hasTarget: boolean; isVacation: boolean; isRampUp: boolean;
      teamType: string | null; teamName: string | null;
    }>();

    for (const r of userRaw) {
      const key = toMonthKeyStr(r.date_from ?? "");
      if (!key) continue;
      if (!byMonth.has(key)) byMonth.set(key, { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0, commission: 0, mrrCom: 0, nrrCom: 0, hasTarget: false, isVacation: false, isRampUp: false, teamType: null, teamName: null });
      const e = byMonth.get(key)!;

      const skipRecord = r.skip_record ?? false;
      const planName = (r.plan_name ?? "").toUpperCase();
      const isRampUp = planName.startsWith("[RAMP-UP]");
      const isActive = r.active !== false;
      const isFeriasOrRampUp = skipRecord && isActive;

      const ach = Math.max(0, r.achieved ?? 0);
      const tgt = r.target_amount ?? 0;
      const com = Math.max(0, r.commission ?? 0);
      const type = (r.plan_type ?? "").toUpperCase();

      if (r.team_type) e.teamType = r.team_type;
      if (r.team_name) e.teamName = r.team_name;
      if (!isFeriasOrRampUp && tgt > 0) e.hasTarget = true;
      if (isFeriasOrRampUp && !isRampUp) e.isVacation = true;
      if (isRampUp) e.isRampUp = true;

      const addAch = ach;
      const addTgt = isFeriasOrRampUp || isRampUp ? 0 : tgt;

      if (type === "MRR") { e.mrrAch += addAch; e.mrrTgt += addTgt; e.mrrCom += com; }
      else if (type === "NRR") { e.nrrAch += addAch; e.nrrTgt += addTgt; e.nrrCom += com; }
      e.commission += com;
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const monthIdx = parseInt(key.split("-")[1], 10) - 1;
        return {
          monthKey: key,
          label: MONTH_NAMES[monthIdx]?.slice(0, 3) ?? key,
          mrrAchieved: v.mrrAch,
          mrrTarget: v.mrrTgt,
          mrrPct: v.mrrTgt > 0 ? (v.mrrAch / v.mrrTgt) * 100 : 0,
          nrrAchieved: v.nrrAch,
          nrrTarget: v.nrrTgt,
          nrrPct: v.nrrTgt > 0 ? (v.nrrAch / v.nrrTgt) * 100 : 0,
          commission: v.commission,
          mrrCommission: v.mrrCom,
          nrrCommission: v.nrrCom,
          hasTarget: v.hasTarget,
          isVacation: v.isVacation,
          isRampUp: v.isRampUp,
          teamType: v.teamType,
          teamName: v.teamName,
        };
      });
  }, [allRaw, seller?.userId, selectedMonth]);

  const chartData = useMemo(
    () => monthlyHistory.filter((m) => m.mrrAchieved > 0 || m.nrrAchieved > 0 || m.mrrTarget > 0 || m.nrrTarget > 0),
    [monthlyHistory],
  );

  const chartYTicks = useMemo(() => {
    if (!chartData.length) return [65, 130, 195, 260];
    const dataMax = Math.max(...chartData.map((d) => Math.max(d.mrrPct, d.nrrPct)));
    const top = Math.max(120, Math.ceil(dataMax / 20) * 20);
    const step = Math.ceil(top / 4 / 10) * 10;
    return [step, step * 2, step * 3, step * 4].filter((t) => t <= top + step);
  }, [chartData]);

  const ytd = useMemo(() => {
    const months = chartData;
    const mrrAch = months.reduce((s, m) => s + m.mrrAchieved, 0);
    const mrrTgt = months.reduce((s, m) => s + m.mrrTarget, 0);
    const nrrAch = months.reduce((s, m) => s + m.nrrAchieved, 0);
    const nrrTgt = months.reduce((s, m) => s + m.nrrTarget, 0);
    const totalCommission = months.reduce((s, m) => s + m.commission, 0);
    const mrrCommission = months.reduce((s, m) => s + m.mrrCommission, 0);
    const nrrCommission = months.reduce((s, m) => s + m.nrrCommission, 0);
    const bestCommissionMonth = months.reduce<MonthEntry | null>(
      (best, m) => (!best || m.commission > best.commission ? m : best), null
    );
    const monthsWithTarget = months.filter((m) => m.hasTarget && m.mrrTarget > 0);
    const monthsWithTargetActive = monthsWithTarget.filter((m) => !m.isVacation && !m.isRampUp);
    const bestMrrMonth = monthsWithTarget.reduce<MonthEntry | null>(
      (best, m) => (!best || m.mrrAchieved > best.mrrAchieved ? m : best), null
    );
    const worstMrrMonth = monthsWithTargetActive.length > 1
      ? monthsWithTargetActive.reduce<MonthEntry | null>(
          (worst, m) => (!worst || m.mrrAchieved < worst.mrrAchieved ? m : worst), null
        )
      : null;
    const avgMrr = months.length > 0 ? mrrAch / months.length : 0;
    const avgMrrPct = mrrTgt > 0 ? (mrrAch / mrrTgt) * 100 : 0;

    const monthsWithNrrTarget = months.filter((m) => m.hasTarget && m.nrrTarget > 0);
    const monthsWithNrrTargetActive = monthsWithNrrTarget.filter((m) => !m.isVacation && !m.isRampUp);
    const bestNrrMonth = monthsWithNrrTarget.reduce<MonthEntry | null>(
      (best, m) => (!best || m.nrrAchieved > best.nrrAchieved ? m : best), null
    );
    const worstNrrMonth = monthsWithNrrTargetActive.length > 1
      ? monthsWithNrrTargetActive.reduce<MonthEntry | null>(
          (worst, m) => (!worst || m.nrrAchieved < worst.nrrAchieved ? m : worst), null
        )
      : null;
    const avgNrr = months.length > 0 ? nrrAch / months.length : 0;

    return {
      mrrAch, mrrTgt, mrrPct: avgMrrPct,
      nrrAch, nrrTgt, nrrPct: nrrTgt > 0 ? (nrrAch / nrrTgt) * 100 : 0,
      totalCommission, mrrCommission, nrrCommission, bestCommissionMonth,
      bestMrrMonth, worstMrrMonth, avgMrr,
      bestNrrMonth, worstNrrMonth, avgNrr,
      monthCount: months.length,
    };
  }, [chartData]);

  return { monthlyHistory, chartData, chartYTicks, ytd };
}
