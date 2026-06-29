import React, { useState, useMemo, useEffect, useRef } from "react";
import { useEmployeeAnalytics, type MonthEntry } from "@/hooks/useEmployeeAnalytics";
import { createPortal } from "react-dom";
import { X, TrendingUp, TrendingDown, Repeat2, BarChart2, CalendarDays, ChevronDown, Crown, Info, Target, Wallet, Users } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  useIsDark,
  TOP_PERFORMANCE_SELLERS,
  TopPerformanceBadge,
  GoatBadge,
  RankBadge,
  TopRankStreakBadge,
  StreakBadge,
  VacationBadge,
} from "../DesempenhoShared";
import {
  toMonthKeyStr,
  stripTetragram,
  getInitials,
  formatCompact,
  pctColorDsm,
  type SellerMetrics,
  type RawRow,
} from "@/lib/desempenhoUtils";
import { MONTH_NAMES, TEAM_NAME_FIXED_COLORS, TEAM_NAME_FALLBACK_COLORS, hashTeamName } from "@/lib/directSalesUtils";
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// ─── Pure formatters (module-level) ───────────────────────────────────────────

function fmtBRLFull(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBRL(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(2)}k`;
  return `R$${v.toFixed(2)}`;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, isDark }: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
  isDark: boolean;
}) {
  if (!active || !payload?.length) return null;
  const bg = isDark ? "rgba(12,13,20,0.92)" : "rgba(255,255,255,0.96)";
  const border = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const text = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.80)";
  const sub = isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)";
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: "10px 14px",
      backdropFilter: "blur(16px)",
      fontSize: 12,
    }}>
      <div style={{ color: sub, fontWeight: 600, marginBottom: 6, letterSpacing: "0.06em", fontSize: 10 }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: text, display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: sub, minWidth: 32, fontSize: 11 }}>{p.dataKey === "mrrPct" ? "MRR" : "NRR"}</span>
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{Math.round(p.value)}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── DeltaTd (month-to-month arrow column) ───────────────────────────────────

const arrowTdStyle: React.CSSProperties = {
  width: 14, minWidth: 14, maxWidth: 14, padding: "0 1px",
  textAlign: "center", verticalAlign: "middle",
};

const DELTA_UP_COLOR = "#E4A900";
const DELTA_DOWN_COLOR = "#ef4444";

function deltaDir(curr: number, prev: number | undefined, show = true): "up" | "down" | "none" {
  if (!show || prev === undefined) return "none";
  if (curr > prev) return "up";
  if (curr < prev) return "down";
  return "none";
}

function applyDelta(dir: "up" | "down" | "none", fallback: string): string {
  if (dir === "up") return DELTA_UP_COLOR;
  if (dir === "down") return DELTA_DOWN_COLOR;
  return fallback;
}

function DeltaTd({ curr, prev, show = true }: { curr: number; prev: number | undefined; show?: boolean }) {
  const emptyCell = <td style={arrowTdStyle}><span style={{ opacity: 0.2, fontSize: 9 }}>–</span></td>;
  const dir = deltaDir(curr, prev, show);
  if (dir === "none") return emptyCell;
  const color = dir === "up" ? DELTA_UP_COLOR : DELTA_DOWN_COLOR;
  const arrow = dir === "up" ? "▲" : "▼";
  return (
    <td style={arrowTdStyle}>
      <span style={{ color, fontSize: 8, display: "inline-block", lineHeight: 1 }}>{arrow}</span>
    </td>
  );
}

// ─── Avatar circle ────────────────────────────────────────────────────────────

function AvatarCircle({ avatarUrl, initials, isDark }: {
  avatarUrl?: string | null;
  initials: string;
  isDark: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div style={{
      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
      background: isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.15)",
      border: isDark ? "1.5px solid rgba(178,127,168,0.45)" : "1.5px solid rgba(113,75,103,0.30)",
      overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 700,
      color: "#B87FA8",
    }}>
      {avatarUrl && !imgErr ? (
        <img
          src={avatarUrl}
          alt={initials}
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : initials}
    </div>
  );
}

// ─── AggMonthTable (team_leader / manager) ────────────────────────────────────

function AggMonthTable({ months, type, numColor, subColor, dividerColor }: {
  months: { monthKey: string; label: string; mrrAchieved: number; mrrTarget: number; mrrPct: number; nrrAchieved: number; nrrTarget: number; nrrPct: number }[];
  type: "MRR" | "NRR";
  numColor: string;
  subColor: string;
  dividerColor: string;
}) {
  const thStyle: React.CSSProperties = {
    color: subColor, fontWeight: 700, fontSize: 9,
    letterSpacing: "0.08em", textTransform: "uppercase" as const,
    paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`,
  };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, textAlign: "left" }}>Mês</th>
          <th style={{ ...thStyle, textAlign: "center" }}>Meta</th>
          <th style={{ ...thStyle, textAlign: "center" }}>Atingido</th>
          <th style={{ ...thStyle, textAlign: "center" }}>%</th>
          <th style={{ ...thStyle, textAlign: "center", width: 28 }}></th>
        </tr>
      </thead>
      <tbody>
        {months.map((m) => {
          const ach = type === "MRR" ? m.mrrAchieved : m.nrrAchieved;
          const tgt = type === "MRR" ? m.mrrTarget : m.nrrTarget;
          const pct = type === "MRR" ? m.mrrPct : m.nrrPct;
          const fullName = MONTH_NAMES[parseInt(m.monthKey.split("-")[1]) - 1] ?? m.label;
          const pctCol = pct >= 100 ? "#E4A900" : pctColorDsm(pct);
          return (
            <tr key={m.monthKey} style={{ borderBottom: `1px solid ${dividerColor}` }}>
              <td style={{ padding: "5px 0", color: numColor, fontWeight: 500 }}>{fullName}</td>
              <td style={{ padding: "5px 0 5px 8px", color: subColor, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                {tgt > 0 ? fmtBRLFull(tgt) : <span style={{ opacity: 0.4 }}>—</span>}
              </td>
              <td style={{ padding: "5px 0 5px 8px", color: numColor, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                {fmtBRLFull(ach)}
              </td>
              <td style={{ padding: "5px 0 5px 8px", color: pctCol, textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {tgt > 0 ? `${pct.toFixed(1)}%` : <span style={{ opacity: 0.4 }}>—</span>}
              </td>
              <td style={{ padding: "5px 0 5px 8px", textAlign: "center", width: 28 }}>
                {pct >= 100 && <Crown size={11} style={{ color: "#E4A900", strokeWidth: 1.5 }} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── AggregatedAnalyticsSection (team_leader / manager) ───────────────────────

function AggregatedAnalyticsSection({
  months, ytd,
  ytdTitle, mrrCardLabel, nrrCardLabel, mrrTooltipText, nrrTooltipText,
  ytdDescWhat, ytdDescUse,
  isDark, numColor, subColor,
  monthsExpanded, onToggleExpanded,
  showYtdInfo, onToggleYtdInfo,
  CYAN, PURPLE,
}: {
  months: { monthKey: string; label: string; mrrAchieved: number; mrrTarget: number; mrrPct: number; nrrAchieved: number; nrrTarget: number; nrrPct: number }[];
  ytd: {
    mrrAch: number; mrrTgt: number; mrrPct: number;
    nrrAch: number; nrrTgt: number; nrrPct: number;
    bestMrrMonth: typeof months[0] | null;
    worstMrrMonth: typeof months[0] | null;
    avgMrr: number;
    bestNrrMonth: typeof months[0] | null;
    worstNrrMonth: typeof months[0] | null;
    avgNrr: number;
  };
  ytdTitle: string;
  mrrCardLabel: string;
  nrrCardLabel: string;
  mrrTooltipText: string;
  nrrTooltipText: string;
  ytdDescWhat: string;
  ytdDescUse: string;
  isDark: boolean;
  numColor: string;
  subColor: string;
  monthsExpanded: boolean;
  onToggleExpanded: () => void;
  showYtdInfo: boolean;
  onToggleYtdInfo: () => void;
  CYAN: string;
  PURPLE: string;
}) {
  const cardBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)";
  const cardBorder = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
  const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const infoButtonStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    background: active
      ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)")
      : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
    border: `1px solid ${active
      ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)")
      : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
    borderRadius: 99, padding: "2px 8px", cursor: "pointer",
    color: active ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
    fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
    transition: "all 0.15s", flexShrink: 0,
  });

  const infoBoxStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
    borderRadius: 12, padding: "14px 16px", marginBottom: 14,
    fontSize: 12, lineHeight: 1.65, color: numColor,
    display: "flex", flexDirection: "column", gap: 8,
    boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
  };

  const expandBtnStyle: React.CSSProperties = {
    background: "transparent", border: "none", cursor: "pointer",
    padding: "12px 20px 17px", margin: "0 -20px",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    fontSize: 10, fontWeight: 700, color: subColor,
    letterSpacing: "0.08em", textTransform: "uppercase",
    transition: "opacity 0.2s, color 0.2s", width: "calc(100% + 40px)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* YTD Cards */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showYtdInfo ? 8 : 18 }}>
          <BarChart2 size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
            {ytdTitle}
          </h2>
          <button onClick={onToggleYtdInfo} style={infoButtonStyle(showYtdInfo)}>
            <Info size={10} strokeWidth={2} />
            Sobre
          </button>
        </div>
        {showYtdInfo && (
          <div style={infoBoxStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📊 O que é</div>
              <p style={{ margin: 0, color: subColor }}>{ytdDescWhat}</p>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
              <p style={{ margin: 0, color: subColor }}>{ytdDescUse}</p>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* MRR Card */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "20px 20px 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>{mrrCardLabel}</span>
              <Repeat2 style={{ width: 16, height: 16, color: CYAN, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {fmtBRLFull(ytd.mrrAch)}
              </div>
              <span className="ytd-badge-wrap" style={{ position: "relative", display: "inline-flex" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center",
                  background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                  border: "1px solid rgba(228,169,0,0.40)",
                  borderRadius: 99, padding: "2px 8px",
                  fontSize: 10, fontWeight: 700, color: "#E4A900",
                  fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", cursor: "help",
                }}>
                  {Math.round(ytd.mrrPct)}% YTD
                </span>
                <span className="ytd-tip" style={{
                  position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                  background: isDark ? "#1c1c2e" : "#fff",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                  borderRadius: 6, padding: "5px 10px", fontSize: 12, lineHeight: 1.4,
                  color: isDark ? "#e0e0e0" : "#333", whiteSpace: "nowrap",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 100,
                }}>
                  {mrrTooltipText}
                </span>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: subColor, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}><CalendarDays style={{ width: 10, height: 10 }} />Média Mensal:</div>
                <span style={{ fontSize: 13, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>{fmtBRL(ytd.avgMrr)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: subColor, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}><TrendingUp style={{ width: 10, height: 10 }} />Maior receita:</div>
                {ytd.bestMrrMonth ? (
                  <span style={{ fontSize: 12, color: numColor, fontVariantNumeric: "tabular-nums" }}>{fmtBRL(ytd.bestMrrMonth.mrrAchieved)} · {ytd.bestMrrMonth.label}</span>
                ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: subColor, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}><TrendingDown style={{ width: 10, height: 10 }} />Menor receita:</div>
                {ytd.worstMrrMonth ? (
                  <span style={{ fontSize: 12, color: numColor, fontVariantNumeric: "tabular-nums" }}>{fmtBRL(ytd.worstMrrMonth.mrrAchieved)} · {ytd.worstMrrMonth.label}</span>
                ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
              </div>
            </div>
            <button onClick={onToggleExpanded} className="ytd-expand-btn" style={expandBtnStyle}>
              <ChevronDown size={12} style={{ transition: "transform 0.25s", transform: monthsExpanded ? "rotate(180deg)" : "rotate(0deg)", strokeWidth: 1.5 }} />
              {monthsExpanded ? "Recolher" : "Ver o mês a mês"}
            </button>
            {monthsExpanded && (
              <div style={{ margin: "0 -20px", padding: "4px 20px 12px", background: "transparent" }}>
                <AggMonthTable months={months} type="MRR" numColor={numColor} subColor={subColor} dividerColor={dividerColor} />
              </div>
            )}
          </div>

          {/* NRR Card */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "20px 20px 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>{nrrCardLabel}</span>
              <BarChart2 style={{ width: 16, height: 16, color: PURPLE, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {fmtBRLFull(ytd.nrrAch)}
              </div>
              <span className="ytd-badge-wrap" style={{ position: "relative", display: "inline-flex" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center",
                  background: "linear-gradient(90deg, rgba(1,126,132,0.16) 0%, rgba(1,126,132,0.10) 100%)",
                  border: "1px solid rgba(1,126,132,0.38)",
                  borderRadius: 99, padding: "2px 8px",
                  fontSize: 10, fontWeight: 700, color: "#0fb8c0",
                  fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", cursor: "help",
                }}>
                  {Math.round(ytd.nrrPct)}% YTD
                </span>
                <span className="ytd-tip" style={{
                  position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                  background: isDark ? "#1c1c2e" : "#fff",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                  borderRadius: 6, padding: "5px 10px", fontSize: 12, lineHeight: 1.4,
                  color: isDark ? "#e0e0e0" : "#333", whiteSpace: "nowrap",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 100,
                }}>
                  {nrrTooltipText}
                </span>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: subColor, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}><CalendarDays style={{ width: 10, height: 10 }} />Média Mensal:</div>
                <span style={{ fontSize: 13, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>{fmtBRL(ytd.avgNrr)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: subColor, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}><TrendingUp style={{ width: 10, height: 10 }} />Maior receita:</div>
                {ytd.bestNrrMonth ? (
                  <span style={{ fontSize: 12, color: numColor, fontVariantNumeric: "tabular-nums" }}>{fmtBRL(ytd.bestNrrMonth.nrrAchieved)} · {ytd.bestNrrMonth.label}</span>
                ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: subColor, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}><TrendingDown style={{ width: 10, height: 10 }} />Menor receita:</div>
                {ytd.worstNrrMonth ? (
                  <span style={{ fontSize: 12, color: numColor, fontVariantNumeric: "tabular-nums" }}>{fmtBRL(ytd.worstNrrMonth.nrrAchieved)} · {ytd.worstNrrMonth.label}</span>
                ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
              </div>
            </div>
            <button onClick={onToggleExpanded} className="ytd-expand-btn" style={expandBtnStyle}>
              <ChevronDown size={12} style={{ transition: "transform 0.25s", transform: monthsExpanded ? "rotate(180deg)" : "rotate(0deg)", strokeWidth: 1.5 }} />
              {monthsExpanded ? "Recolher" : "Ver o mês a mês"}
            </button>
            {monthsExpanded && (
              <div style={{ margin: "0 -20px", padding: "4px 20px 12px", background: "transparent" }}>
                <AggMonthTable months={months} type="NRR" numColor={numColor} subColor={subColor} dividerColor={dividerColor} />
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function GeneralAnalyticsPanel({
  onClose,
  viewMode,
  seller,
  sellers,
  allRaw,
  selectedMonth,
  sellerRank,
  goatRank,
  topRankStreak,
  avatarUrl,
  mrrStreak = 0,
  nrrStreak = 0,
  teamName,
  leaderName,
  hideCommission = false,
  activeManagerIds,
}: {
  onClose: () => void;
  viewMode?: "employee" | "team_leader" | "manager";
  seller?: SellerMetrics | null;
  sellers?: SellerMetrics[];
  allRaw?: RawRow[];
  selectedMonth?: string;
  sellerRank?: number | null;
  goatRank?: number | null;
  topRankStreak?: { top1: number; top2: number; top3: number } | null;
  avatarUrl?: string | null;
  mrrStreak?: number;
  nrrStreak?: number;
  teamName?: string;
  leaderName?: string;
  hideCommission?: boolean;
  activeManagerIds?: Set<number>;
}) {
  const isDark = useIsDark();
  const [monthsExpanded, setMonthsExpanded] = useState(false);
  const [statsMonthsExpanded, setStatsMonthsExpanded] = useState(false);
  const [showTrendInfo, setShowTrendInfo] = useState(false);
  const [showYtdInfo, setShowYtdInfo] = useState(false);
  const [showConsistencyDetails, setShowConsistencyDetails] = useState(false);
  const [showMonthlyInfo, setShowMonthlyInfo] = useState(false);
  const [activeInfoCard, setActiveInfoCard] = useState<"tendencia" | "volatilidade" | "sequencia" | null>(null);
  const [activeTeamInfoCard, setActiveTeamInfoCard] = useState<"tendencia" | "volatilidade" | "sequencia" | null>(null);
  const [showTeamConsistencyDetails, setShowTeamConsistencyDetails] = useState(false);
  const [showTeamMonthlyInfo, setShowTeamMonthlyInfo] = useState(false);
  const [showMemberMetricsInfo, setShowMemberMetricsInfo] = useState(false);
  const [sellerMetricsPage, setSellerMetricsPage] = useState(1);

  const consistencyBadgeRef = useRef<HTMLSpanElement>(null);
  const teamConsistencyBadgeRef = useRef<HTMLSpanElement>(null);
  const infoCardsRef = useRef<HTMLDivElement>(null);
  const teamInfoCardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeInfoCard) return;
    const handler = (e: MouseEvent) => {
      if (infoCardsRef.current && !infoCardsRef.current.contains(e.target as Node)) {
        setActiveInfoCard(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeInfoCard]);

  useEffect(() => {
    if (!activeTeamInfoCard) return;
    const handler = (e: MouseEvent) => {
      if (teamInfoCardsRef.current && !teamInfoCardsRef.current.contains(e.target as Node)) {
        setActiveTeamInfoCard(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeTeamInfoCard]);

  useEffect(() => {
    if (!showTeamConsistencyDetails) return;
    const handler = (e: MouseEvent) => {
      if (teamConsistencyBadgeRef.current && !teamConsistencyBadgeRef.current.contains(e.target as Node)) {
        setShowTeamConsistencyDetails(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTeamConsistencyDetails]);

  useEffect(() => {
    if (!showConsistencyDetails) return;
    const handler = (e: MouseEvent) => {
      if (consistencyBadgeRef.current && !consistencyBadgeRef.current.contains(e.target as Node)) {
        setShowConsistencyDetails(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showConsistencyDetails]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Employee analytics ────────────────────────────────────────────────────────
  const { monthlyHistory, chartData, chartYTicks, ytd } = useEmployeeAnalytics(allRaw, seller, selectedMonth);

  // ── Design tokens ─────────────────────────────────────────────────────────────
  const CYAN = "#714B67";
  const PURPLE = "#017E84";
  const numColor = isDark ? "#FFFFFF" : "#714B67";
  const subColor = isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.42)";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const axisColor = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)";
  const refColor = isDark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.80)";

  const year = (selectedMonth ?? "").slice(0, 4) || new Date().getFullYear().toString();
  const displayName = seller ? stripTetragram(seller.name) : "—";
  const initials = seller ? getInitials(displayName) : "?";

  // ── Aggregated monthly history (team_leader = team, manager = company) ────────
  const teamMonthlyHistory = useMemo(() => {
    if (!allRaw || (viewMode !== "team_leader" && viewMode !== "manager")) return [];
    const year = (selectedMonth ?? "").slice(0, 4);
    const yearRows = allRaw.filter((r) => (r.date_from ?? "").startsWith(year));
    const byMonth = new Map<string, { mrrAch: number; mrrTgt: number; nrrAch: number; nrrTgt: number }>();
    for (const r of yearRows) {
      const key = toMonthKeyStr(r.date_from ?? "");
      if (!key) continue;
      if (!byMonth.has(key)) byMonth.set(key, { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 });
      const e = byMonth.get(key)!;
      const ach = Math.max(0, r.achieved ?? 0);
      const tgt = r.skip_record ? 0 : (r.target_amount ?? 0);
      const type = (r.plan_type ?? "").toUpperCase();
      if (type === "MRR") { e.mrrAch += ach; e.mrrTgt += tgt; }
      else if (type === "NRR") { e.nrrAch += ach; e.nrrTgt += tgt; }
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
        };
      })
      .filter((m) => m.mrrAchieved > 0 || m.nrrAchieved > 0 || m.mrrTarget > 0 || m.nrrTarget > 0);
  }, [allRaw, viewMode, selectedMonth]);

  const teamChartYTicks = useMemo(() => {
    if (!teamMonthlyHistory.length) return [65, 130, 195, 260];
    const dataMax = Math.max(...teamMonthlyHistory.map((d) => Math.max(d.mrrPct, d.nrrPct)));
    const top = Math.max(120, Math.ceil(dataMax / 20) * 20);
    const step = Math.ceil(top / 4 / 10) * 10;
    return [step, step * 2, step * 3, step * 4].filter((t) => t <= top + step);
  }, [teamMonthlyHistory]);

  const teamYtd = useMemo(() => {
    const months = teamMonthlyHistory;
    const mrrAch = months.reduce((s, m) => s + m.mrrAchieved, 0);
    const mrrTgt = months.reduce((s, m) => s + m.mrrTarget, 0);
    const nrrAch = months.reduce((s, m) => s + m.nrrAchieved, 0);
    const nrrTgt = months.reduce((s, m) => s + m.nrrTarget, 0);
    const bestMrrMonth = months.reduce<typeof months[0] | null>(
      (best, m) => (!best || m.mrrAchieved > best.mrrAchieved ? m : best), null
    );
    const worstMrrMonth = months.length > 1
      ? months.reduce<typeof months[0] | null>((w, m) => (!w || m.mrrAchieved < w.mrrAchieved ? m : w), null)
      : null;
    const bestNrrMonth = months.reduce<typeof months[0] | null>(
      (best, m) => (!best || m.nrrAchieved > best.nrrAchieved ? m : best), null
    );
    const worstNrrMonth = months.length > 1
      ? months.reduce<typeof months[0] | null>((w, m) => (!w || m.nrrAchieved < w.nrrAchieved ? m : w), null)
      : null;
    const avgMrr = months.length > 0 ? mrrAch / months.length : 0;
    const avgNrr = months.length > 0 ? nrrAch / months.length : 0;
    return {
      mrrAch, mrrTgt, mrrPct: mrrTgt > 0 ? (mrrAch / mrrTgt) * 100 : 0,
      nrrAch, nrrTgt, nrrPct: nrrTgt > 0 ? (nrrAch / nrrTgt) * 100 : 0,
      bestMrrMonth, worstMrrMonth, avgMrr,
      bestNrrMonth, worstNrrMonth, avgNrr,
      monthCount: months.length,
    };
  }, [teamMonthlyHistory]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backdropFilter: "blur(8px) saturate(1.2)",
        WebkitBackdropFilter: "blur(8px) saturate(1.2)",
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.74) 100%)",
      }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col overflow-hidden rounded-3xl"
        style={{
          width: "min(95vw, 1120px)",
          maxHeight: "90vh",
          background: isDark ? "rgba(14,15,24,0.88)" : "rgba(255,255,255,0.90)",
          backdropFilter: "blur(48px) saturate(2)",
          WebkitBackdropFilter: "blur(48px) saturate(2)",
          border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(180,195,210,0.35)",
          boxShadow: isDark
            ? "0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 96px rgba(0,0,0,0.60), 0 8px 32px rgba(0,0,0,0.40)"
            : "0 0 0 1px rgba(255,255,255,0.50) inset, 0 32px 96px rgba(0,0,0,0.22), 0 8px 32px rgba(0,0,0,0.14)",
          fontFamily: "'Inter', sans-serif",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 h-7 w-7 flex items-center justify-center rounded-full opacity-30 hover:opacity-70 transition-opacity"
          style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div
          className="flex items-start shrink-0"
          style={{ padding: "28px 32px 22px", gap: 18, paddingRight: 60 }}
        >
          {viewMode === "employee" && (
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <div style={{
                width: 58, height: 58, borderRadius: "50%",
                background: isDark ? "rgba(113,75,103,0.28)" : "rgba(113,75,103,0.12)",
                border: isDark ? "2px solid rgba(178,127,168,0.50)" : "2px solid rgba(113,75,103,0.28)",
                overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, color: "#B87FA8",
                boxShadow: isDark ? "0 0 16px rgba(113,75,103,0.25)" : "none",
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={initials} referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : initials}
              </div>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: subColor, textTransform: "uppercase", marginBottom: 5 }}>
              Retrospectiva do Ano · {year}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: viewMode === "team_leader" ? 4 : 8 }}>
              <h1 style={{
                fontSize: "clamp(1.4rem, 2.4vw, 2rem)",
                fontWeight: 800, color: numColor, lineHeight: 1.05,
                letterSpacing: "-0.03em",
                margin: 0, flexShrink: 0,
              }}>
                {viewMode === "employee" ? displayName : "Análises Gerais"}
              </h1>
              {viewMode === "team_leader" && teamName && (() => {
                const palette = TEAM_NAME_FIXED_COLORS[teamName] ?? TEAM_NAME_FALLBACK_COLORS[hashTeamName(teamName)];
                return (
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    background: palette.bg,
                    border: `1.5px solid ${palette.border}`,
                    color: palette.text,
                    borderRadius: 99, padding: "5px 16px",
                    fontSize: 17, fontWeight: 800, letterSpacing: "0.01em",
                    flexShrink: 0,
                    boxShadow: `0 0 16px ${palette.border}`,
                  }}>
                    {teamName}
                  </span>
                );
              })()}
            </div>
            {viewMode === "team_leader" && leaderName && (
              <div style={{ fontSize: 12, color: subColor, fontWeight: 500, marginBottom: 8 }}>
                Líder: <span style={{ fontWeight: 700, color: numColor }}>{leaderName}</span>
              </div>
            )}
            {viewMode === "employee" && (
              <div className="flex flex-wrap items-center gap-1.5">
                {TOP_PERFORMANCE_SELLERS.includes(seller?.name ?? "") && <TopPerformanceBadge />}
                {goatRank !== null && goatRank !== undefined && goatRank <= 3 && <GoatBadge rank={goatRank as 1 | 2 | 3} />}
                {sellerRank !== null && sellerRank !== undefined && sellerRank <= 3 && <RankBadge rank={sellerRank as 1 | 2 | 3} month={selectedMonth} />}
                {topRankStreak !== null && topRankStreak !== undefined && topRankStreak.top1 >= 2 && <TopRankStreakBadge rank={1} count={topRankStreak.top1} />}
                {topRankStreak !== null && topRankStreak !== undefined && topRankStreak.top2 >= 2 && <TopRankStreakBadge rank={2} count={topRankStreak.top2} />}
                {topRankStreak !== null && topRankStreak !== undefined && topRankStreak.top3 >= 2 && <TopRankStreakBadge rank={3} count={topRankStreak.top3} />}
                {mrrStreak >= 2 && <StreakBadge type="MRR" count={mrrStreak} />}
                {nrrStreak >= 2 && <StreakBadge type="NRR" count={nrrStreak} />}
                {seller?.status === "férias" && <VacationBadge />}
              </div>
            )}
          </div>
        </div>


        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div style={{ padding: "24px 32px 28px", display: "flex", flexDirection: "column", gap: 40 }}>

          {/* ── SECTION 1 (now below): Trend Chart ────────────────────────── */}
          {/* rendered after YTD cards — see order below */}

          {/* ── SECTION 2: YTD Cards — rendered FIRST ───────────────────────── */}
          {viewMode === "employee" && ytd.monthCount > 0 && (() => {
            const cardBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
            const cardBorder = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
            const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

            const monthsToShow = monthlyHistory.filter(
              (m) => m.mrrAchieved > 0 || m.nrrAchieved > 0 || m.mrrTarget > 0 || m.nrrTarget > 0 || m.isVacation || m.isRampUp
            );

            const medianOf = (arr: number[]) => {
              if (!arr.length) return 0;
              const s = [...arr].sort((a, b) => a - b);
              const mid = Math.floor(s.length / 2);
              return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
            };
            const mrrPcts = monthsToShow.filter((m) => !m.isVacation && !m.isRampUp && m.mrrTarget > 0).map((m) => m.mrrPct);
            const nrrPcts = monthsToShow.filter((m) => !m.isVacation && !m.isRampUp && m.nrrTarget > 0).map((m) => m.nrrPct);
            const medianMrr = medianOf(mrrPcts);
            const medianNrr = medianOf(nrrPcts);
            const mrrHitCount = mrrPcts.filter((p) => p >= 100).length;
            const nrrHitCount = nrrPcts.filter((p) => p >= 100).length;
            const mrrHitRate = mrrPcts.length > 0 ? mrrHitCount / mrrPcts.length : 0;
            const nrrHitRate = nrrPcts.length > 0 ? nrrHitCount / nrrPcts.length : 0;
            const medianComposite = (medianMrr + medianNrr) / 2;

            // ── Extra consistency metrics ──────────────────────────────────
            const avgArr = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
            const halfN = Math.floor(mrrPcts.length / 2);
            const halfNNrr = Math.floor(nrrPcts.length / 2);
            const mrrTrend = halfN >= 1 ? avgArr(mrrPcts.slice(-halfN)) - avgArr(mrrPcts.slice(0, halfN)) : 0;
            const nrrTrend = halfNNrr >= 1 ? avgArr(nrrPcts.slice(-halfNNrr)) - avgArr(nrrPcts.slice(0, halfNNrr)) : 0;
            const trendComposite = mrrPcts.length >= 2 || nrrPcts.length >= 2 ? (mrrTrend + nrrTrend) / 2 : null;

            const sortedValid = [...monthsToShow]
              .filter((m) => !m.isVacation && !m.isRampUp)
              .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
            let mrrStreakCurrent = 0;
            for (let i = sortedValid.length - 1; i >= 0; i--) {
              if (sortedValid[i].mrrTarget > 0 && sortedValid[i].mrrPct >= 100) mrrStreakCurrent++;
              else break;
            }
            let nrrStreakCurrent = 0;
            for (let i = sortedValid.length - 1; i >= 0; i--) {
              if (sortedValid[i].nrrTarget > 0 && sortedValid[i].nrrPct >= 100) nrrStreakCurrent++;
              else break;
            }
            let mrrBestStreak = 0, mrrRun = 0;
            let mrrBestStreakMonths: string[] = [], mrrRunMonths: string[] = [];
            for (const m of sortedValid) {
              if (m.mrrTarget > 0 && m.mrrPct >= 100) {
                mrrRun++; mrrRunMonths.push(m.label);
                if (mrrRun > mrrBestStreak) { mrrBestStreak = mrrRun; mrrBestStreakMonths = [...mrrRunMonths]; }
              } else { mrrRun = 0; mrrRunMonths = []; }
            }
            let nrrBestStreak = 0, nrrRun = 0;
            let nrrBestStreakMonths: string[] = [], nrrRunMonths: string[] = [];
            for (const m of sortedValid) {
              if (m.nrrTarget > 0 && m.nrrPct >= 100) {
                nrrRun++; nrrRunMonths.push(m.label);
                if (nrrRun > nrrBestStreak) { nrrBestStreak = nrrRun; nrrBestStreakMonths = [...nrrRunMonths]; }
              } else { nrrRun = 0; nrrRunMonths = []; }
            }

            const doubleHitCount = monthsToShow.filter(
              (m) => !m.isVacation && !m.isRampUp && m.mrrTarget > 0 && m.nrrTarget > 0 && m.mrrPct >= 100 && m.nrrPct >= 100
            ).length;
            const doubleTotal = monthsToShow.filter(
              (m) => !m.isVacation && !m.isRampUp && m.mrrTarget > 0 && m.nrrTarget > 0
            ).length;

            const compositeMonths = monthsToShow
              .filter((m) => !m.isVacation && !m.isRampUp && m.mrrTarget > 0 && m.nrrTarget > 0)
              .map((m) => (m.mrrPct + m.nrrPct) / 2);
            const compMean = avgArr(compositeMonths);
            const compStdDev = compositeMonths.length > 1
              ? Math.sqrt(compositeMonths.reduce((s, v) => s + (v - compMean) ** 2, 0) / compositeMonths.length)
              : 0;
            const mrrVolMonths = monthsToShow.filter((m) => !m.isVacation && !m.isRampUp && m.mrrTarget > 0).map((m) => m.mrrPct);
            const nrrVolMonths = monthsToShow.filter((m) => !m.isVacation && !m.isRampUp && m.nrrTarget > 0).map((m) => m.nrrPct);
            const mrrVolMean = avgArr(mrrVolMonths);
            const nrrVolMean = avgArr(nrrVolMonths);
            const mrrStdDev = mrrVolMonths.length > 1 ? Math.sqrt(mrrVolMonths.reduce((s, v) => s + (v - mrrVolMean) ** 2, 0) / mrrVolMonths.length) : 0;
            const nrrStdDev = nrrVolMonths.length > 1 ? Math.sqrt(nrrVolMonths.reduce((s, v) => s + (v - nrrVolMean) ** 2, 0) / nrrVolMonths.length) : 0;

            const consistencyInsight = (() => {
              if (mrrHitRate >= 0.6 && nrrHitRate >= 0.6)
                return "Consistência forte nos dois indicadores — mantenha o ritmo.";
              if (mrrHitRate < 0.4 && nrrHitRate >= 0.6)
                return `NRR consistente (${nrrHitCount}/${nrrPcts.length} meses na meta). MRR abaixo do esperado — foque em novas vendas.`;
              if (mrrHitRate >= 0.6 && nrrHitRate < 0.4)
                return `MRR consistente (${mrrHitCount}/${mrrPcts.length} meses na meta). NRR abaixo — retenção e expansão precisam de atenção.`;
              if (medianMrr < 50 || medianNrr < 50)
                return "Meses com atingimento crítico registrados. Revise estratégia no indicador mais fraco.";
              return "Consistência abaixo de 60% nos dois indicadores — há espaço relevante para melhora.";
            })();

            const PctBadge = ({ pct }: { pct: number }) => {
              const color = pct >= 100 ? (isDark ? "#34d399" : "#059669")
                : pct >= 80 ? (isDark ? "#fbbf24" : "#d97706")
                : (isDark ? "#f87171" : "#dc2626");
              return (
                <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(pct)}%
                </span>
              );
            };

            const thStyle: React.CSSProperties = {
              color: subColor, fontWeight: 700, fontSize: 9,
              letterSpacing: "0.08em", textTransform: "uppercase" as const,
              paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`,
            };
            const MonthTable = ({ type }: { type: "MRR" | "NRR" }) => (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left" }}>Mês</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Meta</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Atingido</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>%</th>
                    <th style={{ ...thStyle, textAlign: "center", width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {monthsToShow.map((m) => {
                    const ach = type === "MRR" ? m.mrrAchieved : m.nrrAchieved;
                    const tgt = type === "MRR" ? m.mrrTarget : m.nrrTarget;
                    const pct = type === "MRR" ? m.mrrPct : m.nrrPct;
                    const fullName = MONTH_NAMES[parseInt(m.monthKey.split("-")[1]) - 1] ?? m.label;
                    const pctColor = pct >= 100 ? "#E4A900" : pctColorDsm(pct);
                    return (
                      <tr key={m.monthKey} style={{ borderBottom: `1px solid ${dividerColor}` }}>
                        <td style={{ padding: "5px 0", color: numColor, fontWeight: 500 }}>{fullName}</td>
                        <td style={{ padding: "5px 0 5px 8px", color: subColor, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                          {tgt > 0 ? fmtBRLFull(tgt) : <span style={{ opacity: 0.4 }}>—</span>}
                        </td>
                        <td style={{ padding: "5px 0 5px 8px", color: numColor, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                          {fmtBRLFull(ach)}
                        </td>
                        <td style={{ padding: "5px 0 5px 8px", color: pctColor, textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          {tgt > 0 ? `${pct.toFixed(1)}%` : <span style={{ opacity: 0.4 }}>—</span>}
                        </td>
                        <td style={{ padding: "5px 0 5px 8px", textAlign: "center", width: 40 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            {m.isVacation && <span title="Férias" style={{ fontSize: 12, lineHeight: 1 }}>🌴</span>}
                            {m.isRampUp && <span title="Ramp-up" style={{ fontSize: 12, lineHeight: 1 }}>🚀</span>}
                            {pct >= 100 && <Crown size={11} style={{ color: "#E4A900", strokeWidth: 1.5 }} />}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );

            return (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showYtdInfo ? 8 : 18 }}>
                  <BarChart2 size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                    Resumo do seu ano
                  </h2>
                  <button
                    onClick={() => setShowYtdInfo((v) => !v)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: showYtdInfo
                        ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)")
                        : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                      border: `1px solid ${showYtdInfo
                        ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)")
                        : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                      borderRadius: 99, padding: "2px 8px",
                      cursor: "pointer",
                      color: showYtdInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                      transition: "all 0.15s", flexShrink: 0,
                    }}
                  >
                    <Info size={10} strokeWidth={2} />
                    Sobre
                  </button>
                </div>
                {showYtdInfo && (
                  <div style={{
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                    borderRadius: 12, padding: "14px 16px", marginBottom: 14,
                    fontSize: 12, lineHeight: 1.65, color: numColor,
                    display: "flex", flexDirection: "column", gap: 8,
                    boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📊 O que é</div>
                      <p style={{ margin: 0, color: subColor }}>Mostra o total acumulado de MRR e NRR que você gerou no ano, com o percentual de atingimento da meta acumulada. Os cards detalham média mensal, melhor e pior mês em receita.</p>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                      <p style={{ margin: 0, color: subColor }}>O % YTD mostra como está o atingimento geral do ano até agora. Comparar o melhor e pior mês ajuda a entender a consistência dos resultados ao longo dos meses. Expandir o mês a mês dá uma visão detalhada de cada período.</p>
                    </div>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* ── MRR Card — Facilities style ─────────────────────── */}
                  <div style={{
                    background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                    border: `1px solid ${cardBorder}`,
                    borderRadius: 16,
                    padding: "20px 20px 20px",
                    boxShadow: isDark
                      ? "0 2px 16px rgba(0,0,0,0.30)"
                      : "0 2px 16px rgba(0,0,0,0.08)",
                    display: "flex", flexDirection: "column",
                    overflow: "hidden",
                  }}>
                    {/* Top: label + icon */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: subColor, lineHeight: 1.35 }}>
                        De MRR:
                      </span>
                      <Repeat2 style={{ width: 16, height: 16, color: CYAN, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                    </div>

                    {/* Hero number + YTD badge */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                      <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                        {fmtBRLFull(ytd.mrrAch)}
                      </div>
                      <span className="ytd-badge-wrap" style={{ position: "relative", display: "inline-flex" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                          border: "1px solid rgba(228,169,0,0.40)",
                          borderRadius: 99, padding: "2px 8px",
                          fontSize: 10, fontWeight: 700, color: "#E4A900",
                          fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em",
                          cursor: "help",
                        }}>
                          {Math.round(ytd.mrrPct)}% YTD
                        </span>
                        <span className="ytd-tip" style={{
                          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
                          transform: "translateX(-50%)",
                          background: isDark ? "#1c1c2e" : "#fff",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                          borderRadius: 6, padding: "5px 10px",
                          fontSize: 12, lineHeight: 1.4,
                          color: isDark ? "#e0e0e0" : "#333",
                          whiteSpace: "nowrap",
                          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
                          pointerEvents: "none", zIndex: 100,
                        }}>
                          MRR acumulado no ano: realizado ÷ metas do período.
                        </span>
                      </span>
                    </div>

                    {/* 2-column stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
                      {/* Col 1: Maior receita */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                          <TrendingUp style={{ width: 12, height: 12, flexShrink: 0 }} />
                          Mês com maior receita:
                        </div>
                        {ytd.bestMrrMonth ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                              {fmtBRLFull(ytd.bestMrrMonth.mrrAchieved)}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                              {MONTH_NAMES[parseInt(ytd.bestMrrMonth.monthKey.split("-")[1]) - 1] ?? ytd.bestMrrMonth.label}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: subColor }}>—</span>
                        )}
                      </div>

                      {/* Col 3: Menor receita */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                          <TrendingDown style={{ width: 12, height: 12, flexShrink: 0 }} />
                          Mês com menor receita:
                        </div>
                        {ytd.worstMrrMonth ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                              {fmtBRLFull(ytd.worstMrrMonth.mrrAchieved)}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                              {MONTH_NAMES[parseInt(ytd.worstMrrMonth.monthKey.split("-")[1]) - 1] ?? ytd.worstMrrMonth.label}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: subColor }}>—</span>
                        )}
                      </div>
                    </div>

                  </div>
                  {/* ── NRR Card — Facilities style ─────────────────────── */}
                  <div style={{
                    background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                    border: `1px solid ${cardBorder}`,
                    borderRadius: 16,
                    padding: "20px 20px 20px",
                    boxShadow: isDark
                      ? "0 2px 16px rgba(0,0,0,0.30)"
                      : "0 2px 16px rgba(0,0,0,0.08)",
                    display: "flex", flexDirection: "column",
                    overflow: "hidden",
                  }}>
                    {/* Top: label + icon */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: subColor, lineHeight: 1.35 }}>
                        De NRR:
                      </span>
                      <BarChart2 style={{ width: 16, height: 16, color: PURPLE, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                    </div>

                    {/* Hero number + YTD badge */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                      <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                        {fmtBRLFull(ytd.nrrAch)}
                      </div>
                      <span className="ytd-badge-wrap" style={{ position: "relative", display: "inline-flex" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                          border: "1px solid rgba(228,169,0,0.40)",
                          borderRadius: 99, padding: "2px 8px",
                          fontSize: 10, fontWeight: 700, color: "#E4A900",
                          fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em",
                          cursor: "help",
                        }}>
                          {Math.round(ytd.nrrPct)}% YTD
                        </span>
                        <span className="ytd-tip" style={{
                          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
                          transform: "translateX(-50%)",
                          background: isDark ? "#1c1c2e" : "#fff",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                          borderRadius: 6, padding: "5px 10px",
                          fontSize: 12, lineHeight: 1.4,
                          color: isDark ? "#e0e0e0" : "#333",
                          whiteSpace: "nowrap",
                          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
                          pointerEvents: "none", zIndex: 100,
                        }}>
                          NRR acumulado no ano: realizado ÷ metas do período.
                        </span>
                      </span>
                    </div>

                    {/* 2-column stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
                      {/* Col 1: Maior receita */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                          <TrendingUp style={{ width: 12, height: 12, flexShrink: 0 }} />
                          Mês com maior receita:
                        </div>
                        {ytd.bestNrrMonth ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                              {fmtBRLFull(ytd.bestNrrMonth.nrrAchieved)}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                              {MONTH_NAMES[parseInt(ytd.bestNrrMonth.monthKey.split("-")[1]) - 1] ?? ytd.bestNrrMonth.label}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: subColor }}>—</span>
                        )}
                      </div>

                      {/* Col 3: Menor receita */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                          <TrendingDown style={{ width: 12, height: 12, flexShrink: 0 }} />
                          Mês com menor receita:
                        </div>
                        {ytd.worstNrrMonth ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                              {fmtBRLFull(ytd.worstNrrMonth.nrrAchieved)}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                              {MONTH_NAMES[parseInt(ytd.worstNrrMonth.monthKey.split("-")[1]) - 1] ?? ytd.worstNrrMonth.label}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: subColor }}>—</span>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* ── Comissões Card ───────────────────────────────────── */}
                  {!hideCommission ? (
                  <div style={{
                    background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                    border: `1px solid ${cardBorder}`,
                    borderRadius: 16,
                    padding: "20px 20px 20px",
                    boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.30)" : "0 2px 16px rgba(0,0,0,0.08)",
                    display: "flex", flexDirection: "column",
                    overflow: "hidden",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>Suas Comissões:</span>
                      <Wallet style={{ width: 16, height: 16, color: PURPLE, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                    </div>
                    <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 16 }}>
                      {fmtBRLFull(ytd.totalCommission)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                          <Repeat2 style={{ width: 12, height: 12 }} />Comissão MRR:
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                          {fmtBRLFull(ytd.mrrCommission)}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                          <BarChart2 style={{ width: 12, height: 12 }} />Comissão NRR:
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                          {fmtBRLFull(ytd.nrrCommission)}
                        </span>
                      </div>
                    </div>
                  </div>
                  ) : (
                  <div style={{
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                    border: `1px dashed ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                    borderRadius: 16,
                    padding: "20px 20px 20px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    minHeight: 120,
                  }}>
                    <span style={{ fontSize: 11, color: subColor, opacity: 0.4, fontStyle: "italic" }}>Em breve</span>
                  </div>
                  )}

                  {/* ── Placeholder (new card slot) ──────────────────────── */}
                  <div style={{
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                    border: `1px dashed ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                    borderRadius: 16,
                    padding: "20px 20px 20px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    minHeight: 120,
                  }}>
                    <span style={{ fontSize: 11, color: subColor, opacity: 0.4, fontStyle: "italic" }}>Em breve</span>
                  </div>
                </div>

                {/* ── Consistência ────────────────────────────────────────── */}
                <div style={{ marginBottom: 28, order: -1 }}>
                  {/* Consistência card */}
                  <div style={{
                    background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                    border: `1px solid ${cardBorder}`,
                    borderRadius: 16,
                    padding: "20px 20px 0",
                    boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.30)" : "0 2px 16px rgba(0,0,0,0.08)",
                    display: "flex", flexDirection: "column",
                    overflow: "visible",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>Sua Consistência:</span>
                      <Target style={{ width: 16, height: 16, color: CYAN, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                    </div>
                    {/* Hero: mediana composta + badge */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                      <div style={{
                        fontSize: "clamp(2.8rem, 4vw, 3.5rem)", fontWeight: 900,
                        letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1,
                        color: medianComposite >= 90 ? "#E4A900" : (isDark ? "#FFFFFF" : CYAN),
                      }}>
                        {medianComposite.toFixed(1)}%
                      </div>
                      <span ref={consistencyBadgeRef} style={{ position: "relative", display: "inline-flex" }}>
                        <span
                          onClick={() => setShowConsistencyDetails((v) => !v)}
                          style={{
                            display: "inline-flex", alignItems: "center",
                            background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                            border: "1px solid rgba(228,169,0,0.40)",
                            borderRadius: 99, padding: "2px 8px",
                            fontSize: 10, fontWeight: 700, color: "#E4A900",
                            letterSpacing: "0.02em", cursor: "pointer",
                            userSelect: "none",
                          }}
                        >
                          Ver Detalhes
                        </span>
                        {showConsistencyDetails && (
                          <div className="consistency-detail-card" style={{
                            position: "absolute", top: "calc(100% + 8px)", left: 0,
                            width: 380, zIndex: 200,
                            background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                            borderRadius: 12, padding: "18px 20px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              Sua Consistência
                            </div>
                            <p style={{ margin: "0 0 14px", fontSize: 10, color: subColor, lineHeight: 1.5, fontStyle: "italic" }}>
                              Calculado pela mediana dos seus percentuais (%) mensais de MRR e NRR, excluindo os meses em férias e ramp-up.
                            </p>
                            <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                              Você bate sua meta com regularidade?
                            </p>
                            {/* Threshold rows */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                              {[
                                { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Acima de 90%", desc: "Você está consistente, chegando perto ou superando o objetivo na maioria dos meses." },
                                { dot: isDark ? "#fbbf24" : "#d97706", labelColor: isDark ? "#fbbf24" : "#d97706", range: "Entre 70% e 90%", desc: "Você está no caminho, mas ainda há espaço para crescer." },
                                { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Abaixo de 70%", desc: "Os resultados estão ficando distantes da meta com frequência." },
                              ].map(({ dot, labelColor, range, desc }) => (
                                <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", marginBottom: 10 }} />
                            {/* MRR row */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Mediana MRR</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: medianMrr >= 100 ? "#E4A900" : pctColorDsm(medianMrr), fontVariantNumeric: "tabular-nums" }}>
                                  {medianMrr.toFixed(1)}%
                                </span>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                                  background: medianMrr >= 90 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : medianMrr >= 70 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                                  color: medianMrr >= 90 ? (isDark ? "#34d399" : "#059669") : medianMrr >= 70 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                                  borderRadius: 99, padding: "2px 6px",
                                }}>
                                  {medianMrr >= 90 ? "Acima de 90%" : medianMrr >= 70 ? "Entre 70% e 90%" : "Abaixo de 70%"}
                                </span>
                              </div>
                            </div>
                            {/* NRR row */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Mediana NRR</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: medianNrr >= 100 ? "#E4A900" : pctColorDsm(medianNrr), fontVariantNumeric: "tabular-nums" }}>
                                  {medianNrr.toFixed(1)}%
                                </span>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                                  background: medianNrr >= 90 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : medianNrr >= 70 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                                  color: medianNrr >= 90 ? (isDark ? "#34d399" : "#059669") : medianNrr >= 70 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                                  borderRadius: 99, padding: "2px 6px",
                                }}>
                                  {medianNrr >= 90 ? "Acima de 90%" : medianNrr >= 70 ? "Entre 70% e 90%" : "Abaixo de 70%"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </span>
                    </div>


                    {/* ── Extra metrics: tendência · sequência · duplo · volatilidade ── */}
                    <div ref={infoCardsRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0 16px", marginBottom: 14 }}>
                      {/* Tendência recente */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                          <TrendingUp style={{ width: 12, height: 12 }} />Tendência recente
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {trendComposite !== null ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start",
                              background: trendComposite >= 15
                                ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)"
                                : trendComposite <= -15
                                  ? "rgba(239,68,68,0.15)"
                                  : "rgba(1,126,132,0.14)",
                              border: trendComposite >= 15
                                ? "1px solid rgba(228,169,0,0.40)"
                                : trendComposite <= -15
                                  ? "1px solid rgba(239,68,68,0.40)"
                                  : "1px solid rgba(1,126,132,0.35)",
                              color: trendComposite >= 15
                                ? "#E4A900"
                                : trendComposite <= -15
                                  ? "#ef4444"
                                  : "#0fb8c0",
                              borderRadius: 99, padding: "3px 10px",
                              fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                            }}>
                              {trendComposite >= 15
                                ? <TrendingUp size={11} />
                                : trendComposite <= -15
                                  ? <TrendingDown size={11} />
                                  : <Repeat2 size={11} />}
                              {trendComposite >= 15 ? "Acelerando" : trendComposite <= -15 ? "Desacelerando" : "Estável"}
                            </span>
                          ) : <span style={{ fontSize: 11, color: subColor, opacity: 0.4 }}>—</span>}
                          <button onClick={() => setActiveInfoCard(v => v === "tendencia" ? null : "tendencia")} style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", padding: 0, flexShrink: 0,
                            cursor: "pointer",
                            color: activeInfoCard === "tendencia" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                            transition: "color 0.15s",
                          }}>
                            <Info size={14} strokeWidth={2} />
                          </button>
                        </div>
                        {trendComposite !== null && (
                          <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>
                            {trendComposite >= 0 ? "+" : ""}{trendComposite.toFixed(0)} pp vs início
                          </span>
                        )}
                        {activeInfoCard === "tendencia" && (
                          <div className="consistency-detail-card" style={{
                            position: "absolute", top: "calc(100% + 6px)", left: 0,
                            width: 320, zIndex: 300,
                            background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                            borderRadius: 12, padding: "14px 16px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              Tendência Recente
                            </div>
                            <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                              Você está evoluindo ao longo do ano?
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {([
                                { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Acelerando", desc: "Seus últimos meses estão melhores do que os primeiros. Você está no caminho certo. (variação ≥ +15 pp)" },
                                { dot: isDark ? "#0fb8c0" : "#017E84", labelColor: isDark ? "#0fb8c0" : "#017E84", range: "Estável", desc: "Sem variação significativa ao longo do ano. Resultado consistente, sem aceleração ou queda. (variação entre −15 pp e +15 pp)" },
                                { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Desacelerando", desc: "Os meses mais recentes estão abaixo do início do ano. Atenção para reverter a tendência. (variação ≤ −15 pp)" },
                              ] as { dot: string; labelColor: string; range: string; desc: string }[]).map(({ dot, labelColor, range, desc }) => (
                                <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", margin: "12px 0 10px" }} />
                            {([
                              { icon: <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />, label: "Tendência MRR", val: mrrTrend },
                              { icon: <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />, label: "Tendência NRR", val: nrrTrend },
                            ]).map(({ icon, label, val }, i) => {
                              const cat = val >= 15 ? "Acelerando" : val <= -15 ? "Desacelerando" : "Estável";
                              const valColor = val >= 15 ? (isDark ? "#34d399" : "#059669") : val <= -15 ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#0fb8c0" : "#017E84");
                              const badgeBg = val >= 15 ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)" : val <= -15 ? "rgba(239,68,68,0.15)" : "rgba(1,126,132,0.14)";
                              const badgeBorder = val >= 15 ? "1px solid rgba(228,169,0,0.40)" : val <= -15 ? "1px solid rgba(239,68,68,0.40)" : "1px solid rgba(1,126,132,0.35)";
                              return (
                                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i === 0 ? 8 : 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    {icon}
                                    <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>{label}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: valColor }}>
                                      {val >= 0 ? "+" : ""}{val.toFixed(0)} pp
                                    </span>
                                    <span style={{ fontSize: 9, fontWeight: 700, background: badgeBg, border: badgeBorder, color: valColor, borderRadius: 99, padding: "2px 7px", letterSpacing: "0.02em" }}>
                                      {cat}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Volatilidade */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                          <BarChart2 style={{ width: 12, height: 12 }} />Volatilidade
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", alignSelf: "flex-start",
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                            background: compStdDev < 20
                              ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)")
                              : compStdDev < 40
                                ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)")
                                : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                            border: compStdDev < 20
                              ? "1px solid rgba(52,211,153,0.40)"
                              : compStdDev < 40
                                ? "1px solid rgba(251,191,36,0.40)"
                                : "1px solid rgba(248,113,113,0.40)",
                            color: compStdDev < 20
                              ? (isDark ? "#34d399" : "#059669")
                              : compStdDev < 40
                                ? (isDark ? "#fbbf24" : "#d97706")
                                : (isDark ? "#f87171" : "#dc2626"),
                            borderRadius: 99, padding: "3px 10px",
                          }}>
                            {compStdDev < 20 ? "Baixa" : compStdDev < 40 ? "Média" : "Alta"}
                          </span>
                          <button onClick={() => setActiveInfoCard(v => v === "volatilidade" ? null : "volatilidade")} style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", padding: 0, flexShrink: 0,
                            cursor: "pointer",
                            color: activeInfoCard === "volatilidade" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                            transition: "color 0.15s",
                          }}>
                            <Info size={14} strokeWidth={2} />
                          </button>
                        </div>
                        {compositeMonths.length > 1 && (
                          <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>±{compStdDev.toFixed(0)} pp desvio padrão</span>
                        )}
                        {activeInfoCard === "volatilidade" && (
                          <div className="consistency-detail-card" style={{
                            position: "absolute", top: "calc(100% + 6px)", left: 0,
                            width: 320, zIndex: 300,
                            background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                            borderRadius: 12, padding: "14px 16px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              Volatilidade
                            </div>
                            <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                              Seus resultados oscilam muito entre os meses?
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {([
                                { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Baixa", desc: "Resultados estáveis e previsíveis. Você mantém um nível parecido mês a mês. (desvio padrão < 20 pp)" },
                                { dot: isDark ? "#fbbf24" : "#d97706", labelColor: isDark ? "#fbbf24" : "#d97706", range: "Média", desc: "Oscilações moderadas entre os meses. Há variação, mas sem extremos. (desvio padrão 20–40 pp)" },
                                { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Alta", desc: "Grandes variações entre meses bons e ruins. Resultado pouco previsível. (desvio padrão > 40 pp)" },
                              ] as { dot: string; labelColor: string; range: string; desc: string }[]).map(({ dot, labelColor, range, desc }) => (
                                <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", margin: "12px 0 10px" }} />
                            {([
                              { icon: <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />, label: "Volatilidade MRR", std: mrrStdDev },
                              { icon: <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />, label: "Volatilidade NRR", std: nrrStdDev },
                            ]).map(({ icon, label, std }, i) => {
                              const cat = std < 20 ? "Baixa" : std < 40 ? "Média" : "Alta";
                              const valColor = std < 20 ? (isDark ? "#34d399" : "#059669") : std < 40 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626");
                              const badgeBg = std < 20 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : std < 40 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)");
                              const badgeBorder = std < 20 ? "1px solid rgba(52,211,153,0.40)" : std < 40 ? "1px solid rgba(251,191,36,0.40)" : "1px solid rgba(248,113,113,0.40)";
                              return (
                                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i === 0 ? 8 : 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    {icon}
                                    <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>{label}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: valColor }}>
                                      ±{std.toFixed(0)} pp
                                    </span>
                                    <span style={{ fontSize: 9, fontWeight: 700, background: badgeBg, border: badgeBorder, color: valColor, borderRadius: 99, padding: "2px 7px", letterSpacing: "0.02em" }}>
                                      {cat}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Histórico de Sequência */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                          <CalendarDays style={{ width: 12, height: 12 }} />Histórico de Sequência
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", alignSelf: "flex-start",
                            background: mrrBestStreak > 0 || nrrBestStreak > 0
                              ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)"
                              : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                            border: mrrBestStreak > 0 || nrrBestStreak > 0
                              ? "1px solid rgba(228,169,0,0.40)"
                              : (isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)"),
                            borderRadius: 99, padding: "3px 10px",
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                            color: mrrBestStreak > 0 || nrrBestStreak > 0 ? "#E4A900" : subColor,
                          }}>
                            🔥 {mrrBestStreak} MRR · {nrrBestStreak} NRR
                          </span>
                          <button onClick={() => setActiveInfoCard(v => v === "sequencia" ? null : "sequencia")} style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", padding: 0, flexShrink: 0,
                            cursor: "pointer",
                            color: activeInfoCard === "sequencia" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                            transition: "color 0.15s",
                          }}>
                            <Info size={14} strokeWidth={2} />
                          </button>
                        </div>
                        <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>melhor sequência do ano</span>
                        {activeInfoCard === "sequencia" && (
                          <div className="consistency-detail-card" style={{
                            position: "absolute", top: "calc(100% + 6px)", left: 0,
                            width: 320, zIndex: 300,
                            background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                            borderRadius: 12, padding: "14px 16px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              Histórico de Sequência
                            </div>
                            <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                              Quantos meses seguidos você bateu sua meta?
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                  <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Melhor sequência MRR</span>
                                  {mrrBestStreak > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#E4A900" }}>{mrrBestStreak} meses</span>}
                                </div>
                                {mrrBestStreakMonths.length > 0
                                  ? <span style={{ fontSize: 11, color: numColor, lineHeight: 1.5, paddingLeft: 14 }}>{mrrBestStreakMonths.join(" · ")}</span>
                                  : <span style={{ fontSize: 11, color: subColor, opacity: 0.4, paddingLeft: 14 }}>Nenhuma sequência</span>}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                  <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Melhor sequência NRR</span>
                                  {nrrBestStreak > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#E4A900" }}>{nrrBestStreak} meses</span>}
                                </div>
                                {nrrBestStreakMonths.length > 0
                                  ? <span style={{ fontSize: 11, color: numColor, lineHeight: 1.5, paddingLeft: 14 }}>{nrrBestStreakMonths.join(" · ")}</span>
                                  : <span style={{ fontSize: 11, color: subColor, opacity: 0.4, paddingLeft: 14 }}>Nenhuma sequência</span>}
                              </div>
                            </div>
                            <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", marginBottom: 10 }} />
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Sequência atual</span>
                              {mrrStreakCurrent > 0 || nrrStreakCurrent > 0 ? (
                                <span style={{
                                  display: "inline-flex", alignItems: "center",
                                  background: "rgba(1,126,132,0.14)",
                                  border: "1px solid rgba(1,126,132,0.35)",
                                  borderRadius: 99, padding: "2px 10px",
                                  fontSize: 10, fontWeight: 700, color: "#0fb8c0",
                                }}>
                                  🔥 {mrrStreakCurrent} MRR · {nrrStreakCurrent} NRR
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: subColor, opacity: 0.4 }}>Sem sequência ativa</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Histórico metas */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                          <Target style={{ width: 12, height: 12 }} />Histórico metas
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", alignSelf: "flex-start",
                          background: mrrHitRate >= 0.6 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : mrrHitRate >= 0.4 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                          color: mrrHitRate >= 0.6 ? (isDark ? "#34d399" : "#059669") : mrrHitRate >= 0.4 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                          borderRadius: 99, padding: "2px 6px",
                        }}>
                          MRR: {mrrHitCount}/{mrrPcts.length} meses na meta
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", alignSelf: "flex-start",
                          background: nrrHitRate >= 0.6 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : nrrHitRate >= 0.4 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                          color: nrrHitRate >= 0.6 ? (isDark ? "#34d399" : "#059669") : nrrHitRate >= 0.4 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                          borderRadius: 99, padding: "2px 6px",
                        }}>
                          NRR: {nrrHitCount}/{nrrPcts.length} meses na meta
                        </span>
                      </div>
                    </div>

                    <div style={{ height: 20 }} />
                  </div>

                </div>

              </div>
            );
          })()}

          {/* ── SECTION 1: Trend Chart (after YTD) ───────────────────────── */}
          {viewMode === "employee" && chartData.length > 0 ? (
            <div>
              {/* Section label */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <TrendingUp size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                    Sua linha de tendência no atingimento de metas
                  </h2>
                  <button
                    onClick={() => setShowTrendInfo((v) => !v)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: showTrendInfo
                        ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)")
                        : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                      border: `1px solid ${showTrendInfo
                        ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)")
                        : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                      borderRadius: 99, padding: "2px 8px",
                      cursor: "pointer",
                      color: showTrendInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                      transition: "all 0.15s", flexShrink: 0,
                    }}
                  >
                    <Info size={10} strokeWidth={2} />
                    Sobre
                  </button>
                </div>
                {showTrendInfo && (
                  <div style={{
                    background: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(255,255,255,0.55)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                    borderRadius: 12, padding: "14px 16px", marginBottom: 10,
                    fontSize: 12, lineHeight: 1.65, color: numColor,
                    display: "flex", flexDirection: "column", gap: 8,
                    boxShadow: isDark
                      ? "0 4px 24px rgba(0,0,0,0.25)"
                      : "0 4px 24px rgba(0,0,0,0.07)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📈 O que é</div>
                      <p style={{ margin: 0, color: subColor }}>Mostra o quanto você atingiu da sua meta de MRR e NRR em cada mês do ano. A linha tracejada horizontal é o ponto de 100% de meta.</p>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                      <p style={{ margin: 0, color: subColor }}>Meses abaixo de 100% mostram onde o resultado ficou abaixo do esperado. Meses acima mostram os períodos de melhor desempenho. Olhar MRR e NRR juntos ajuda a ver se os dois caminham no mesmo ritmo ou se um descolou do outro.</p>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                    <svg width={20} height={2} style={{ display: "inline-block", flexShrink: 0 }}>
                      <line x1={0} y1={1} x2={20} y2={1} stroke={CYAN} strokeWidth={1} strokeDasharray="4 2" />
                    </svg>
                    <span style={{ color: CYAN, fontWeight: 700 }}>MRR%</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                    <span style={{ width: 20, height: 2, background: PURPLE, display: "inline-block", borderRadius: 1 }} />
                    <span style={{ color: PURPLE, fontWeight: 700 }}>NRR%</span>
                  </span>
                </div>
              </div>

              <div style={{ height: 220, padding: "0 16px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 36, left: 0, bottom: 12 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridColor}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: axisColor, fontSize: 11, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      ticks={chartYTicks}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: axisColor, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                      domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax / 20) * 20)]}
                    />
                    <ReferenceLine
                      y={100}
                      stroke={refColor}
                      strokeDasharray="3 2"
                      strokeWidth={1}
                      strokeOpacity={0.4}
                      label={{
                        value: "Meta: 100%",
                        fill: refColor,
                        opacity: 0.4,
                        fontSize: 10,
                        fontWeight: 600,
                        position: "insideTopRight",
                      }}
                    />
                    <Tooltip
                      content={<ChartTooltip isDark={isDark} />}
                      cursor={{ stroke: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", strokeWidth: 1 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="mrrPct"
                      stroke={CYAN}
                      strokeWidth={1}
                      strokeDasharray="4 2"
                      dot={false}
                      activeDot={{ r: 5, fill: CYAN, stroke: "none" }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="nrrPct"
                      stroke={PURPLE}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, fill: PURPLE, stroke: "none" }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : viewMode === "employee" && chartData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: subColor, fontSize: 13, fontStyle: "italic" }}>
              Sem dados históricos disponíveis para {year}.
            </div>
          ) : null}

          {/* ── EMPLOYEE: Mês a Mês chart ────────────────────────────────── */}
          {viewMode === "employee" && monthlyHistory.length > 0 && (() => {
            const monthsToShow = monthlyHistory.filter(
              (m) => m.mrrAchieved > 0 || m.nrrAchieved > 0 || m.mrrTarget > 0 || m.nrrTarget > 0 || m.isVacation || m.isRampUp
            );
            const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
            const infoButtonStyle: React.CSSProperties = {
              display: "inline-flex", alignItems: "center", gap: 4,
              background: showMonthlyInfo
                ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)")
                : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
              border: `1px solid ${showMonthlyInfo
                ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)")
                : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
              borderRadius: 99, padding: "2px 8px",
              cursor: "pointer",
              color: showMonthlyInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
              fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
              transition: "all 0.15s", flexShrink: 0,
            };
            const thStyle: React.CSSProperties = {
              color: subColor, fontWeight: 700, fontSize: 9,
              letterSpacing: "0.08em", textTransform: "uppercase" as const,
              paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`,
              whiteSpace: "nowrap" as const,
            };
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <CalendarDays size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                    Seu mês a mês
                  </h2>
                  <button onClick={() => setShowMonthlyInfo((v) => !v)} style={infoButtonStyle}>
                    <Info size={10} strokeWidth={2} />
                    Sobre
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: showMonthlyInfo ? 8 : 16 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: subColor }}>
                    <span style={{ color: DELTA_UP_COLOR, fontSize: 9, lineHeight: 1 }}>▲</span>
                    Valor acima comparando com o mês anterior
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: subColor }}>
                    <span style={{ color: DELTA_DOWN_COLOR, fontSize: 9, lineHeight: 1 }}>▼</span>
                    Valor abaixo comparando com o mês anterior
                  </span>
                </div>
                {showMonthlyInfo && (
                  <div style={{
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                    borderRadius: 12, padding: "14px 16px", marginBottom: 16,
                    fontSize: 12, lineHeight: 1.65, color: numColor,
                    display: "flex", flexDirection: "column", gap: 8,
                    boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📊 O que é</div>
                      <p style={{ margin: 0, color: subColor }}>Visão compilada de todos os seus números mês a mês — MRR, NRR, totais e comissão — em uma única tabela. Inclui indicadores de férias, ramp-up e meta batida por mês.</p>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                      <p style={{ margin: 0, color: subColor }}>Permite comparar todos os indicadores de um mês de forma rápida, sem precisar abrir cada card separadamente. Coroa aparece quando a meta foi batida naquele mês.</p>
                    </div>
                  </div>
                )}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: "left" }}>Mês</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Time</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>MRR R$</th>
                        <th style={{ ...thStyle, width: 14 }} />
                        <th style={{ ...thStyle, textAlign: "center" }}>MRR %</th>
                        <th style={{ ...thStyle, width: 14 }} />
                        <th style={{ ...thStyle, textAlign: "center" }}>NRR R$</th>
                        <th style={{ ...thStyle, width: 14 }} />
                        <th style={{ ...thStyle, textAlign: "center" }}>NRR %</th>
                        <th style={{ ...thStyle, width: 14 }} />
                        <th style={{ ...thStyle, textAlign: "center" }}>Total R$</th>
                        <th style={{ ...thStyle, width: 14 }} />
                        <th style={{ ...thStyle, textAlign: "center" }}>Total %</th>
                        <th style={{ ...thStyle, width: 14 }} />
                        <th style={{ ...thStyle, textAlign: "center" }}>Comissão</th>
                        <th style={{ ...thStyle, textAlign: "center", width: 52 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {monthsToShow.map((m, idx) => {
                        const prev = monthsToShow[idx - 1];
                        const fullName = MONTH_NAMES[parseInt(m.monthKey.split("-")[1]) - 1] ?? m.label;
                        const totalAch = m.mrrAchieved + m.nrrAchieved;
                        const totalTgt = m.mrrTarget + m.nrrTarget;
                        const totalPct = totalTgt > 0 ? (totalAch / totalTgt) * 100 : 0;
                        const prevTotalAch = prev ? prev.mrrAchieved + prev.nrrAchieved : undefined;
                        const prevTotalTgt = prev ? prev.mrrTarget + prev.nrrTarget : undefined;
                        const prevTotalPct = prevTotalTgt !== undefined && prevTotalTgt > 0
                          ? ((prevTotalAch ?? 0) / prevTotalTgt) * 100 : undefined;
                        const mrrPctBase = m.mrrPct >= 100 ? "#E4A900" : pctColorDsm(m.mrrPct);
                        const nrrPctBase = m.nrrPct >= 100 ? "#E4A900" : pctColorDsm(m.nrrPct);
                        const totalPctBase = totalPct >= 100 ? "#E4A900" : pctColorDsm(totalPct);
                        const mrrMetBeat = m.mrrTarget > 0 && m.mrrAchieved >= m.mrrTarget;
                        const nrrMetBeat = m.nrrTarget > 0 && m.nrrAchieved >= m.nrrTarget;
                        const hasMrrData = m.mrrTarget > 0 || m.mrrAchieved !== 0;
                        const hasNrrData = m.nrrTarget > 0 || m.nrrAchieved !== 0;
                        const prevMrrPct = prev?.mrrTarget !== undefined && prev.mrrTarget > 0 ? prev.mrrPct : undefined;
                        const prevNrrPct = prev?.nrrTarget !== undefined && prev.nrrTarget > 0 ? prev.nrrPct : undefined;
                        const dMrrR = deltaDir(m.mrrAchieved, prev?.mrrAchieved, hasMrrData);
                        const dMrrPct = deltaDir(m.mrrPct, prevMrrPct, m.mrrTarget > 0);
                        const dNrrR = deltaDir(m.nrrAchieved, prev?.nrrAchieved, hasNrrData);
                        const dNrrPct = deltaDir(m.nrrPct, prevNrrPct, m.nrrTarget > 0);
                        const dTotalR = deltaDir(totalAch, prevTotalAch);
                        const dTotalPct = deltaDir(totalPct, prevTotalPct, totalTgt > 0);
                        const tdV: React.CSSProperties = { padding: "6px 0 6px 8px", textAlign: "center" as const, fontVariantNumeric: "tabular-nums" as const, fontWeight: 700 };
                        return (
                          <tr key={m.monthKey} style={{ borderBottom: `1px solid ${dividerColor}` }}>
                            <td style={{ padding: "6px 0", color: numColor, fontWeight: 500, whiteSpace: "nowrap" }}>{fullName}</td>
                            <td style={{ padding: "6px 0 6px 8px", textAlign: "center", fontSize: 11, color: subColor, whiteSpace: "nowrap" }}>
                              {m.teamName
                                ? m.teamName
                                : <span style={{ opacity: 0.3 }}>—</span>}
                            </td>
                            <td style={{ ...tdV, color: applyDelta(dMrrR, numColor) }}>
                              {hasMrrData ? fmtBRLFull(m.mrrAchieved) : <span style={{ opacity: 0.35 }}>—</span>}
                            </td>
                            <DeltaTd curr={m.mrrAchieved} prev={prev?.mrrAchieved} show={hasMrrData} />
                            <td style={{ ...tdV, color: applyDelta(dMrrPct, mrrPctBase) }}>
                              {m.mrrTarget > 0 ? `${m.mrrPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}
                            </td>
                            <DeltaTd curr={m.mrrPct} prev={prevMrrPct} show={m.mrrTarget > 0} />
                            <td style={{ ...tdV, color: applyDelta(dNrrR, numColor) }}>
                              {hasNrrData ? fmtBRLFull(m.nrrAchieved) : <span style={{ opacity: 0.35 }}>—</span>}
                            </td>
                            <DeltaTd curr={m.nrrAchieved} prev={prev?.nrrAchieved} show={hasNrrData} />
                            <td style={{ ...tdV, color: applyDelta(dNrrPct, nrrPctBase) }}>
                              {m.nrrTarget > 0 ? `${m.nrrPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}
                            </td>
                            <DeltaTd curr={m.nrrPct} prev={prevNrrPct} show={m.nrrTarget > 0} />
                            <td style={{ ...tdV, color: m.isVacation ? subColor : applyDelta(dTotalR, numColor) }}>
                              {m.isVacation ? <span style={{ opacity: 0.35 }}>—</span> : fmtBRLFull(totalAch)}
                            </td>
                            <DeltaTd curr={totalAch} prev={prevTotalAch} show={!m.isVacation} />
                            <td style={{ ...tdV, color: applyDelta(dTotalPct, totalPctBase) }}>
                              {totalTgt > 0 ? `${totalPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}
                            </td>
                            <DeltaTd curr={totalPct} prev={prevTotalPct} show={totalTgt > 0 && !m.isVacation} />
                            <td style={{ ...tdV, color: m.isVacation ? subColor : numColor }}>
                              {m.isVacation ? <span style={{ opacity: 0.35 }}>—</span> : fmtBRLFull(m.commission)}
                            </td>
                            <td style={{ padding: "6px 0 6px 8px", textAlign: "center", width: 52 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                {m.isVacation && <span title="Férias" style={{ fontSize: 12, lineHeight: 1 }}>🌴</span>}
                                {m.isRampUp && <span title="Ramp-up" style={{ fontSize: 12, lineHeight: 1 }}>🚀</span>}
                                {mrrMetBeat && <Crown size={11} style={{ color: "#E4A900", strokeWidth: 1.5 }} />}
                              {nrrMetBeat && <Crown size={11} style={{ color: "#E4A900", strokeWidth: 1.5 }} />}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
              </div>
            );
          })()}


          {/* ── TEAM LEADER: YTD Cards + Consistência + Trend + Mês a Mês ─── */}
          {viewMode === "team_leader" && teamYtd.monthCount > 0 && (() => {
            const cardBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
            const cardBorder = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
            const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

            // ── Consistency metrics (team) ─────────────────────────────────
            const teamMrrPcts = teamMonthlyHistory.filter((m) => m.mrrTarget > 0).map((m) => m.mrrPct);
            const teamNrrPcts = teamMonthlyHistory.filter((m) => m.nrrTarget > 0).map((m) => m.nrrPct);
            const medianOf = (arr: number[]) => {
              if (!arr.length) return 0;
              const s = [...arr].sort((a, b) => a - b);
              const mid = Math.floor(s.length / 2);
              return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
            };
            const teamMedianMrr = medianOf(teamMrrPcts);
            const teamMedianNrr = medianOf(teamNrrPcts);
            const teamMedianComposite = (teamMedianMrr + teamMedianNrr) / 2;
            const teamMrrHitCount = teamMrrPcts.filter((p) => p >= 100).length;
            const teamNrrHitCount = teamNrrPcts.filter((p) => p >= 100).length;
            const teamMrrHitRate = teamMrrPcts.length > 0 ? teamMrrHitCount / teamMrrPcts.length : 0;
            const teamNrrHitRate = teamNrrPcts.length > 0 ? teamNrrHitCount / teamNrrPcts.length : 0;

            const avgArr = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
            const halfN = Math.floor(teamMrrPcts.length / 2);
            const halfNNrr = Math.floor(teamNrrPcts.length / 2);
            const teamMrrTrend = halfN >= 1 ? avgArr(teamMrrPcts.slice(-halfN)) - avgArr(teamMrrPcts.slice(0, halfN)) : 0;
            const teamNrrTrend = halfNNrr >= 1 ? avgArr(teamNrrPcts.slice(-halfNNrr)) - avgArr(teamNrrPcts.slice(0, halfNNrr)) : 0;
            const teamTrendComposite = teamMrrPcts.length >= 2 || teamNrrPcts.length >= 2 ? (teamMrrTrend + teamNrrTrend) / 2 : null;

            const teamMrrVolMonths = teamMonthlyHistory.filter((m) => m.mrrTarget > 0).map((m) => m.mrrPct);
            const teamNrrVolMonths = teamMonthlyHistory.filter((m) => m.nrrTarget > 0).map((m) => m.nrrPct);
            const teamMrrVolMean = avgArr(teamMrrVolMonths);
            const teamNrrVolMean = avgArr(teamNrrVolMonths);
            const teamMrrStdDev = teamMrrVolMonths.length > 1 ? Math.sqrt(teamMrrVolMonths.reduce((s, v) => s + (v - teamMrrVolMean) ** 2, 0) / teamMrrVolMonths.length) : 0;
            const teamNrrStdDev = teamNrrVolMonths.length > 1 ? Math.sqrt(teamNrrVolMonths.reduce((s, v) => s + (v - teamNrrVolMean) ** 2, 0) / teamNrrVolMonths.length) : 0;
            const teamCompositeMonths = teamMonthlyHistory.filter((m) => m.mrrTarget > 0 && m.nrrTarget > 0).map((m) => (m.mrrPct + m.nrrPct) / 2);
            const teamCompMean = avgArr(teamCompositeMonths);
            const teamCompStdDev = teamCompositeMonths.length > 1 ? Math.sqrt(teamCompositeMonths.reduce((s, v) => s + (v - teamCompMean) ** 2, 0) / teamCompositeMonths.length) : 0;

            const sortedTeam = [...teamMonthlyHistory].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
            let teamMrrBestStreak = 0, teamMrrRun = 0;
            let teamMrrBestStreakMonths: string[] = [], teamMrrRunMonths: string[] = [];
            for (const m of sortedTeam) {
              if (m.mrrTarget > 0 && m.mrrPct >= 100) {
                teamMrrRun++; teamMrrRunMonths.push(m.label);
                if (teamMrrRun > teamMrrBestStreak) { teamMrrBestStreak = teamMrrRun; teamMrrBestStreakMonths = [...teamMrrRunMonths]; }
              } else { teamMrrRun = 0; teamMrrRunMonths = []; }
            }
            let teamNrrBestStreak = 0, teamNrrRun = 0;
            let teamNrrBestStreakMonths: string[] = [], teamNrrRunMonths: string[] = [];
            for (const m of sortedTeam) {
              if (m.nrrTarget > 0 && m.nrrPct >= 100) {
                teamNrrRun++; teamNrrRunMonths.push(m.label);
                if (teamNrrRun > teamNrrBestStreak) { teamNrrBestStreak = teamNrrRun; teamNrrBestStreakMonths = [...teamNrrRunMonths]; }
              } else { teamNrrRun = 0; teamNrrRunMonths = []; }
            }
            let teamMrrStreakCurrent = 0;
            for (let i = sortedTeam.length - 1; i >= 0; i--) {
              if (sortedTeam[i].mrrTarget > 0 && sortedTeam[i].mrrPct >= 100) teamMrrStreakCurrent++;
              else break;
            }
            let teamNrrStreakCurrent = 0;
            for (let i = sortedTeam.length - 1; i >= 0; i--) {
              if (sortedTeam[i].nrrTarget > 0 && sortedTeam[i].nrrPct >= 100) teamNrrStreakCurrent++;
              else break;
            }

            // ── Per-member analytics ──────────────────────────────────────────
            type MemberMonthAgg = { mrrAch: number; mrrTgt: number; nrrAch: number; nrrTgt: number; isVacOrRamp: boolean };
            // Year-static current status per userId (last-write-wins, sorted asc by date_from)
            const tlCurrentStatusMap = new Map<number, string>();
            {
              const yearRowsSorted = (allRaw ?? [])
                .filter((r) => (r.date_from ?? "").startsWith(year) && r.user_id != null)
                .sort((a, b) => (a.date_from ?? "").localeCompare(b.date_from ?? ""));
              for (const r of yearRowsSorted) {
                const uid = r.user_id!;
                if (r.active === false) tlCurrentStatusMap.set(uid, "inativo");
                else if ((r.plan_name ?? "").startsWith("[RAMP-UP]")) tlCurrentStatusMap.set(uid, "ramp-up");
                else if (r.skip_record) tlCurrentStatusMap.set(uid, "férias");
                else tlCurrentStatusMap.set(uid, "ativo");
              }
            }
            const memberRawMap = new Map<string | number, { userId: number | null; userName: string; months: Map<string, MemberMonthAgg> }>();
            for (const r of (allRaw ?? [])) {
              if (!(r.date_from ?? "").startsWith(year)) continue;
              const uid: string | number = r.user_id ?? r.user_name ?? "?";
              const uname = r.user_name ?? "—";
              if (!memberRawMap.has(uid)) memberRawMap.set(uid, { userId: r.user_id ?? null, userName: uname, months: new Map() });
              const mem = memberRawMap.get(uid)!;
              const mKey = toMonthKeyStr(r.date_from ?? "");
              if (!mKey) continue;
              if (!mem.months.has(mKey)) mem.months.set(mKey, { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0, isVacOrRamp: false });
              const md = mem.months.get(mKey)!;
              if (!!(r.skip_record && r.active !== false) || (r.plan_name ?? "").startsWith("[RAMP-UP]")) md.isVacOrRamp = true;
              const rType = (r.plan_type ?? "").toUpperCase();
              const rAch = Math.max(0, r.achieved ?? 0);
              const rTgt = r.skip_record ? 0 : (r.target_amount ?? 0);
              if (rType === "MRR") { md.mrrAch += rAch; md.mrrTgt += rTgt; }
              else if (rType === "NRR") { md.nrrAch += rAch; md.nrrTgt += rTgt; }
            }

            const memberStatsList = Array.from(memberRawMap.values())
              .filter((mem) => mem.userId != null && tlCurrentStatusMap.get(mem.userId) !== "inativo")
              .map((mem) => {
              const sorted = [...mem.months.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([, d]) => d);
              const validMrrPcts = sorted.filter((m) => !m.isVacOrRamp && m.mrrTgt > 0).map((m) => (m.mrrAch / m.mrrTgt) * 100);
              const validNrrPcts = sorted.filter((m) => !m.isVacOrRamp && m.nrrTgt > 0).map((m) => (m.nrrAch / m.nrrTgt) * 100);
              const medMrr = medianOf(validMrrPcts);
              const medNrr = medianOf(validNrrPcts);
              const consistency = validMrrPcts.length > 0 || validNrrPcts.length > 0 ? (medMrr + medNrr) / 2 : null;
              const halfMm = Math.floor(validMrrPcts.length / 2);
              const halfNm = Math.floor(validNrrPcts.length / 2);
              const mrrTr = halfMm >= 1 ? avgArr(validMrrPcts.slice(-halfMm)) - avgArr(validMrrPcts.slice(0, halfMm)) : 0;
              const nrrTr = halfNm >= 1 ? avgArr(validNrrPcts.slice(-halfNm)) - avgArr(validNrrPcts.slice(0, halfNm)) : 0;
              const trend = validMrrPcts.length >= 2 || validNrrPcts.length >= 2 ? (mrrTr + nrrTr) / 2 : null;
              const compMonths = sorted.filter((m) => !m.isVacOrRamp && m.mrrTgt > 0 && m.nrrTgt > 0).map((m) => ((m.mrrAch / m.mrrTgt) * 100 + (m.nrrAch / m.nrrTgt) * 100) / 2);
              const compMean = avgArr(compMonths);
              const volatility = compMonths.length > 1 ? Math.sqrt(compMonths.reduce((s, v) => s + (v - compMean) ** 2, 0) / compMonths.length) : null;
              const mrrHitCount = validMrrPcts.filter((p) => p >= 100).length;
              const mrrTotalMonths = validMrrPcts.length;
              const nrrHitCount = validNrrPcts.filter((p) => p >= 100).length;
              const nrrTotalMonths = validNrrPcts.length;
              const status = mem.userId != null ? (tlCurrentStatusMap.get(mem.userId) ?? null) : null;
              return { userName: mem.userName, consistency, trend, volatility, mrrHitCount, mrrTotalMonths, nrrHitCount, nrrTotalMonths, status };
            }).sort((a, b) => (b.consistency ?? -1) - (a.consistency ?? -1));

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

                {/* ── YTD Cards ─────────────────────────────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showYtdInfo ? 8 : 18 }}>
                    <BarChart2 size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                      Resumo do ano do time
                    </h2>
                    <button
                      onClick={() => setShowYtdInfo((v) => !v)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: showYtdInfo ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)") : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                        border: `1px solid ${showYtdInfo ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)") : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                        borderRadius: 99, padding: "2px 8px", cursor: "pointer",
                        color: showYtdInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                        transition: "all 0.15s", flexShrink: 0,
                      }}
                    >
                      <Info size={10} strokeWidth={2} />
                      Sobre
                    </button>
                  </div>
                  {showYtdInfo && (
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                      borderRadius: 12, padding: "14px 16px", marginBottom: 14,
                      fontSize: 12, lineHeight: 1.65, color: numColor,
                      display: "flex", flexDirection: "column", gap: 8,
                      boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📊 O que é</div>
                        <p style={{ margin: 0, color: subColor }}>Total acumulado de MRR e NRR gerado pelo time no ano, com % de atingimento sobre as metas do período. Os cards detalham média mensal e os meses de maior e menor receita.</p>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                        <p style={{ margin: 0, color: subColor }}>O % YTD mostra o atingimento geral do time no ano. Comparar melhor e pior mês revela a consistência coletiva do time ao longo dos meses.</p>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {/* MRR Card */}
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                      border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "20px 20px 20px",
                      boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.30)" : "0 2px 16px rgba(0,0,0,0.08)",
                      display: "flex", flexDirection: "column", overflow: "hidden",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>MRR do time:</span>
                        <Repeat2 style={{ width: 16, height: 16, color: CYAN, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                          {fmtBRLFull(teamYtd.mrrAch)}
                        </div>
                        <span className="ytd-badge-wrap" style={{ position: "relative", display: "inline-flex" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                            border: "1px solid rgba(228,169,0,0.40)", borderRadius: 99, padding: "2px 8px",
                            fontSize: 10, fontWeight: 700, color: "#E4A900",
                            fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", cursor: "help",
                          }}>
                            {Math.round(teamYtd.mrrPct)}% YTD
                          </span>
                          <span className="ytd-tip" style={{
                            position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                            background: isDark ? "#1c1c2e" : "#fff",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                            borderRadius: 6, padding: "5px 10px", fontSize: 12, lineHeight: 1.4,
                            color: isDark ? "#e0e0e0" : "#333", whiteSpace: "nowrap",
                            boxShadow: "0 2px 10px rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 100,
                          }}>
                            MRR acumulado do time no ano: realizado ÷ metas do período.
                          </span>
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                            <TrendingUp style={{ width: 12, height: 12, flexShrink: 0 }} />Mês com maior receita:
                          </div>
                          {teamYtd.bestMrrMonth ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                                {fmtBRLFull(teamYtd.bestMrrMonth.mrrAchieved)}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                                {MONTH_NAMES[parseInt(teamYtd.bestMrrMonth.monthKey.split("-")[1]) - 1] ?? teamYtd.bestMrrMonth.label}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                            <TrendingDown style={{ width: 12, height: 12, flexShrink: 0 }} />Mês com menor receita:
                          </div>
                          {teamYtd.worstMrrMonth ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                                {fmtBRLFull(teamYtd.worstMrrMonth.mrrAchieved)}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                                {MONTH_NAMES[parseInt(teamYtd.worstMrrMonth.monthKey.split("-")[1]) - 1] ?? teamYtd.worstMrrMonth.label}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
                        </div>
                      </div>
                    </div>

                    {/* NRR Card */}
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                      border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "20px 20px 20px",
                      boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.30)" : "0 2px 16px rgba(0,0,0,0.08)",
                      display: "flex", flexDirection: "column", overflow: "hidden",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>NRR do time:</span>
                        <BarChart2 style={{ width: 16, height: 16, color: PURPLE, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                          {fmtBRLFull(teamYtd.nrrAch)}
                        </div>
                        <span className="ytd-badge-wrap" style={{ position: "relative", display: "inline-flex" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                            border: "1px solid rgba(228,169,0,0.40)", borderRadius: 99, padding: "2px 8px",
                            fontSize: 10, fontWeight: 700, color: "#E4A900",
                            fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", cursor: "help",
                          }}>
                            {Math.round(teamYtd.nrrPct)}% YTD
                          </span>
                          <span className="ytd-tip" style={{
                            position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                            background: isDark ? "#1c1c2e" : "#fff",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                            borderRadius: 6, padding: "5px 10px", fontSize: 12, lineHeight: 1.4,
                            color: isDark ? "#e0e0e0" : "#333", whiteSpace: "nowrap",
                            boxShadow: "0 2px 10px rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 100,
                          }}>
                            NRR acumulado do time no ano: realizado ÷ metas do período.
                          </span>
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                            <TrendingUp style={{ width: 12, height: 12, flexShrink: 0 }} />Mês com maior receita:
                          </div>
                          {teamYtd.bestNrrMonth ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                                {fmtBRLFull(teamYtd.bestNrrMonth.nrrAchieved)}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                                {MONTH_NAMES[parseInt(teamYtd.bestNrrMonth.monthKey.split("-")[1]) - 1] ?? teamYtd.bestNrrMonth.label}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                            <TrendingDown style={{ width: 12, height: 12, flexShrink: 0 }} />Mês com menor receita:
                          </div>
                          {teamYtd.worstNrrMonth ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                                {fmtBRLFull(teamYtd.worstNrrMonth.nrrAchieved)}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                                {MONTH_NAMES[parseInt(teamYtd.worstNrrMonth.monthKey.split("-")[1]) - 1] ?? teamYtd.worstNrrMonth.label}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
                        </div>
                      </div>
                    </div>

                    {/* Comissões — placeholder */}
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      border: `1px dashed ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                      borderRadius: 16, padding: "20px 20px 20px",
                      display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120,
                    }}>
                      <span style={{ fontSize: 11, color: subColor, opacity: 0.4, fontStyle: "italic" }}>Em breve</span>
                    </div>

                    {/* Placeholder slot */}
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      border: `1px dashed ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                      borderRadius: 16, padding: "20px 20px 20px",
                      display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120,
                    }}>
                      <span style={{ fontSize: 11, color: subColor, opacity: 0.4, fontStyle: "italic" }}>Em breve</span>
                    </div>
                  </div>

                  {/* ── Consistência do time ───────────────────────────────── */}
                  <div style={{ marginBottom: 28, order: -1 }}>
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                      border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "20px 20px 0",
                      boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.30)" : "0 2px 16px rgba(0,0,0,0.08)",
                      display: "flex", flexDirection: "column", overflow: "visible",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>Consistência do time:</span>
                        <Target style={{ width: 16, height: 16, color: CYAN, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                        <div style={{
                          fontSize: "clamp(2.8rem, 4vw, 3.5rem)", fontWeight: 900,
                          letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1,
                          color: teamMedianComposite >= 90 ? "#E4A900" : (isDark ? "#FFFFFF" : CYAN),
                        }}>
                          {teamMedianComposite.toFixed(1)}%
                        </div>
                        <span ref={teamConsistencyBadgeRef} style={{ position: "relative", display: "inline-flex" }}>
                          <span
                            onClick={() => setShowTeamConsistencyDetails((v) => !v)}
                            style={{
                              display: "inline-flex", alignItems: "center",
                              background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                              border: "1px solid rgba(228,169,0,0.40)",
                              borderRadius: 99, padding: "2px 8px",
                              fontSize: 10, fontWeight: 700, color: "#E4A900",
                              letterSpacing: "0.02em", cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            Ver Detalhes
                          </span>
                          {showTeamConsistencyDetails && (
                            <div className="consistency-detail-card" style={{
                              position: "absolute", top: "calc(100% + 8px)", left: 0,
                              width: 380, zIndex: 200,
                              background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                              borderRadius: 12, padding: "18px 20px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Consistência do time
                              </div>
                              <p style={{ margin: "0 0 14px", fontSize: 10, color: subColor, lineHeight: 1.5, fontStyle: "italic" }}>
                                Calculado pela mediana dos percentuais (%) mensais de MRR e NRR do time, excluindo meses sem meta registrada.
                              </p>
                              <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                                O time bate meta com regularidade?
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                                {[
                                  { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Acima de 90%", desc: "Time consistente, chegando perto ou superando o objetivo na maioria dos meses." },
                                  { dot: isDark ? "#fbbf24" : "#d97706", labelColor: isDark ? "#fbbf24" : "#d97706", range: "Entre 70% e 90%", desc: "Time no caminho, mas ainda há espaço para crescer coletivamente." },
                                  { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Abaixo de 70%", desc: "Resultados coletivos ficando distantes da meta com frequência." },
                                ].map(({ dot, labelColor, range, desc }) => (
                                  <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", marginBottom: 10 }} />
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Mediana MRR</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: teamMedianMrr >= 100 ? "#E4A900" : pctColorDsm(teamMedianMrr), fontVariantNumeric: "tabular-nums" }}>
                                    {teamMedianMrr.toFixed(1)}%
                                  </span>
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                                    background: teamMedianMrr >= 90 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : teamMedianMrr >= 70 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                                    color: teamMedianMrr >= 90 ? (isDark ? "#34d399" : "#059669") : teamMedianMrr >= 70 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                                    borderRadius: 99, padding: "2px 6px",
                                  }}>
                                    {teamMedianMrr >= 90 ? "Acima de 90%" : teamMedianMrr >= 70 ? "Entre 70% e 90%" : "Abaixo de 70%"}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Mediana NRR</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: teamMedianNrr >= 100 ? "#E4A900" : pctColorDsm(teamMedianNrr), fontVariantNumeric: "tabular-nums" }}>
                                    {teamMedianNrr.toFixed(1)}%
                                  </span>
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                                    background: teamMedianNrr >= 90 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : teamMedianNrr >= 70 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                                    color: teamMedianNrr >= 90 ? (isDark ? "#34d399" : "#059669") : teamMedianNrr >= 70 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                                    borderRadius: 99, padding: "2px 6px",
                                  }}>
                                    {teamMedianNrr >= 90 ? "Acima de 90%" : teamMedianNrr >= 70 ? "Entre 70% e 90%" : "Abaixo de 70%"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </span>
                      </div>
                      <div ref={teamInfoCardsRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0 16px", marginBottom: 14 }}>
                        {/* Tendência */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                            <TrendingUp style={{ width: 12, height: 12 }} />Tendência recente
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {teamTrendComposite !== null ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start",
                                background: teamTrendComposite >= 15
                                  ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)"
                                  : teamTrendComposite <= -15 ? "rgba(239,68,68,0.15)" : "rgba(1,126,132,0.14)",
                                border: teamTrendComposite >= 15
                                  ? "1px solid rgba(228,169,0,0.40)"
                                  : teamTrendComposite <= -15 ? "1px solid rgba(239,68,68,0.40)" : "1px solid rgba(1,126,132,0.35)",
                                color: teamTrendComposite >= 15 ? "#E4A900" : teamTrendComposite <= -15 ? "#ef4444" : "#0fb8c0",
                                borderRadius: 99, padding: "3px 10px",
                                fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                              }}>
                                {teamTrendComposite >= 15 ? <TrendingUp size={11} /> : teamTrendComposite <= -15 ? <TrendingDown size={11} /> : <Repeat2 size={11} />}
                                {teamTrendComposite >= 15 ? "Acelerando" : teamTrendComposite <= -15 ? "Desacelerando" : "Estável"}
                              </span>
                            ) : <span style={{ fontSize: 11, color: subColor, opacity: 0.4 }}>—</span>}
                            <button onClick={() => setActiveTeamInfoCard(v => v === "tendencia" ? null : "tendencia")} style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              background: "none", border: "none", padding: 0, flexShrink: 0, cursor: "pointer",
                              color: activeTeamInfoCard === "tendencia" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                              transition: "color 0.15s",
                            }}>
                              <Info size={14} strokeWidth={2} />
                            </button>
                          </div>
                          {teamTrendComposite !== null && (
                            <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>
                              {teamTrendComposite >= 0 ? "+" : ""}{teamTrendComposite.toFixed(0)} pp vs início
                            </span>
                          )}
                          {activeTeamInfoCard === "tendencia" && (
                            <div className="consistency-detail-card" style={{
                              position: "absolute", top: "calc(100% + 6px)", left: 0,
                              width: 320, zIndex: 300,
                              background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                              borderRadius: 12, padding: "14px 16px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Tendência Recente
                              </div>
                              <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                                O time está evoluindo ao longo do ano?
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {([
                                  { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Acelerando", desc: "Os últimos meses estão melhores do que os primeiros. O time está no caminho certo. (variação ≥ +15 pp)" },
                                  { dot: isDark ? "#0fb8c0" : "#017E84", labelColor: isDark ? "#0fb8c0" : "#017E84", range: "Estável", desc: "Sem variação significativa ao longo do ano. Resultado consistente, sem aceleração ou queda. (variação entre −15 pp e +15 pp)" },
                                  { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Desacelerando", desc: "Os meses mais recentes estão abaixo do início do ano. Atenção para reverter a tendência. (variação ≤ −15 pp)" },
                                ] as { dot: string; labelColor: string; range: string; desc: string }[]).map(({ dot, labelColor, range, desc }) => (
                                  <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", margin: "12px 0 10px" }} />
                              {([
                                { icon: <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />, label: "Tendência MRR", val: teamMrrTrend },
                                { icon: <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />, label: "Tendência NRR", val: teamNrrTrend },
                              ]).map(({ icon, label, val }, i) => {
                                const cat = val >= 15 ? "Acelerando" : val <= -15 ? "Desacelerando" : "Estável";
                                const valColor = val >= 15 ? (isDark ? "#34d399" : "#059669") : val <= -15 ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#0fb8c0" : "#017E84");
                                const badgeBg = val >= 15 ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)" : val <= -15 ? "rgba(239,68,68,0.15)" : "rgba(1,126,132,0.14)";
                                const badgeBorder = val >= 15 ? "1px solid rgba(228,169,0,0.40)" : val <= -15 ? "1px solid rgba(239,68,68,0.40)" : "1px solid rgba(1,126,132,0.35)";
                                return (
                                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i === 0 ? 8 : 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      {icon}
                                      <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>{label}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: valColor }}>
                                        {val >= 0 ? "+" : ""}{val.toFixed(0)} pp
                                      </span>
                                      <span style={{ fontSize: 9, fontWeight: 700, background: badgeBg, border: badgeBorder, color: valColor, borderRadius: 99, padding: "2px 7px", letterSpacing: "0.02em" }}>
                                        {cat}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Volatilidade */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                            <BarChart2 style={{ width: 12, height: 12 }} />Volatilidade
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", alignSelf: "flex-start",
                              fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                              background: teamCompStdDev < 20 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : teamCompStdDev < 40 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                              border: teamCompStdDev < 20 ? "1px solid rgba(52,211,153,0.40)" : teamCompStdDev < 40 ? "1px solid rgba(251,191,36,0.40)" : "1px solid rgba(248,113,113,0.40)",
                              color: teamCompStdDev < 20 ? (isDark ? "#34d399" : "#059669") : teamCompStdDev < 40 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                              borderRadius: 99, padding: "3px 10px",
                            }}>
                              {teamCompStdDev < 20 ? "Baixa" : teamCompStdDev < 40 ? "Média" : "Alta"}
                            </span>
                            <button onClick={() => setActiveTeamInfoCard(v => v === "volatilidade" ? null : "volatilidade")} style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              background: "none", border: "none", padding: 0, flexShrink: 0, cursor: "pointer",
                              color: activeTeamInfoCard === "volatilidade" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                              transition: "color 0.15s",
                            }}>
                              <Info size={14} strokeWidth={2} />
                            </button>
                          </div>
                          {teamCompositeMonths.length > 1 && (
                            <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>±{teamCompStdDev.toFixed(0)} pp desvio padrão</span>
                          )}
                          {activeTeamInfoCard === "volatilidade" && (
                            <div className="consistency-detail-card" style={{
                              position: "absolute", top: "calc(100% + 6px)", left: 0,
                              width: 320, zIndex: 300,
                              background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                              borderRadius: 12, padding: "14px 16px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Volatilidade
                              </div>
                              <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                                Os resultados do time oscilam muito entre os meses?
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {([
                                  { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Baixa", desc: "Resultados estáveis e previsíveis. O time mantém nível parecido mês a mês. (desvio padrão < 20 pp)" },
                                  { dot: isDark ? "#fbbf24" : "#d97706", labelColor: isDark ? "#fbbf24" : "#d97706", range: "Média", desc: "Oscilações moderadas entre os meses. Há variação, mas sem extremos. (desvio padrão 20–40 pp)" },
                                  { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Alta", desc: "Grandes variações entre meses bons e ruins. Resultado coletivo pouco previsível. (desvio padrão > 40 pp)" },
                                ] as { dot: string; labelColor: string; range: string; desc: string }[]).map(({ dot, labelColor, range, desc }) => (
                                  <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", margin: "12px 0 10px" }} />
                              {([
                                { icon: <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />, label: "Volatilidade MRR", std: teamMrrStdDev },
                                { icon: <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />, label: "Volatilidade NRR", std: teamNrrStdDev },
                              ]).map(({ icon, label, std }, i) => {
                                const cat = std < 20 ? "Baixa" : std < 40 ? "Média" : "Alta";
                                const valColor = std < 20 ? (isDark ? "#34d399" : "#059669") : std < 40 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626");
                                const badgeBg = std < 20 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : std < 40 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)");
                                const badgeBorder = std < 20 ? "1px solid rgba(52,211,153,0.40)" : std < 40 ? "1px solid rgba(251,191,36,0.40)" : "1px solid rgba(248,113,113,0.40)";
                                return (
                                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i === 0 ? 8 : 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      {icon}
                                      <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>{label}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: valColor }}>
                                        ±{std.toFixed(0)} pp
                                      </span>
                                      <span style={{ fontSize: 9, fontWeight: 700, background: badgeBg, border: badgeBorder, color: valColor, borderRadius: 99, padding: "2px 7px", letterSpacing: "0.02em" }}>
                                        {cat}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Histórico de Sequência */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                            <CalendarDays style={{ width: 12, height: 12 }} />Histórico de Sequência
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", alignSelf: "flex-start",
                              background: teamMrrBestStreak > 0 || teamNrrBestStreak > 0
                                ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)"
                                : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                              border: teamMrrBestStreak > 0 || teamNrrBestStreak > 0
                                ? "1px solid rgba(228,169,0,0.40)"
                                : (isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)"),
                              borderRadius: 99, padding: "3px 10px",
                              fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                              color: teamMrrBestStreak > 0 || teamNrrBestStreak > 0 ? "#E4A900" : subColor,
                            }}>
                              🔥 {teamMrrBestStreak} MRR · {teamNrrBestStreak} NRR
                            </span>
                            <button onClick={() => setActiveTeamInfoCard(v => v === "sequencia" ? null : "sequencia")} style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              background: "none", border: "none", padding: 0, flexShrink: 0, cursor: "pointer",
                              color: activeTeamInfoCard === "sequencia" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                              transition: "color 0.15s",
                            }}>
                              <Info size={14} strokeWidth={2} />
                            </button>
                          </div>
                          <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>melhor sequência do ano</span>
                          {activeTeamInfoCard === "sequencia" && (
                            <div className="consistency-detail-card" style={{
                              position: "absolute", top: "calc(100% + 6px)", left: 0,
                              width: 320, zIndex: 300,
                              background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                              borderRadius: 12, padding: "14px 16px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Histórico de Sequência
                              </div>
                              <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                                Quantos meses seguidos o time bateu meta?
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                    <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Melhor sequência MRR</span>
                                    {teamMrrBestStreak > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#E4A900" }}>{teamMrrBestStreak} meses</span>}
                                  </div>
                                  {teamMrrBestStreakMonths.length > 0
                                    ? <span style={{ fontSize: 11, color: numColor, lineHeight: 1.5, paddingLeft: 14 }}>{teamMrrBestStreakMonths.join(" · ")}</span>
                                    : <span style={{ fontSize: 11, color: subColor, opacity: 0.4, paddingLeft: 14 }}>Nenhuma sequência</span>}
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                    <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Melhor sequência NRR</span>
                                    {teamNrrBestStreak > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#E4A900" }}>{teamNrrBestStreak} meses</span>}
                                  </div>
                                  {teamNrrBestStreakMonths.length > 0
                                    ? <span style={{ fontSize: 11, color: numColor, lineHeight: 1.5, paddingLeft: 14 }}>{teamNrrBestStreakMonths.join(" · ")}</span>
                                    : <span style={{ fontSize: 11, color: subColor, opacity: 0.4, paddingLeft: 14 }}>Nenhuma sequência</span>}
                                </div>
                              </div>
                              <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", marginBottom: 10 }} />
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Sequência atual</span>
                                {teamMrrStreakCurrent > 0 || teamNrrStreakCurrent > 0 ? (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center",
                                    background: "rgba(1,126,132,0.14)", border: "1px solid rgba(1,126,132,0.35)",
                                    borderRadius: 99, padding: "2px 10px",
                                    fontSize: 10, fontWeight: 700, color: "#0fb8c0",
                                  }}>
                                    🔥 {teamMrrStreakCurrent} MRR · {teamNrrStreakCurrent} NRR
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: subColor, opacity: 0.4 }}>Sem sequência ativa</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Histórico metas */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                            <Target style={{ width: 12, height: 12 }} />Histórico metas
                          </div>
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", alignSelf: "flex-start",
                            background: teamMrrHitRate >= 0.6 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : teamMrrHitRate >= 0.4 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                            color: teamMrrHitRate >= 0.6 ? (isDark ? "#34d399" : "#059669") : teamMrrHitRate >= 0.4 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                            borderRadius: 99, padding: "2px 6px",
                          }}>
                            MRR: {teamMrrHitCount}/{teamMrrPcts.length} meses na meta
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", alignSelf: "flex-start",
                            background: teamNrrHitRate >= 0.6 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : teamNrrHitRate >= 0.4 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                            color: teamNrrHitRate >= 0.6 ? (isDark ? "#34d399" : "#059669") : teamNrrHitRate >= 0.4 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                            borderRadius: 99, padding: "2px 6px",
                          }}>
                            NRR: {teamNrrHitCount}/{teamNrrPcts.length} meses na meta
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 20 }} />
                    </div>
                  </div>
                </div>

                {/* ── Trend Chart ────────────────────────────────────────────── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <TrendingUp size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                      Linha de tendência do time
                    </h2>
                    <button
                      onClick={() => setShowTrendInfo((v) => !v)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: showTrendInfo ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)") : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                        border: `1px solid ${showTrendInfo ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)") : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                        borderRadius: 99, padding: "2px 8px", cursor: "pointer",
                        color: showTrendInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                        transition: "all 0.15s", flexShrink: 0,
                      }}
                    >
                      <Info size={10} strokeWidth={2} />
                      Sobre
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: showTrendInfo ? 0 : 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={CYAN} strokeWidth="1.5" strokeDasharray="4 2" /></svg>
                      <span style={{ fontSize: 10, color: subColor, fontWeight: 600 }}>MRR</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={PURPLE} strokeWidth="2" /></svg>
                      <span style={{ fontSize: 10, color: subColor, fontWeight: 600 }}>NRR</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={refColor} strokeWidth="1" strokeDasharray="4 3" opacity={0.4} /></svg>
                      <span style={{ fontSize: 10, color: subColor, fontWeight: 600 }}>Meta: 100%</span>
                    </div>
                  </div>
                  {showTrendInfo && (
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                      borderRadius: 12, padding: "14px 16px", margin: "10px 0 14px",
                      fontSize: 12, lineHeight: 1.65, color: numColor,
                      display: "flex", flexDirection: "column", gap: 8,
                      boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📈 O que é</div>
                        <p style={{ margin: 0, color: subColor }}>Mostra mês a mês o % de atingimento de MRR e NRR do time em relação às metas. A linha tracejada é MRR, a sólida é NRR. A linha horizontal marca os 100% de meta.</p>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                        <p style={{ margin: 0, color: subColor }}>Permite identificar meses de aceleração ou queda no desempenho coletivo. Quando as linhas estão próximas, o time tem equilíbrio entre os dois indicadores.</p>
                      </div>
                    </div>
                  )}
                  <div style={{ height: 220, padding: "0 16px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={teamMonthlyHistory} margin={{ top: 8, right: 36, left: 0, bottom: 12 }}>
                        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} />
                        <YAxis ticks={teamChartYTicks} tickFormatter={(v) => `${v}%`} tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                        <ReferenceLine y={100} stroke={refColor} strokeDasharray="3 2" strokeWidth={1} strokeOpacity={0.4}
                          label={{ value: "Meta: 100%", fill: refColor, opacity: 0.4, fontSize: 10, fontWeight: 600, position: "insideTopRight" }}
                        />
                        <Tooltip content={<ChartTooltip isDark={isDark} />} cursor={{ stroke: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", strokeWidth: 1 }} />
                        <Line type="monotone" dataKey="mrrPct" stroke={CYAN} strokeWidth={1} strokeDasharray="4 2" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: "none" }} connectNulls={false} />
                        <Line type="monotone" dataKey="nrrPct" stroke={PURPLE} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: PURPLE, stroke: "none" }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Mês a Mês table ────────────────────────────────────────── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <CalendarDays size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                      Mês a mês do time
                    </h2>
                    <button
                      onClick={() => setShowTeamMonthlyInfo((v) => !v)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: showTeamMonthlyInfo ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)") : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                        border: `1px solid ${showTeamMonthlyInfo ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)") : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                        borderRadius: 99, padding: "2px 8px", cursor: "pointer",
                        color: showTeamMonthlyInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                        transition: "all 0.15s", flexShrink: 0,
                      }}
                    >
                      <Info size={10} strokeWidth={2} />
                      Sobre
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: showTeamMonthlyInfo ? 8 : 16 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: subColor }}>
                      <span style={{ color: DELTA_UP_COLOR, fontSize: 9, lineHeight: 1 }}>▲</span>
                      Valor acima comparando com o mês anterior
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: subColor }}>
                      <span style={{ color: DELTA_DOWN_COLOR, fontSize: 9, lineHeight: 1 }}>▼</span>
                      Valor abaixo comparando com o mês anterior
                    </span>
                  </div>
                  {showTeamMonthlyInfo && (
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                      borderRadius: 12, padding: "14px 16px", marginBottom: 16,
                      fontSize: 12, lineHeight: 1.65, color: numColor,
                      display: "flex", flexDirection: "column", gap: 8,
                      boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📊 O que é</div>
                        <p style={{ margin: 0, color: subColor }}>Visão compilada dos números do time mês a mês — MRR, NRR e totais em uma única tabela. Coroa indica meses onde o total superou a meta.</p>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                        <p style={{ margin: 0, color: subColor }}>Permite identificar rapidamente meses de aceleração ou queda no desempenho coletivo. As setas mostram variação em relação ao mês anterior.</p>
                      </div>
                    </div>
                  )}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "left", whiteSpace: "nowrap" }}>Mês</th>
                        <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>MRR R$</th>
                        <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                        <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>MRR %</th>
                        <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                        <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>NRR R$</th>
                        <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                        <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>NRR %</th>
                        <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                        <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>Total R$</th>
                        <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                        <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>Total %</th>
                        <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                        <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", width: 28 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {teamMonthlyHistory.map((m, idx) => {
                        const prev = teamMonthlyHistory[idx - 1];
                        const fullName = MONTH_NAMES[parseInt(m.monthKey.split("-")[1]) - 1] ?? m.label;
                        const totalAch = m.mrrAchieved + m.nrrAchieved;
                        const totalTgt = m.mrrTarget + m.nrrTarget;
                        const totalPct = totalTgt > 0 ? (totalAch / totalTgt) * 100 : 0;
                        const prevTotalAch = prev ? prev.mrrAchieved + prev.nrrAchieved : undefined;
                        const prevTotalTgt = prev ? prev.mrrTarget + prev.nrrTarget : undefined;
                        const prevTotalPct = prevTotalTgt !== undefined && prevTotalTgt > 0 ? ((prevTotalAch ?? 0) / prevTotalTgt) * 100 : undefined;
                        const mrrPctBase = m.mrrPct >= 100 ? "#E4A900" : pctColorDsm(m.mrrPct);
                        const nrrPctBase = m.nrrPct >= 100 ? "#E4A900" : pctColorDsm(m.nrrPct);
                        const totalPctBase = totalPct >= 100 ? "#E4A900" : pctColorDsm(totalPct);
                        const hasMrrData = m.mrrTarget > 0 || m.mrrAchieved !== 0;
                        const hasNrrData = m.nrrTarget > 0 || m.nrrAchieved !== 0;
                        const prevMrrPct = prev?.mrrTarget !== undefined && prev.mrrTarget > 0 ? prev.mrrPct : undefined;
                        const prevNrrPct = prev?.nrrTarget !== undefined && prev.nrrTarget > 0 ? prev.nrrPct : undefined;
                        const dMrrR = deltaDir(m.mrrAchieved, prev?.mrrAchieved, hasMrrData);
                        const dMrrPct = deltaDir(m.mrrPct, prevMrrPct, m.mrrTarget > 0);
                        const dNrrR = deltaDir(m.nrrAchieved, prev?.nrrAchieved, hasNrrData);
                        const dNrrPct = deltaDir(m.nrrPct, prevNrrPct, m.nrrTarget > 0);
                        const dTotalR = deltaDir(totalAch, prevTotalAch);
                        const dTotalPct = deltaDir(totalPct, prevTotalPct, totalTgt > 0);
                        const tdV: React.CSSProperties = { padding: "6px 0 6px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 700 };
                        return (
                          <tr key={m.monthKey} style={{ borderBottom: `1px solid ${dividerColor}` }}>
                            <td style={{ padding: "6px 0", color: numColor, fontWeight: 500, whiteSpace: "nowrap" }}>{fullName}</td>
                            <td style={{ ...tdV, color: applyDelta(dMrrR, numColor) }}>{hasMrrData ? fmtBRLFull(m.mrrAchieved) : <span style={{ opacity: 0.35 }}>—</span>}</td>
                            <DeltaTd curr={m.mrrAchieved} prev={prev?.mrrAchieved} show={hasMrrData} />
                            <td style={{ ...tdV, color: applyDelta(dMrrPct, mrrPctBase) }}>{m.mrrTarget > 0 ? `${m.mrrPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                            <DeltaTd curr={m.mrrPct} prev={prevMrrPct} show={m.mrrTarget > 0} />
                            <td style={{ ...tdV, color: applyDelta(dNrrR, numColor) }}>{hasNrrData ? fmtBRLFull(m.nrrAchieved) : <span style={{ opacity: 0.35 }}>—</span>}</td>
                            <DeltaTd curr={m.nrrAchieved} prev={prev?.nrrAchieved} show={hasNrrData} />
                            <td style={{ ...tdV, color: applyDelta(dNrrPct, nrrPctBase) }}>{m.nrrTarget > 0 ? `${m.nrrPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                            <DeltaTd curr={m.nrrPct} prev={prevNrrPct} show={m.nrrTarget > 0} />
                            <td style={{ ...tdV, color: applyDelta(dTotalR, numColor) }}>{fmtBRLFull(totalAch)}</td>
                            <DeltaTd curr={totalAch} prev={prevTotalAch} />
                            <td style={{ ...tdV, color: applyDelta(dTotalPct, totalPctBase) }}>{totalTgt > 0 ? `${totalPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                            <DeltaTd curr={totalPct} prev={prevTotalPct} show={totalTgt > 0} />
                            <td style={{ padding: "6px 0 6px 8px", textAlign: "center", width: 28 }}>
                              {totalPct >= 100 && <Crown size={11} style={{ color: "#E4A900", strokeWidth: 1.5 }} />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── ANÁLISE POR MEMBRO ─────────────────────────────────────── */}
                {memberStatsList.length > 0 && (() => {
                  const thS: React.CSSProperties = {
                    color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em",
                    textTransform: "uppercase", paddingBottom: 6,
                    borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap",
                  };
                  const tdC: React.CSSProperties = {
                    padding: "7px 4px 7px 8px", textAlign: "center",
                    fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 12,
                  };
                  return (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showMemberMetricsInfo ? 8 : 16 }}>
                        <Users size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                          Métricas por Vendedor
                        </h2>
                        <button
                          onClick={() => setShowMemberMetricsInfo((v) => !v)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            background: showMemberMetricsInfo ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)") : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                            border: `1px solid ${showMemberMetricsInfo ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)") : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                            borderRadius: 99, padding: "2px 8px", cursor: "pointer",
                            color: showMemberMetricsInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                            fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                            transition: "all 0.15s", flexShrink: 0,
                          }}
                        >
                          <Info size={10} strokeWidth={2} />
                          Sobre
                        </button>
                      </div>
                      {showMemberMetricsInfo && (
                        <div style={{
                          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                          borderRadius: 12, padding: "14px 16px", marginBottom: 16,
                          display: "flex", flexDirection: "column", gap: 12,
                          boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                        }}>
                          {/* Callout produção */}
                          <div style={{
                            display: "flex", alignItems: "flex-start", gap: 10,
                            background: isDark ? "rgba(228,169,0,0.10)" : "rgba(228,169,0,0.10)",
                            border: `1px solid ${isDark ? "rgba(228,169,0,0.28)" : "rgba(228,169,0,0.35)"}`,
                            borderRadius: 8, padding: "8px 12px",
                          }}>
                            <span style={{ fontSize: 15, lineHeight: 1.4, flexShrink: 0 }}>⚡</span>
                            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, fontWeight: 600, color: isDark ? "#fbbf24" : "#92400e" }}>
                              Apenas meses em <strong>produção</strong> entram nos cálculos. Meses de Ramp-up 🚀 e Férias 🌴 são completamente desconsiderados.
                            </p>
                          </div>

                          {/* Grid de métricas */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {([
                              {
                                icon: "🎯", label: "Consistência",
                                desc: "Nível típico de entrega no ano. Mediana dos % mensais de MRR e NRR, ignorando meses extremos.",
                                levels: [
                                  { color: isDark ? "#34d399" : "#059669", label: "Acima de 90%", note: "Consistente, batendo o objetivo na maioria dos meses." },
                                  { color: isDark ? "#fbbf24" : "#d97706", label: "Entre 70% e 90%", note: "No caminho, mas com espaço para crescer." },
                                  { color: isDark ? "#f87171" : "#dc2626", label: "Abaixo de 70%", note: "Resultados distantes da meta com frequência." },
                                ],
                              },
                              {
                                icon: "📈", label: "Tendência",
                                desc: "Compara a 1ª metade do ano com a 2ª. Mostra se o vendedor está evoluindo ou regredindo.",
                                levels: [
                                  { color: isDark ? "#34d399" : "#059669", label: "Acelerando", note: "Últimos meses melhores que os primeiros. No caminho certo. (≥ +15 pp)" },
                                  { color: isDark ? "#0fb8c0" : "#017E84", label: "Estável", note: "Resultado consistente, sem aceleração ou queda. (entre −15 pp e +15 pp)" },
                                  { color: isDark ? "#f87171" : "#dc2626", label: "Desacelerando", note: "Meses recentes abaixo do início do ano. Atenção para reverter. (≤ −15 pp)" },
                                ],
                              },
                              {
                                icon: "🌊", label: "Volatilidade",
                                desc: "Mede o quanto os resultados variam mês a mês. Baixa volatilidade indica maturidade e previsibilidade.",
                                levels: [
                                  { color: isDark ? "#34d399" : "#059669", label: "Baixa", note: "Resultados estáveis e previsíveis mês a mês. (desvio padrão < 20 pp)" },
                                  { color: isDark ? "#fbbf24" : "#d97706", label: "Média", note: "Oscilações moderadas, sem extremos. (20–40 pp)" },
                                  { color: isDark ? "#f87171" : "#dc2626", label: "Alta", note: "Grandes variações entre meses bons e ruins. (> 40 pp)" },
                                ],
                              },
                              {
                                icon: "✅", label: "Meta MRR / NRR",
                                desc: "Meses em que o vendedor bateu a meta no ano sobre o total de meses com target. Formato: bateu/total.",
                                levels: [
                                  { color: isDark ? "#34d399" : "#059669", label: "Numerador alto", note: "Bateu a meta na maioria dos meses em produção." },
                                  { color: isDark ? "#fbbf24" : "#d97706", label: "Parcial", note: "Bateu em alguns meses, mas há consistência a construir." },
                                  { color: isDark ? "#f87171" : "#dc2626", label: "Numerador baixo", note: "Poucas vezes atingiu a meta ao longo do ano." },
                                ],
                              },
                            ] as { icon: string; label: string; desc: string; levels: { color: string; label: string; note: string }[] }[]).map(({ icon, label, desc, levels }) => (
                              <div key={label} style={{
                                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
                                borderRadius: 8, padding: "10px 12px",
                                display: "flex", flexDirection: "column", gap: 6,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ fontSize: 13 }}>{icon}</span>
                                  <span style={{ fontWeight: 700, fontSize: 12, color: numColor }}>{label}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: subColor }}>{desc}</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
                                  {levels.map(({ color, label: lvlLabel, note }) => (
                                    <div key={lvlLabel} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 3 }} />
                                      <span style={{ fontSize: 10, lineHeight: 1.45, color: subColor }}>
                                        <strong style={{ color, fontWeight: 700 }}>{lvlLabel}:</strong> {note}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 520 }}>
                          <thead>
                            <tr>
                              <th style={{ ...thS, textAlign: "left" }}>Vendedor</th>
                              <th style={thS}>Consistência</th>
                              <th style={thS}>Tendência</th>
                              <th style={thS}>Volatilidade</th>
                              <th style={thS}>Meta MRR</th>
                              <th style={thS}>Meta NRR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {memberStatsList.map((mem) => {
                              const nameClean = stripTetragram(mem.userName);
                              const tetraMatch = mem.userName.match(/\(([^)]+)\)$/);
                              const tetra = tetraMatch ? tetraMatch[1].toUpperCase() : null;

                              const trendLabel = mem.trend == null ? null : mem.trend >= 15 ? "Acelerando" : mem.trend <= -15 ? "Desacelerando" : "Estável";
                              const trendArrow = mem.trend == null ? null : mem.trend >= 15 ? "↗" : mem.trend <= -15 ? "↘" : "→";
                              const trendColor = mem.trend == null ? subColor : mem.trend >= 15 ? "#22c55e" : mem.trend <= -15 ? "#ef4444" : subColor;

                              const volLabel = mem.volatility == null ? null : mem.volatility < 20 ? "Baixa" : mem.volatility < 40 ? "Média" : "Alta";
                              const volColor = mem.volatility == null ? subColor : mem.volatility < 20 ? "#22c55e" : mem.volatility < 40 ? "#E4A900" : "#ef4444";

                              const consColor = mem.consistency == null
                                ? subColor
                                : mem.consistency >= 90
                                  ? (isDark ? "#34d399" : "#059669")
                                  : mem.consistency >= 70
                                    ? (isDark ? "#fbbf24" : "#d97706")
                                    : (isDark ? "#f87171" : "#dc2626");

                              return (
                                <tr key={mem.userName} style={{ borderBottom: `1px solid ${dividerColor}` }}>
                                  <td style={{ padding: "7px 0", color: numColor, fontWeight: 500, whiteSpace: "nowrap" }}>
                                    {nameClean}
                                    {tetra && (
                                      <span style={{
                                        marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                                        color: subColor, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                                        borderRadius: 4, padding: "1px 5px",
                                      }}>
                                        {tetra}
                                      </span>
                                    )}
                                    {mem.status === "ramp-up" && (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                                        style={{ marginLeft: 6, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.30)", color: "#60a5fa" }}
                                      >
                                        🚀 Ramp-up
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ ...tdC, color: consColor }}>
                                    {mem.consistency != null
                                      ? `${mem.consistency.toFixed(1)}%`
                                      : <span style={{ opacity: 0.35, color: subColor }}>—</span>}
                                  </td>
                                  <td style={{ ...tdC, color: trendColor }}>
                                    {trendLabel != null
                                      ? <span title={`${mem.trend!.toFixed(1)} pp`}>{trendArrow} {trendLabel}</span>
                                      : <span style={{ opacity: 0.35, color: subColor }}>—</span>}
                                  </td>
                                  <td style={{ ...tdC, color: volColor }}>
                                    {volLabel != null
                                      ? <span title={`${mem.volatility!.toFixed(1)} pp`}>{volLabel}</span>
                                      : <span style={{ opacity: 0.35, color: subColor }}>—</span>}
                                  </td>
                                  <td style={{ ...tdC, color: mem.mrrTotalMonths > 0 ? (mem.mrrHitCount === mem.mrrTotalMonths ? "#E4A900" : numColor) : subColor }}>
                                    {mem.mrrTotalMonths > 0
                                      ? `${mem.mrrHitCount}/${mem.mrrTotalMonths}`
                                      : <span style={{ opacity: 0.35 }}>—</span>}
                                  </td>
                                  <td style={{ ...tdC, color: mem.nrrTotalMonths > 0 ? (mem.nrrHitCount === mem.nrrTotalMonths ? "#E4A900" : numColor) : subColor }}>
                                    {mem.nrrTotalMonths > 0
                                      ? `${mem.nrrHitCount}/${mem.nrrTotalMonths}`
                                      : <span style={{ opacity: 0.35 }}>—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })()}

          {/* ── MANAGER: Sessões ────────────────────────────────────────────── */}
          {viewMode === "manager" && teamYtd.monthCount > 0 && (() => {
            const cardBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
            const cardBorder = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
            const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

            // ── Consistency metrics (empresa) ──────────────────────────────
            const mgrMrrPcts = teamMonthlyHistory.filter((m) => m.mrrTarget > 0).map((m) => m.mrrPct);
            const mgrNrrPcts = teamMonthlyHistory.filter((m) => m.nrrTarget > 0).map((m) => m.nrrPct);
            const medianOf = (arr: number[]) => {
              if (!arr.length) return 0;
              const s = [...arr].sort((a, b) => a - b);
              const mid = Math.floor(s.length / 2);
              return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
            };
            const mgrMedianMrr = medianOf(mgrMrrPcts);
            const mgrMedianNrr = medianOf(mgrNrrPcts);
            const mgrMedianComposite = (mgrMedianMrr + mgrMedianNrr) / 2;
            const mgrMrrHitCount = mgrMrrPcts.filter((p) => p >= 100).length;
            const mgrNrrHitCount = mgrNrrPcts.filter((p) => p >= 100).length;
            const mgrMrrHitRate = mgrMrrPcts.length > 0 ? mgrMrrHitCount / mgrMrrPcts.length : 0;
            const mgrNrrHitRate = mgrNrrPcts.length > 0 ? mgrNrrHitCount / mgrNrrPcts.length : 0;

            const avgArr = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
            const halfN = Math.floor(mgrMrrPcts.length / 2);
            const halfNNrr = Math.floor(mgrNrrPcts.length / 2);
            const mgrMrrTrend = halfN >= 1 ? avgArr(mgrMrrPcts.slice(-halfN)) - avgArr(mgrMrrPcts.slice(0, halfN)) : 0;
            const mgrNrrTrend = halfNNrr >= 1 ? avgArr(mgrNrrPcts.slice(-halfNNrr)) - avgArr(mgrNrrPcts.slice(0, halfNNrr)) : 0;
            const mgrTrendComposite = mgrMrrPcts.length >= 2 || mgrNrrPcts.length >= 2 ? (mgrMrrTrend + mgrNrrTrend) / 2 : null;

            const mgrMrrVolMonths = teamMonthlyHistory.filter((m) => m.mrrTarget > 0).map((m) => m.mrrPct);
            const mgrNrrVolMonths = teamMonthlyHistory.filter((m) => m.nrrTarget > 0).map((m) => m.nrrPct);
            const mgrMrrVolMean = avgArr(mgrMrrVolMonths);
            const mgrNrrVolMean = avgArr(mgrNrrVolMonths);
            const mgrMrrStdDev = mgrMrrVolMonths.length > 1 ? Math.sqrt(mgrMrrVolMonths.reduce((s, v) => s + (v - mgrMrrVolMean) ** 2, 0) / mgrMrrVolMonths.length) : 0;
            const mgrNrrStdDev = mgrNrrVolMonths.length > 1 ? Math.sqrt(mgrNrrVolMonths.reduce((s, v) => s + (v - mgrNrrVolMean) ** 2, 0) / mgrNrrVolMonths.length) : 0;
            const mgrCompositeMonths = teamMonthlyHistory.filter((m) => m.mrrTarget > 0 && m.nrrTarget > 0).map((m) => (m.mrrPct + m.nrrPct) / 2);
            const mgrCompMean = avgArr(mgrCompositeMonths);
            const mgrCompStdDev = mgrCompositeMonths.length > 1 ? Math.sqrt(mgrCompositeMonths.reduce((s, v) => s + (v - mgrCompMean) ** 2, 0) / mgrCompositeMonths.length) : 0;

            const sortedMgr = [...teamMonthlyHistory].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
            let mgrMrrBestStreak = 0, mgrMrrRun = 0;
            let mgrMrrBestStreakMonths: string[] = [], mgrMrrRunMonths: string[] = [];
            for (const m of sortedMgr) {
              if (m.mrrTarget > 0 && m.mrrPct >= 100) {
                mgrMrrRun++; mgrMrrRunMonths.push(m.label);
                if (mgrMrrRun > mgrMrrBestStreak) { mgrMrrBestStreak = mgrMrrRun; mgrMrrBestStreakMonths = [...mgrMrrRunMonths]; }
              } else { mgrMrrRun = 0; mgrMrrRunMonths = []; }
            }
            let mgrNrrBestStreak = 0, mgrNrrRun = 0;
            let mgrNrrBestStreakMonths: string[] = [], mgrNrrRunMonths: string[] = [];
            for (const m of sortedMgr) {
              if (m.nrrTarget > 0 && m.nrrPct >= 100) {
                mgrNrrRun++; mgrNrrRunMonths.push(m.label);
                if (mgrNrrRun > mgrNrrBestStreak) { mgrNrrBestStreak = mgrNrrRun; mgrNrrBestStreakMonths = [...mgrNrrRunMonths]; }
              } else { mgrNrrRun = 0; mgrNrrRunMonths = []; }
            }
            let mgrMrrStreakCurrent = 0;
            for (let i = sortedMgr.length - 1; i >= 0; i--) {
              if (sortedMgr[i].mrrTarget > 0 && sortedMgr[i].mrrPct >= 100) mgrMrrStreakCurrent++;
              else break;
            }
            let mgrNrrStreakCurrent = 0;
            for (let i = sortedMgr.length - 1; i >= 0; i--) {
              if (sortedMgr[i].nrrTarget > 0 && sortedMgr[i].nrrPct >= 100) mgrNrrStreakCurrent++;
              else break;
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

                {/* ── SESSÃO 1: YTD Cards + Consistência ────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showYtdInfo ? 8 : 18 }}>
                    <BarChart2 size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                      Resumo do ano da empresa
                    </h2>
                    <button
                      onClick={() => setShowYtdInfo((v) => !v)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: showYtdInfo ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)") : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                        border: `1px solid ${showYtdInfo ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)") : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                        borderRadius: 99, padding: "2px 8px", cursor: "pointer",
                        color: showYtdInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                        transition: "all 0.15s", flexShrink: 0,
                      }}
                    >
                      <Info size={10} strokeWidth={2} />
                      Sobre
                    </button>
                  </div>
                  {showYtdInfo && (
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                      borderRadius: 12, padding: "14px 16px", marginBottom: 14,
                      fontSize: 12, lineHeight: 1.65, color: numColor,
                      display: "flex", flexDirection: "column", gap: 8,
                      boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📊 O que é</div>
                        <p style={{ margin: 0, color: subColor }}>Total acumulado de MRR e NRR gerado pela empresa no ano, com % de atingimento sobre as metas do período. Os cards detalham média mensal e os meses de maior e menor receita.</p>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                        <p style={{ margin: 0, color: subColor }}>O % YTD mostra o atingimento geral da empresa no ano. Comparar melhor e pior mês revela a consistência coletiva ao longo dos meses.</p>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

                    {/* MRR Card */}
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                      border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "20px 20px 20px",
                      boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.30)" : "0 2px 16px rgba(0,0,0,0.08)",
                      display: "flex", flexDirection: "column", overflow: "hidden",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>MRR da empresa:</span>
                        <Repeat2 style={{ width: 16, height: 16, color: CYAN, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                          {fmtBRLFull(teamYtd.mrrAch)}
                        </div>
                        <span className="ytd-badge-wrap" style={{ position: "relative", display: "inline-flex" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                            border: "1px solid rgba(228,169,0,0.40)", borderRadius: 99, padding: "2px 8px",
                            fontSize: 10, fontWeight: 700, color: "#E4A900",
                            fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", cursor: "help",
                          }}>
                            {Math.round(teamYtd.mrrPct)}% YTD
                          </span>
                          <span className="ytd-tip" style={{
                            position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                            background: isDark ? "#1c1c2e" : "#fff",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                            borderRadius: 6, padding: "5px 10px", fontSize: 12, lineHeight: 1.4,
                            color: isDark ? "#e0e0e0" : "#333", whiteSpace: "nowrap",
                            boxShadow: "0 2px 10px rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 100,
                          }}>
                            MRR acumulado da empresa no ano: realizado ÷ metas do período.
                          </span>
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                            <TrendingUp style={{ width: 12, height: 12, flexShrink: 0 }} />Mês com maior receita:
                          </div>
                          {teamYtd.bestMrrMonth ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                                {fmtBRLFull(teamYtd.bestMrrMonth.mrrAchieved)}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                                {MONTH_NAMES[parseInt(teamYtd.bestMrrMonth.monthKey.split("-")[1]) - 1] ?? teamYtd.bestMrrMonth.label}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                            <TrendingDown style={{ width: 12, height: 12, flexShrink: 0 }} />Mês com menor receita:
                          </div>
                          {teamYtd.worstMrrMonth ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                                {fmtBRLFull(teamYtd.worstMrrMonth.mrrAchieved)}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                                {MONTH_NAMES[parseInt(teamYtd.worstMrrMonth.monthKey.split("-")[1]) - 1] ?? teamYtd.worstMrrMonth.label}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
                        </div>
                      </div>
                    </div>

                    {/* NRR Card */}
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                      border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "20px 20px 20px",
                      boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.30)" : "0 2px 16px rgba(0,0,0,0.08)",
                      display: "flex", flexDirection: "column", overflow: "hidden",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>NRR da empresa:</span>
                        <BarChart2 style={{ width: 16, height: 16, color: PURPLE, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <div style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, color: numColor, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                          {fmtBRLFull(teamYtd.nrrAch)}
                        </div>
                        <span className="ytd-badge-wrap" style={{ position: "relative", display: "inline-flex" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                            border: "1px solid rgba(228,169,0,0.40)", borderRadius: 99, padding: "2px 8px",
                            fontSize: 10, fontWeight: 700, color: "#E4A900",
                            fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", cursor: "help",
                          }}>
                            {Math.round(teamYtd.nrrPct)}% YTD
                          </span>
                          <span className="ytd-tip" style={{
                            position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                            background: isDark ? "#1c1c2e" : "#fff",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                            borderRadius: 6, padding: "5px 10px", fontSize: 12, lineHeight: 1.4,
                            color: isDark ? "#e0e0e0" : "#333", whiteSpace: "nowrap",
                            boxShadow: "0 2px 10px rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 100,
                          }}>
                            NRR acumulado da empresa no ano: realizado ÷ metas do período.
                          </span>
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                            <TrendingUp style={{ width: 12, height: 12, flexShrink: 0 }} />Mês com maior receita:
                          </div>
                          {teamYtd.bestNrrMonth ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                                {fmtBRLFull(teamYtd.bestNrrMonth.nrrAchieved)}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                                {MONTH_NAMES[parseInt(teamYtd.bestNrrMonth.monthKey.split("-")[1]) - 1] ?? teamYtd.bestNrrMonth.label}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: numColor, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em" }}>
                            <TrendingDown style={{ width: 12, height: 12, flexShrink: 0 }} />Mês com menor receita:
                          </div>
                          {teamYtd.worstNrrMonth ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 400, color: numColor, fontVariantNumeric: "tabular-nums" }}>
                                {fmtBRLFull(teamYtd.worstNrrMonth.nrrAchieved)}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", alignSelf: "flex-start", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: subColor, borderRadius: 99, padding: "2px 7px" }}>
                                {MONTH_NAMES[parseInt(teamYtd.worstNrrMonth.monthKey.split("-")[1]) - 1] ?? teamYtd.worstNrrMonth.label}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 12, color: subColor }}>—</span>}
                        </div>
                      </div>
                    </div>

                    {/* Placeholder slots */}
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      border: `1px dashed ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                      borderRadius: 16, padding: "20px 20px 20px",
                      display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120,
                    }}>
                      <span style={{ fontSize: 11, color: subColor, opacity: 0.4, fontStyle: "italic" }}>Em breve</span>
                    </div>
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      border: `1px dashed ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                      borderRadius: 16, padding: "20px 20px 20px",
                      display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120,
                    }}>
                      <span style={{ fontSize: 11, color: subColor, opacity: 0.4, fontStyle: "italic" }}>Em breve</span>
                    </div>
                  </div>

                  {/* ── Consistência da empresa ────────────────────────────────── */}
                  <div style={{ marginBottom: 28, order: -1 }}>
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.96)",
                      border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "20px 20px 0",
                      boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.30)" : "0 2px 16px rgba(0,0,0,0.08)",
                      display: "flex", flexDirection: "column", overflow: "visible",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>Consistência da empresa:</span>
                        <Target style={{ width: 16, height: 16, color: CYAN, opacity: 0.55, flexShrink: 0, marginTop: 2 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                        <div style={{
                          fontSize: "clamp(2.8rem, 4vw, 3.5rem)", fontWeight: 900,
                          letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1,
                          color: mgrMedianComposite >= 90 ? "#E4A900" : (isDark ? "#FFFFFF" : CYAN),
                        }}>
                          {mgrMedianComposite.toFixed(1)}%
                        </div>
                        <span ref={teamConsistencyBadgeRef} style={{ position: "relative", display: "inline-flex" }}>
                          <span
                            onClick={() => setShowTeamConsistencyDetails((v) => !v)}
                            style={{
                              display: "inline-flex", alignItems: "center",
                              background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                              border: "1px solid rgba(228,169,0,0.40)",
                              borderRadius: 99, padding: "2px 8px",
                              fontSize: 10, fontWeight: 700, color: "#E4A900",
                              letterSpacing: "0.02em", cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            Ver Detalhes
                          </span>
                          {showTeamConsistencyDetails && (
                            <div className="consistency-detail-card" style={{
                              position: "absolute", top: "calc(100% + 8px)", left: 0,
                              width: 380, zIndex: 200,
                              background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                              borderRadius: 12, padding: "18px 20px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Consistência da empresa
                              </div>
                              <p style={{ margin: "0 0 14px", fontSize: 10, color: subColor, lineHeight: 1.5, fontStyle: "italic" }}>
                                Calculado pela mediana dos percentuais (%) mensais de MRR e NRR da empresa, excluindo meses sem meta registrada.
                              </p>
                              <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                                A empresa bate meta com regularidade?
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                                {[
                                  { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Acima de 90%", desc: "Empresa consistente, chegando perto ou superando o objetivo na maioria dos meses." },
                                  { dot: isDark ? "#fbbf24" : "#d97706", labelColor: isDark ? "#fbbf24" : "#d97706", range: "Entre 70% e 90%", desc: "Empresa no caminho, mas ainda há espaço para crescer coletivamente." },
                                  { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Abaixo de 70%", desc: "Resultados coletivos ficando distantes da meta com frequência." },
                                ].map(({ dot, labelColor, range, desc }) => (
                                  <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", marginBottom: 10 }} />
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Mediana MRR</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: mgrMedianMrr >= 100 ? "#E4A900" : pctColorDsm(mgrMedianMrr), fontVariantNumeric: "tabular-nums" }}>
                                    {mgrMedianMrr.toFixed(1)}%
                                  </span>
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                                    background: mgrMedianMrr >= 90 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : mgrMedianMrr >= 70 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                                    color: mgrMedianMrr >= 90 ? (isDark ? "#34d399" : "#059669") : mgrMedianMrr >= 70 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                                    borderRadius: 99, padding: "2px 6px",
                                  }}>
                                    {mgrMedianMrr >= 90 ? "Acima de 90%" : mgrMedianMrr >= 70 ? "Entre 70% e 90%" : "Abaixo de 70%"}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Mediana NRR</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: mgrMedianNrr >= 100 ? "#E4A900" : pctColorDsm(mgrMedianNrr), fontVariantNumeric: "tabular-nums" }}>
                                    {mgrMedianNrr.toFixed(1)}%
                                  </span>
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                                    background: mgrMedianNrr >= 90 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : mgrMedianNrr >= 70 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                                    color: mgrMedianNrr >= 90 ? (isDark ? "#34d399" : "#059669") : mgrMedianNrr >= 70 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                                    borderRadius: 99, padding: "2px 6px",
                                  }}>
                                    {mgrMedianNrr >= 90 ? "Acima de 90%" : mgrMedianNrr >= 70 ? "Entre 70% e 90%" : "Abaixo de 70%"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </span>
                      </div>
                      <div ref={teamInfoCardsRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0 16px", marginBottom: 14 }}>

                        {/* Tendência */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                            <TrendingUp style={{ width: 12, height: 12 }} />Tendência recente
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {mgrTrendComposite !== null ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start",
                                background: mgrTrendComposite >= 15
                                  ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)"
                                  : mgrTrendComposite <= -15 ? "rgba(239,68,68,0.15)" : "rgba(1,126,132,0.14)",
                                border: mgrTrendComposite >= 15
                                  ? "1px solid rgba(228,169,0,0.40)"
                                  : mgrTrendComposite <= -15 ? "1px solid rgba(239,68,68,0.40)" : "1px solid rgba(1,126,132,0.35)",
                                color: mgrTrendComposite >= 15 ? "#E4A900" : mgrTrendComposite <= -15 ? "#ef4444" : "#0fb8c0",
                                borderRadius: 99, padding: "3px 10px",
                                fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                              }}>
                                {mgrTrendComposite >= 15 ? <TrendingUp size={11} /> : mgrTrendComposite <= -15 ? <TrendingDown size={11} /> : <Repeat2 size={11} />}
                                {mgrTrendComposite >= 15 ? "Acelerando" : mgrTrendComposite <= -15 ? "Desacelerando" : "Estável"}
                              </span>
                            ) : <span style={{ fontSize: 11, color: subColor, opacity: 0.4 }}>—</span>}
                            <button onClick={() => setActiveTeamInfoCard(v => v === "tendencia" ? null : "tendencia")} style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              background: "none", border: "none", padding: 0, flexShrink: 0, cursor: "pointer",
                              color: activeTeamInfoCard === "tendencia" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                              transition: "color 0.15s",
                            }}>
                              <Info size={14} strokeWidth={2} />
                            </button>
                          </div>
                          {mgrTrendComposite !== null && (
                            <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>
                              {mgrTrendComposite >= 0 ? "+" : ""}{mgrTrendComposite.toFixed(0)} pp vs início
                            </span>
                          )}
                          {activeTeamInfoCard === "tendencia" && (
                            <div className="consistency-detail-card" style={{
                              position: "absolute", top: "calc(100% + 6px)", left: 0,
                              width: 320, zIndex: 300,
                              background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                              borderRadius: 12, padding: "14px 16px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Tendência Recente
                              </div>
                              <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                                A empresa está evoluindo ao longo do ano?
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {([
                                  { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Acelerando", desc: "Os últimos meses estão melhores do que os primeiros. A empresa está no caminho certo. (variação ≥ +15 pp)" },
                                  { dot: isDark ? "#0fb8c0" : "#017E84", labelColor: isDark ? "#0fb8c0" : "#017E84", range: "Estável", desc: "Sem variação significativa ao longo do ano. Resultado consistente, sem aceleração ou queda. (variação entre −15 pp e +15 pp)" },
                                  { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Desacelerando", desc: "Os meses mais recentes estão abaixo do início do ano. Atenção para reverter a tendência. (variação ≤ −15 pp)" },
                                ] as { dot: string; labelColor: string; range: string; desc: string }[]).map(({ dot, labelColor, range, desc }) => (
                                  <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", margin: "12px 0 10px" }} />
                              {([
                                { icon: <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />, label: "Tendência MRR", val: mgrMrrTrend },
                                { icon: <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />, label: "Tendência NRR", val: mgrNrrTrend },
                              ]).map(({ icon, label, val }, i) => {
                                const cat = val >= 15 ? "Acelerando" : val <= -15 ? "Desacelerando" : "Estável";
                                const valColor = val >= 15 ? (isDark ? "#34d399" : "#059669") : val <= -15 ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#0fb8c0" : "#017E84");
                                const badgeBg = val >= 15 ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)" : val <= -15 ? "rgba(239,68,68,0.15)" : "rgba(1,126,132,0.14)";
                                const badgeBorder = val >= 15 ? "1px solid rgba(228,169,0,0.40)" : val <= -15 ? "1px solid rgba(239,68,68,0.40)" : "1px solid rgba(1,126,132,0.35)";
                                return (
                                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i === 0 ? 8 : 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      {icon}
                                      <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>{label}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: valColor }}>
                                        {val >= 0 ? "+" : ""}{val.toFixed(0)} pp
                                      </span>
                                      <span style={{ fontSize: 9, fontWeight: 700, background: badgeBg, border: badgeBorder, color: valColor, borderRadius: 99, padding: "2px 7px", letterSpacing: "0.02em" }}>
                                        {cat}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Volatilidade */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                            <BarChart2 style={{ width: 12, height: 12 }} />Volatilidade
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", alignSelf: "flex-start",
                              fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                              background: mgrCompStdDev < 20 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : mgrCompStdDev < 40 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                              border: mgrCompStdDev < 20 ? "1px solid rgba(52,211,153,0.40)" : mgrCompStdDev < 40 ? "1px solid rgba(251,191,36,0.40)" : "1px solid rgba(248,113,113,0.40)",
                              color: mgrCompStdDev < 20 ? (isDark ? "#34d399" : "#059669") : mgrCompStdDev < 40 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                              borderRadius: 99, padding: "3px 10px",
                            }}>
                              {mgrCompStdDev < 20 ? "Baixa" : mgrCompStdDev < 40 ? "Média" : "Alta"}
                            </span>
                            <button onClick={() => setActiveTeamInfoCard(v => v === "volatilidade" ? null : "volatilidade")} style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              background: "none", border: "none", padding: 0, flexShrink: 0, cursor: "pointer",
                              color: activeTeamInfoCard === "volatilidade" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                              transition: "color 0.15s",
                            }}>
                              <Info size={14} strokeWidth={2} />
                            </button>
                          </div>
                          {mgrCompositeMonths.length > 1 && (
                            <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>±{mgrCompStdDev.toFixed(0)} pp desvio padrão</span>
                          )}
                          {activeTeamInfoCard === "volatilidade" && (
                            <div className="consistency-detail-card" style={{
                              position: "absolute", top: "calc(100% + 6px)", left: 0,
                              width: 320, zIndex: 300,
                              background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                              borderRadius: 12, padding: "14px 16px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Volatilidade
                              </div>
                              <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                                Os resultados da empresa oscilam muito entre os meses?
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {([
                                  { dot: isDark ? "#34d399" : "#059669", labelColor: isDark ? "#34d399" : "#059669", range: "Baixa", desc: "Resultados estáveis e previsíveis. A empresa mantém nível parecido mês a mês. (desvio padrão < 20 pp)" },
                                  { dot: isDark ? "#fbbf24" : "#d97706", labelColor: isDark ? "#fbbf24" : "#d97706", range: "Média", desc: "Oscilações moderadas entre os meses. Há variação, mas sem extremos. (desvio padrão 20–40 pp)" },
                                  { dot: isDark ? "#f87171" : "#dc2626", labelColor: isDark ? "#f87171" : "#dc2626", range: "Alta", desc: "Grandes variações entre meses bons e ruins. Resultado coletivo pouco previsível. (desvio padrão > 40 pp)" },
                                ] as { dot: string; labelColor: string; range: string; desc: string }[]).map(({ dot, labelColor, range, desc }) => (
                                  <div key={range} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11, fontWeight: 700, color: labelColor }}>{range}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: subColor, lineHeight: 1.5, paddingLeft: 16 }}>{desc}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", margin: "12px 0 10px" }} />
                              {([
                                { icon: <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />, label: "Volatilidade MRR", std: mgrMrrStdDev },
                                { icon: <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />, label: "Volatilidade NRR", std: mgrNrrStdDev },
                              ]).map(({ icon, label, std }, i) => {
                                const cat = std < 20 ? "Baixa" : std < 40 ? "Média" : "Alta";
                                const valColor = std < 20 ? (isDark ? "#34d399" : "#059669") : std < 40 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626");
                                const badgeBg = std < 20 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : std < 40 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)");
                                const badgeBorder = std < 20 ? "1px solid rgba(52,211,153,0.40)" : std < 40 ? "1px solid rgba(251,191,36,0.40)" : "1px solid rgba(248,113,113,0.40)";
                                return (
                                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i === 0 ? 8 : 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      {icon}
                                      <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>{label}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: valColor }}>
                                        ±{std.toFixed(0)} pp
                                      </span>
                                      <span style={{ fontSize: 9, fontWeight: 700, background: badgeBg, border: badgeBorder, color: valColor, borderRadius: 99, padding: "2px 7px", letterSpacing: "0.02em" }}>
                                        {cat}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Histórico de Sequência */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                            <CalendarDays style={{ width: 12, height: 12 }} />Histórico de Sequência
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", alignSelf: "flex-start",
                              background: mgrMrrBestStreak > 0 || mgrNrrBestStreak > 0
                                ? "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)"
                                : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                              border: mgrMrrBestStreak > 0 || mgrNrrBestStreak > 0
                                ? "1px solid rgba(228,169,0,0.40)"
                                : (isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)"),
                              borderRadius: 99, padding: "3px 10px",
                              fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                              color: mgrMrrBestStreak > 0 || mgrNrrBestStreak > 0 ? "#E4A900" : subColor,
                            }}>
                              🔥 {mgrMrrBestStreak} MRR · {mgrNrrBestStreak} NRR
                            </span>
                            <button onClick={() => setActiveTeamInfoCard(v => v === "sequencia" ? null : "sequencia")} style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              background: "none", border: "none", padding: 0, flexShrink: 0, cursor: "pointer",
                              color: activeTeamInfoCard === "sequencia" ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                              transition: "color 0.15s",
                            }}>
                              <Info size={14} strokeWidth={2} />
                            </button>
                          </div>
                          <span style={{ fontSize: 9, color: subColor, opacity: 0.55 }}>melhor sequência do ano</span>
                          {activeTeamInfoCard === "sequencia" && (
                            <div className="consistency-detail-card" style={{
                              position: "absolute", top: "calc(100% + 6px)", left: 0,
                              width: 320, zIndex: 300,
                              background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                              borderRadius: 12, padding: "14px 16px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Histórico de Sequência
                              </div>
                              <p style={{ margin: "0 0 12px", fontSize: 12, color: numColor, fontWeight: 600, lineHeight: 1.5 }}>
                                Quantos meses seguidos a empresa bateu meta?
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                    <Repeat2 style={{ width: 10, height: 10, color: CYAN }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Melhor sequência MRR</span>
                                    {mgrMrrBestStreak > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#E4A900" }}>{mgrMrrBestStreak} meses</span>}
                                  </div>
                                  {mgrMrrBestStreakMonths.length > 0
                                    ? <span style={{ fontSize: 11, color: numColor, lineHeight: 1.5, paddingLeft: 14 }}>{mgrMrrBestStreakMonths.join(" · ")}</span>
                                    : <span style={{ fontSize: 11, color: subColor, opacity: 0.4, paddingLeft: 14 }}>Nenhuma sequência</span>}
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                    <BarChart2 style={{ width: 10, height: 10, color: PURPLE }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Melhor sequência NRR</span>
                                    {mgrNrrBestStreak > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#E4A900" }}>{mgrNrrBestStreak} meses</span>}
                                  </div>
                                  {mgrNrrBestStreakMonths.length > 0
                                    ? <span style={{ fontSize: 11, color: numColor, lineHeight: 1.5, paddingLeft: 14 }}>{mgrNrrBestStreakMonths.join(" · ")}</span>
                                    : <span style={{ fontSize: 11, color: subColor, opacity: 0.4, paddingLeft: 14 }}>Nenhuma sequência</span>}
                                </div>
                              </div>
                              <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", marginBottom: 10 }} />
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: subColor }}>Sequência atual</span>
                                {mgrMrrStreakCurrent > 0 || mgrNrrStreakCurrent > 0 ? (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center",
                                    background: "rgba(1,126,132,0.14)", border: "1px solid rgba(1,126,132,0.35)",
                                    borderRadius: 99, padding: "2px 10px",
                                    fontSize: 10, fontWeight: 700, color: "#0fb8c0",
                                  }}>
                                    🔥 {mgrMrrStreakCurrent} MRR · {mgrNrrStreakCurrent} NRR
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: subColor, opacity: 0.4 }}>Sem sequência ativa</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Histórico metas */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: numColor, display: "flex", alignItems: "center", gap: 5, letterSpacing: "-0.01em", marginBottom: 2 }}>
                            <Target style={{ width: 12, height: 12 }} />Histórico metas
                          </div>
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", alignSelf: "flex-start",
                            background: mgrMrrHitRate >= 0.6 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : mgrMrrHitRate >= 0.4 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                            color: mgrMrrHitRate >= 0.6 ? (isDark ? "#34d399" : "#059669") : mgrMrrHitRate >= 0.4 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                            borderRadius: 99, padding: "2px 6px",
                          }}>
                            MRR: {mgrMrrHitCount}/{mgrMrrPcts.length} meses na meta
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", alignSelf: "flex-start",
                            background: mgrNrrHitRate >= 0.6 ? (isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)") : mgrNrrHitRate >= 0.4 ? (isDark ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.10)") : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)"),
                            color: mgrNrrHitRate >= 0.6 ? (isDark ? "#34d399" : "#059669") : mgrNrrHitRate >= 0.4 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626"),
                            borderRadius: 99, padding: "2px 6px",
                          }}>
                            NRR: {mgrNrrHitCount}/{mgrNrrPcts.length} meses na meta
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 20 }} />
                    </div>
                  </div>
                </div>

                {/* ── SESSÃO 2: Trend Chart ────────────────────────────────── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <TrendingUp size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                      Linha de tendência da empresa
                    </h2>
                    <button
                      onClick={() => setShowTrendInfo((v) => !v)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: showTrendInfo ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)") : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                        border: `1px solid ${showTrendInfo ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)") : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                        borderRadius: 99, padding: "2px 8px", cursor: "pointer",
                        color: showTrendInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                        transition: "all 0.15s", flexShrink: 0,
                      }}
                    >
                      <Info size={10} strokeWidth={2} />
                      Sobre
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: showTrendInfo ? 0 : 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={CYAN} strokeWidth="1.5" strokeDasharray="4 2" /></svg>
                      <span style={{ fontSize: 10, color: subColor, fontWeight: 600 }}>MRR</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={PURPLE} strokeWidth="2" /></svg>
                      <span style={{ fontSize: 10, color: subColor, fontWeight: 600 }}>NRR</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={refColor} strokeWidth="1" strokeDasharray="4 3" opacity={0.4} /></svg>
                      <span style={{ fontSize: 10, color: subColor, fontWeight: 600 }}>Meta: 100%</span>
                    </div>
                  </div>
                  {showTrendInfo && (
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                      borderRadius: 12, padding: "14px 16px", margin: "10px 0 14px",
                      fontSize: 12, lineHeight: 1.65, color: numColor,
                      display: "flex", flexDirection: "column", gap: 8,
                      boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📈 O que é</div>
                        <p style={{ margin: 0, color: subColor }}>Mostra mês a mês o % de atingimento de MRR e NRR da empresa em relação às metas. A linha tracejada é MRR, a sólida é NRR. A linha horizontal marca os 100% de meta.</p>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                        <p style={{ margin: 0, color: subColor }}>Permite identificar meses de aceleração ou queda no desempenho coletivo. Quando as linhas estão próximas, a empresa tem equilíbrio entre os dois indicadores.</p>
                      </div>
                    </div>
                  )}
                  <div style={{ height: 220, padding: "0 16px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={teamMonthlyHistory} margin={{ top: 8, right: 36, left: 0, bottom: 12 }}>
                        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} />
                        <YAxis ticks={teamChartYTicks} tickFormatter={(v) => `${v}%`} tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                        <ReferenceLine y={100} stroke={refColor} strokeDasharray="3 2" strokeWidth={1} strokeOpacity={0.4}
                          label={{ value: "Meta: 100%", fill: refColor, opacity: 0.4, fontSize: 10, fontWeight: 600, position: "insideTopRight" }}
                        />
                        <Tooltip content={<ChartTooltip isDark={isDark} />} cursor={{ stroke: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", strokeWidth: 1 }} />
                        <Line type="monotone" dataKey="mrrPct" stroke={CYAN} strokeWidth={1} strokeDasharray="4 2" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: "none" }} connectNulls={false} />
                        <Line type="monotone" dataKey="nrrPct" stroke={PURPLE} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: PURPLE, stroke: "none" }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── SESSÃO 3: Mês a Mês ─────────────────────────────────────── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <CalendarDays size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                      Mês a mês da empresa
                    </h2>
                    <button
                      onClick={() => setShowTeamMonthlyInfo((v) => !v)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: showTeamMonthlyInfo ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)") : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                        border: `1px solid ${showTeamMonthlyInfo ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)") : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                        borderRadius: 99, padding: "2px 8px", cursor: "pointer",
                        color: showTeamMonthlyInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                        transition: "all 0.15s", flexShrink: 0,
                      }}
                    >
                      <Info size={10} strokeWidth={2} />
                      Sobre
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: showTeamMonthlyInfo ? 8 : 16 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: subColor }}>
                      <span style={{ color: DELTA_UP_COLOR, fontSize: 9, lineHeight: 1 }}>▲</span>
                      Valor acima comparando com o mês anterior
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: subColor }}>
                      <span style={{ color: DELTA_DOWN_COLOR, fontSize: 9, lineHeight: 1 }}>▼</span>
                      Valor abaixo comparando com o mês anterior
                    </span>
                  </div>
                  {showTeamMonthlyInfo && (
                    <div style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                      borderRadius: 12, padding: "14px 16px", marginBottom: 16,
                      fontSize: 12, lineHeight: 1.65, color: numColor,
                      display: "flex", flexDirection: "column", gap: 8,
                      boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>📊 O que é</div>
                        <p style={{ margin: 0, color: subColor }}>Visão compilada dos números da empresa mês a mês — MRR, NRR e totais em uma única tabela. Coroa indica meses onde o total superou a meta.</p>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: numColor, marginBottom: 3 }}>🔍 Para que serve</div>
                        <p style={{ margin: 0, color: subColor }}>Permite identificar rapidamente meses de aceleração ou queda no desempenho coletivo. As setas mostram variação em relação ao mês anterior.</p>
                      </div>
                    </div>
                  )}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 640 }}>
                      <thead>
                        <tr>
                          <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "left", whiteSpace: "nowrap" }}>Mês</th>
                          <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>MRR R$</th>
                          <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                          <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>MRR %</th>
                          <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                          <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>NRR R$</th>
                          <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                          <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>NRR %</th>
                          <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                          <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>Total R$</th>
                          <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                          <th style={{ color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap" }}>Total %</th>
                          <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, width: 14 }} />
                          <th style={{ paddingBottom: 6, borderBottom: `1px solid ${dividerColor}`, textAlign: "center", width: 28 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {teamMonthlyHistory.map((m, idx) => {
                          const prev = teamMonthlyHistory[idx - 1];
                          const fullName = MONTH_NAMES[parseInt(m.monthKey.split("-")[1]) - 1] ?? m.label;
                          const totalAch = m.mrrAchieved + m.nrrAchieved;
                          const totalTgt = m.mrrTarget + m.nrrTarget;
                          const totalPct = totalTgt > 0 ? (totalAch / totalTgt) * 100 : 0;
                          const prevTotalAch = prev ? prev.mrrAchieved + prev.nrrAchieved : undefined;
                          const prevTotalTgt = prev ? prev.mrrTarget + prev.nrrTarget : undefined;
                          const prevTotalPct = prevTotalTgt !== undefined && prevTotalTgt > 0 ? ((prevTotalAch ?? 0) / prevTotalTgt) * 100 : undefined;
                          const mrrPctBase = m.mrrPct >= 100 ? "#E4A900" : pctColorDsm(m.mrrPct);
                          const nrrPctBase = m.nrrPct >= 100 ? "#E4A900" : pctColorDsm(m.nrrPct);
                          const totalPctBase = totalPct >= 100 ? "#E4A900" : pctColorDsm(totalPct);
                          const hasMrrData = m.mrrTarget > 0 || m.mrrAchieved !== 0;
                          const hasNrrData = m.nrrTarget > 0 || m.nrrAchieved !== 0;
                          const prevMrrPct = prev?.mrrTarget !== undefined && prev.mrrTarget > 0 ? prev.mrrPct : undefined;
                          const prevNrrPct = prev?.nrrTarget !== undefined && prev.nrrTarget > 0 ? prev.nrrPct : undefined;
                          const dMrrR = deltaDir(m.mrrAchieved, prev?.mrrAchieved, hasMrrData);
                          const dMrrPct = deltaDir(m.mrrPct, prevMrrPct, m.mrrTarget > 0);
                          const dNrrR = deltaDir(m.nrrAchieved, prev?.nrrAchieved, hasNrrData);
                          const dNrrPct = deltaDir(m.nrrPct, prevNrrPct, m.nrrTarget > 0);
                          const dTotalR = deltaDir(totalAch, prevTotalAch);
                          const dTotalPct = deltaDir(totalPct, prevTotalPct, totalTgt > 0);
                          const tdV: React.CSSProperties = { padding: "6px 0 6px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 700 };
                          return (
                            <tr key={m.monthKey} style={{ borderBottom: `1px solid ${dividerColor}` }}>
                              <td style={{ padding: "6px 0", color: numColor, fontWeight: 500, whiteSpace: "nowrap" }}>{fullName}</td>
                              <td style={{ ...tdV, color: applyDelta(dMrrR, numColor) }}>{hasMrrData ? fmtBRLFull(m.mrrAchieved) : <span style={{ opacity: 0.35 }}>—</span>}</td>
                              <DeltaTd curr={m.mrrAchieved} prev={prev?.mrrAchieved} show={hasMrrData} />
                              <td style={{ ...tdV, color: applyDelta(dMrrPct, mrrPctBase) }}>{m.mrrTarget > 0 ? `${m.mrrPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                              <DeltaTd curr={m.mrrPct} prev={prevMrrPct} show={m.mrrTarget > 0} />
                              <td style={{ ...tdV, color: applyDelta(dNrrR, numColor) }}>{hasNrrData ? fmtBRLFull(m.nrrAchieved) : <span style={{ opacity: 0.35 }}>—</span>}</td>
                              <DeltaTd curr={m.nrrAchieved} prev={prev?.nrrAchieved} show={hasNrrData} />
                              <td style={{ ...tdV, color: applyDelta(dNrrPct, nrrPctBase) }}>{m.nrrTarget > 0 ? `${m.nrrPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                              <DeltaTd curr={m.nrrPct} prev={prevNrrPct} show={m.nrrTarget > 0} />
                              <td style={{ ...tdV, color: applyDelta(dTotalR, numColor) }}>{fmtBRLFull(totalAch)}</td>
                              <DeltaTd curr={totalAch} prev={prevTotalAch} />
                              <td style={{ ...tdV, color: applyDelta(dTotalPct, totalPctBase) }}>{totalTgt > 0 ? `${totalPct.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                              <DeltaTd curr={totalPct} prev={prevTotalPct} show={totalTgt > 0} />
                              <td style={{ padding: "6px 0 6px 8px", textAlign: "center", width: 28 }}>
                                {totalPct >= 100 && <Crown size={11} style={{ color: "#E4A900", strokeWidth: 1.5 }} />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              {/* ── SESSÃO 4: Métricas por Time ───────────────────────────── */}
              {(() => {
                type S4MonthAgg = { mrrAch: number; mrrTgt: number; nrrAch: number; nrrTgt: number; isVacOrRamp: boolean };

                // Build team membership + active status from full-year allRaw (static, not month-filtered)
                const s4TeamMap = new Map<number, string>();
                const s4ActiveSet = new Set<number | null>();
                const s4StatusMap = new Map<number | null, string>();
                // team_name → manager_id (most recent, sorted asc → last write wins)
                const teamManagerIdMap = new Map<string, number>();
                {
                  const yearRowsSorted = (allRaw ?? [])
                    .filter((r) => (r.date_from ?? "").startsWith(year))
                    .sort((a, b) => (a.date_from ?? "").localeCompare(b.date_from ?? ""));
                  const allInativo = new Map<number, boolean>();
                  for (const r of yearRowsSorted) {
                    if (r.user_id == null) continue;
                    if (r.team_name) s4TeamMap.set(r.user_id, r.team_name);
                    if (r.team_name && r.manager_id != null) teamManagerIdMap.set(r.team_name, r.manager_id);
                    const isInativo = r.active === false;
                    allInativo.set(r.user_id, isInativo ? (allInativo.get(r.user_id) ?? true) : false);
                    // most recent status wins (sorted asc → last write = most recent)
                    if (isInativo) s4StatusMap.set(r.user_id, "inativo");
                    else if ((r.plan_name ?? "").startsWith("[RAMP-UP]")) s4StatusMap.set(r.user_id, "ramp-up");
                    else if (r.skip_record) s4StatusMap.set(r.user_id, "férias");
                    else s4StatusMap.set(r.user_id, "ativo");
                  }
                  for (const [uid, onlyInativo] of allInativo) {
                    if (!onlyInativo) s4ActiveSet.add(uid);
                  }
                }
                const s4RawMap = new Map<string | number, { userId: number | null; userName: string; teamName: string | null; months: Map<string, S4MonthAgg> }>();

                for (const r of (allRaw ?? [])) {
                  if (!(r.date_from ?? "").startsWith(year)) continue;
                  const uid: string | number = r.user_id ?? r.user_name ?? "?";
                  const uname = r.user_name ?? "—";
                  if (!s4RawMap.has(uid)) {
                    const team = r.user_id != null ? (s4TeamMap.get(r.user_id) ?? null) : null;
                    s4RawMap.set(uid, { userId: r.user_id ?? null, userName: uname, teamName: team, months: new Map() });
                  }
                  const mem = s4RawMap.get(uid)!;
                  const mKey = toMonthKeyStr(r.date_from ?? "");
                  if (!mKey) continue;
                  if (!mem.months.has(mKey)) mem.months.set(mKey, { mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0, isVacOrRamp: false });
                  const md = mem.months.get(mKey)!;
                  if (!!(r.skip_record && r.active !== false) || (r.plan_name ?? "").startsWith("[RAMP-UP]")) md.isVacOrRamp = true;
                  const rType = (r.plan_type ?? "").toUpperCase();
                  const rAch = Math.max(0, r.achieved ?? 0);
                  const rTgt = r.skip_record ? 0 : (r.target_amount ?? 0);
                  if (rType === "MRR") { md.mrrAch += rAch; md.mrrTgt += rTgt; }
                  else if (rType === "NRR") { md.nrrAch += rAch; md.nrrTgt += rTgt; }
                }

                const s4Members = Array.from(s4RawMap.values())
                  .filter((mem) => mem.userId != null && s4StatusMap.get(mem.userId) !== "inativo")
                  .map((mem) => {
                    const sorted = [...mem.months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d);
                    const validMrr = sorted.filter((m) => !m.isVacOrRamp && m.mrrTgt > 0).map((m) => (m.mrrAch / m.mrrTgt) * 100);
                    const validNrr = sorted.filter((m) => !m.isVacOrRamp && m.nrrTgt > 0).map((m) => (m.nrrAch / m.nrrTgt) * 100);
                    const medMrr = medianOf(validMrr);
                    const medNrr = medianOf(validNrr);
                    const consistency = validMrr.length > 0 || validNrr.length > 0 ? (medMrr + medNrr) / 2 : null;
                    const halfMm = Math.floor(validMrr.length / 2);
                    const halfNm = Math.floor(validNrr.length / 2);
                    const mrrTr = halfMm >= 1 ? avgArr(validMrr.slice(-halfMm)) - avgArr(validMrr.slice(0, halfMm)) : 0;
                    const nrrTr = halfNm >= 1 ? avgArr(validNrr.slice(-halfNm)) - avgArr(validNrr.slice(0, halfNm)) : 0;
                    const trend = validMrr.length >= 2 || validNrr.length >= 2 ? (mrrTr + nrrTr) / 2 : null;
                    const compMonths = sorted.filter((m) => !m.isVacOrRamp && m.mrrTgt > 0 && m.nrrTgt > 0).map((m) => ((m.mrrAch / m.mrrTgt) * 100 + (m.nrrAch / m.nrrTgt) * 100) / 2);
                    const compMean = avgArr(compMonths);
                    const volatility = compMonths.length > 1 ? Math.sqrt(compMonths.reduce((s, v) => s + (v - compMean) ** 2, 0) / compMonths.length) : null;
                    const mrrHitCount = validMrr.filter((p) => p >= 100).length;
                    const mrrTotalMonths = validMrr.length;
                    const nrrHitCount = validNrr.filter((p) => p >= 100).length;
                    const nrrTotalMonths = validNrr.length;
                    const status = mem.userId != null ? (s4StatusMap.get(mem.userId) ?? null) : null;
                    return { userName: mem.userName, teamName: mem.teamName, consistency, trend, volatility, mrrHitCount, mrrTotalMonths, nrrHitCount, nrrTotalMonths, status };
                  });

                if (s4Members.length === 0) return null;

                // Group sellers by team
                const s4TeamGroups = new Map<string, typeof s4Members>();
                for (const m of s4Members) {
                  const team = m.teamName ?? "Sem time";
                  if (!s4TeamGroups.has(team)) s4TeamGroups.set(team, []);
                  s4TeamGroups.get(team)!.push(m);
                }

                // Build team list and stats directly from allRaw by r.team_name (historical, like teamMonthlyHistory).
                // This matches TL view semantics: team data = rows where that team_name appears, not current member assignment.
                type TeamAgg = {
                  teamName: string;
                  consistency: number | null;
                  trend: number | null;
                  volatility: number | null;
                  mrrHitCount: number;
                  mrrTotalMonths: number;
                  nrrHitCount: number;
                  nrrTotalMonths: number;
                  members: typeof s4Members;
                };

                const s4TeamRawMap = new Map<string, { mrrAch: number; mrrTgt: number; nrrAch: number; nrrTgt: number }[]>();
                for (const r of (allRaw ?? [])) {
                  if (!(r.date_from ?? "").startsWith(year)) continue;
                  const tName = r.team_name;
                  if (!tName || tName === "Team Leaders BR") continue;
                  const mKey = toMonthKeyStr(r.date_from ?? "");
                  if (!mKey) continue;
                  if (!s4TeamRawMap.has(tName)) s4TeamRawMap.set(tName, []);
                  const monthsArr = s4TeamRawMap.get(tName)!;
                  let entry = monthsArr.find((e: { mrrAch: number; mrrTgt: number; nrrAch: number; nrrTgt: number } & { mKey?: string }) => e.mKey === mKey);
                  if (!entry) { entry = { mKey, mrrAch: 0, mrrTgt: 0, nrrAch: 0, nrrTgt: 0 } as typeof entry; monthsArr.push(entry!); }
                  const rAch = Math.max(0, r.achieved ?? 0);
                  const rTgt = r.skip_record ? 0 : (r.target_amount ?? 0);
                  const rType = (r.plan_type ?? "").toUpperCase();
                  if (rType === "MRR") { entry!.mrrAch += rAch; entry!.mrrTgt += rTgt; }
                  else if (rType === "NRR") { entry!.nrrAch += rAch; entry!.nrrTgt += rTgt; }
                }

                const computeTeamStats = (teamName: string, members: typeof s4Members): TeamAgg => {
                  const rawMonths = (s4TeamRawMap.get(teamName) ?? []) as ({ mKey: string; mrrAch: number; mrrTgt: number; nrrAch: number; nrrTgt: number })[];
                  const sorted = [...rawMonths].sort((a, b) => a.mKey.localeCompare(b.mKey));
                  const validMrr = sorted.filter((m) => m.mrrTgt > 0).map((m) => (m.mrrAch / m.mrrTgt) * 100);
                  const validNrr = sorted.filter((m) => m.nrrTgt > 0).map((m) => (m.nrrAch / m.nrrTgt) * 100);
                  const medMrr = medianOf(validMrr);
                  const medNrr = medianOf(validNrr);
                  const consistency = validMrr.length > 0 || validNrr.length > 0 ? (medMrr + medNrr) / 2 : null;
                  const halfMm = Math.floor(validMrr.length / 2);
                  const halfNm = Math.floor(validNrr.length / 2);
                  const mrrTr = halfMm >= 1 ? avgArr(validMrr.slice(-halfMm)) - avgArr(validMrr.slice(0, halfMm)) : 0;
                  const nrrTr = halfNm >= 1 ? avgArr(validNrr.slice(-halfNm)) - avgArr(validNrr.slice(0, halfNm)) : 0;
                  const trend = validMrr.length >= 2 || validNrr.length >= 2 ? (mrrTr + nrrTr) / 2 : null;
                  const compMonths = sorted.filter((m) => m.mrrTgt > 0 && m.nrrTgt > 0).map((m) => ((m.mrrAch / m.mrrTgt) * 100 + (m.nrrAch / m.nrrTgt) * 100) / 2);
                  const compMean = avgArr(compMonths);
                  const volatility = compMonths.length > 1 ? Math.sqrt(compMonths.reduce((s, v) => s + (v - compMean) ** 2, 0) / compMonths.length) : null;
                  return {
                    teamName,
                    consistency,
                    trend,
                    volatility,
                    mrrHitCount: validMrr.filter((p) => p >= 100).length,
                    mrrTotalMonths: validMrr.length,
                    nrrHitCount: validNrr.filter((p) => p >= 100).length,
                    nrrTotalMonths: validNrr.length,
                    members,
                  };
                };

                const s4Teams: TeamAgg[] = [...s4TeamRawMap.keys()]
                  .filter((team) => {
                    if (!activeManagerIds || activeManagerIds.size === 0) return true;
                    const mgid = teamManagerIdMap.get(team);
                    return mgid != null && activeManagerIds.has(mgid);
                  })
                  .map((team) => {
                    const teamMembers = s4Members.filter((m) => m.teamName === team);
                    return computeTeamStats(team, teamMembers.sort((a, b) => (b.consistency ?? -1) - (a.consistency ?? -1)));
                  })
                  .sort((a, b) => (b.consistency ?? -1) - (a.consistency ?? -1));

                const thS: React.CSSProperties = {
                  color: subColor, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em",
                  textTransform: "uppercase", paddingBottom: 6,
                  borderBottom: `1px solid ${dividerColor}`, textAlign: "center", whiteSpace: "nowrap",
                };
                const tdC: React.CSSProperties = {
                  padding: "7px 4px 7px 8px", textAlign: "center",
                  fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 12,
                };

                return (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showMemberMetricsInfo ? 8 : 16 }}>
                      <Users size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                        Métricas por Time
                      </h2>
                      <button
                        onClick={() => setShowMemberMetricsInfo((v) => !v)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: showMemberMetricsInfo ? (isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)") : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"),
                          border: `1px solid ${showMemberMetricsInfo ? (isDark ? "rgba(113,75,103,0.50)" : "rgba(113,75,103,0.30)") : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)")}`,
                          borderRadius: 99, padding: "2px 8px", cursor: "pointer",
                          color: showMemberMetricsInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
                          fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                          transition: "all 0.15s", flexShrink: 0,
                        }}
                      >
                        <Info size={10} strokeWidth={2} />
                        Sobre
                      </button>
                    </div>

                    {showMemberMetricsInfo && (
                      <div style={{
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
                        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                        borderRadius: 12, padding: "14px 16px", marginBottom: 16,
                        display: "flex", flexDirection: "column", gap: 12,
                        boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.07)",
                      }}>
                        <div style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          background: isDark ? "rgba(228,169,0,0.10)" : "rgba(228,169,0,0.10)",
                          border: `1px solid ${isDark ? "rgba(228,169,0,0.28)" : "rgba(228,169,0,0.35)"}`,
                          borderRadius: 8, padding: "8px 12px",
                        }}>
                          <span style={{ fontSize: 15, lineHeight: 1.4, flexShrink: 0 }}>⚡</span>
                          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, fontWeight: 600, color: isDark ? "#fbbf24" : "#92400e" }}>
                            Apenas meses em <strong>produção</strong> entram nos cálculos. Meses de Ramp-up 🚀 e Férias 🌴 são completamente desconsiderados.
                          </p>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {([
                            {
                              icon: "🎯", label: "Consistência",
                              desc: "Nível típico de entrega no ano. Mediana dos % mensais de MRR e NRR, ignorando meses extremos.",
                              levels: [
                                { color: isDark ? "#34d399" : "#059669", label: "Acima de 90%", note: "Consistente, batendo o objetivo na maioria dos meses." },
                                { color: isDark ? "#fbbf24" : "#d97706", label: "Entre 70% e 90%", note: "No caminho, mas com espaço para crescer." },
                                { color: isDark ? "#f87171" : "#dc2626", label: "Abaixo de 70%", note: "Resultados distantes da meta com frequência." },
                              ],
                            },
                            {
                              icon: "📈", label: "Tendência",
                              desc: "Compara a 1ª metade do ano com a 2ª. Mostra se o vendedor está evoluindo ou regredindo.",
                              levels: [
                                { color: isDark ? "#34d399" : "#059669", label: "Acelerando", note: "Últimos meses melhores que os primeiros. No caminho certo. (≥ +15 pp)" },
                                { color: isDark ? "#0fb8c0" : "#017E84", label: "Estável", note: "Resultado consistente, sem aceleração ou queda. (entre −15 pp e +15 pp)" },
                                { color: isDark ? "#f87171" : "#dc2626", label: "Desacelerando", note: "Meses recentes abaixo do início do ano. Atenção para reverter. (≤ −15 pp)" },
                              ],
                            },
                            {
                              icon: "🌊", label: "Volatilidade",
                              desc: "Mede o quanto os resultados variam mês a mês. Baixa volatilidade indica maturidade e previsibilidade.",
                              levels: [
                                { color: isDark ? "#34d399" : "#059669", label: "Baixa", note: "Resultados estáveis e previsíveis mês a mês. (desvio padrão < 20 pp)" },
                                { color: isDark ? "#fbbf24" : "#d97706", label: "Média", note: "Oscilações moderadas, sem extremos. (20–40 pp)" },
                                { color: isDark ? "#f87171" : "#dc2626", label: "Alta", note: "Grandes variações entre meses bons e ruins. (> 40 pp)" },
                              ],
                            },
                            {
                              icon: "✅", label: "Meta MRR / NRR",
                              desc: "Meses em que o time/vendedor bateu a meta no ano sobre o total de meses com target. Formato: bateu/total.",
                              levels: [
                                { color: isDark ? "#34d399" : "#059669", label: "Numerador alto", note: "Bateu a meta na maioria dos meses em produção." },
                                { color: isDark ? "#fbbf24" : "#d97706", label: "Parcial", note: "Bateu em alguns meses, mas há consistência a construir." },
                                { color: isDark ? "#f87171" : "#dc2626", label: "Numerador baixo", note: "Poucas vezes atingiu a meta ao longo do ano." },
                              ],
                            },
                          ] as { icon: string; label: string; desc: string; levels: { color: string; label: string; note: string }[] }[]).map(({ icon, label, desc, levels }) => (
                            <div key={label} style={{
                              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
                              borderRadius: 8, padding: "10px 12px",
                              display: "flex", flexDirection: "column", gap: 6,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ fontSize: 13 }}>{icon}</span>
                                <span style={{ fontWeight: 700, fontSize: 12, color: numColor }}>{label}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: subColor }}>{desc}</p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
                                {levels.map(({ color, label: lvlLabel, note }) => (
                                  <div key={lvlLabel} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 3 }} />
                                    <span style={{ fontSize: 10, lineHeight: 1.45, color: subColor }}>
                                      <strong style={{ color, fontWeight: 700 }}>{lvlLabel}:</strong> {note}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 520 }}>
                        <thead>
                          <tr>
                            <th style={{ ...thS, textAlign: "left" }}>Time</th>
                            <th style={thS}>Consistência</th>
                            <th style={thS}>Tendência</th>
                            <th style={thS}>Volatilidade</th>
                            <th style={thS}>Meta MRR</th>
                            <th style={thS}>Meta NRR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s4Teams.map((team) => {
                            const teamConsColor = team.consistency == null ? subColor : team.consistency >= 90 ? (isDark ? "#34d399" : "#059669") : team.consistency >= 70 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626");
                            const teamTrendLabel = team.trend == null ? null : team.trend >= 15 ? "Acelerando" : team.trend <= -15 ? "Desacelerando" : "Estável";
                            const teamTrendArrow = team.trend == null ? null : team.trend >= 15 ? "↗" : team.trend <= -15 ? "↘" : "→";
                            const teamTrendColor = team.trend == null ? subColor : team.trend >= 15 ? "#22c55e" : team.trend <= -15 ? "#ef4444" : subColor;
                            const teamVolLabel = team.volatility == null ? null : team.volatility < 20 ? "Baixa" : team.volatility < 40 ? "Média" : "Alta";
                            const teamVolColor = team.volatility == null ? subColor : team.volatility < 20 ? "#22c55e" : team.volatility < 40 ? "#E4A900" : "#ef4444";
                            return (
                              <tr key={team.teamName} style={{ borderBottom: `1px solid ${dividerColor}` }}>
                                <td style={{ padding: "7px 0", color: numColor, fontWeight: 700, whiteSpace: "nowrap" }}>
                                  {team.teamName}
                                </td>
                                <td style={{ ...tdC, color: teamConsColor }}>{team.consistency != null ? `${team.consistency.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                                <td style={{ ...tdC, color: teamTrendColor }}>{teamTrendLabel != null ? <span title={`${team.trend!.toFixed(1)} pp`}>{teamTrendArrow} {teamTrendLabel}</span> : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                                <td style={{ ...tdC, color: teamVolColor }}>{teamVolLabel != null ? <span title={`${team.volatility!.toFixed(1)} pp`}>{teamVolLabel}</span> : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                                <td style={{ ...tdC, color: team.mrrTotalMonths > 0 ? (team.mrrHitCount === team.mrrTotalMonths ? "#E4A900" : numColor) : subColor }}>{team.mrrTotalMonths > 0 ? `${team.mrrHitCount}/${team.mrrTotalMonths}` : <span style={{ opacity: 0.35 }}>—</span>}</td>
                                <td style={{ ...tdC, color: team.nrrTotalMonths > 0 ? (team.nrrHitCount === team.nrrTotalMonths ? "#E4A900" : numColor) : subColor }}>{team.nrrTotalMonths > 0 ? `${team.nrrHitCount}/${team.nrrTotalMonths}` : <span style={{ opacity: 0.35 }}>—</span>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* ── Métricas por Vendedor ─────────────────────────── */}
                    {(() => {
                      const PAGE_SIZE = 10;
                      const sortedSellers = [...s4Members].sort((a, b) => (b.consistency ?? -1) - (a.consistency ?? -1));
                      const totalSellerPages = Math.ceil(sortedSellers.length / PAGE_SIZE);
                      const pagedSellers = sortedSellers.slice((sellerMetricsPage - 1) * PAGE_SIZE, sellerMetricsPage * PAGE_SIZE);

                      return (
                        <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                            <Users size={18} style={{ color: isDark ? "#a78bfa" : "#714B67", strokeWidth: 1.8, flexShrink: 0 }} />
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: numColor, letterSpacing: "-0.01em" }}>
                              Métricas por Vendedor
                            </h2>
                            <span style={{ fontSize: 11, color: subColor, fontWeight: 500, opacity: 0.6 }}>
                              ({sortedSellers.length} vendedores)
                            </span>
                          </div>

                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 560 }}>
                              <thead>
                                <tr>
                                  <th style={{ ...thS, textAlign: "left" }}>Vendedor</th>
                                  <th style={{ ...thS, textAlign: "left" }}>Time</th>
                                  <th style={thS}>Consistência</th>
                                  <th style={thS}>Tendência</th>
                                  <th style={thS}>Volatilidade</th>
                                  <th style={thS}>Meta MRR</th>
                                  <th style={thS}>Meta NRR</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pagedSellers.map((mem) => {
                                  const nameClean = stripTetragram(mem.userName);
                                  const tetraMatch = mem.userName.match(/\(([^)]+)\)$/);
                                  const tetra = tetraMatch ? tetraMatch[1].toUpperCase() : null;
                                  const consColor = mem.consistency == null ? subColor : mem.consistency >= 90 ? (isDark ? "#34d399" : "#059669") : mem.consistency >= 70 ? (isDark ? "#fbbf24" : "#d97706") : (isDark ? "#f87171" : "#dc2626");
                                  const trendLabel = mem.trend == null ? null : mem.trend >= 15 ? "Acelerando" : mem.trend <= -15 ? "Desacelerando" : "Estável";
                                  const trendArrow = mem.trend == null ? null : mem.trend >= 15 ? "↗" : mem.trend <= -15 ? "↘" : "→";
                                  const trendColor = mem.trend == null ? subColor : mem.trend >= 15 ? "#22c55e" : mem.trend <= -15 ? "#ef4444" : subColor;
                                  const volLabel = mem.volatility == null ? null : mem.volatility < 20 ? "Baixa" : mem.volatility < 40 ? "Média" : "Alta";
                                  const volColor = mem.volatility == null ? subColor : mem.volatility < 20 ? "#22c55e" : mem.volatility < 40 ? "#E4A900" : "#ef4444";
                                  return (
                                    <tr key={mem.userName} style={{ borderBottom: `1px solid ${dividerColor}` }}>
                                      <td style={{ padding: "7px 0", color: numColor, fontWeight: 600, whiteSpace: "nowrap" }}>
                                        {nameClean}
                                        {tetra && (
                                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: subColor, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", borderRadius: 4, padding: "1px 5px" }}>
                                            {tetra}
                                          </span>
                                        )}
                                        {mem.status === "ramp-up" && (
                                          <span style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 2, borderRadius: 99, padding: "1px 6px", fontSize: 8, fontWeight: 600, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.30)", color: "#60a5fa" }}>
                                            🚀 Ramp-up
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: "7px 4px 7px 8px", whiteSpace: "nowrap" }}>
                                        {mem.teamName ? (
                                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", color: subColor, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", borderRadius: 4, padding: "2px 6px" }}>
                                            {mem.teamName}
                                          </span>
                                        ) : <span style={{ opacity: 0.3, color: subColor }}>—</span>}
                                      </td>
                                      <td style={{ ...tdC, color: consColor }}>{mem.consistency != null ? `${mem.consistency.toFixed(1)}%` : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                                      <td style={{ ...tdC, color: trendColor }}>{trendLabel != null ? <span title={`${mem.trend!.toFixed(1)} pp`}>{trendArrow} {trendLabel}</span> : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                                      <td style={{ ...tdC, color: volColor }}>{volLabel != null ? <span title={`${mem.volatility!.toFixed(1)} pp`}>{volLabel}</span> : <span style={{ opacity: 0.35, color: subColor }}>—</span>}</td>
                                      <td style={{ ...tdC, color: mem.mrrTotalMonths > 0 ? (mem.mrrHitCount === mem.mrrTotalMonths ? "#E4A900" : numColor) : subColor }}>{mem.mrrTotalMonths > 0 ? `${mem.mrrHitCount}/${mem.mrrTotalMonths}` : <span style={{ opacity: 0.35 }}>—</span>}</td>
                                      <td style={{ ...tdC, color: mem.nrrTotalMonths > 0 ? (mem.nrrHitCount === mem.nrrTotalMonths ? "#E4A900" : numColor) : subColor }}>{mem.nrrTotalMonths > 0 ? `${mem.nrrHitCount}/${mem.nrrTotalMonths}` : <span style={{ opacity: 0.35 }}>—</span>}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {totalSellerPages > 1 && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 16 }}>
                              {Array.from({ length: totalSellerPages }, (_, i) => i + 1).map((page) => {
                                const isActive = page === sellerMetricsPage;
                                return (
                                  <button
                                    key={page}
                                    onClick={() => setSellerMetricsPage(page)}
                                    style={{
                                      height: 24, width: 24,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      borderRadius: "50%", fontSize: 10, fontWeight: 700,
                                      cursor: "pointer", transition: "all 0.15s", border: "none",
                                      ...(isActive
                                        ? { background: "#714B67", color: "#fff" }
                                        : { background: "transparent", color: subColor }
                                      ),
                                    }}
                                  >
                                    {page}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

            </div>
          );
        })()}

        </div>
      </div>
    </div>,
    document.body
  );
}
