import { useEffect, useState } from "react";
import { Users, CalendarDays } from "lucide-react";
import { useIsDark } from "@/hooks/useIsDark";
import { useBSAContext } from "@/contexts/BSAContext";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import type { BSAQuarterData } from "./BSAShared";
import { fmtH, fmt2 } from "./BSAShared";
import { BSAQuarterMiniCard } from "./BSAQuarterMiniCard";

export function TeamManagerRightPanel() {
  const isDark = useIsDark();
  const { viewMode, analysts, analystsByManager, selectedTeamLeader, selectedMonth } = useBSAContext();
  const analystCount = viewMode === "team_leader"
    ? (analystsByManager[selectedTeamLeader ?? ""] ?? []).length
    : analysts.length;

  const [feriasCount, setFeriasCount] = useState<number>(0);
  const [rampupCount, setRampupCount] = useState<number>(0);

  useEffect(() => {
    const isTeamLeader = viewMode === "team_leader" && !!selectedTeamLeader;
    const isManager    = viewMode === "manager";
    if (!isTeamLeader && !isManager) return;
    let cancelled = false;

    async function fetchCompositionCounts() {
      const [year, mon] = selectedMonth.split("-").map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      const dateFrom = `${selectedMonth}-01`;
      const dateTo   = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

      const allRows = await getDummyImplantacaoRows();
      let rows = allRows.filter((r) => r.report_date >= dateFrom && r.report_date <= dateTo);
      if (isTeamLeader) rows = rows.filter((r) => r.manager_name === selectedTeamLeader);

      if (cancelled) return;

      const feriasUsers = new Set(rows.filter((r) => r.skip_record).map((r) => r.user_name).filter(Boolean));
      const rampupUsers = new Set(rows.filter((r) => r.is_rampup).map((r) => r.user_name).filter(Boolean));

      setFeriasCount(feriasUsers.size);
      setRampupCount(rampupUsers.size);
    }

    fetchCompositionCounts();
    return () => { cancelled = true; };
  }, [viewMode, selectedTeamLeader, selectedMonth]);

  const [quarters, setQuarters] = useState<BSAQuarterData[]>([
    { quarter: "Q1", billable: 0, meta: 0, pct: 0, hasData: false },
    { quarter: "Q2", billable: 0, meta: 0, pct: 0, hasData: false },
    { quarter: "Q3", billable: 0, meta: 0, pct: 0, hasData: false },
    { quarter: "Q4", billable: 0, meta: 0, pct: 0, hasData: false },
  ]);

  useEffect(() => {
    const isTeamLeader = viewMode === "team_leader" && !!selectedTeamLeader;
    const isManager    = viewMode === "manager";
    if (!isTeamLeader && !isManager) return;
    let cancelled = false;

    async function fetchYearly() {
      const year = selectedMonth.split("-")[0];
      const allRows = await getDummyImplantacaoRows();
      let rows = allRows.filter((r) =>
        r.report_date >= `${year}-01-01` &&
        r.report_date <= `${year}-12-31`
      );
      if (isTeamLeader) rows = rows.filter((r) => r.manager_name === selectedTeamLeader);

      if (cancelled) return;

      const qDefs = [
        { quarter: "Q1" as const, months: [1, 2, 3] },
        { quarter: "Q2" as const, months: [4, 5, 6] },
        { quarter: "Q3" as const, months: [7, 8, 9] },
        { quarter: "Q4" as const, months: [10, 11, 12] },
      ];

      const results = qDefs.map(({ quarter, months }) => {
        const qRows = rows.filter((r) => {
          const m = parseInt(r.report_date.split("-")[1], 10);
          return months.includes(m);
        });
        const billable = qRows.reduce((s, r) => s + (r.billable_hours ?? 0), 0);
        const meta     = qRows.reduce((s, r) => s + (r.skip_record ? 0 : (r.expected_billable_hours ?? 0)), 0);
        return { quarter, billable, meta, pct: meta > 0 ? (billable / meta) * 100 : 0, hasData: qRows.length > 0 };
      });

      setQuarters(results);
    }

    fetchYearly();
    return () => { cancelled = true; };
  }, [viewMode, selectedTeamLeader, selectedMonth]);

  const cardStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.014)" : "rgba(255,255,255,0.58)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.06)",
    boxShadow: isDark
      ? "0 4px 20px rgba(0,0,0,0.14)"
      : "0 2px 14px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.80) inset",
  };
  const topShine  = "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.18) 50%, transparent 90%)";
  const innerGlow = "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)";
  const subColor  = isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)";

  return (
    <div className="w-[280px] shrink-0 relative overflow-hidden rounded-2xl flex flex-col" style={cardStyle}>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px z-10" style={{ background: topShine }} />
      <span className="pointer-events-none absolute inset-0 z-0" style={{ background: innerGlow }} />

      {/* Composição */}
      <div className="relative z-10 p-5 pb-4">
        <div className="flex items-center gap-1.5 mb-4">
          <Users className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span className="text-[9px] uppercase tracking-[0.20em] text-muted-foreground/40 font-semibold">
            Composição do Time
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-[32px] font-extrabold leading-none tabular-nums" style={{ color: subColor }}>
            {fmt2(analystCount)}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">analistas</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[18px] font-bold leading-none tabular-nums text-amber-500/70">{fmt2(rampupCount)}</span>
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">ramp-up</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[18px] font-bold leading-none tabular-nums text-sky-400/70">{fmt2(feriasCount)}</span>
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">férias</span>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div className="relative z-10 mx-5">
        <div className="h-px bg-white/10 dark:bg-white/10 bg-black/5" />
      </div>

      {/* Resumo anual */}
      <div className="relative z-10 flex items-center gap-1.5 px-5 pt-3 pb-1">
        <CalendarDays className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        <span className="text-[9px] uppercase tracking-[0.20em] text-muted-foreground/40 font-semibold">
          Resumo Anual
        </span>
      </div>
      <div className="relative z-10 flex flex-col gap-2.5 p-5 pt-3">
        {quarters.map((q) => (
          <BSAQuarterMiniCard key={q.quarter} data={q} />
        ))}
      </div>
    </div>
  );
}
