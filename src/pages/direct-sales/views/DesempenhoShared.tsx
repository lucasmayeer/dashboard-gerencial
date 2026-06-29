import { memo, useState } from "react";
import { useIsDark } from "@/hooks/useIsDark";
export { useIsDark };
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/data";
import lucasMayerImg from "@/assets/lucas_mayer.png";
import rodrigoMarbaImg from "@/assets/rodrigo_marba.png";
import { Progress } from "@/components/ui/progress";
import {
  Crown, Medal, TrendingUp, Award, Eye, EyeOff, Repeat2, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, Cell, XAxis, ResponsiveContainer, Tooltip as RechartsTooltip,
} from "recharts";
import { MONTH_NAMES, TEAM_NAME_FIXED_COLORS, TEAM_NAME_FALLBACK_COLORS, hashTeamName } from "@/lib/directSalesUtils";
import type { PlanMetrics, SellerMetrics, MonthlyPoint, QuarterMetrics } from "@/lib/desempenhoUtils";
import { formatPct, pctColorDsm } from "@/lib/desempenhoUtils";

export function TeamBadgeDsm({ teamName, small }: { teamName: string | null | undefined; small?: boolean }) {
  if (!teamName) return null;
  const color = TEAM_NAME_FIXED_COLORS[teamName] ?? TEAM_NAME_FALLBACK_COLORS[hashTeamName(teamName)];
  const label = teamName.length > 22 ? teamName.slice(0, 20) + "…" : teamName;
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold shrink-0 ${small ? "px-1.5 py-0 text-[8px]" : "px-2.5 py-0.5 text-[10px]"}`}
      style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
    >
      {label}
    </span>
  );
}

const RANK_BADGE_PALETTE = {
  1: { bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.35)", text: "#EAB308" },
  2: { bg: "rgba(192,200,212,0.09)", border: "rgba(192,200,212,0.30)", text: "#C0C8D4" },
  3: { bg: "rgba(180,83,9,0.10)", border: "rgba(180,83,9,0.32)", text: "#CD9B6A" },
} as const;

export const TOP_PERFORMANCE_SELLERS = ["Caio Said Dias Basto Ming (csdb)"];

export function TopPerformanceBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0"
      style={{
        background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
        border: "1px solid rgba(228,169,0,0.40)",
        color: "#E4A900",
      }}
    >
      ⭐ Top Performance 2025
    </span>
  );
}

const GOAT_TIERS = {
  1: { label: "🐐 G.O.A.T", bg: "rgba(234,179,8,0.14)", border: "rgba(234,179,8,0.42)", color: "#EAB308" },
  2: { label: "🥈 Second GOAT", bg: "rgba(192,200,212,0.10)", border: "rgba(192,200,212,0.32)", color: "#C0C8D4" },
  3: { label: "🥉 Third GOAT", bg: "rgba(180,83,9,0.11)", border: "rgba(180,83,9,0.34)", color: "#CD9B6A" },
} as const;

export function GoatBadge({ rank }: { rank: 1 | 2 | 3 }) {
  const { label, bg, border, color } = GOAT_TIERS[rank];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      {label}
    </span>
  );
}

const TOP_RANK_STREAK_PALETTE = {
  1: { bg: "linear-gradient(90deg, rgba(251,146,60,0.16) 0%, rgba(234,179,8,0.16) 100%)", border: "rgba(251,146,60,0.42)", color: "#fb923c" },
  2: { bg: "rgba(192,200,212,0.13)", border: "rgba(192,200,212,0.40)", color: "#C0C8D4" },
  3: { bg: "rgba(180,83,9,0.13)", border: "rgba(180,83,9,0.38)", color: "#CD9B6A" },
} as const;

export function TopRankStreakBadge({ rank, count }: { rank: 1 | 2 | 3; count: number }) {
  const p = TOP_RANK_STREAK_PALETTE[rank];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0"
      style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.color }}
    >
      🔥 Top{rank} Streak #{count}
    </span>
  );
}

export function StreakBadge({ type, count, label }: { type: "MRR" | "NRR"; count: number; label?: string }) {
  const isMrr = type === "MRR";
  const color = isMrr ? "#714B67" : "#017E84";
  const bg = isMrr ? "rgba(113,75,103,0.14)" : "rgba(1,126,132,0.14)";
  const border = isMrr ? "rgba(113,75,103,0.35)" : "rgba(1,126,132,0.35)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      🔥 {label ?? `${type} Streak`} #{count}
    </span>
  );
}

export function VacationBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0"
      style={{
        background: "rgba(14,165,233,0.12)",
        border: "1px solid rgba(14,165,233,0.30)",
        color: "#38bdf8",
      }}
    >
      🌴 Férias
    </span>
  );
}

export function RankBadge({ rank, month, labelOverride }: { rank: 1 | 2 | 3; month?: string; labelOverride?: string }) {
  const p = RANK_BADGE_PALETTE[rank];
  const Icon = rank === 1 ? Crown : Medal;
  const monthName = month ? MONTH_NAMES[parseInt(month.split("-")[1], 10) - 1] : null;
  const label = labelOverride ?? (rank === 1 ? (monthName ? `Top 1 ${monthName}` : "TOP1") : rank === 2 ? "TOP2" : "TOP3");
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0"
      style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.text }}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {label}
    </span>
  );
}

// intentional divergence from global StatusBadge: shows "Ativo" label, different design
export const StatusBadgeDsm = memo(function StatusBadgeDsm({ status }: { status: SellerMetrics["status"] }) {
  const map = {
    ativo: { label: "Ativo", cls: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30" },
    "ramp-up": { label: "Ramp-up", cls: "bg-blue-500/15 text-blue-600 border border-blue-500/30" },
    férias: { label: "Férias", cls: "bg-amber-500/15 text-amber-600 border border-amber-500/30" },
    inativo: { label: "Inativo", cls: "bg-red-500/15 text-red-600 border border-red-500/30" },
  };
  const { label, cls } = map[status] ?? map["ativo"];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", cls)}>
      {label}
    </span>
  );
});

export function KpiCard({
  label,
  achieved,
  target,
  commission,
  color,
  icon: Icon,
}: {
  label: string;
  achieved: number;
  target: number;
  commission?: number;
  color: string;
  icon: typeof TrendingUp;
}) {
  const pct = target > 0 ? Math.min((achieved / target) * 100, 200) : 0;
  const hit = target > 0 && achieved >= target;

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl p-1.5" style={{ background: `${color}20` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        {hit && <span className="text-lg">🎉</span>}
      </div>

      <div>
        <p className="text-2xl font-extrabold tabular-nums text-foreground">{formatCurrency(achieved)}</p>
        {target > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            de {formatCurrency(target)} — <span className="font-semibold" style={{ color }}>{formatPct(pct)}</span>
          </p>
        )}
      </div>

      {target > 0 && (
        <Progress
          value={Math.min(pct, 100)}
          className="h-1.5"
          style={{ "--progress-color": color } as React.CSSProperties}
        />
      )}

      {commission !== undefined && commission > 0 && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
          <Award className="h-3 w-3 text-amber-500" />
          <span className="text-[11px] text-muted-foreground">
            Comissão: <span className="font-semibold text-amber-600">{formatCurrency(commission)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function MetricMiniCard({
  title,
  achieved,
  target,
  monthlyData,
  currentMonthKey,
  dataKey,
  icon: Icon,
}: {
  title: string;
  achieved: number;
  target: number;
  planType?: string;
  monthlyData: MonthlyPoint[];
  currentMonthKey: string;
  dataKey: "mrr" | "nrr" | "commission";
  icon?: React.ElementType;
}) {
  const isGoalMet = target > 0 && achieved >= target;
  const gradId = `metric-glow-${dataKey}`;
  const isDark = useIsDark();
  const inactiveBarColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)";

  const cardBackground = isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.52)";
  const cardBorder = isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.06)";
  const cardShadow = isDark
    ? "0 2px 14px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.06) inset"
    : "0 2px 14px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.75) inset";

  return (
    <div
      className="rounded-2xl flex flex-col gap-2 p-4 relative overflow-hidden"
      style={{
        background: cardBackground,
        backdropFilter: "blur(22px) saturate(140%)",
        WebkitBackdropFilter: "blur(22px) saturate(140%)",
        border: cardBorder,
        boxShadow: cardShadow,
        minHeight: 0,
        maxHeight: 220,
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: isDark ? "linear-gradient(90deg, transparent 15%, rgba(255,255,255,0.14) 50%, transparent 85%)" : "linear-gradient(90deg, transparent 15%, rgba(255,255,255,0.6) 50%, transparent 85%)" }}
      />
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(var(--foreground))", opacity: 0.55 }} />}
        <h2 className="text-[11px] font-semibold text-muted-foreground/70 tracking-wide leading-none">
          {title}
        </h2>
      </div>

      <p className="text-[22px] font-extrabold tabular-nums text-foreground leading-none">
        {formatCurrency(achieved)}
      </p>

      {target > 0 && (
        <p className="text-[12px] text-muted-foreground/55 leading-snug">
          {isGoalMet
            ? `Meta de ${formatCurrency(target)} atingida! 🎉`
            : `${formatPct((achieved / target) * 100)} da meta de ${formatCurrency(target)}`}
        </p>
      )}

      {monthlyData.length > 0 && (
        <div className="mt-auto h-[72px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barCategoryGap="18%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E4A900" stopOpacity={1} />
                  <stop offset="100%" stopColor="#714B67" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.10, strokeWidth: 1 }}
                tickLine={false}
                tick={{ fontSize: 9, fill: "hsl(var(--foreground))", fontWeight: 700, opacity: 0.65 }}
                interval={0}
                tickMargin={5}
              />
              <RechartsTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div
                        className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold"
                        style={{
                          background: "rgba(10,10,18,0.85)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#fff",
                          backdropFilter: "blur(8px)",
                        }}
                      >
                        {formatCurrency(payload[0].value as number)}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey={dataKey} radius={[5, 5, 0, 0]} isAnimationActive>
                {monthlyData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.key === currentMonthKey ? `url(#${gradId})` : inactiveBarColor}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function UnifiedMetricsCard({
  mrr,
  nrr,
  total,
  commission,
  mrrCommission,
  nrrCommission,
  monthlyData,
  currentMonthKey,
}: {
  mrr: PlanMetrics;
  nrr: PlanMetrics;
  total: PlanMetrics;
  commission: number;
  mrrCommission: number;
  nrrCommission: number;
  monthlyData: MonthlyPoint[];
  currentMonthKey: string;
}) {
  const isDark = useIsDark();
  const [commissionVisible, setCommissionVisible] = useState(false);

  const renderSection = (
    title: string,
    Icon: React.ElementType,
    metrics: PlanMetrics,
    dataKey: "mrr" | "nrr" | "total",
    gradId: string,
    _grow = false,
    color = "hsl(var(--foreground))"
  ) => {
    const isGoalMet = metrics.target > 0 && metrics.achieved >= metrics.target;
    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 shrink-0" style={{ color }} />
            <h1 className="text-[19px] font-bold tracking-wide leading-none" style={{ color }}>
              {title}
            </h1>
          </div>
          <p className="text-[28px] font-extrabold tabular-nums text-foreground leading-none">
            {formatCurrency(metrics.achieved)}
          </p>
          {metrics.target > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[16px] text-muted-foreground/70 font-bold leading-none">
                Sua Meta: {formatCurrency(metrics.target)}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold shrink-0"
                  style={isGoalMet
                    ? { background: "rgba(34,197,94,0.13)", border: "1px solid rgba(34,197,94,0.32)", color: "#22c55e" }
                    : { background: "rgba(228,169,0,0.13)", border: "1px solid rgba(228,169,0,0.32)", color: "#E4A900" }}
                >
                  {isGoalMet ? "🎉 " : ""}{formatPct((metrics.achieved / metrics.target) * 100)}
                </span>
                {!isGoalMet && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold shrink-0"
                    style={{ background: "rgba(113,75,103,0.18)", border: "1px solid rgba(113,75,103,0.35)", color: "#b87fa8" }}
                  >
                    Falta {formatCurrency(metrics.target - metrics.achieved)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {monthlyData.length > 0 && (
          <div className="h-[90px] w-full mt-auto pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barCategoryGap="18%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.10, strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 700, opacity: 0.65 }}
                  interval={0}
                  tickMargin={5}
                />
                <RechartsTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div
                          className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold"
                          style={{
                            background: "rgba(10,10,18,0.85)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#fff",
                            backdropFilter: "blur(8px)",
                          }}
                        >
                          {formatCurrency(payload[0].value as number)}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey={dataKey} radius={[5, 5, 0, 0]} isAnimationActive>
                  {monthlyData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={entry.key === currentMonthKey ? `url(#${gradId})` : color}
                      fillOpacity={entry.key === currentMonthKey ? 1 : 0.28}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  const renderSimpleSection = (
    title: string,
    Icon: React.ElementType,
    value: number,
    breakdown?: { mrrVal: number; nrrVal: number },
    meta?: { target: number; achieved: number },
    eyeToggle?: { visible: boolean; onToggle: () => void },
    color = "hsl(var(--foreground))"
  ) => {
    const isGoalMet = meta ? meta.target > 0 && meta.achieved >= meta.target : false;
    const masked = eyeToggle ? !eyeToggle.visible : false;
    const EyeIcon = eyeToggle?.visible ? Eye : EyeOff;
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 shrink-0" style={{ color }} />
            <h1 className="text-[19px] font-bold tracking-wide leading-none" style={{ color }}>
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[28px] font-extrabold tabular-nums text-foreground leading-none">
              {masked ? "R$ ••••••" : formatCurrency(value)}
            </p>
            {eyeToggle && (
              <button
                onClick={eyeToggle.onToggle}
                className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
                style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.30)" }}
                aria-label={eyeToggle.visible ? "Ocultar comissão" : "Mostrar comissão"}
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          {breakdown && (
            <div className="flex flex-col gap-1.5">
              <span
                className="inline-flex items-center self-start rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                style={{ background: "rgba(228,169,0,0.13)", border: "1px solid rgba(228,169,0,0.32)", color: "#E4A900" }}
              >
                MRR {masked ? "••••••" : formatCurrency(breakdown.mrrVal)}
              </span>
              <span
                className="inline-flex items-center self-start rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                style={{ background: "rgba(113,75,103,0.18)", border: "1px solid rgba(113,75,103,0.35)", color: "#b87fa8" }}
              >
                NRR {masked ? "••••••" : formatCurrency(breakdown.nrrVal)}
              </span>
            </div>
          )}
          {meta && meta.target > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] text-muted-foreground/70 font-bold leading-none shrink-0">
                Sua Meta: {formatCurrency(meta.target)}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold shrink-0"
                style={isGoalMet
                  ? { background: "rgba(34,197,94,0.13)", border: "1px solid rgba(34,197,94,0.32)", color: "#22c55e" }
                  : { background: "rgba(228,169,0,0.13)", border: "1px solid rgba(228,169,0,0.32)", color: "#E4A900" }}
              >
                {isGoalMet ? "🎉 " : ""}{formatPct((meta.achieved / meta.target) * 100)}
              </span>
              {!isGoalMet && (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold shrink-0"
                  style={{ background: "rgba(113,75,103,0.18)", border: "1px solid rgba(113,75,103,0.35)", color: "#b87fa8" }}
                >
                  Falta {formatCurrency(meta.target - meta.achieved)}
                </span>
              )}
            </div>
          )}
        </div>

        {monthlyData.length > 0 && (
          <div className="h-[90px] w-full mt-auto pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barCategoryGap="18%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="simple-glow-commission" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.10, strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 700, opacity: 0.65 }}
                  interval={0}
                  tickMargin={5}
                />
                <RechartsTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div
                          className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold"
                          style={{
                            background: "rgba(10,10,18,0.85)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#fff",
                            backdropFilter: "blur(8px)",
                          }}
                        >
                          {masked ? "••••••" : formatCurrency(payload[0].value as number)}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="commission" radius={[5, 5, 0, 0]} isAnimationActive>
                  {monthlyData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={entry.key === currentMonthKey ? "url(#simple-glow-commission)" : color}
                      fillOpacity={entry.key === currentMonthKey ? 1 : 0.28}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col min-h-0 justify-between">
      <div className="flex gap-6 min-w-0 items-stretch flex-1">
        <div className="flex-1 min-w-0 flex flex-col">
          {renderSection("Seu MRR", Repeat2, mrr, "mrr", "unified-glow-mrr", false, "#714B67")}
        </div>
        <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.07)", opacity: 0 }} />
        <div className="flex-1 min-w-0 flex flex-col">
          {renderSection("Seu NRR", BarChart2, nrr, "nrr", "unified-glow-nrr", false, "#017E84")}
        </div>
      </div>

      <div className="my-8 relative">
        <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.10) 70%, transparent)", opacity: 0 }} />
      </div>

      <div className="flex gap-6 min-w-0 items-stretch flex-1">
        <div className="flex-1 min-w-0 flex flex-col">
          {renderSection("Seu Desempenho do Mês", TrendingUp, total, "total", "unified-glow-total", false, "#5B899E")}
        </div>
        <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.07)", opacity: 0 }} />
        <div className="flex-1 min-w-0 flex flex-col">
          {renderSimpleSection("Sua Comissão", Award, commission, { mrrVal: mrrCommission, nrrVal: nrrCommission }, undefined, { visible: commissionVisible, onToggle: () => setCommissionVisible(v => !v) }, "#E4A900")}
        </div>
      </div>
    </div>
  );
}

const QUARTER_LABEL: Record<string, string> = {
  Q1: "Quarter 01",
  Q2: "Quarter 02",
  Q3: "Quarter 03",
  Q4: "Quarter 04",
};

export function QuarterMiniCard({ data }: { data: QuarterMetrics }) {
  const mrrPct = Math.max(0, data.mrr.pct);
  const nrrPct = Math.max(0, data.nrr.pct);

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-1.5">
        <div className="text-center">
          <span className="text-[13px] font-bold text-foreground/75 tracking-wide">
            {QUARTER_LABEL[data.quarter] ?? data.quarter}
          </span>
          {!data.hasData && (
            <span className="block text-[10px] text-muted-foreground/30 italic mt-0.5">sem dados</span>
          )}
        </div>

        {data.hasData ? (
          <div className="grid grid-cols-[1fr_1px_1fr] gap-0">
            <div className="flex flex-col items-center gap-0.5 pr-2.5">
              <span
                className="inline-flex items-center rounded-full px-1 py-0.5 text-[9px] font-bold tracking-wider uppercase"
                style={{ background: "rgba(113,75,103,0.18)", border: "1px solid rgba(113,75,103,0.40)", color: "#b87fa8" }}
              >
                MRR
              </span>
              <span className="text-[12px] tabular-nums text-foreground/65 font-medium leading-tight">
                {formatCurrency(data.mrr.achieved)}
              </span>
              <span className={cn("text-[12px] font-bold tabular-nums", pctColorDsm(mrrPct))}>
                {Math.round(mrrPct)}%
              </span>
            </div>

            <div className="bg-white/8 rounded-full" />

            <div className="flex flex-col items-center gap-0.5 pl-2.5">
              <span
                className="inline-flex items-center rounded-full px-1 py-0.5 text-[9px] font-bold tracking-wider uppercase"
                style={{ background: "rgba(1,126,132,0.16)", border: "1px solid rgba(1,126,132,0.38)", color: "#0fb8c0" }}
              >
                NRR
              </span>
              <span className="text-[12px] tabular-nums text-foreground/65 font-medium leading-tight">
                {formatCurrency(data.nrr.achieved)}
              </span>
              <span className={cn("text-[12px] font-bold tabular-nums", pctColorDsm(nrrPct))}>
                {Math.round(nrrPct)}%
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/25 italic text-center py-0.5">dados indisponíveis</p>
        )}
      </div>
    </div>
  );
}

const LEADER_PHOTO_MAP: Record<string, string> = {
  "lucas mayer": lucasMayerImg,
  "rodrigo marba": rodrigoMarbaImg,
};

export function getLeaderPhotoByName(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [key, img] of Object.entries(LEADER_PHOTO_MAP)) {
    if (lower.includes(key)) return img;
  }
  return null;
}
