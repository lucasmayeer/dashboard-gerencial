import { useEffect, useState } from "react";
import { Trophy, ArrowUp, ArrowDown, CalendarDays } from "lucide-react";
import { useIsDark } from "@/hooks/useIsDark";
import { useBSAContext } from "@/contexts/BSAContext";
import { stripTetragram } from "@/lib/desempenhoUtils";
import type { RankNeighbors } from "@/lib/desempenhoUtils";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import type { BSAQuarterData } from "./BSAShared";
import { QUARTER_MONTHS, fmtH } from "./BSAShared";
import { BSAQuarterMiniCard } from "./BSAQuarterMiniCard";

export function AnalystRightPanel({
  rank, rankNeighbors,
}: {
  rank: number | null;
  rankNeighbors: RankNeighbors | null;
}) {
  const isDark = useIsDark();
  const { selectedAnalyst, selectedMonth } = useBSAContext();
  const [quarters, setQuarters] = useState<BSAQuarterData[]>([
    { quarter: "Q1", billable: 0, meta: 0, pct: 0, hasData: false },
    { quarter: "Q2", billable: 0, meta: 0, pct: 0, hasData: false },
    { quarter: "Q3", billable: 0, meta: 0, pct: 0, hasData: false },
    { quarter: "Q4", billable: 0, meta: 0, pct: 0, hasData: false },
  ]);

  useEffect(() => {
    if (!selectedAnalyst) return;
    let cancelled = false;

    async function fetchYearly() {
      const year = selectedMonth.split("-")[0];
      const allRows = await getDummyImplantacaoRows();
      const rows = allRows.filter((r) =>
        r.user_name === selectedAnalyst &&
        r.report_date >= `${year}-01-01` &&
        r.report_date <= `${year}-12-31`
      );

      if (cancelled) return;

      const result = (["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
        const months = QUARTER_MONTHS[q];
        const qRows = rows.filter((r) => {
          const m = parseInt(r.report_date.split("-")[1], 10);
          return months.includes(m);
        });
        const billable = qRows.reduce((s, r) => s + (r.billable_hours ?? 0), 0);
        const meta     = qRows.reduce((s, r) => s + (r.skip_record ? 0 : (r.expected_billable_hours ?? 0)), 0);
        const hasData  = qRows.length > 0;
        return { quarter: q, billable, meta, pct: meta > 0 ? (billable / meta) * 100 : 0, hasData };
      });

      setQuarters(result);
    }

    fetchYearly();
    return () => { cancelled = true; };
  }, [selectedAnalyst, selectedMonth]);

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

  return (
    <div className="w-[280px] shrink-0 relative overflow-hidden rounded-2xl flex flex-col overflow-y-auto" style={cardStyle}>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px z-10" style={{ background: topShine }} />
      <span className="pointer-events-none absolute inset-0 z-0" style={{ background: innerGlow }} />

      {/* Ranking */}
      <div className="relative z-10 flex flex-col gap-3 p-5 pb-4">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span className="text-[11px] uppercase tracking-[0.20em] text-muted-foreground/40 font-semibold">
            Posição no Ranking
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5 py-2">
          <span
            className="text-[51px] font-black tabular-nums leading-none"
            style={{
              color: rank !== null && rank <= 3 ? "#E4A900" : "hsl(var(--foreground))",
              textShadow: rank !== null && rank <= 3 ? "0 0 24px rgba(228,169,0,0.35)" : undefined,
            }}
          >
            {rank !== null ? `#${rank}` : "—"}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_1px_1fr] gap-0 mt-1">
          <div className="flex flex-col items-center gap-1 pr-3">
            <div className="flex items-center gap-1 text-muted-foreground/35">
              <ArrowUp className="h-2.5 w-2.5 shrink-0" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">acima</span>
            </div>
            {rankNeighbors?.above ? (
              <span className="text-[12px] font-semibold text-foreground/60 text-center leading-tight">
                {stripTetragram(rankNeighbors.above.name)}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-center leading-tight" style={{ color: "#E4A900" }}>
                Você é o Melhor!
              </span>
            )}
          </div>

          <div className="h-full bg-white/8 rounded-full" />

          <div className="flex flex-col items-center gap-1 pl-3">
            <div className="flex items-center gap-1 text-muted-foreground/35">
              <ArrowDown className="h-2.5 w-2.5 shrink-0" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">abaixo</span>
            </div>
            {rankNeighbors?.below ? (
              <span className="text-[12px] font-semibold text-foreground/60 text-center leading-tight">
                {stripTetragram(rankNeighbors.below.name)}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/20 italic text-center">último lugar</span>
            )}
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div className="relative z-10 mx-4">
        <div className="h-px bg-white/8" />
        <div className="h-[3px] bg-gradient-to-b from-black/[0.04] to-transparent blur-[1px]" />
      </div>

      {/* Resumo anual */}
      <div className="relative z-10 flex flex-col gap-2.5 p-5 pt-4">
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarDays className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span className="text-[11px] uppercase tracking-[0.20em] text-muted-foreground/40 font-semibold">
            Resumo Anual
          </span>
        </div>
        {quarters.map((q) => (
          <BSAQuarterMiniCard key={q.quarter} data={q} />
        ))}
      </div>
    </div>
  );
}
