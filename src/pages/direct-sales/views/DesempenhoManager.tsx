import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/data";
import lucasMayerImg from "@/assets/lucas_mayer.png";
import rodrigoMarbaImg from "@/assets/rodrigo_marba.png";
import {
  CalendarDays, TrendingUp, Users, User, Repeat2, BarChart2,
  Search, X, ArrowUp, ArrowDown, Info, LayoutGrid, List,
} from "lucide-react";
import { computeTlCommission, type TlCommissionResult, type TlMultiplierRow } from "@/lib/tlUtils";
import {
  MRR_BADGE_COLOR, MRR_BADGE_STYLE,
  NRR_BADGE_COLOR, NRR_BADGE_STYLE,
} from "@/lib/directSalesUtils";
import {
  aggregateCompany,
  aggregateSellers,
  aggregateTeams,
  getInitials,
  getRowStatus,
  pctColorDsm,
  sellerRankingScore,
  stripTetragram,
  toMonthKeyStr,
} from "@/lib/desempenhoUtils";
import type { PlanMetrics, QuarterMetrics, SellerMetrics, TeamMetrics } from "@/lib/desempenhoUtils";
import type { RawRow } from "@/lib/desempenhoUtils";
import { useIsDark, getLeaderPhotoByName, QuarterMiniCard, TeamBadgeDsm } from "./DesempenhoShared";
import { TeamKpiCard, SellerTeamCard, SellerTeamRow, TeamCompositionStrip } from "./DesempenhoTeamLeader";
import { PainelDoGestor } from "./manager/PainelDoGestor";

// =============================================================================
// TEAM MANAGER CARD
// =============================================================================

function TlCommissionPopup({
  team,
  result,
  anchorEl,
  onClose,
}: {
  team: TeamMetrics;
  result: TlCommissionResult;
  anchorEl: HTMLElement;
  onClose: () => void;
}) {
  const isDark = useIsDark();
  const rect = anchorEl.getBoundingClientRect();

  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed z-[10005] rounded-2xl p-4 flex flex-col gap-3 text-[11px]"
      style={{
        top: rect.bottom + 8,
        left: Math.max(8, rect.left - 180),
        width: 280,
        background: isDark ? "rgba(20,20,28,0.96)" : "rgba(255,255,255,0.97)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
        boxShadow: isDark
          ? "0 8px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.06) inset"
          : "0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">
        Cálculo da Comissão TL
      </p>

      {/* MRR row */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold" style={{ color: MRR_BADGE_COLOR }}>MRR</span>
          {result.mrrRow
            ? <span className="text-muted-foreground/50 text-[9px]">bracket: {result.mrrRow.label}</span>
            : <span className="text-muted-foreground/40 text-[9px]">sem bracket</span>
          }
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <span className="tabular-nums">{formatCurrency(team.mrr.achieved)}</span>
          <span className="text-muted-foreground/30">×</span>
          <span className="tabular-nums font-medium text-foreground/60">
            {result.mrrRow ? result.mrrRow.multiplier.toFixed(9) : "0"}
          </span>
          <span className="text-muted-foreground/30">=</span>
          <span className="tabular-nums font-bold" style={{ color: MRR_BADGE_COLOR }}>
            {formatCurrency(result.mrrResult)}
          </span>
        </div>
      </div>

      <div className="h-px" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />

      {/* NRR row */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold" style={{ color: NRR_BADGE_COLOR }}>NRR</span>
          {result.nrrRow
            ? <span className="text-muted-foreground/50 text-[9px]">bracket: {result.nrrRow.label}</span>
            : <span className="text-muted-foreground/40 text-[9px]">sem bracket</span>
          }
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <span className="tabular-nums">{formatCurrency(team.nrr.achieved)}</span>
          <span className="text-muted-foreground/30">×</span>
          <span className="tabular-nums font-medium text-foreground/60">
            {result.nrrRow ? result.nrrRow.multiplier.toFixed(9) : "0"}
          </span>
          <span className="text-muted-foreground/30">=</span>
          <span className="tabular-nums font-bold" style={{ color: NRR_BADGE_COLOR }}>
            {formatCurrency(result.nrrResult)}
          </span>
        </div>
      </div>

      <div className="h-px" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-foreground/80">Total</span>
        <span className="font-extrabold tabular-nums text-[13px]" style={{ color: isDark ? "#fff" : "#111" }}>
          {formatCurrency(result.total)}
        </span>
      </div>
    </div>,
    document.body,
  );
}

function TeamManagerCard({ team, rank, metricMode, tlRows, avatarMap = new Map(), onAnalytics }: {
  team: TeamMetrics;
  rank: number;
  metricMode?: "acumulado" | "comissao";
  tlRows?: TlMultiplierRow[];
  avatarMap?: Map<string, string>;
  onAnalytics?: () => void;
}) {
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
  const [photoErr, setPhotoErr] = useState(false);
  const isDark = useIsDark();
  const leaderPhoto = avatarMap.get(team.managerName) ?? getLeaderPhotoByName(team.managerName);
  const leaderInitials = getInitials(stripTetragram(team.managerName));
  const rampUpCount = team.sellers.filter((s) => s.status === "ramp-up").length;
  const feriasCount = team.sellers.filter((s) => s.status === "férias").length;
  const totalSellers = team.sellers.length;
  const teamName = team.sellers[0]?.teamName ?? null;

  const mrrPct = team.mrr.target > 0 ? (team.mrr.achieved / team.mrr.target) * 100 : 0;
  const nrrPct = team.nrr.target > 0 ? (team.nrr.achieved / team.nrr.target) * 100 : 0;

  const tlCommission = useMemo(
    () => metricMode === "comissao" && tlRows?.length ? computeTlCommission(team, tlRows) : null,
    [metricMode, tlRows, team],
  );

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
      {/* Rank */}
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

      {/* Avatar do líder */}
      <div className="flex justify-center pt-1">
        {leaderPhoto && !photoErr ? (
          <div
            className="h-[44px] w-[44px] rounded-full overflow-hidden shrink-0"
            style={{ border: "2px solid rgba(1,126,132,0.35)", boxShadow: "0 0 14px rgba(1,126,132,0.20)" }}
          >
            <img src={leaderPhoto} alt={stripTetragram(team.managerName)} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" onError={() => setPhotoErr(true)} />
          </div>
        ) : (
          <div
            className="h-[44px] w-[44px] rounded-full flex items-center justify-center font-bold text-[12px] shrink-0"
            style={{ background: "rgba(1,126,132,0.18)", color: "#2dd4bf", border: "1.5px solid rgba(1,126,132,0.35)", boxShadow: "0 0 14px rgba(1,126,132,0.18)" }}
          >
            {leaderInitials}
          </div>
        )}
      </div>

      {/* Nome do líder + badge do time */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-[12px] font-bold text-foreground leading-tight text-center line-clamp-2 px-1">{stripTetragram(team.managerName)}</p>
        <TeamBadgeDsm teamName={teamName} />
      </div>

      {/* Total de vendedores */}
      <div className="flex flex-col items-center text-center">
        <span className="text-[22px] font-bold tabular-nums leading-none text-foreground/85">
          {String(totalSellers).padStart(2, "0")}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/40 font-semibold mt-0.5">
          vendedores
        </span>
      </div>

      {/* Ramp-up | Férias */}
      <div className="grid grid-cols-[1fr_1px_1fr] gap-0">
        <div className="flex flex-col gap-0.5 pr-3 items-center">
          <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: "#E4A900" }}>
            {String(rampUpCount).padStart(2, "0")}
          </span>
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">
            Ramp-up
          </span>
        </div>
        <div className="bg-border/15 rounded-full" />
        <div className="flex flex-col gap-0.5 pl-3 items-center">
          <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: "#5B899E" }}>
            {String(feriasCount).padStart(2, "0")}
          </span>
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">
            Férias
          </span>
        </div>
      </div>

      {/* Total acumulado / Comissão */}
      <div className="text-center">
        <p className="text-[9px] text-muted-foreground/40 font-medium tracking-wide uppercase">
          {metricMode === "comissao" ? "Comissão TL" : "Total acumulado"}
        </p>
        {tlCommission ? (
          <div className="flex items-center justify-center gap-1.5">
            <p className="text-[18px] font-extrabold tabular-nums text-foreground leading-tight">
              {formatCurrency(tlCommission.total)}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setInfoAnchor(infoAnchor ? null : e.currentTarget);
              }}
              className="shrink-0 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            {infoAnchor && (
              <TlCommissionPopup
                team={team}
                result={tlCommission}
                anchorEl={infoAnchor}
                onClose={() => setInfoAnchor(null)}
              />
            )}
          </div>
        ) : (
          <p className="text-[18px] font-extrabold tabular-nums text-foreground leading-tight">
            {formatCurrency(team.total.achieved)}
          </p>
        )}
      </div>

      {/* MRR | NRR */}
      <div className="grid grid-cols-[1fr_1px_1fr] gap-0 pt-2.5 border-t border-border/15">
        <div className="flex flex-col items-center gap-1 pr-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase"
            style={MRR_BADGE_STYLE}
          >
            MRR
          </span>
          <span className="text-[12px] font-bold tabular-nums text-foreground/75">{formatCurrency(team.mrr.achieved)}</span>
          {team.mrr.target > 0
            ? <span className={cn("text-[11px] font-bold tabular-nums", pctColorDsm(mrrPct))}>{Math.round(mrrPct)}%{mrrPct >= 100 ? " 🎉" : ""}</span>
            : <span className="text-[11px] text-muted-foreground/22">—</span>}
        </div>
        <div className="bg-border/20 rounded-full" />
        <div className="flex flex-col items-center gap-1 pl-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase"
            style={NRR_BADGE_STYLE}
          >
            NRR
          </span>
          <span className="text-[12px] font-bold tabular-nums text-foreground/75">{formatCurrency(team.nrr.achieved)}</span>
          {team.nrr.target > 0
            ? <span className={cn("text-[11px] font-bold tabular-nums", pctColorDsm(nrrPct))}>{Math.round(nrrPct)}%{nrrPct >= 100 ? " 🎉" : ""}</span>
            : <span className="text-[11px] text-muted-foreground/22">—</span>}
        </div>
      </div>

      {/* Botão Analytics */}
      <div className="pt-1 border-t border-border/10">
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
    </div>
  );
}

// =============================================================================
// TEAM MANAGER ROW (layout lista)
// =============================================================================

function TeamManagerRow({ team, rank, metricMode, tlRows, avatarMap = new Map(), onAnalytics }: {
  team: TeamMetrics;
  rank: number;
  metricMode?: "acumulado" | "comissao";
  tlRows?: TlMultiplierRow[];
  avatarMap?: Map<string, string>;
  onAnalytics?: () => void;
}) {
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
  const [photoErr, setPhotoErr] = useState(false);
  const isDark = useIsDark();
  const leaderPhoto = avatarMap.get(team.managerName) ?? getLeaderPhotoByName(team.managerName);
  const leaderInitials = getInitials(stripTetragram(team.managerName));
  const rampUpCount = team.sellers.filter((s) => s.status === "ramp-up").length;
  const feriasCount = team.sellers.filter((s) => s.status === "férias").length;
  const totalSellers = team.sellers.length;
  const teamName = team.sellers[0]?.teamName ?? null;
  const mrrPct = team.mrr.target > 0 ? (team.mrr.achieved / team.mrr.target) * 100 : 0;
  const nrrPct = team.nrr.target > 0 ? (team.nrr.achieved / team.nrr.target) * 100 : 0;

  const tlCommission = useMemo(
    () => metricMode === "comissao" && tlRows?.length ? computeTlCommission(team, tlRows) : null,
    [metricMode, tlRows, team],
  );

  const rankStyle =
    rank === 1 ? { bg: "rgba(234,179,8,0.18)", border: "rgba(234,179,8,0.45)", text: "#EAB308" }
      : rank === 2 ? { bg: "rgba(192,200,212,0.14)", border: "rgba(192,200,212,0.38)", text: "#C0C8D4" }
        : rank === 3 ? { bg: "rgba(180,83,9,0.14)", border: "rgba(180,83,9,0.38)", text: "#CD9B6A" }
          : null;

  return (
    <div className="glass-card rounded-xl px-3 py-2 flex items-center gap-3">
      {/* Rank */}
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

      {/* Avatar + Nome + Badge */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {leaderPhoto && !photoErr ? (
          <div
            className="h-[24px] w-[24px] rounded-full overflow-hidden shrink-0"
            style={{ border: "1.5px solid rgba(1,126,132,0.35)" }}
          >
            <img src={leaderPhoto} alt={stripTetragram(team.managerName)} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" onError={() => setPhotoErr(true)} />
          </div>
        ) : (
          <div
            className="h-[24px] w-[24px] rounded-full flex items-center justify-center font-bold text-[9px] shrink-0"
            style={{ background: "rgba(1,126,132,0.18)", color: "#2dd4bf", border: "1.5px solid rgba(1,126,132,0.35)" }}
          >
            {leaderInitials}
          </div>
        )}
        <span className="text-[11px] font-semibold text-foreground truncate">{stripTetragram(team.managerName)}</span>
        <TeamBadgeDsm teamName={teamName} small />
      </div>

      {/* Vendedores | Ramp-up | Férias */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex flex-col items-center gap-0 w-[32px]">
          <span className="text-[11px] font-bold tabular-nums text-foreground/85">{String(totalSellers).padStart(2, "0")}</span>
          <span className="text-[7px] uppercase tracking-wider text-muted-foreground/35 font-semibold">Sellers</span>
        </div>
        <div className="h-5 w-px bg-border/20 rounded-full" />
        <div className="flex flex-col items-center gap-0 w-[28px]">
          <span className="text-[11px] font-bold tabular-nums leading-none" style={{ color: "#E4A900" }}>{String(rampUpCount).padStart(2, "0")}</span>
          <span className="text-[7px] uppercase tracking-wider text-muted-foreground/35 font-semibold">Ramp</span>
        </div>
        <div className="flex flex-col items-center gap-0 w-[28px]">
          <span className="text-[11px] font-bold tabular-nums leading-none" style={{ color: "#5B899E" }}>{String(feriasCount).padStart(2, "0")}</span>
          <span className="text-[7px] uppercase tracking-wider text-muted-foreground/35 font-semibold">Férias</span>
        </div>
      </div>

      <span className="text-muted-foreground/20 self-center">|</span>

      {/* Total */}
      <div className="flex flex-col items-center gap-0 w-[100px] shrink-0">
        <span className="text-[7px] uppercase tracking-wider text-muted-foreground/40 font-medium">
          {metricMode === "comissao" ? "Comissão TL" : "Total"}
        </span>
        {tlCommission ? (
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-extrabold tabular-nums text-foreground">{formatCurrency(tlCommission.total)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setInfoAnchor(infoAnchor ? null : e.currentTarget); }}
              className="shrink-0 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
            >
              <Info className="h-2.5 w-2.5" />
            </button>
            {infoAnchor && (
              <TlCommissionPopup team={team} result={tlCommission} anchorEl={infoAnchor} onClose={() => setInfoAnchor(null)} />
            )}
          </div>
        ) : (
          <span className="text-[11px] font-extrabold tabular-nums text-foreground">{formatCurrency(team.total.achieved)}</span>
        )}
      </div>

      <span className="text-muted-foreground/20 self-center">|</span>

      {/* MRR */}
      <div className="flex items-center justify-center gap-1 w-[155px] shrink-0">
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase shrink-0" style={MRR_BADGE_STYLE}>MRR</span>
        <span className="text-[9px] font-bold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="text-foreground/75">{formatCurrency(team.mrr.achieved)}</span>
          {team.mrr.target > 0
            ? <span className={cn(pctColorDsm(mrrPct))}> ({Math.round(mrrPct)}%{mrrPct >= 100 ? " 🎉" : ""})</span>
            : <span className="text-muted-foreground/22"> (—)</span>}
        </span>
      </div>

      <span className="text-muted-foreground/20 self-center">|</span>

      {/* NRR */}
      <div className="flex items-center justify-center gap-1 w-[155px] shrink-0">
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase shrink-0" style={NRR_BADGE_STYLE}>NRR</span>
        <span className="text-[9px] font-bold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="text-foreground/75">{formatCurrency(team.nrr.achieved)}</span>
          {team.nrr.target > 0
            ? <span className={cn(pctColorDsm(nrrPct))}> ({Math.round(nrrPct)}%{nrrPct >= 100 ? " 🎉" : ""})</span>
            : <span className="text-muted-foreground/22"> (—)</span>}
        </span>
      </div>

      {/* Analytics — icon only */}
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
// MANAGER VIEW
// =============================================================================

export function ManagerView({ teams, company, allRaw, selectedMonth, painelOpen, onClosePainel, tlRows, onTlRowsChange, tlLoading, onRefresh, avatarMap = new Map(), onTeamAnalytics, onSellerAnalytics }: {
  teams: TeamMetrics[];
  company: { mrr: PlanMetrics; nrr: PlanMetrics; total: PlanMetrics };
  allRaw: RawRow[];
  selectedMonth: string;
  painelOpen: boolean;
  onClosePainel: () => void;
  tlRows: TlMultiplierRow[];
  onTlRowsChange: (rows: TlMultiplierRow[]) => void;
  tlLoading?: boolean;
  onRefresh?: () => void;
  avatarMap?: Map<string, string>;
  onTeamAnalytics?: (team: TeamMetrics) => void;
  onSellerAnalytics?: (seller: SellerMetrics) => void;
}) {
  const [viewFilter, setViewFilter] = useState<"time" | "vendedor">("time");
  const [layoutMode, setLayoutMode] = useState<"card" | "lista">("card");
  const [typeFilter, setTypeFilter] = useState<"Ambos" | "MRR" | "NRR">("Ambos");
  const [metricMode, setMetricMode] = useState<"acumulado" | "comissao">("acumulado");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sellerPage, setSellerPage] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { prevMonth, nextMonth } = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

  const kpiBreakdown = useMemo(() => {
    const acc = {
      production: { mrr: 0, nrr: 0, total: 0 },
      rampup:     { mrr: 0, nrr: 0, total: 0 },
      vacation:   { mrr: 0, nrr: 0, total: 0 },
    };
    const monthRows = allRaw.filter(
      (r) => toMonthKeyStr(r.date_from ?? "") === selectedMonth    );
    for (const r of monthRows) {
      const ach = Math.max(0, r.achieved ?? 0);
      const type = (r.plan_type ?? "").toUpperCase();
      const status = getRowStatus(r);
      const bucket = status === "ramp-up" ? "rampup" : status === "férias" ? "vacation" : "production";
      if (type === "MRR") { acc[bucket].mrr += ach; acc[bucket].total += ach; }
      else if (type === "NRR") { acc[bucket].nrr += ach; acc[bucket].total += ach; }
    }
    return acc;
  }, [allRaw, selectedMonth]);

  const PAGE_SIZE = 8;

  const sortedTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...teams];
    if (q) list = list.filter((t) => t.managerName.toLowerCase().includes(q));
    if (typeFilter === "MRR") return list.sort((a, b) => b.mrr.achieved - a.mrr.achieved);
    if (typeFilter === "NRR") return list.sort((a, b) => b.nrr.achieved - a.nrr.achieved);
    return list.sort((a, b) => {
      const mrrPctA = a.mrr.target > 0 ? (a.mrr.achieved / a.mrr.target) * 100 : 0;
      const nrrPctA = a.nrr.target > 0 ? (a.nrr.achieved / a.nrr.target) * 100 : 0;
      const mrrPctB = b.mrr.target > 0 ? (b.mrr.achieved / b.mrr.target) * 100 : 0;
      const nrrPctB = b.nrr.target > 0 ? (b.nrr.achieved / b.nrr.target) * 100 : 0;
      return sellerRankingScore(mrrPctB, nrrPctB) - sellerRankingScore(mrrPctA, nrrPctA);
    });
  }, [teams, typeFilter, searchQuery]);

  const sortedSellers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...allSellers];
    if (q) list = list.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.managerName ?? "").toLowerCase().includes(q) ||
      (s.teamName ?? "").toLowerCase().includes(q)
    );
    if (typeFilter === "MRR") return list.sort((a, b) => b.mrr.achieved - a.mrr.achieved);
    if (typeFilter === "NRR") return list.sort((a, b) => b.nrr.achieved - a.nrr.achieved);
    return list.sort((a, b) => sellerRankingScore(b.mrr.pct, b.nrr.pct) - sellerRankingScore(a.mrr.pct, a.nrr.pct));
  }, [allSellers, typeFilter, searchQuery]);

  const totalPages = Math.ceil(sortedSellers.length / PAGE_SIZE);
  const safePage = Math.min(sellerPage, Math.max(0, totalPages - 1));
  const pagedSellers = sortedSellers.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => { setSellerPage(0); }, [typeFilter, viewFilter, searchQuery]);

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

  const isDark = useIsDark();
  const cardStyle: React.CSSProperties = isDark
    ? {
      background: "rgba(255,255,255,0.014)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
    }
    : {
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(14px) saturate(1.5)",
      WebkitBackdropFilter: "blur(14px) saturate(1.5)",
      border: "1px solid rgba(0,0,0,0.07)",
      boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9) inset",
    };
  const topShine = "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.18) 50%, transparent 90%)";
  const innerGlow = "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)";

  if (!teams.length) return null;

  return (
    <>
      {painelOpen && (
        <PainelDoGestor
          teams={teams}
          allRaw={allRaw}
          initialMonth={selectedMonth}
          onClose={onClosePainel}
          tlRows={tlRows}
          onTlRowsChange={onTlRowsChange}
          tlLoading={tlLoading}
          onRefresh={onRefresh}
        />
      )}
      <div className="flex gap-5 items-start">
        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* 3 KPI Cards do departamento */}
          <div className="grid grid-cols-3 gap-4">
            <TeamKpiCard
              title="Desempenho do Departamento"
              metrics={company.total}
              prevValue={prevMetrics.total.achieved}
              nextValue={nextMetrics.total.achieved}
              color="#5B899E"
              icon={TrendingUp}
              breakdown={{ production: kpiBreakdown.production.total, rampup: kpiBreakdown.rampup.total, vacation: kpiBreakdown.vacation.total }}
            />
            <TeamKpiCard
              title="MRR do Departamento"
              metrics={company.mrr}
              prevValue={prevMetrics.mrr.achieved}
              nextValue={nextMetrics.mrr.achieved}
              color="#714B67"
              icon={Repeat2}
              breakdown={{ production: kpiBreakdown.production.mrr, rampup: kpiBreakdown.rampup.mrr, vacation: kpiBreakdown.vacation.mrr }}
            />
            <TeamKpiCard
              title="NRR do Departamento"
              metrics={company.nrr}
              prevValue={prevMetrics.nrr.achieved}
              nextValue={nextMetrics.nrr.achieved}
              color="#017E84"
              icon={BarChart2}
              breakdown={{ production: kpiBreakdown.production.nrr, rampup: kpiBreakdown.rampup.nrr, vacation: kpiBreakdown.vacation.nrr }}
            />
          </div>

          {/* Section header + segmentadores */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {viewFilter === "time"
                ? <Users className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                : <User className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              }
              <span className="text-[10px] font-semibold text-muted-foreground/45 uppercase tracking-[0.18em]">
                Análise dos {viewFilter === "time" ? "Times" : "Vendedores"}
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
              {/* Visualizar por */}
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] text-muted-foreground/35 font-medium">Visualizar por:</span>
                <div className="flex rounded-lg overflow-hidden glass-card p-0.5">
                  {(["time", "vendedor"] as const).map((opt) => (
                    <div key={opt} className="relative group">
                      <button
                        onClick={() => setViewFilter(opt)}
                        className={cn(
                          "px-2 py-1 rounded-md transition-all flex items-center justify-center",
                          viewFilter === opt ? "glass-button-active" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt === "time"
                          ? <Users className="h-3 w-3 shrink-0" />
                          : <User className="h-3 w-3 shrink-0" />
                        }
                      </button>
                      <span
                        className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
                        style={{ background: "rgba(0,0,0,0.72)", color: "#fff", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
                      >
                        {opt === "time" ? "Time" : "Vendedor"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Ordenar por */}
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
              {/* Exibir */}
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] text-muted-foreground/35 font-medium">Exibir:</span>
                <div className="flex rounded-lg overflow-hidden glass-card p-0.5">
                  {(["acumulado", "comissao"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetricMode(m)}
                      className={cn(
                        "px-2 py-1 text-[10px] font-medium rounded-md transition-all",
                        metricMode === m ? "glass-button-active" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m === "acumulado" ? "Total Acumulado" : "Comissão"}
                    </button>
                  ))}
                </div>
              </div>
              {/* Busca */}
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

          {/* Grid de times */}
          {viewFilter === "time" && (
            layoutMode === "card" ? (
              <div className="grid grid-cols-4 gap-4">
                {sortedTeams.map((team, i) => (
                  <TeamManagerCard key={team.managerName} team={team} rank={i + 1} metricMode={metricMode} tlRows={tlRows} avatarMap={avatarMap} onAnalytics={onTeamAnalytics ? () => onTeamAnalytics(team) : undefined} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedTeams.map((team, i) => (
                  <TeamManagerRow key={team.managerName} team={team} rank={i + 1} metricMode={metricMode} tlRows={tlRows} avatarMap={avatarMap} onAnalytics={onTeamAnalytics ? () => onTeamAnalytics(team) : undefined} />
                ))}
              </div>
            )
          )}

          {/* Grid de vendedores */}
          {viewFilter === "vendedor" && (
            <>
              {layoutMode === "card" ? (
                <div className="grid grid-cols-4 gap-4">
                  {pagedSellers.map((seller, i) => (
                    <SellerTeamCard
                      key={seller.userId ?? seller.name}
                      seller={seller}
                      rank={safePage * PAGE_SIZE + i + 1}
                      showFullName
                      showTeamBadge
                      compactAvatar
                      showAnalyticsBtn
                      metricMode={metricMode}
                      avatarUrl={avatarMap.get(seller.name)}
                      onAnalytics={onSellerAnalytics ? () => onSellerAnalytics(seller) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {pagedSellers.map((seller, i) => (
                    <SellerTeamRow
                      key={seller.userId ?? seller.name}
                      seller={seller}
                      rank={safePage * PAGE_SIZE + i + 1}
                      metricMode={metricMode}
                      avatarUrl={avatarMap.get(seller.name)}
                      onAnalytics={onSellerAnalytics ? () => onSellerAnalytics(seller) : undefined}
                    />
                  ))}
                </div>
              )}

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    onClick={() => setSellerPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className={cn(
                      "glass-button flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                      safePage === 0 && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    <ArrowUp className="h-3 w-3 rotate-[-90deg] shrink-0" />
                    Anterior
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSellerPage(idx)}
                        className={cn(
                          "h-6 w-6 rounded-full text-[10px] font-bold transition-all",
                          idx === safePage
                            ? "glass-button-active"
                            : "text-muted-foreground/50 hover:text-foreground"
                        )}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSellerPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage === totalPages - 1}
                    className={cn(
                      "glass-button flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                      safePage === totalPages - 1 && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    Próximo
                    <ArrowDown className="h-3 w-3 rotate-[-90deg] shrink-0" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Painel direito: resumo anual */}
        <div className="w-[280px] shrink-0 relative overflow-hidden rounded-2xl flex flex-col" style={cardStyle}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px z-10" style={{ background: topShine }} />
          <span className="pointer-events-none absolute inset-0 z-0" style={{ background: innerGlow }} />

          <TeamCompositionStrip sellers={allSellers} />

          <div className="relative z-10 flex items-center gap-1.5 px-5 pt-2 pb-1">
            <CalendarDays className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[9px] uppercase tracking-[0.20em] text-muted-foreground/40 font-semibold">
              Resumo Anual
            </span>
          </div>

          <div className="relative z-10 flex flex-col gap-2.5 p-5 pt-3">
            {quarterlyData.map((q) => (
              <QuarterMiniCard key={q.quarter} data={q} />
            ))}
          </div>
        </div>
      </div>

      {/* Autor */}
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
