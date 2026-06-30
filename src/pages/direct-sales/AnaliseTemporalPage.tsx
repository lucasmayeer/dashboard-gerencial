// ANÁLISE TEMPORAL — Direct Sales

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { getDummySalesRows } from "@/lib/dummyDataLoader";
import { useDirectSalesContext } from "@/contexts/DirectSalesContext";
import { formatCurrency } from "@/lib/data";
import { cn } from "@/lib/utils";
import { MRR_COLOR, NRR_COLOR, MONTH_NAMES_SHORT } from "@/lib/directSalesUtils";
import { Search, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { DirectSalesPageControls } from "@/components/direct-sales/DirectSalesPageControls";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { DummyDataBadge } from "@/components/DummyDataBadge";

// =============================================================================
// TIPOS
// =============================================================================

type Granularity = "month" | "quarter" | "year";
type TypeFilter  = "Ambos" | "MRR" | "NRR";

type RawRow = Pick<
  Tables<"commissions_report">,
  | "plan_type" | "achieved" | "target_amount" | "date_from"
  | "user_name" | "manager_name" | "team_name" | "active" | "skip_record"
  | "plan_name" | "team_type"
>;

interface ChartEntry {
  period:      string;
  mrr:         number;
  nrr:         number;
  total:       number;
  targetMrr:   number;
  targetNrr:   number;
  targetTotal: number;
}

// =============================================================================
// CONSTANTES
// =============================================================================

const VISIBLE_PERIODS  = 4;

// =============================================================================
// HELPERS
// =============================================================================

function parseDateFrom(d: string) {
  const [y, m] = d.split("-").map(Number);
  return { year: y, month: m };
}
function formatMonthLabel(month: number, year: number) {
  return `${MONTH_NAMES_SHORT[month - 1]}/${year}`;
}
function quarterKey(month: number, year: number) {
  return `Q${Math.ceil(month / 3)}/${year}`;
}
function sortPeriodKey(a: string, b: string, g: Granularity): number {
  if (g === "year") return Number(a) - Number(b);
  if (g === "quarter") {
    const [qA, yA] = a.replace("Q","").split("/").map(Number);
    const [qB, yB] = b.replace("Q","").split("/").map(Number);
    return yA !== yB ? yA - yB : qA - qB;
  }
  const mA = MONTH_NAMES_SHORT.indexOf(a.split("/")[0]) + 1, yA = Number(a.split("/")[1]);
  const mB = MONTH_NAMES_SHORT.indexOf(b.split("/")[0]) + 1, yB = Number(b.split("/")[1]);
  return yA !== yB ? yA - yB : mA - mB;
}
function fmtVar(cur: number, other?: number): { text: string; up: boolean } | null {
  if (!other) return null;
  const p = ((cur - other) / other) * 100;
  return { text: `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`, up: p >= 0 };
}
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `R$${(v/1_000).toFixed(2)}k`;
  return `R$${v.toFixed(2)}`;
};

function resolveContribution(
  r: RawRow,
  granularity: "month" | "quarter" | "year",
  isEmployeeView: boolean,
): { addTarget: boolean; addAchieved: boolean } {
  const a = r.achieved ?? 0;
  if (r.active === false) return a <= 0
    ? { addTarget: false, addAchieved: false }
    : { addTarget: false, addAchieved: true };
  // Férias/ramp-up: na visão de employee, target conta em trimestre e ano.
  // Na visão de time e empresa, target nunca conta para férias/ramp-up.
  if (r.skip_record) return { addTarget: isEmployeeView && granularity !== "month", addAchieved: a > 0 };
  return { addTarget: true, addAchieved: a > 0 };
}

type DisplayMode = "R$" | "%";

// 2-tier threshold (>=100 green, else red) — divergência intencional vs pctColor em directSalesUtils (3 tiers)
function pctColorTemporal(pct: number): string {
  return pct >= 100 ? "text-green-400" : "text-red-400";
}

// =============================================================================
// RESUMO TEMPORAL — tipos, helpers, componente
// =============================================================================

interface PeriodData {
  mrr: number;
  nrr: number;
  targetMrr: number;
  targetNrr: number;
}

interface PersonTemporal {
  name: string;
  byPeriod: Record<string, PeriodData>;
}

interface TeamTemporal {
  managerName: string;
  teamType: string | null;
  byPeriod: Record<string, PeriodData>;
  people: PersonTemporal[];
}

function isRampUpRow(r: RawRow): boolean {
  return (r.plan_name ?? "").toUpperCase().startsWith("[RAMP-UP]");
}

/** Renderiza o conteúdo de uma célula de período respeitando typeFilter e displayMode */
function CellContent({
  byPeriod, period, typeFilter, displayMode, isTeam,
}: {
  byPeriod: Record<string, PeriodData>;
  period: string;
  typeFilter: TypeFilter;
  displayMode: DisplayMode;
  isTeam: boolean;
}) {
  const v: PeriodData = byPeriod[period] ?? { mrr: 0, nrr: 0, targetMrr: 0, targetNrr: 0 };
  const dash = <span className="text-muted-foreground/25">—</span>;
  const valCls = isTeam ? "text-foreground font-semibold" : "text-muted-foreground";

  if (typeFilter === "Ambos") {
    if (displayMode === "R$") {
      return (
        <span className="inline-flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: MRR_COLOR }} />
            <span className={cn("text-xs font-mono tabular-nums", valCls)}>
              {v.mrr > 0 ? fmtK(v.mrr) : <span className="text-muted-foreground/25">—</span>}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: NRR_COLOR }} />
            <span className={cn("text-xs font-mono tabular-nums", valCls)}>
              {v.nrr > 0 ? fmtK(v.nrr) : <span className="text-muted-foreground/25">—</span>}
            </span>
          </span>
        </span>
      );
    }
    // % mode — Ambos
    const mrrPct = v.targetMrr > 0 ? (v.mrr / v.targetMrr) * 100 : null;
    const nrrPct = v.targetNrr > 0 ? (v.nrr / v.targetNrr) * 100 : null;
    return (
      <span className="inline-flex items-center gap-2.5">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: MRR_COLOR }} />
          <span className={cn("text-xs font-mono tabular-nums font-bold",
            mrrPct !== null ? pctColorTemporal(mrrPct) : "text-muted-foreground/25")}>
            {mrrPct !== null ? `${mrrPct.toFixed(2)}%` : "—"}
          </span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: NRR_COLOR }} />
          <span className={cn("text-xs font-mono tabular-nums font-bold",
            nrrPct !== null ? pctColorTemporal(nrrPct) : "text-muted-foreground/25")}>
            {nrrPct !== null ? `${nrrPct.toFixed(2)}%` : "—"}
          </span>
        </span>
      </span>
    );
  }

  // Single type — MRR ou NRR
  const achieved = typeFilter === "MRR" ? v.mrr : v.nrr;
  const target   = typeFilter === "MRR" ? v.targetMrr : v.targetNrr;

  if (displayMode === "R$") {
    return achieved > 0
      ? <span className={cn("text-xs font-mono tabular-nums", valCls)}>{fmtK(achieved)}</span>
      : dash;
  }
  const pct = target > 0 ? (achieved / target) * 100 : null;
  return pct !== null
    ? <span className={cn("text-xs font-mono tabular-nums font-bold", pctColorTemporal(pct))}>{pct.toFixed(2)}%</span>
    : dash;
}

interface TemporalTeamCardProps {
  data: TeamTemporal;
  periods: string[];
  typeFilter: TypeFilter;
  displayMode: DisplayMode;
  cellW: number;
  expanded: boolean;
  onToggle: () => void;
}

function TemporalTeamCard({
  data, periods, typeFilter, displayMode, cellW, expanded, onToggle,
}: TemporalTeamCardProps) {
  return (
    <div className={cn(
      "glass-card rounded-xl overflow-hidden transition-all duration-300",
      expanded
        ? "ring-1 ring-white/20 shadow-[0_0_24px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)]"
        : "hover:ring-1 hover:ring-white/10",
    )}>
      {/* ── Header do time ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <strong className="text-sm font-bold text-foreground truncate flex-1 min-w-0 text-left">
          {data.managerName}
        </strong>
        <div className="flex items-center shrink-0">
          {periods.map((p) => (
            <div key={p} className="flex justify-center items-center" style={{ width: cellW }}>
              <CellContent byPeriod={data.byPeriod} period={p} typeFilter={typeFilter} displayMode={displayMode} isTeam />
            </div>
          ))}
        </div>
      </button>

      {/* ── Linhas dos colaboradores (expandido) ── */}
      {expanded && data.people.length > 0 && (
        <div className="border-t border-white/8 bg-white/[0.02]">
          {data.people.map((person) => (
            <div
              key={person.name}
              className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors border-b border-border/10 last:border-0"
            >
              <div className="w-4 shrink-0" />
              <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0 ml-1.5">
                {person.name}
              </span>
              <div className="flex items-center shrink-0">
                {periods.map((p) => (
                  <div key={p} className="flex justify-center items-center" style={{ width: cellW }}>
                    <CellContent byPeriod={person.byPeriod} period={p} typeFilter={typeFilter} displayMode={displayMode} isTeam={false} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BAR LABELS — 10px
// =============================================================================

function makeMrrLabel(data: ChartEntry[], fill: string) {
  return function Lbl(p: any) {
    const { x, y, width, value, index } = p;
    if (!value) return null;
    const e = data[index];
    const hit = e?.targetMrr > 0 && e.mrr >= e.targetMrr;
    return (
      <text x={(x??0)+(width??0)/2} y={(y??0)-8} textAnchor="middle"
        fontSize={10} fontWeight={700} fill={fill}>
        {fmtK(value)}{hit ? " 🎉" : ""}
      </text>
    );
  };
}
function makeNrrLabel(data: ChartEntry[], fill: string) {
  return function Lbl(p: any) {
    const { x, y, width, value, index } = p;
    if (!value) return null;
    const e = data[index];
    const hit = e?.targetNrr > 0 && e.nrr >= e.targetNrr;
    return (
      <text x={(x??0)+(width??0)/2} y={(y??0)-8} textAnchor="middle"
        fontSize={10} fontWeight={700} fill={fill}>
        {fmtK(value)}{hit ? " 🎉" : ""}
      </text>
    );
  };
}

// =============================================================================
// TOOLTIP — definido FORA do componente principal, props explícitas
// =============================================================================

interface DSTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  chartData: ChartEntry[];
  typeFilter: TypeFilter;
  isDark: boolean;
}

function DSTooltip({ active, payload, label, chartData, typeFilter, isDark }: DSTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = chartData.find((d) => d.period === label);
  if (!entry) return null;

  const idx  = chartData.indexOf(entry);
  const prev = idx > 0 ? chartData[idx - 1] : undefined;
  const next = idx < chartData.length - 1 ? chartData[idx + 1] : undefined;

  const mrrHit = entry.targetMrr > 0 && entry.mrr >= entry.targetMrr;
  const nrrHit = entry.targetNrr > 0 && entry.nrr >= entry.targetNrr;

  const dispTotal  = typeFilter === "MRR" ? entry.mrr : typeFilter === "NRR" ? entry.nrr : entry.total;
  const dispTarget = typeFilter === "MRR" ? entry.targetMrr : typeFilter === "NRR" ? entry.targetNrr : entry.targetTotal;
  const hasTarget  = dispTarget > 0;
  const overallHit = hasTarget && dispTotal >= dispTarget;
  const overallPct = hasTarget ? (dispTotal / dispTarget) * 100 : null;

  // Cores e estilos do tema
  const surface    = isDark ? "rgba(12,12,20,0.90)"  : "rgba(255,255,255,0.90)";
  const border     = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)";
  const headBg     = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const headLine   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const txt        = isDark ? "rgba(255,255,255,0.92)" : "rgba(12,12,20,0.92)";
  const muted      = isDark ? "rgba(255,255,255,0.40)" : "rgba(12,12,20,0.40)";
  const divider    = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const headerColor = typeFilter === "MRR" ? MRR_COLOR : typeFilter === "NRR" ? NRR_COLOR : MRR_COLOR;

  function TypeRow({
    type, color, achieved, target, varPrev, varNext,
  }: {
    type: string; color: string;
    achieved: number; target: number;
    varPrev: ReturnType<typeof fmtVar>;
    varNext: ReturnType<typeof fmtVar>;
  }) {
    const hasT = target > 0;
    const hit  = hasT && achieved >= target;
    const pct  = hasT ? (achieved / target) * 100 : null;

    return (
      <div style={{
        borderRadius: 10,
        background: `${color}0c`,
        borderLeft: `3px solid ${color}`,
        padding: "10px 12px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color, textTransform: "uppercase" }}>
              {type}
            </span>
          </div>
          {hasT && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "2px 8px", borderRadius: 99,
              background: hit ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)",
              color: hit ? "#22c55e" : "#f87171",
            }}>
              {hit ? "✓ BATIDA" : "✗ ABAIXO"}
            </span>
          )}
        </div>

        {/* valores */}
        <div style={{ display: "grid", gridTemplateColumns: hasT ? "1fr 1fr" : "1fr", gap: 6 }}>
          <div>
            <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              Achieved
            </p>
            <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.025em", color, lineHeight: 1 }}>
              {fmtK(achieved)}
            </p>
          </div>
          {hasT && (
            <div>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                Meta{pct !== null ? ` · ${pct.toFixed(0)}%` : ""}
              </p>
              <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.025em", color, lineHeight: 1 }}>
                {fmtK(target)}
              </p>
            </div>
          )}
        </div>

        {/* variações */}
        <div style={{
          display: "flex", gap: 16,
          paddingTop: 8,
          borderTop: `1px solid ${color}20`,
        }}>
          {[
            { v: varPrev, lbl: "vs anterior" },
            { v: varNext, lbl: "vs próximo" },
          ].map(({ v, lbl }) => (
            <div key={lbl} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 8, color: muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {lbl}
              </span>
              {v ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: v.up ? "#22c55e" : "#f87171" }}>
                  {v.up ? "↑" : "↓"} {v.text}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: muted }}>—</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: surface,
      backdropFilter: "blur(28px) saturate(180%)",
      WebkitBackdropFilter: "blur(28px) saturate(180%)",
      border: `1px solid ${border}`,
      borderRadius: 14,
      boxShadow: isDark
        ? "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 20px 60px rgba(0,0,0,0.13), inset 0 1px 0 rgba(255,255,255,1)",
      minWidth: 296,
      overflow: "hidden",
      color: txt,
      fontFamily: "inherit",
    }}>

      {/* ── SEÇÃO HIGH ── */}
      <div style={{ padding: "14px 16px 12px", background: headBg, borderBottom: `1px solid ${headLine}` }}>
        <p style={{ fontSize: 9, color: muted, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 7 }}>
          {label}
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: headerColor }}>
              {formatCurrency(dispTotal)}
            </p>
            {hasTarget && overallPct !== null && (
              <p style={{ fontSize: 10, color: headerColor, opacity: 0.7, marginTop: 4 }}>
                Meta {fmtK(dispTarget)}
                <span style={{ marginLeft: 5, fontWeight: 700, color: overallHit ? "#22c55e" : "#f87171" }}>
                  {overallPct.toFixed(0)}%
                </span>
              </p>
            )}
          </div>
          {hasTarget && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: "4px 10px", borderRadius: 99,
              background: overallHit ? "rgba(34,197,94,0.13)" : "rgba(248,113,113,0.13)",
              color: overallHit ? "#22c55e" : "#f87171",
              whiteSpace: "nowrap",
              letterSpacing: "0.04em",
            }}>
              {typeFilter === "Ambos"
                ? mrrHit && nrrHit ? "🎉 Ambas"
                  : mrrHit ? "✓ MRR" : nrrHit ? "✓ NRR" : "✗ Nenhuma"
                : overallHit ? "🎉 Meta" : "✗ Abaixo"}
            </span>
          )}
        </div>
      </div>

      {/* ── SEÇÕES MID + LOW ── */}
      <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 7 }}>
        {typeFilter !== "NRR" && (
          <TypeRow
            type="MRR" color={MRR_COLOR}
            achieved={entry.mrr} target={entry.targetMrr}
            varPrev={fmtVar(entry.mrr, prev?.mrr)}
            varNext={fmtVar(entry.mrr, next?.mrr)}
          />
        )}
        {typeFilter !== "MRR" && (
          <TypeRow
            type="NRR" color={NRR_COLOR}
            achieved={entry.nrr} target={entry.targetNrr}
            varPrev={fmtVar(entry.nrr, prev?.nrr)}
            varNext={fmtVar(entry.nrr, next?.nrr)}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PERSON TEMPORAL CARD — view individual (EMPLOYEE)
// =============================================================================

function PersonTemporalCard({
  person, periods, typeFilter, displayMode, cellW,
}: {
  person: PersonTemporal;
  periods: string[];
  typeFilter: TypeFilter;
  displayMode: DisplayMode;
  cellW: number;
}) {
  return (
    <div className="glass-card rounded-xl overflow-hidden hover:ring-1 hover:ring-white/10 transition-all duration-200">
      <div className="flex items-center gap-2 px-4 py-3">
        <strong className="text-sm font-bold text-foreground truncate flex-1 min-w-0">
          {person.name}
        </strong>
        <div className="flex items-center shrink-0">
          {periods.map((p) => (
            <div key={p} className="flex justify-center items-center" style={{ width: cellW }}>
              <CellContent
                byPeriod={person.byPeriod}
                period={p}
                typeFilter={typeFilter}
                displayMode={displayMode}
                isTeam
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export function AnaliseTemporalPage() {
  const { theme }    = useTheme();
  const isDark       = theme === "dark";
  const labelFill    = isDark ? "rgba(255,255,255,0.80)" : "#2a2a2a";
  const { filterUserId, filterManagerId, filterTeamLeaderId, roleLoading, dsUser } = useDirectSalesContext();

  const userRole     = dsUser?.userRole ?? null;
  const isEmployee   = userRole === "EMPLOYEE";
  const isTeamLeader = userRole === "TEAM_LEADER";

  const [raw, setRaw]                 = useState<RawRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("quarter");
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>("Ambos");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTeams, setExpandedTeams]   = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode]       = useState<DisplayMode>("R$");
  const [periodOffset, setPeriodOffset]     = useState(0);

  useEffect(() => {
    if (roleLoading) return;
    async function load() {
      let rows = await getDummySalesRows();
      if (filterUserId !== null) {
        rows = rows.filter((r) => r.user_id === filterUserId);
      } else if (filterManagerId !== null && filterTeamLeaderId !== null) {
        rows = rows.filter((r) => r.manager_id === filterManagerId || r.user_id === filterTeamLeaderId);
      }
      setRaw(rows as unknown as RawRow[]);
      setLoading(false);
    }
    load();
  }, [filterUserId, filterManagerId, filterTeamLeaderId, roleLoading]);

  const chartData = useMemo<ChartEntry[]>(() => {
    let rows = raw.filter((r) => r.date_from && r.plan_type);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((r) =>
        (r.user_name ?? "").toLowerCase().includes(q) ||
        (r.manager_name ?? "").toLowerCase().includes(q) ||
        (r.team_name ?? "").toLowerCase().includes(q),
      );
    }
    const map = new Map<string, { mrr:number; nrr:number; targetMrr:number; targetNrr:number }>();
    for (const r of rows) {
      const { month, year } = parseDateFrom(r.date_from!);
      const key = granularity === "year" ? String(year)
        : granularity === "quarter" ? quarterKey(month, year)
        : formatMonthLabel(month, year);
      if (!map.has(key)) map.set(key, { mrr:0, nrr:0, targetMrr:0, targetNrr:0 });
      const e = map.get(key)!;
      const { addTarget, addAchieved } = resolveContribution(r, granularity, isEmployee || filterUserId !== null);
      const type = (r.plan_type ?? "").toUpperCase();
      const val = r.achieved ?? 0, tgt = r.target_amount ?? 0;
      if (type === "MRR") { if (addAchieved) e.mrr += val; if (addTarget) e.targetMrr += tgt; }
      else if (type === "NRR") { if (addAchieved) e.nrr += val; if (addTarget) e.targetNrr += tgt; }
    }
    return Array.from(map.entries())
      .map(([period, d]) => ({
        period, mrr: d.mrr, nrr: d.nrr, total: d.mrr + d.nrr,
        targetMrr: d.targetMrr, targetNrr: d.targetNrr, targetTotal: d.targetMrr + d.targetNrr,
      }))
      .sort((a, b) => sortPeriodKey(a.period, b.period, granularity));
  }, [raw, granularity, searchQuery]);

  const yAxisMax = useMemo(() => {
    const max = chartData.reduce((m, d) => {
      const candidates = [m];
      if (typeFilter !== "NRR") { candidates.push(d.mrr); if (typeFilter === "MRR") candidates.push(d.targetMrr); }
      if (typeFilter !== "MRR") { candidates.push(d.nrr); if (typeFilter === "NRR") candidates.push(d.targetNrr); }
      return Math.max(...candidates);
    }, 0);
    return Math.ceil(max * 1.25) || 1_000;
  }, [chartData, typeFilter]);

  const granLabel: Record<Granularity, string> = { month: "Mês", quarter: "Quarter", year: "Ano" };

  // Períodos ordenados para as colunas do Resumo Temporal
  const periods = useMemo(() => chartData.map((e) => e.period), [chartData]);

  // Nome do time (TEAM_LEADER): lido do primeiro registro disponível em raw
  const teamName = useMemo(
    () => raw.find((r) => r.team_name)?.team_name ?? dsUser?.userName ?? "",
    [raw, dsUser?.userName],
  );

  // Título e subtítulo condicionais por perfil de acesso
  const pageTitle = isEmployee
    ? "Análise Temporal de Performance"
    : isTeamLeader
    ? `Análise Temporal do time: ${teamName}`
    : "Análise Temporal de Vendas";

  const pageSubtitle = isEmployee
    ? `Resumo temporal de MRR e NRR de ${dsUser?.userName ?? ""}`
    : isTeamLeader
    ? "Resumo temporal de MRR e NRR do seu time comercial."
    : "Resumo temporal de MRR e NRR do time Comercial.";

  // Reseta para a janela mais recente sempre que granularity ou busca mudam
  useEffect(() => {
    setPeriodOffset(Math.max(0, periods.length - VISIBLE_PERIODS));
  }, [granularity, searchQuery, periods.length]);

  // Navegação da janela de 4 períodos
  const isSliderActive  = periods.length > VISIBLE_PERIODS;
  const safeOffset      = Math.min(periodOffset, Math.max(0, periods.length - VISIBLE_PERIODS));
  const visiblePeriods  = periods.slice(safeOffset, safeOffset + VISIBLE_PERIODS);
  const canGoBack       = safeOffset > 0;
  const canGoForward    = safeOffset + VISIBLE_PERIODS < periods.length;

  // Largura de cada célula de período — Ambos exibe MRR + NRR lado a lado, precisa de mais espaço
  const cellW = typeFilter === "Ambos" ? 170 : 90;

  // Dados agrupados por Time → Colaborador, com breakdown por período
  const teamTemporalData = useMemo<TeamTemporal[]>(() => {
    let rows = raw.filter((r) => r.date_from && r.plan_type);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((r) =>
        (r.user_name ?? "").toLowerCase().includes(q) ||
        (r.manager_name ?? "").toLowerCase().includes(q) ||
        (r.team_name ?? "").toLowerCase().includes(q),
      );
    }

    const teamMap = new Map<string, {
      teamType: string | null;
      byPeriod: Map<string, PeriodData>;
      people: Map<string, Map<string, PeriodData>>;
    }>();

    for (const r of rows) {
      const { month, year } = parseDateFrom(r.date_from!);
      const period =
        granularity === "year"    ? String(year)
        : granularity === "quarter" ? quarterKey(month, year)
        : formatMonthLabel(month, year);

      const { addAchieved, addTarget } = resolveContribution(r, granularity, isEmployee || filterUserId !== null);
      if (!addAchieved && !addTarget) continue;

      const managerName = r.manager_name ?? "Sem Gerente";
      const personName  = r.user_name ?? "Sem Nome";
      const planType    = (r.plan_type ?? "").toUpperCase();
      const val         = Math.max(0, r.achieved ?? 0);
      const tgt         = r.target_amount ?? 0;

      if (!teamMap.has(managerName)) {
        teamMap.set(managerName, {
          teamType: r.team_type ?? null,
          byPeriod: new Map(),
          people:   new Map(),
        });
      }
      const team = teamMap.get(managerName)!;

      const emptyPD = (): PeriodData => ({ mrr: 0, nrr: 0, targetMrr: 0, targetNrr: 0 });

      // Totais do time por período
      if (!team.byPeriod.has(period)) team.byPeriod.set(period, emptyPD());
      const tp = team.byPeriod.get(period)!;
      if (planType === "MRR") { if (addAchieved) tp.mrr += val; if (addTarget) tp.targetMrr += tgt; }
      else if (planType === "NRR") { if (addAchieved) tp.nrr += val; if (addTarget) tp.targetNrr += tgt; }

      // Totais da pessoa por período
      if (!team.people.has(personName)) team.people.set(personName, new Map());
      const personPeriods = team.people.get(personName)!;
      if (!personPeriods.has(period)) personPeriods.set(period, emptyPD());
      const pp = personPeriods.get(period)!;
      if (planType === "MRR") { if (addAchieved) pp.mrr += val; if (addTarget) pp.targetMrr += tgt; }
      else if (planType === "NRR") { if (addAchieved) pp.nrr += val; if (addTarget) pp.targetNrr += tgt; }
    }

    return Array.from(teamMap.entries())
      .map(([managerName, data]) => ({
        managerName,
        teamType: data.teamType,
        byPeriod: Object.fromEntries(data.byPeriod),
        people: Array.from(data.people.entries())
          .map(([name, periodMap]) => ({
            name,
            byPeriod: Object.fromEntries(periodMap),
          }))
          .sort((a, b) => {
            const totalA = Object.values(a.byPeriod).reduce((s, v) => s + v.mrr + v.nrr, 0);
            const totalB = Object.values(b.byPeriod).reduce((s, v) => s + v.mrr + v.nrr, 0);
            return totalB - totalA;
          }),
      }))
      .sort((a, b) => {
        const totalA = Object.values(a.byPeriod).reduce((s, v) => s + v.mrr + v.nrr, 0);
        const totalB = Object.values(b.byPeriod).reduce((s, v) => s + v.mrr + v.nrr, 0);
        return totalB - totalA;
      });
  }, [raw, granularity, searchQuery]);

  const mrrLbl = useMemo(() => makeMrrLabel(chartData, labelFill), [chartData, labelFill]);
  const nrrLbl = useMemo(() => makeNrrLabel(chartData, labelFill), [chartData, labelFill]);

  // Render function para tooltip — evita problema de re-criação de componente
  const renderTooltip = (props: any) => (
    <DSTooltip {...props} chartData={chartData} typeFilter={typeFilter} isDark={isDark} />
  );

  return (
    <div className="space-y-10">
      {/* Controles: sync, theme, view — acima do título */}
      <DirectSalesPageControls />

      {/* Título */}
      <div className="animate-fade-in-delayed stagger-1">
        <h2 className="text-5xl font-extrabold animate-gradient-text">
          {pageTitle}
        </h2>
        <DummyDataBadge className="mb-1" />
        <p className="text-lg text-muted-foreground mt-3">
          {pageSubtitle}
        </p>
      </div>

      {/* Gráfico */}
      <div className="animate-fade-in-delayed stagger-2">

        {/* Header: título + controles */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h3 className="text-lg font-bold text-foreground">Evolução MRR &amp; NRR</h3>
          <div className="flex items-center gap-3 flex-wrap">
            {!isEmployee && !isTeamLeader && (
              <div className="glass-button flex items-center gap-2 px-3 py-1.5 rounded-xl">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Vendedor, gestor ou time..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] text-foreground placeholder:text-muted-foreground w-[180px]"
                />
              </div>
            )}
            <div className="flex rounded-xl overflow-hidden glass-card p-0.5">
              {(["Ambos","MRR","NRR"] as TypeFilter[]).map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={cn("px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all",
                    typeFilter === t ? "glass-button-active" : "text-muted-foreground hover:text-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl overflow-hidden glass-card p-0.5">
              {(["month","quarter","year"] as Granularity[]).map((g) => (
                <button key={g} onClick={() => setGranularity(g)}
                  className={cn("px-4 py-1.5 text-[11px] font-medium rounded-lg transition-all",
                    granularity === g ? "glass-button-active" : "text-muted-foreground hover:text-foreground")}>
                  {granLabel[g]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legenda — topo esquerdo */}
        {!loading && chartData.length > 0 && (
          <div className="flex items-center gap-5 mb-4">
            {typeFilter !== "NRR" && (
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: MRR_COLOR }} />
                <span className="text-xs text-muted-foreground font-medium">MRR</span>
              </div>
            )}
            {typeFilter !== "MRR" && (
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: NRR_COLOR }} />
                <span className="text-xs text-muted-foreground font-medium">NRR</span>
              </div>
            )}
            {typeFilter !== "Ambos" && (
              <div className="flex items-center gap-1.5">
                <svg width="22" height="10" viewBox="0 0 22 10">
                  <line x1="0" y1="5" x2="22" y2="5"
                    stroke={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
                    strokeWidth="2" strokeDasharray="5 3" />
                </svg>
                <span className="text-xs text-muted-foreground font-medium">Meta</span>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : chartData.length === 0 ? (
          <p className="text-muted-foreground text-sm py-12 text-center">
            {searchQuery ? "Nenhum resultado para a busca." : "Nenhum dado encontrado."}
          </p>
        ) : (
          <div className="h-96 pt-6" style={{ overflow: "visible" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 30, right: 16, left: 10, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "rgba(255,255,255,0.07)" : "hsl(230,18%,89%)"}
                  vertical={false}
                />
                <XAxis dataKey="period"
                  tick={{ fontSize: 10, fill: "hsl(230,12%,48%)" }}
                  axisLine={false} tickLine={false} />
                <YAxis domain={[0, yAxisMax]}
                  tick={{ fontSize: 10, fill: "hsl(230,12%,48%)" }}
                  tickFormatter={(v) => `R$${(v/1_000).toFixed(0)}k`}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  content={renderTooltip}
                  cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)" }}
                />
                {typeFilter !== "NRR" && (
                  <Bar dataKey="mrr" name="MRR" fill={MRR_COLOR} radius={[6,6,0,0]} minPointSize={4}>
                    <LabelList content={mrrLbl} />
                  </Bar>
                )}
                {typeFilter !== "MRR" && (
                  <Bar dataKey="nrr" name="NRR" fill={NRR_COLOR} radius={[6,6,0,0]} minPointSize={4}>
                    <LabelList content={nrrLbl} />
                  </Bar>
                )}
                {typeFilter === "MRR" && (
                  <Line dataKey="targetMrr" name="Meta MRR"
                    stroke={isDark ? "#ffffff" : "#111111"} strokeOpacity={0.4}
                    strokeWidth={2} strokeDasharray="7 4"
                    dot={{ r: 3, fill: isDark ? "#ffffff" : "#111111", opacity: 0.4, strokeWidth: 0 }}
                    activeDot={{ r: 4, opacity: 0.55 }}
                    connectNulls
                  />
                )}
                {typeFilter === "NRR" && (
                  <Line dataKey="targetNrr" name="Meta NRR"
                    stroke={isDark ? "#ffffff" : "#111111"} strokeOpacity={0.4}
                    strokeWidth={2} strokeDasharray="7 4"
                    dot={{ r: 3, fill: isDark ? "#ffffff" : "#111111", opacity: 0.4, strokeWidth: 0 }}
                    activeDot={{ r: 4, opacity: 0.55 }}
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Resumo Temporal (flui visualmente a seguir do gráfico) ── */}
      {!loading && chartData.length > 0 && teamTemporalData.length > 0 && (
        <div className="animate-fade-in-delayed stagger-3">

          {/* Barra de controles: Segmentador Rolante + Toggle R$/% */}
          <div className="flex items-center justify-end gap-2 mb-3">

            {/* ── Segmentador Rolante ── */}
            <div className={cn(
              "flex items-center rounded-xl glass-card p-0.5 gap-0.5 transition-opacity duration-200",
              !isSliderActive && "opacity-35 pointer-events-none",
            )}>
              {/* Seta esquerda */}
              <button
                onClick={() => setPeriodOffset((o) => Math.max(0, o - 1))}
                disabled={!canGoBack}
                className={cn(
                  "flex items-center justify-center w-7 h-[26px] rounded-lg transition-all",
                  canGoBack
                    ? "text-foreground hover:bg-white/10"
                    : "text-muted-foreground/30",
                )}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {/* Indicador de posição */}
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums px-1.5 min-w-[52px] text-center select-none">
                {safeOffset + 1}–{Math.min(safeOffset + VISIBLE_PERIODS, periods.length)}
                <span className="text-muted-foreground/40"> / {periods.length}</span>
              </span>

              {/* Seta direita */}
              <button
                onClick={() => setPeriodOffset((o) => Math.min(periods.length - VISIBLE_PERIODS, o + 1))}
                disabled={!canGoForward}
                className={cn(
                  "flex items-center justify-center w-7 h-[26px] rounded-lg transition-all",
                  canGoForward
                    ? "text-foreground hover:bg-white/10"
                    : "text-muted-foreground/30",
                )}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Toggle R$/% ── */}
            <div className="flex rounded-xl overflow-hidden glass-card p-0.5">
              {(["R$", "%"] as DisplayMode[]).map((m) => (
                <button key={m} onClick={() => setDisplayMode(m)}
                  className={cn("px-4 py-1.5 text-[11px] font-medium rounded-lg transition-all",
                    displayMode === m ? "glass-button-active" : "text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ minWidth: `${280 + visiblePeriods.length * cellW}px` }}>

            {/* Cabeçalho de colunas — alinhado ao grid dos cards */}
            <div className="flex items-center gap-2 px-4 py-1.5 mb-1">
              {/* espaço para o chevron */}
              <div className="w-6 shrink-0" />
              <span className="text-[11px] font-medium text-muted-foreground flex-1 min-w-0 uppercase tracking-wide">
                Time / Colaborador
              </span>
              <div className="flex items-center shrink-0">
                {visiblePeriods.map((p) => (
                  <div
                    key={p}
                    className="flex justify-center"
                    style={{ width: cellW }}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {p}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cards: flat (EMPLOYEE / TEAM_LEADER) ou agrupado por time (MANAGER) */}
            <div className="space-y-2">
              {(isEmployee || isTeamLeader) ? (
                // Perfil EMPLOYEE e TEAM_LEADER: card individual por pessoa, sem agrupamento
                teamTemporalData
                  .flatMap((t) => t.people)
                  .map((person) => (
                    <PersonTemporalCard
                      key={person.name}
                      person={person}
                      periods={visiblePeriods}
                      typeFilter={typeFilter}
                      displayMode={displayMode}
                      cellW={cellW}
                    />
                  ))
              ) : (
                // Perfil MANAGER: cards agrupados por time com expand/collapse
                teamTemporalData.map((team) => (
                  <TemporalTeamCard
                    key={team.managerName}
                    data={team}
                    periods={visiblePeriods}
                    typeFilter={typeFilter}
                    displayMode={displayMode}
                    cellW={cellW}
                    expanded={expandedTeams.has(team.managerName)}
                    onToggle={() =>
                      setExpandedTeams((prev) => {
                        const next = new Set(prev);
                        if (next.has(team.managerName)) next.delete(team.managerName);
                        else next.add(team.managerName);
                        return next;
                      })
                    }
                  />
                ))
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
