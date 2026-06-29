import { useMemo } from "react";
import { CalendarDays, Trophy, ArrowUp, ArrowDown } from "lucide-react";
import lucasMayerImg from "@/assets/lucas_mayer.png";
import rodrigoMarbaImg from "@/assets/rodrigo_marba.png";
import { useAuth } from "@/hooks/useAuth";
import { useDirectSalesContext } from "@/contexts/DirectSalesContext";
import { MONTH_NAMES } from "@/lib/directSalesUtils";
import {
  toMonthKeyStr,
  stripTetragram,
  getInitials,
  type SellerMetrics,
  type RawRow,
  type RankNeighbors,
  type MonthlyPoint,
  type QuarterMetrics,
} from "@/lib/desempenhoUtils";
import { UnifiedMetricsCard, QuarterMiniCard } from "./DesempenhoShared";

export function EmployeeView({
  sellers,
  rank,
  goatRank: _goatRank,
  selectedEmployeeId,
  allRaw,
  selectedMonth,
  rankNeighbors,
}: {
  sellers: SellerMetrics[];
  rank: number | null;
  goatRank: number | null;
  selectedEmployeeId: number | null;
  allRaw: RawRow[];
  selectedMonth: string;
  rankNeighbors: RankNeighbors | null;
}) {
  const { user, profile } = useAuth();
  const { dsUser, filterUserId } = useDirectSalesContext();

  const previewSeller = !filterUserId
    ? (selectedEmployeeId
      ? sellers.find((s) => s.userId === selectedEmployeeId) ?? sellers[0]
      : sellers[0])
    : null;

  const displayName = previewSeller
    ? previewSeller.name
    : (dsUser?.userName ? stripTetragram(dsUser.userName) : (user?.user_metadata?.full_name ?? ""));
  const _initials = getInitials(displayName || "U");
  const _avatarUrl = previewSeller ? null : (profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null);

  const currentSeller = previewSeller
    ?? (filterUserId != null ? sellers.find((s) => s.userId === filterUserId) : undefined)
    ?? sellers[0];

  const monthlyBarData = useMemo((): MonthlyPoint[] => {
    const targetUserId = currentSeller?.userId;
    if (!targetUserId) return [];

    const userRaw = allRaw.filter((r) => r.user_id === targetUserId);
    const byMonth = new Map<string, { mrr: number; nrr: number; commission: number }>();

    for (const r of userRaw) {
      const key = toMonthKeyStr(r.date_from ?? "");
      if (!byMonth.has(key)) byMonth.set(key, { mrr: 0, nrr: 0, commission: 0 });
      const entry = byMonth.get(key)!;
      const type = (r.plan_type ?? "").toUpperCase();
      const ach = Math.max(0, r.achieved ?? 0);
      if (type === "MRR") entry.mrr += ach;
      else if (type === "NRR") entry.nrr += ach;
      entry.commission += Math.max(0, r.commission ?? 0);
    }

    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, vals]) => ({
        key,
        month: MONTH_NAMES[parseInt(key.split("-")[1], 10) - 1]?.slice(0, 3) ?? key,
        ...vals,
        total: vals.mrr + vals.nrr,
      }))
      .slice(-4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRaw, currentSeller?.userId]);

  const { mrrStreak, nrrStreak } = useMemo(() => {
    const targetUserId = currentSeller?.userId;
    const year = selectedMonth.slice(0, 4);
    if (!targetUserId || !year) return { mrrStreak: 0, nrrStreak: 0 };

    const userYearRaw = allRaw.filter(
      (r) => r.user_id === targetUserId && (r.date_from ?? "").startsWith(year)
    );

    const byMonthType = new Map<string, { achieved: number; target: number }>();
    for (const r of userYearRaw) {
      if (r.skip_record) continue;
      const type = (r.plan_type ?? "").toUpperCase();
      if (type !== "MRR" && type !== "NRR") continue;
      const key = `${toMonthKeyStr(r.date_from ?? "")}_${type}`;
      if (!byMonthType.has(key)) byMonthType.set(key, { achieved: 0, target: 0 });
      const e = byMonthType.get(key)!;
      e.achieved += r.achieved ?? 0;
      e.target += r.target_amount ?? 0;
    }

    let mrr = 0;
    let nrr = 0;
    for (const [key, val] of byMonthType.entries()) {
      if (val.target <= 0 || val.achieved < val.target) continue;
      if (key.endsWith("_MRR")) mrr++;
      else nrr++;
    }
    return { mrrStreak: mrr, nrrStreak: nrr };
  }, [allRaw, currentSeller?.userId, selectedMonth]);

  const quarterlyData = useMemo((): QuarterMetrics[] => {
    const targetUserId = currentSeller?.userId;
    const year = selectedMonth.slice(0, 4);
    const quarters = {
      Q1: { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 },
      Q2: { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 },
      Q3: { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 },
      Q4: { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 },
    };
    if (targetUserId && year) {
      const userYearRaw = allRaw.filter(
        (r) => r.user_id === targetUserId && (r.date_from ?? "").startsWith(year)
      );
      for (const r of userYearRaw) {
        const month = parseInt((r.date_from ?? "").slice(5, 7), 10);
        const q = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
        const type = (r.plan_type ?? "").toUpperCase();
        const ach = Math.max(0, r.achieved ?? 0);
        const tgt = r.target_amount ?? 0;
        if (type === "MRR") { quarters[q].mrrAch += ach; quarters[q].mrrTgt += tgt; }
        else if (type === "NRR") { quarters[q].nrrAch += ach; quarters[q].nrrTgt += tgt; }
      }
    }
    return (["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
      const d = quarters[q];
      return {
        quarter: q,
        mrr: { achieved: d.mrrAch, target: d.mrrTgt, pct: d.mrrTgt > 0 ? (d.mrrAch / d.mrrTgt) * 100 : 0 },
        nrr: { achieved: d.nrrAch, target: d.nrrTgt, pct: d.nrrTgt > 0 ? (d.nrrAch / d.nrrTgt) * 100 : 0 },
        hasData: d.mrrAch > 0 || d.nrrAch > 0 || d.mrrTgt > 0 || d.nrrTgt > 0,
      };
    });
  }, [allRaw, currentSeller?.userId, selectedMonth]);

  // mrrStreak and nrrStreak are passed up via props in the original design;
  // keeping them computed here for future sidebar badge usage.
  void mrrStreak;
  void nrrStreak;

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.014)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
  };
  const topShine = "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.18) 50%, transparent 90%)";
  const innerGlow = "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-5 items-stretch min-h-[600px]">
        {/* ── Card principal ── */}
        <div className="flex-1 relative overflow-hidden rounded-2xl p-8 flex flex-col" style={cardStyle}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: topShine }} />
          <span className="pointer-events-none absolute inset-0" style={{ background: innerGlow }} />

          {currentSeller && (
            <UnifiedMetricsCard
              mrr={currentSeller.mrr}
              nrr={currentSeller.nrr}
              total={currentSeller.total}
              commission={currentSeller.total.commission}
              mrrCommission={currentSeller.mrr.commission}
              nrrCommission={currentSeller.nrr.commission}
              monthlyData={monthlyBarData}
              currentMonthKey={selectedMonth}
            />
          )}
        </div>

        {/* ── Card secundário: rank + trimestres ── */}
        <div className="w-[280px] shrink-0 relative overflow-hidden rounded-2xl flex flex-col overflow-y-auto" style={cardStyle}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px z-10" style={{ background: topShine }} />
          <span className="pointer-events-none absolute inset-0 z-0" style={{ background: innerGlow }} />

          {/* Rank */}
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
                    Você é a Maior Máquina de Vendas
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

          <div className="relative z-10 mx-4">
            <div className="h-px bg-white/8" />
            <div className="h-[3px] bg-gradient-to-b from-black/[0.04] to-transparent blur-[1px]" />
          </div>

          {/* Resumo trimestral */}
          <div className="relative z-10 flex flex-col gap-2.5 p-5 pt-4">
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <span className="text-[11px] uppercase tracking-[0.20em] text-muted-foreground/40 font-semibold">
                Resumo Anual
              </span>
            </div>
            {quarterlyData.map((q) => (
              <QuarterMiniCard key={q.quarter} data={q} />
            ))}
          </div>
        </div>
      </div>

      {/* Autor */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-[9px] text-muted-foreground/35 font-medium tracking-wider">Criado por:</span>
        <a href="https://www.linkedin.com/in/lucasmayer00" target="_blank" rel="noopener noreferrer" className="no-underline shrink-0">
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-white/10 backdrop-blur-sm transition-[opacity,transform] duration-150 hover:opacity-75 hover:scale-[1.04]"
            style={{ background: "rgba(228, 110, 120, 0.22)" }}
          >
            <img src={lucasMayerImg} alt="Lucas Mayer" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
            <span className="text-[8px] font-medium text-foreground/50 dark:text-white/50 whitespace-nowrap">Lucas Mayer</span>
          </div>
        </a>
        <a href="https://www.linkedin.com/in/rodrigomarba" target="_blank" rel="noopener noreferrer" className="no-underline shrink-0">
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-white/10 backdrop-blur-sm transition-[opacity,transform] duration-150 hover:opacity-75 hover:scale-[1.04]"
            style={{ background: "rgba(228, 169, 0, 0.18)" }}
          >
            <img src={rodrigoMarbaImg} alt="Rodrigo Marba" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
            <span className="text-[8px] font-medium text-foreground/50 dark:text-white/50 whitespace-nowrap">Rodrigo Marba</span>
          </div>
        </a>
      </div>
    </div>
  );
}
