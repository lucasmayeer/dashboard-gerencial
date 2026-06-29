import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/data";
import {
  CalendarDays, Users, TrendingUp, Repeat2, BarChart2, Search, X, LayoutGrid, List, Info,
} from "lucide-react";
import lucasMayerImg from "@/assets/lucas_mayer.png";
import rodrigoMarbaImg from "@/assets/rodrigo_marba.png";
import { MRR_BADGE_STYLE, NRR_BADGE_STYLE } from "@/lib/directSalesUtils";
import {
  ZERO_PLAN, addPlan, combinePlan,
  aggregateSellers, aggregateTeams, aggregateCompany,
  sellerRankingScore, toMonthKeyStr, formatPct, pctColorDsm,
  extractTetragramFromName, stripTetragram, getInitials,
  type PlanMetrics, type SellerMetrics, type TeamMetrics, type RawRow, type QuarterMetrics,
} from "@/lib/desempenhoUtils";
import { useIsDark, TeamBadgeDsm, QuarterMiniCard } from "./DesempenhoShared";

// =============================================================================
// TEAM KPI CARD
// =============================================================================

export function TeamKpiCard({
  title, metrics, prevValue, nextValue, color, icon: Icon, breakdown,
}: {
  title: string;
  metrics: PlanMetrics;
  prevValue: number;
  nextValue: number;
  color: string;
  icon: React.ElementType;
  breakdown?: { production: number; rampup: number; vacation: number };
}) {
  const isDark = useIsDark();
  const isGoalMet = metrics.target > 0 && metrics.achieved >= metrics.target;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showBreakdown) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setShowBreakdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showBreakdown]);

  const varPrev = prevValue > 0 ? ((metrics.achieved - prevValue) / prevValue) * 100 : null;
  const varNext = nextValue > 0 ? ((metrics.achieved - nextValue) / nextValue) * 100 : null;

  const bg = isDark ? "rgba(255,255,255,0.030)" : "rgba(255,255,255,0.58)";
  const border = isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.06)";
  const shadow = isDark
    ? "0 2px 16px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset"
    : "0 2px 14px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.80) inset";
  const subColor = isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)";
  const numColor = isDark ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.85)";

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: bg, backdropFilter: "blur(22px) saturate(145%)", WebkitBackdropFilter: "blur(22px) saturate(145%)", border, boxShadow: shadow }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
        <span className="text-[10px] font-semibold text-muted-foreground/55 tracking-wide uppercase">{title}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p className="text-[26px] font-extrabold tabular-nums text-foreground leading-none">
            {formatCurrency(metrics.achieved)}
          </p>
          {breakdown && (
            <>
              <button
                ref={btnRef}
                onClick={() => setShowBreakdown((v) => !v)}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0,
                  color: showBreakdown ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                  transition: "color 0.15s",
                }}
              >
                <Info size={14} strokeWidth={2} />
              </button>
              {showBreakdown && btnRef.current && createPortal(
                <div
                  className="consistency-detail-card"
                  style={{
                    position: "fixed",
                    top: btnRef.current.getBoundingClientRect().bottom + 8,
                    left: btnRef.current.getBoundingClientRect().left,
                    width: 260, zIndex: 10005,
                    background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                    borderRadius: 12, padding: "14px 16px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: color, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Composição do total
                  </div>
                  {([
                    { label: "Em produção", value: breakdown.production, dot: isDark ? "#34d399" : "#059669" },
                    { label: "Ramp-Up", value: breakdown.rampup, dot: isDark ? "#fbbf24" : "#d97706" },
                    { label: "Férias", value: breakdown.vacation, dot: isDark ? "#60a5fa" : "#2563eb" },
                  ] as { label: string; value: number; dot: string }[]).map(({ label, value, dot }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: subColor, fontWeight: 500 }}>{label}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(value)}
                      </span>
                    </div>
                  ))}
                </div>,
                document.body
              )}
            </>
          )}
        </div>
        {metrics.target > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-muted-foreground/65 font-bold">
              Sua Meta: {formatCurrency(metrics.target)}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={isGoalMet
                  ? { background: "rgba(34,197,94,0.13)", border: "1px solid rgba(34,197,94,0.32)", color: "#22c55e" }
                  : { background: "rgba(228,169,0,0.13)", border: "1px solid rgba(228,169,0,0.32)", color: "#E4A900" }}
              >
                {isGoalMet ? "🎉 " : ""}{formatPct(metrics.pct)}
              </span>
              {!isGoalMet && metrics.target > metrics.achieved && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{ background: "rgba(113,75,103,0.18)", border: "1px solid rgba(113,75,103,0.35)", color: "#b87fa8" }}
                >
                  Falta {formatCurrency(metrics.target - metrics.achieved)}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[22px]" />
        )}
      </div>

      <div className="grid grid-cols-[1fr_1px_1fr] gap-0 pt-3 border-t border-border/15">
        <div className="flex flex-col gap-0.5 pr-3">
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">vs mês anterior</span>
          {varPrev !== null ? (
            <span className={cn("text-[15px] font-bold tabular-nums", varPrev >= 0 ? "text-emerald-500" : "text-red-400")}>
              {varPrev >= 0 ? "↑" : "↓"} {Math.abs(varPrev).toFixed(1)}%
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground/35 italic">sem dados</span>
          )}
        </div>
        <div className="bg-white/8 rounded-full" />
        <div className="flex flex-col gap-0.5 pl-3">
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">vs mês seguinte</span>
          {varNext !== null ? (
            <span className={cn("text-[15px] font-bold tabular-nums", varNext >= 0 ? "text-emerald-500" : "text-red-400")}>
              {varNext >= 0 ? "↑" : "↓"} {Math.abs(varNext).toFixed(1)}%
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground/35 italic">sem dados</span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SELLER TEAM CARD
// =============================================================================

export function SellerTeamCard({ seller, rank, showFullName, showTeamBadge, compactAvatar, showAnalyticsBtn, metricMode, avatarUrl, onAnalytics }: {
  seller: SellerMetrics;
  rank: number;
  showFullName?: boolean;
  showTeamBadge?: boolean;
  compactAvatar?: boolean;
  showAnalyticsBtn?: boolean;
  metricMode?: "acumulado" | "comissao";
  onAnalytics?: () => void;
  avatarUrl?: string | null;
}) {
  const isDark = useIsDark();
  const [imgErr, setImgErr] = useState(false);
  const displayName = showFullName ? seller.name : stripTetragram(seller.name);
  const initials = getInitials(stripTetragram(seller.name));
  const mrrPct = seller.mrr.target > 0 ? (seller.mrr.achieved / seller.mrr.target) * 100 : 0;
  const nrrPct = seller.nrr.target > 0 ? (seller.nrr.achieved / seller.nrr.target) * 100 : 0;

  const bg = isDark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.52)";
  const border = isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.06)";
  const shadow = isDark
    ? "0 2px 14px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.06) inset"
    : "0 2px 14px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.75) inset";

  const rankStyle =
    rank === 1 ? { bg: "rgba(234,179,8,0.18)", border: "rgba(234,179,8,0.45)", text: "#EAB308" }
      : rank === 2 ? { bg: "rgba(192,200,212,0.14)", border: "rgba(192,200,212,0.38)", text: "#C0C8D4" }
        : rank === 3 ? { bg: "rgba(180,83,9,0.14)", border: "rgba(180,83,9,0.38)", text: "#CD9B6A" }
          : null;

  return (
    <div
      className="relative rounded-2xl p-5 flex flex-col gap-3 overflow-hidden"
      style={{ background: bg, backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)", border, boxShadow: shadow }}
    >
      <div className="absolute top-3 left-3">
        {rankStyle ? (
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: rankStyle.bg, border: `1px solid ${rankStyle.border}`, color: rankStyle.text }}
          >
            #{rank}
          </span>
        ) : (
          <span className="text-[10px] font-bold text-muted-foreground/28">#{rank}</span>
        )}
      </div>

      {seller.status !== "ativo" && (
        <div className="absolute top-3 right-3">
          {seller.status === "férias" && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
              style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.30)", color: "#38bdf8" }}
            >
              🌴 Férias
            </span>
          )}
          {seller.status === "ramp-up" && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.30)", color: "#60a5fa" }}
            >
              🚀 Ramp-up
            </span>
          )}
          {seller.status === "inativo" && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
            >
              ✕ Inativo
            </span>
          )}
        </div>
      )}

      <div className={cn("flex justify-center", compactAvatar ? "pt-1" : "pt-3")}>
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-bold shrink-0 overflow-hidden",
            compactAvatar ? "h-[36px] w-[36px] text-[11px]" : "h-[56px] w-[56px] text-[15px]"
          )}
          style={{ background: "rgba(113,75,103,0.22)", color: "#b87fa8", border: "1.5px solid rgba(113,75,103,0.38)", boxShadow: "0 0 14px rgba(113,75,103,0.22)" }}
        >
          {avatarUrl && !imgErr ? (
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" onError={() => setImgErr(true)} />
          ) : initials}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-[12px] font-bold text-foreground leading-tight text-center line-clamp-2 px-1">{displayName}</p>
        {showTeamBadge && seller.teamName && <TeamBadgeDsm teamName={seller.teamName} />}
      </div>

      <div className="text-center">
        <p className="text-[9px] text-muted-foreground/40 font-medium tracking-wide uppercase">
          {metricMode === "comissao" ? "Comissão" : "Total acumulado"}
        </p>
        <p className="text-[18px] font-extrabold tabular-nums text-foreground leading-tight">
          {formatCurrency(metricMode === "comissao" ? seller.total.commission : seller.total.achieved)}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_1px_1fr] gap-0 pt-2.5 border-t border-border/15">
        <div className="flex flex-col items-center gap-1 pr-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase"
            style={{ background: "rgba(113,75,103,0.18)", border: "1px solid rgba(113,75,103,0.40)", color: "#b87fa8" }}
          >
            MRR
          </span>
          <span className="text-[12px] font-bold tabular-nums text-foreground/75">{formatCurrency(seller.mrr.achieved)}</span>
          {seller.mrr.target > 0
            ? <span className={cn("text-[11px] font-bold tabular-nums", pctColorDsm(mrrPct))}>{Math.round(mrrPct)}%{mrrPct >= 100 ? " 🎉" : ""}</span>
            : <span className="text-[11px] text-muted-foreground/22">—</span>}
        </div>
        <div className="bg-border/20 rounded-full" />
        <div className="flex flex-col items-center gap-1 pl-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase"
            style={{ background: "rgba(1,126,132,0.16)", border: "1px solid rgba(1,126,132,0.38)", color: "#0fb8c0" }}
          >
            NRR
          </span>
          <span className="text-[12px] font-bold tabular-nums text-foreground/75">{formatCurrency(seller.nrr.achieved)}</span>
          {seller.nrr.target > 0
            ? <span className={cn("text-[11px] font-bold tabular-nums", pctColorDsm(nrrPct))}>{Math.round(nrrPct)}%{nrrPct >= 100 ? " 🎉" : ""}</span>
            : <span className="text-[11px] text-muted-foreground/22">—</span>}
        </div>
      </div>

      {showAnalyticsBtn && (
        <div className="mt-auto pt-1 border-t border-border/10">
          <button
            onClick={onAnalytics}
            className="glass-button w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: isDark ? "rgba(1,126,132,0.10)" : "rgba(1,126,132,0.07)",
              border: isDark ? "1px solid rgba(1,126,132,0.28)" : "1px solid rgba(1,126,132,0.13)",
              color: isDark ? "#2dd4bf" : "#017E84",
              backdropFilter: "blur(14px) saturate(1.4)",
              WebkitBackdropFilter: "blur(14px) saturate(1.4)",
              boxShadow: isDark
                ? "0 2px 12px rgba(1,126,132,0.15), 0 1px 0 rgba(255,255,255,0.08) inset"
                : "0 1px 6px rgba(1,126,132,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
            }}
          >
            <BarChart2 className="h-3 w-3 shrink-0" />
            Analytics
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SELLER TEAM ROW (layout lista)
// =============================================================================

export function SellerTeamRow({ seller, rank, metricMode, showTeamBadge = true, avatarUrl, onAnalytics }: {
  seller: SellerMetrics;
  rank: number;
  metricMode?: "acumulado" | "comissao";
  showTeamBadge?: boolean;
  avatarUrl?: string | null;
  onAnalytics?: () => void;
}) {
  const isDark = useIsDark();
  const [imgErr, setImgErr] = useState(false);
  const initials = getInitials(stripTetragram(seller.name));
  const mrrPct = seller.mrr.target > 0 ? (seller.mrr.achieved / seller.mrr.target) * 100 : 0;
  const nrrPct = seller.nrr.target > 0 ? (seller.nrr.achieved / seller.nrr.target) * 100 : 0;

  const rankStyle =
    rank === 1 ? { bg: "rgba(234,179,8,0.18)", border: "rgba(234,179,8,0.45)", text: "#EAB308" }
      : rank === 2 ? { bg: "rgba(192,200,212,0.14)", border: "rgba(192,200,212,0.38)", text: "#C0C8D4" }
        : rank === 3 ? { bg: "rgba(180,83,9,0.14)", border: "rgba(180,83,9,0.38)", text: "#CD9B6A" }
          : null;

  return (
    <div className="glass-card rounded-xl px-3 py-2 flex items-center gap-3">
      <span className="shrink-0 w-7 text-center">
        {rankStyle ? (
          <span
            className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: rankStyle.bg, border: `1px solid ${rankStyle.border}`, color: rankStyle.text }}
          >
            #{rank}
          </span>
        ) : (
          <span className="text-[9px] font-bold text-muted-foreground/28">#{rank}</span>
        )}
      </span>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="h-[24px] w-[24px] rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 overflow-hidden"
          style={{ background: "rgba(1,126,132,0.18)", color: "#2dd4bf", border: "1.5px solid rgba(1,126,132,0.35)" }}
        >
          {avatarUrl && !imgErr ? (
            <img src={avatarUrl} alt={stripTetragram(seller.name)} className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" onError={() => setImgErr(true)} />
          ) : initials}
        </div>
        <span className="text-[11px] font-semibold text-foreground truncate">{stripTetragram(seller.name)}</span>
        {showTeamBadge && seller.teamName && <TeamBadgeDsm teamName={seller.teamName} small />}
        {seller.status === "férias" && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-semibold shrink-0"
            style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.30)", color: "#38bdf8" }}
          >
            🌴 Férias
          </span>
        )}
        {seller.status === "ramp-up" && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-semibold shrink-0"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.30)", color: "#60a5fa" }}
          >
            🚀 Ramp-up
          </span>
        )}
        {seller.status === "inativo" && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-semibold shrink-0"
            style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
          >
            ✕ Inativo
          </span>
        )}
      </div>

      <span className="text-muted-foreground/20 self-center">|</span>

      <div className="flex flex-col items-center gap-0 w-[100px] shrink-0">
        <span className="text-[7px] uppercase tracking-wider text-muted-foreground/40 font-medium">
          {metricMode === "comissao" ? "Comissão" : "Total"}
        </span>
        <span className="text-[11px] font-extrabold tabular-nums text-foreground">
          {formatCurrency(metricMode === "comissao" ? seller.total.commission : seller.total.achieved)}
        </span>
      </div>

      <span className="text-muted-foreground/20 self-center">|</span>

      <div className="flex items-center justify-center gap-1 w-[155px] shrink-0">
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase shrink-0" style={MRR_BADGE_STYLE}>MRR</span>
        <span className="text-[9px] font-bold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="text-foreground/75">{formatCurrency(seller.mrr.achieved)}</span>
          {seller.mrr.target > 0
            ? <span className={cn(pctColorDsm(mrrPct))}> ({Math.round(mrrPct)}%{mrrPct >= 100 ? " 🎉" : ""})</span>
            : <span className="text-muted-foreground/22"> (—)</span>}
        </span>
      </div>

      <span className="text-muted-foreground/20 self-center">|</span>

      <div className="flex items-center justify-center gap-1 w-[155px] shrink-0">
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase shrink-0" style={NRR_BADGE_STYLE}>NRR</span>
        <span className="text-[9px] font-bold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="text-foreground/75">{formatCurrency(seller.nrr.achieved)}</span>
          {seller.nrr.target > 0
            ? <span className={cn(pctColorDsm(nrrPct))}> ({Math.round(nrrPct)}%{nrrPct >= 100 ? " 🎉" : ""})</span>
            : <span className="text-muted-foreground/22"> (—)</span>}
        </span>
      </div>

      <button
        onClick={onAnalytics}
        className="shrink-0 glass-button flex items-center justify-center h-[26px] w-[26px] rounded-lg transition-all hover:scale-[1.05] active:scale-[0.97]"
        style={{
          background: isDark ? "rgba(1,126,132,0.10)" : "rgba(1,126,132,0.07)",
          border: isDark ? "1px solid rgba(1,126,132,0.28)" : "1px solid rgba(1,126,132,0.13)",
          color: isDark ? "#2dd4bf" : "#017E84",
        }}
      >
        <BarChart2 className="h-3 w-3 shrink-0" />
      </button>
    </div>
  );
}

// =============================================================================
// TEAM COMPOSITION STRIP
// =============================================================================

export function TeamCompositionStrip({ sellers }: { sellers: SellerMetrics[] }) {
  const rampUp = sellers.filter((s) => s.status === "ramp-up");
  const vacation = sellers.filter((s) => s.status === "férias");

  return (
    <div className="relative z-10 px-5 pt-5 pb-4">
      <div className="flex items-center gap-1.5 mb-4">
        <Users className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        <span className="text-[9px] uppercase tracking-[0.20em] text-muted-foreground/40 font-semibold">
          Composição do Time
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-[32px] font-bold tabular-nums leading-none text-foreground/85">
          {String(sellers.length).padStart(2, "0")}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/40 font-semibold">
          vendedores
        </span>
      </div>

      <div className="grid grid-cols-[1fr_1px_1fr] gap-0">
        <div className="flex flex-col gap-1.5 pr-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: "#E4A900" }}>
              {String(rampUp.length).padStart(2, "0")}
            </span>
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">Ramp-up</span>
          </div>
          {rampUp.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {rampUp.map((s) => (
                <span
                  key={s.name}
                  className="text-[7px] font-bold px-1.5 py-px rounded-full uppercase tracking-wide"
                  style={{ background: "rgba(228,169,0,0.14)", color: "#E4A900", border: "1px solid rgba(228,169,0,0.30)" }}
                >
                  {extractTetragramFromName(s.name)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/8 rounded-full" />

        <div className="flex flex-col gap-1.5 pl-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: "#5B899E" }}>
              {String(vacation.length).padStart(2, "0")}
            </span>
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">Férias</span>
          </div>
          {vacation.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {vacation.map((s) => (
                <span
                  key={s.name}
                  className="text-[7px] font-bold px-1.5 py-px rounded-full uppercase tracking-wide"
                  style={{ background: "rgba(91,137,158,0.14)", color: "#5B899E", border: "1px solid rgba(91,137,158,0.30)" }}
                >
                  {extractTetragramFromName(s.name)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}


// =============================================================================
// TEAM LEADER VIEW
// =============================================================================

export function TeamLeaderView({ teams, allRaw, selectedMonth, avatarMap = new Map(), onSellerAnalytics }: {
  teams: TeamMetrics[];
  allRaw: RawRow[];
  selectedMonth: string;
  avatarMap?: Map<string, string>;
  onSellerAnalytics?: (seller: SellerMetrics) => void;
}) {
  const isDark = useIsDark();
  const [typeFilter, setTypeFilter] = useState<"Ambos" | "MRR" | "NRR">("Ambos");
  const [metricMode] = useState<"acumulado" | "comissao">("acumulado");
  const [layoutMode, setLayoutMode] = useState<"card" | "lista">("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const teamMetrics = useMemo(() => {
    let mrr = { ...ZERO_PLAN };
    let nrr = { ...ZERO_PLAN };
    for (const t of teams) {
      mrr = addPlan(mrr, t.mrr);
      nrr = addPlan(nrr, t.nrr);
    }
    return { mrr, nrr, total: combinePlan(mrr, nrr) };
  }, [teams]);

  const { prevMonth, nextMonth } = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      prevMonth: fmt(new Date(y, m - 2, 1)),
      nextMonth: fmt(new Date(y, m, 1)),
    };
  }, [selectedMonth]);

  const prevMetrics = useMemo(() => {
    const rows = allRaw.filter((r) => toMonthKeyStr(r.date_from ?? "") === prevMonth);
    return aggregateCompany(aggregateTeams(aggregateSellers(rows)));
  }, [allRaw, prevMonth]);

  const nextMetrics = useMemo(() => {
    const rows = allRaw.filter((r) => toMonthKeyStr(r.date_from ?? "") === nextMonth);
    return aggregateCompany(aggregateTeams(aggregateSellers(rows)));
  }, [allRaw, nextMonth]);

  const allSellers = useMemo(() => teams.flatMap((t) => t.sellers), [teams]);

  const sortedSellers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...allSellers];
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
    if (typeFilter === "MRR") return list.sort((a, b) => b.mrr.achieved - a.mrr.achieved);
    if (typeFilter === "NRR") return list.sort((a, b) => b.nrr.achieved - a.nrr.achieved);
    return list.sort((a, b) => sellerRankingScore(b.mrr.pct, b.nrr.pct) - sellerRankingScore(a.mrr.pct, a.nrr.pct));
  }, [allSellers, typeFilter, searchQuery]);

  const quarterlyData = useMemo((): QuarterMetrics[] => {
    const year = selectedMonth.slice(0, 4);
    const quarters = {
      Q1: { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 },
      Q2: { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 },
      Q3: { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 },
      Q4: { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 },
    };
    const yearRows = allRaw.filter(
      (r) => (r.date_from ?? "").startsWith(year)    );
    for (const r of yearRows) {
      const month = parseInt((r.date_from ?? "").slice(5, 7), 10);
      const q = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
      const type = (r.plan_type ?? "").toUpperCase();
      const ach = Math.max(0, r.achieved ?? 0);
      const tgt = r.target_amount ?? 0;
      if (type === "MRR") {
        quarters[q].mrrAch += ach;
        if (!r.skip_record) quarters[q].mrrTgt += tgt;
      } else if (type === "NRR") {
        quarters[q].nrrAch += ach;
        if (!r.skip_record) quarters[q].nrrTgt += tgt;
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
  }, [allRaw, selectedMonth]);

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.014)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
  };
  const topShine = "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.18) 50%, transparent 90%)";
  const innerGlow = "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)";

  if (!teams.length) return null;

  return (
    <>
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-6">

          <div className="grid grid-cols-3 gap-4">
            <TeamKpiCard
              title="Desempenho do time no Mês"
              metrics={teamMetrics.total}
              prevValue={prevMetrics.total.achieved}
              nextValue={nextMetrics.total.achieved}
              color="#5B899E"
              icon={TrendingUp}
            />
            <TeamKpiCard
              title="MRR do time"
              metrics={teamMetrics.mrr}
              prevValue={prevMetrics.mrr.achieved}
              nextValue={nextMetrics.mrr.achieved}
              color="#714B67"
              icon={Repeat2}
            />
            <TeamKpiCard
              title="NRR do time"
              metrics={teamMetrics.nrr}
              prevValue={prevMetrics.nrr.achieved}
              nextValue={nextMetrics.nrr.achieved}
              color="#017E84"
              icon={BarChart2}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground/45 uppercase tracking-[0.18em]">
                Funcionários do time
              </span>
              <div className="flex rounded-lg overflow-hidden glass-card p-0.5 ml-1">
                {(["card", "lista"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setLayoutMode(opt)}
                    className={cn(
                      "px-1.5 py-1 rounded-md transition-all flex items-center justify-center",
                      layoutMode === opt ? "glass-button-active" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt === "card"
                      ? <LayoutGrid className="h-3 w-3 shrink-0" />
                      : <List className="h-3 w-3 shrink-0" />
                    }
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] text-muted-foreground/35 font-medium">Ordenar por:</span>
                <div className="flex rounded-lg overflow-hidden glass-card p-0.5">
                  {(["Ambos", "MRR", "NRR"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                        "px-2 py-1 text-[10px] font-medium rounded-md transition-all",
                        typeFilter === t ? "glass-button-active" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {!searchOpen ? (
                <button
                  onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                  className="h-[26px] w-[26px] rounded-full glass-card flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-all hover:scale-105 shrink-0"
                >
                  <Search className="h-3 w-3 shrink-0" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 glass-card rounded-full px-2.5 h-[26px] w-[180px] transition-all">
                  <Search className="h-3 w-3 text-muted-foreground/35 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar vendedor…"
                    className="flex-1 bg-transparent outline-none border-none text-[10px] font-medium text-foreground placeholder:text-muted-foreground/30 min-w-0"
                  />
                  <button
                    onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                    className="flex items-center justify-center text-muted-foreground/35 hover:text-foreground transition-colors shrink-0"
                  >
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {layoutMode === "card" ? (
            <div className="grid grid-cols-4 gap-4">
              {sortedSellers.map((seller, i) => (
                <SellerTeamCard key={seller.userId ?? seller.name} seller={seller} rank={i + 1} metricMode={metricMode} showAnalyticsBtn avatarUrl={avatarMap.get(seller.name)} onAnalytics={onSellerAnalytics ? () => onSellerAnalytics(seller) : undefined} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedSellers.map((seller, i) => (
                <SellerTeamRow key={seller.userId ?? seller.name} seller={seller} rank={i + 1} metricMode={metricMode} showTeamBadge={false} avatarUrl={avatarMap.get(seller.name)} onAnalytics={onSellerAnalytics ? () => onSellerAnalytics(seller) : undefined} />
              ))}
            </div>
          )}
        </div>

        <div className="w-[280px] shrink-0 relative overflow-hidden rounded-2xl flex flex-col" style={cardStyle}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px z-10" style={{ background: topShine }} />
          <span className="pointer-events-none absolute inset-0 z-0" style={{ background: innerGlow }} />

          <TeamCompositionStrip sellers={allSellers} />

          <div className="relative z-10 flex items-center gap-1.5 px-5 pt-2 pb-1">
            <CalendarDays className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[9px] uppercase tracking-[0.20em] text-muted-foreground/40 font-semibold">
              Resumo Anual do Time
            </span>
          </div>

          <div className="relative z-10 flex flex-col gap-2.5 p-5 pt-3">
            {quarterlyData.map((q) => (
              <QuarterMiniCard key={q.quarter} data={q} />
            ))}
          </div>
        </div>
      </div>


      <div className="flex items-center justify-end gap-2 mt-4">
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
    </>
  );
}
