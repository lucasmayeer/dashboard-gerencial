import { useMemo, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { useFilters } from "@/lib/filters";
import { formatCurrency, getUniqueValues } from "@/lib/data";
import { MONTH_NAMES, YEAR_COLORS, OUTLIER_THRESHOLD } from "@/lib/facilitiesUtils";
import { InconsistenciasButton } from "@/components/facilities/InconsistenciasButton";
import { ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown, Info, ShoppingCart, CalendarDays, Wrench, Monitor, BarChart2, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PerspectiveCard } from "@/components/PerspectiveCard";
import { OutlierBadge } from "@/components/facilities/OutlierBadge";
import { Dialog, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Granularity = "month" | "quarter" | "year";

const TIPO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Insumos": ShoppingCart,
  "Eventos": CalendarDays,
  "Serviços": Wrench,
  "Atv. Escritório": Monitor,
};

function getQuarterFromMesRef(mesRef: string): string {
  const [m, y] = mesRef.split("/").map(Number);
  const q = Math.ceil(m / 3);
  return `Q${q}/${y}`;
}

function getYearFromMesRef(mesRef: string): string {
  return mesRef.split("/")[1] || mesRef;
}

function sortPeriodKey(a: string, b: string, granularity: Granularity): number {
  if (granularity === "year") return Number(a) - Number(b);
  if (granularity === "quarter") {
    const [qA, yA] = a.replace("Q", "").split("/").map(Number);
    const [qB, yB] = b.replace("Q", "").split("/").map(Number);
    return yA !== yB ? yA - yB : qA - qB;
  }
  const [mA, yA] = a.split("/").map(Number);
  const [mB, yB] = b.split("/").map(Number);
  return yA !== yB ? yA - yB : mA - mB;
}

function formatVariation(current: number, other: number | undefined): { text: string; positive: boolean; diff: number } | null {
  if (other === undefined || other === 0) return null;
  const pct = ((current - other) / other) * 100;
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}%`, positive: pct >= 0, diff: current - other };
}

const formatCompactCurrency = (v: number) => {
  if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
};

export function TemporalPage() {
  const { allData, setFilter, filters, removeOutliers } = useFilters();
  const { theme } = useTheme();
  const labelColor = theme === "dark" ? "#ffffff" : "#1a1a1a";
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [selectedYear, setSelectedYear] = useState<string>("Todos");
  const [selectedTipoFilter, setSelectedTipoFilter] = useState<string>("Todos");
  const [expandedTipo, setExpandedTipo] = useState<Set<string>>(new Set());
  const [modalChart, setModalChart] = useState<{ label: string; filterKey: "tipo" | "cat"; filterValue: string; parentTipo?: string } | null>(null);

  const workingData = useMemo(() => {
    if (!removeOutliers) return allData;
    return allData.filter(o => o.valorTotal <= OUTLIER_THRESHOLD);
  }, [allData, removeOutliers]);

  const tipos = useMemo(() => ["Todos", ...getUniqueValues(workingData, "tipo")], [workingData]);

  const allYears = useMemo(() => {
    const s = new Set<number>();
    workingData.forEach(o => {
      const [, y] = (o.mesRef || "").split("/");
      const n = Number(y);
      if (!isNaN(n)) s.add(n);
    });
    return Array.from(s).sort();
  }, [workingData]);

  const currentYear = allYears.length > 0 ? allYears[allYears.length - 1] : new Date().getFullYear();
  const prevYear = currentYear - 1;
  const currentMonthNum = new Date().getMonth() + 1;

  // ---- Period range ----
  const periodRange = useMemo(() => {
    const validFormat = /^\d{2}\/\d{4}$/;
    const months = workingData.map(o => o.mesRef).filter(m => validFormat.test(m)).sort((a, b) => {
      const [mA, yA] = a.split("/").map(Number);
      const [mB, yB] = b.split("/").map(Number);
      return yA !== yB ? yA - yB : mA - mB;
    });
    if (!months.length) return { first: "—", last: "—" };
    const format = (ref: string) => {
      const [m, y] = ref.split("/").map(Number);
      return `${MONTH_NAMES[m - 1]}/${y}`;
    };
    return { first: format(months[0]), last: format(months[months.length - 1]) };
  }, [workingData]);

  // ---- Year stats ----
  const yearlyStats = useMemo(() => {
    const byYearTipo = new Map<number, Map<string, number>>();
    const byYearMonth = new Map<number, Map<number, number>>();
    workingData.forEach(o => {
      if (!o.mesRef) return;
      const [mStr, yStr] = o.mesRef.split("/");
      const year = Number(yStr);
      const month = Number(mStr);
      if (isNaN(year)) return;
      if (!byYearTipo.has(year)) byYearTipo.set(year, new Map());
      const tm = byYearTipo.get(year)!;
      if (o.tipo) tm.set(o.tipo, (tm.get(o.tipo) || 0) + o.valorTotal);
      if (!byYearMonth.has(year)) byYearMonth.set(year, new Map());
      const mm = byYearMonth.get(year)!;
      mm.set(month, (mm.get(month) || 0) + o.valorTotal);
    });

    return allYears.map(y => {
      const tipoMap = byYearTipo.get(y) || new Map();
      const monthMap = byYearMonth.get(y) || new Map();
      const total = Array.from(tipoMap.values()).reduce((s, v) => s + v, 0);
      const monthCount = monthMap.size || 1;
      const media = total / monthCount;
      const byTipo = Array.from(tipoMap.entries()).map(([t, v]) => ({ tipo: t, value: v })).sort((a, b) => a.tipo.localeCompare(b.tipo));
      let samePeriodTotal = 0;
      for (let m = 1; m <= currentMonthNum; m++) {
        samePeriodTotal += monthMap.get(m) || 0;
      }
      return { year: y, total, media, byTipo, samePeriodTotal, monthCount };
    });
  }, [workingData, allYears, currentMonthNum]);

  const currentYearStats = yearlyStats.find(y => y.year === currentYear);
  const prevYearStats = yearlyStats.find(y => y.year === prevYear);

  // YoY same period
  const yoySamePeriod = useMemo(() => {
    if (!currentYearStats || !prevYearStats) return null;
    const curr = currentYearStats.samePeriodTotal;
    const prev = prevYearStats.samePeriodTotal;
    if (prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return { curr, prev, pct, diff: curr - prev };
  }, [currentYearStats, prevYearStats]);

  const yoySamePeriodMedia = useMemo(() => {
    if (!currentYearStats || !prevYearStats) return null;
    const currMedia = currentYearStats.samePeriodTotal / currentMonthNum;
    const prevMedia = prevYearStats.samePeriodTotal / currentMonthNum;
    if (prevMedia === 0) return null;
    const pct = ((currMedia - prevMedia) / prevMedia) * 100;
    return { currMedia, prevMedia, pct, diff: currMedia - prevMedia };
  }, [currentYearStats, prevYearStats, currentMonthNum]);

  // ---- Chart data (apply year + tipo filters) ----
  const chartData = useMemo(() => {
    let data = [...workingData];
    if (selectedYear !== "Todos") data = data.filter(o => o.mesRef?.endsWith(`/${selectedYear}`));
    if (selectedTipoFilter !== "Todos") data = data.filter(o => o.tipo === selectedTipoFilter);
    return data;
  }, [workingData, selectedYear, selectedTipoFilter]);

  const evolutionData = useMemo(() => {
    const periodMap = new Map<string, { total: number; byTipo: Map<string, number> }>();
    chartData.forEach((o) => {
      if (!o.mesRef) return;
      let key: string;
      if (granularity === "year") key = getYearFromMesRef(o.mesRef);
      else if (granularity === "quarter") key = getQuarterFromMesRef(o.mesRef);
      else key = o.mesRef;
      if (!periodMap.has(key)) periodMap.set(key, { total: 0, byTipo: new Map() });
      const entry = periodMap.get(key)!;
      entry.total += o.valorTotal;
      entry.byTipo.set(o.tipo, (entry.byTipo.get(o.tipo) || 0) + o.valorTotal);
    });
    return Array.from(periodMap.entries())
      .map(([period, data]) => ({
        period,
        total: data.total,
        byTipo: Array.from(data.byTipo.entries())
          .map(([name, value]) => ({ name, value, pct: data.total > 0 ? (value / data.total) * 100 : 0 }))
          .sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => sortPeriodKey(a.period, b.period, granularity));
  }, [chartData, granularity]);

  // Dynamic Y-axis max (20% above highest bar)
  const yAxisMax = useMemo(() => {
    const maxTotal = evolutionData.reduce((max, d) => Math.max(max, d.total), 0);
    return Math.ceil(maxTotal * 1.2);
  }, [evolutionData]);

  // ---- Composition hierarchy - NOW uses chartData (synced with evolution filters) ----
  const compositionData = useMemo(() => {
    const tipoMap = new Map<string, { total: number; cats: Map<string, number> }>();
    chartData.forEach(o => {
      if (!o.tipo || !o.cat) return;
      if (!tipoMap.has(o.tipo)) tipoMap.set(o.tipo, { total: 0, cats: new Map() });
      const t = tipoMap.get(o.tipo)!;
      t.total += o.valorTotal;
      if (!t.cats.has(o.cat)) t.cats.set(o.cat, 0);
      t.cats.set(o.cat, t.cats.get(o.cat)! + o.valorTotal);
    });

    return Array.from(tipoMap.entries())
      .map(([tipo, data]) => ({
        tipo,
        total: data.total,
        cats: Array.from(data.cats.entries())
          .map(([cat, total]) => ({ cat, total }))
          .sort((a, b) => a.cat.localeCompare(b.cat)),
      }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo));
  }, [chartData]);

  // Composition title derived from active filters
  const compositionTitle = useMemo(() => {
    const parts: string[] = [];
    if (selectedTipoFilter !== "Todos") parts.push(selectedTipoFilter);
    if (selectedYear !== "Todos") parts.push(selectedYear);
    else parts.push("Todos os anos");
    return parts.length > 0 ? parts.join(" — ") : `${currentYear}`;
  }, [selectedYear, selectedTipoFilter, currentYear]);

  // Modal chart evolution data
  const modalEvolutionData = useMemo(() => {
    if (!modalChart) return [];
    const filtered = chartData.filter(o =>
      modalChart.filterKey === "tipo" ? (o.tipo === modalChart.filterValue && o.tipo && o.cat) : (o.cat === modalChart.filterValue && o.tipo === modalChart.parentTipo && o.tipo && o.cat)
    );
    const periodMap = new Map<string, number>();
    filtered.forEach(o => {
      if (!o.mesRef) return;
      let key: string;
      if (granularity === "year") key = getYearFromMesRef(o.mesRef);
      else if (granularity === "quarter") key = getQuarterFromMesRef(o.mesRef);
      else key = o.mesRef;
      periodMap.set(key, (periodMap.get(key) || 0) + o.valorTotal);
    });
    return Array.from(periodMap.entries())
      .map(([period, total]) => ({ period, total }))
      .sort((a, b) => sortPeriodKey(a.period, b.period, granularity));
  }, [modalChart, chartData, granularity]);

  const modalYAxisMax = useMemo(() => {
    const max = modalEvolutionData.reduce((m, d) => Math.max(m, d.total), 0);
    return Math.ceil(max * 1.2) || 1000;
  }, [modalEvolutionData]);

  // Modal KPI metrics
  const modalMetrics = useMemo(() => {
    if (!modalChart) return { totalValue: 0, uniqueOrders: 0, avgValue: 0 };
    const filtered = chartData.filter(o =>
      modalChart.filterKey === "tipo" ? (o.tipo === modalChart.filterValue && o.tipo && o.cat) : (o.cat === modalChart.filterValue && o.tipo === modalChart.parentTipo && o.tipo && o.cat)
    );
    const totalValue = filtered.reduce((s, o) => s + o.valorTotal, 0);
    const orderSet = new Set(filtered.map(o => o.codPedido).filter(Boolean));
    const uniqueOrders = orderSet.size || 1;
    return { totalValue, uniqueOrders, avgValue: totalValue / uniqueOrders };
  }, [modalChart, chartData]);

  // ---- Chart click handler ----
  const handleBarClick = (data: any) => {
    if (!data?.activePayload?.[0]) return;
    const period = data.activePayload[0].payload.period;
    if (granularity === "month") {
      const current = filters.mesRef;
      if (current.length === 1 && current[0] === period) setFilter("mesRef", []);
      else setFilter("mesRef", [period]);
    }
  };

  const renderEvolutionTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const dataPoint = evolutionData.find((d) => d.period === label);
    if (!dataPoint) return null;
    const idx = evolutionData.indexOf(dataPoint);
    const prev = idx > 0 ? evolutionData[idx - 1] : undefined;
    const next = idx < evolutionData.length - 1 ? evolutionData[idx + 1] : undefined;
    const varPrev = formatVariation(dataPoint.total, prev?.total);
    const varNext = formatVariation(dataPoint.total, next?.total);

    return (
      <div className="glass-card backdrop-blur-md rounded-2xl p-6 shadow-2xl text-sm min-w-[300px]">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">{formatCurrency(dataPoint.total)}</p>
        </div>
        {(varPrev || varNext) && (
          <div className="flex gap-6 mb-4 pb-4 border-b border-border/50">
            {varPrev && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">vs anterior</span>
                <span className={cn("text-sm font-bold flex items-center gap-1", varPrev.positive ? "text-kpi-down" : "text-kpi-up")}>
                  {varPrev.positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {varPrev.text}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {varPrev.diff > 0 ? "+" : ""}{formatCurrency(varPrev.diff)}
                </span>
              </div>
            )}
            {varNext && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">vs seguinte</span>
                <span className={cn("text-sm font-bold flex items-center gap-1", varNext.positive ? "text-kpi-down" : "text-kpi-up")}>
                  {varNext.positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {varNext.text}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {varNext.diff > 0 ? "+" : ""}{formatCurrency(varNext.diff)}
                </span>
              </div>
            )}
          </div>
        )}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quebra por tipo</p>
          {dataPoint.byTipo.map((t) => (
            <div key={t.name} className="flex justify-between gap-3 items-center">
              <span className="text-xs text-foreground truncate">{t.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-foreground font-medium">{formatCurrency(t.value)}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground w-12 text-right">{t.pct.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [evolutionData]);

  const toggleTipo = useCallback((t: string) => setExpandedTipo(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; }), []);

  const granularityLabel: Record<Granularity, string> = { month: "Mês", quarter: "Quarter", year: "Ano" };

  const isYearDisabled = selectedYear !== "Todos";

  return (
    <div className="space-y-10">
      {/* Title */}
      <div className="animate-fade-in-delayed stagger-1">
        <div className="flex items-center justify-between">
          <h2 className="text-5xl font-extrabold animate-gradient-text pb-2">
            E o mês a mês…
          </h2>
          <InconsistenciasButton />
        </div>
        <p className="text-lg text-muted-foreground mt-3">
          Resumo de gastos do período <span className="font-semibold text-foreground">{periodRange.first}</span> até <span className="font-semibold text-foreground">{periodRange.last}</span>
        </p>
      </div>

      {/* Analytical Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-delayed stagger-2">
        {/* Main Card - Current Year */}
        <PerspectiveCard className="lg:col-span-2">
          <div className="glass-card rounded-2xl p-8">
            <p className="text-sm text-muted-foreground mb-2">Neste ano, o gasto total é:</p>
            <p className="text-5xl font-bold tracking-tight text-foreground tabular-nums">
              {formatCurrency(currentYearStats?.total || 0)}
              <OutlierBadge show={removeOutliers} />
            </p>

            {/* Mini cards by tipo - no background, with icons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {(currentYearStats?.byTipo || []).map(t => {
                const Icon = TIPO_ICONS[t.tipo] || ShoppingCart;
                return (
                  <div key={t.tipo} className="px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.tipo}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(t.value)}<OutlierBadge show={removeOutliers} /></p>
                  </div>
                );
              })}
            </div>

            {/* Average + YoY integrated in 3-column grid */}
            <div className="mt-6 pt-6 border-t border-border/20">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Col 1: Monthly Average */}
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Média Mensal {currentYear}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(currentYearStats?.media || 0)}<OutlierBadge show={removeOutliers} /></p>
                    {prevYearStats && currentYearStats && (() => {
                      const pct = ((currentYearStats.media - prevYearStats.media) / prevYearStats.media) * 100;
                      const up = pct > 0;
                      return (
                        <div className="flex items-center gap-1">
                          {up ? <ArrowUpRight className="h-3.5 w-3.5 text-destructive" /> : <ArrowDownRight className="h-3.5 w-3.5 text-kpi-up" />}
                          <span className={cn("text-sm font-bold tabular-nums", up ? "text-destructive" : "text-kpi-up")}>
                            {up ? "+" : ""}{pct.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  {prevYearStats && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      A média de {prevYear} foi de {formatCurrency(prevYearStats.media)}.
                    </p>
                  )}
                </div>

                {/* Col 2: Média vs Mesmo Período */}
                {yoySamePeriodMedia && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Média vs Mesmo Período {prevYear}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(yoySamePeriodMedia.currMedia)}<OutlierBadge show={removeOutliers} /></span>
                      <div className="flex items-center gap-1">
                        {yoySamePeriodMedia.pct > 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-destructive" /> : <ArrowDownRight className="h-3.5 w-3.5 text-kpi-up" />}
                        <span className={cn("text-sm font-bold tabular-nums", yoySamePeriodMedia.pct > 0 ? "text-destructive" : "text-kpi-up")}>
                          {yoySamePeriodMedia.pct > 0 ? "+" : ""}{yoySamePeriodMedia.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      A média no mesmo período de {prevYear} foi de {formatCurrency(yoySamePeriodMedia.prevMedia)}.
                    </p>
                  </div>
                )}

                {/* Col 3: YTD Vs Mesmo Período */}
                {yoySamePeriod && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">YTD Vs Mesmo Período {prevYear}</p>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px]">
                            <p className="text-xs">Comparação do total acumulado de Jan até {MONTH_NAMES[currentMonthNum - 1]} entre {currentYear} e {prevYear}.</p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(yoySamePeriod.prev)}</span>
                      <div className="flex items-center gap-1">
                        {yoySamePeriod.pct > 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-destructive" /> : <ArrowDownRight className="h-3.5 w-3.5 text-kpi-up" />}
                        <span className={cn("text-sm font-bold tabular-nums", yoySamePeriod.pct > 0 ? "text-destructive" : "text-kpi-up")}>
                          {yoySamePeriod.pct > 0 ? "+" : ""}{yoySamePeriod.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Estamos {formatCurrency(Math.abs(yoySamePeriod.diff))} {yoySamePeriod.pct > 0 ? "acima" : "abaixo"} do mesmo período de {prevYear}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </PerspectiveCard>

        {/* Right column: Previous year cards only */}
        <div className="space-y-6">
          {yearlyStats.filter(y => y.year !== currentYear).reverse().slice(0, 2).map(ys => (
            <div key={ys.year} className="glass-card rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 animate-fade-in-delayed stagger-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: YEAR_COLORS[ys.year] || "#888" }} />
                <p className="text-sm font-semibold text-foreground">{ys.year}</p>
                <span className="text-sm font-bold tabular-nums text-foreground ml-auto">{formatCurrency(ys.total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ys.byTipo.slice(0, 4).map(t => (
                  <div key={t.tipo} className="text-xs">
                    <span className="text-muted-foreground">{t.tipo}</span>
                    <p className="font-medium text-foreground tabular-nums">{formatCurrency(t.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evolution Chart */}
      <div className="animate-fade-in-delayed stagger-3">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-foreground">Evolução de Gastos</h3>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Type segmenter */}
            <div className="flex rounded-xl overflow-hidden glass-card p-0.5">
              {tipos.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTipoFilter(t)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all",
                    selectedTipoFilter === t ? "glass-button-active" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Year segmenter */}
            <div className="flex rounded-xl overflow-hidden glass-card p-0.5">
              <button
                onClick={() => setSelectedYear("Todos")}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all",
                  selectedYear === "Todos" ? "glass-button-active" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </button>
              {allYears.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(String(y))}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all",
                    selectedYear === String(y) ? "glass-button-active" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
            {/* Granularity */}
            <div className="flex rounded-xl overflow-hidden glass-card p-0.5">
              {(["month", "quarter", "year"] as Granularity[]).map((g) => (
                <button
                  key={g}
                  onClick={() => !(g === "year" && isYearDisabled) && setGranularity(g)}
                  disabled={g === "year" && isYearDisabled}
                  className={cn(
                    "px-4 py-1.5 text-[11px] font-medium rounded-lg transition-all",
                    granularity === g ? "glass-button-active" : "text-muted-foreground hover:text-foreground",
                    g === "year" && isYearDisabled && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {granularityLabel[g]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-96 pt-6" style={{ overflow: "visible" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolutionData} onClick={handleBarClick} className="cursor-pointer" margin={{ top: 30, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 18%, 89%)" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "hsl(230, 12%, 48%)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, yAxisMax]} tick={{ fontSize: 10, fill: "hsl(230, 12%, 48%)" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip content={renderEvolutionTooltip} cursor={{ fill: "hsl(258, 60%, 52%, 0.05)" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={12}
                  formatter={(v: number) => formatCompactCurrency(v)}
                  style={{ fontSize: 10, fill: labelColor, fontWeight: 700 }}
                />
                {evolutionData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill="#714B67"
                    opacity={filters.mesRef.length === 1 && filters.mesRef[0] !== entry.period ? 0.3 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {filters.mesRef.length === 1 && granularity === "month" && (
          <div className="mt-2 flex justify-center">
            <button onClick={() => setFilter("mesRef", [])} className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
              ✕ Limpar filtro de mês ({filters.mesRef[0]})
            </button>
          </div>
        )}
      </div>

      {/* Composição dos Gastos - Clean hierarchy, synced with chart filters */}
      <div className="animate-fade-in-delayed stagger-4">
        <h3 className="text-sm font-semibold text-foreground mb-6">Composição dos Gastos — {compositionTitle}</h3>
        <div className="space-y-1">
          {compositionData.map(tipo => {
            const isOpen = expandedTipo.has(tipo.tipo);
            const grandTotal = compositionData.reduce((s, t) => s + t.total, 0);
            const maxTotal = compositionData.reduce((m, t) => Math.max(m, t.total), 1);
            const barPct = maxTotal > 0 ? (tipo.total / maxTotal) * 100 : 0;
            const tipoPctTotal = grandTotal > 0 ? (tipo.total / grandTotal) * 100 : 0;
            const TipoIcon = TIPO_ICONS[tipo.tipo] || ShoppingCart;
            return (
              <div key={tipo.tipo} className={cn(
                "transition-all duration-300 rounded-xl",
                isOpen ? "ring-1 ring-primary/20 bg-muted/20" : expandedTipo.size > 0 ? "opacity-50" : ""
              )}>
                <div className="flex items-center">
                  <button
                    onClick={() => toggleTipo(tipo.tipo)}
                    className="flex-1 text-left px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TipoIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className={cn("text-sm font-medium flex-1", isOpen ? "text-foreground" : "text-foreground/80")}>{tipo.tipo}</span>
                      <span className="text-xs tabular-nums text-muted-foreground mr-1">{tipoPctTotal.toFixed(1)}%</span>
                      <span className="text-sm tabular-nums text-foreground font-medium">{formatCurrency(tipo.total)}</span>
                    </div>
                    <div className="ml-6">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, backgroundColor: "#714B67" }} />
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setModalChart({ label: tipo.tipo, filterKey: "tipo", filterValue: tipo.tipo }); }}
                    className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title={`Ver evolução de ${tipo.tipo}`}
                  >
                    <BarChart2 className="h-4 w-4" />
                  </button>
                </div>
                {isOpen && (
                  <div className="ml-8 space-y-0.5 pb-2 animate-fade-in">
                    {tipo.cats.filter(c => c.total > 0).map(cat => {
                      return (
                        <div key={cat.cat} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-muted/30 transition-colors">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                          <span className="text-sm text-foreground/80 flex-1">{cat.cat}</span>
                          <span className="text-xs tabular-nums text-foreground font-medium">{formatCurrency(cat.total)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setModalChart({ label: cat.cat, filterKey: "cat", filterValue: cat.cat, parentTipo: tipo.tipo }); }}
                            className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            title={`Ver evolução de ${cat.cat}`}
                          >
                            <BarChart2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Chart Dialog */}
      <Dialog open={!!modalChart} onOpenChange={(open) => !open && setModalChart(null)}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-white/30 dark:bg-black/30" />
          <DialogContent className="max-w-4xl glass-card rounded-2xl border-0">
            <DialogHeader>
              <DialogTitle>Evolução — {modalChart?.parentTipo ? `${modalChart.parentTipo} > ${modalChart.label}` : modalChart?.label}</DialogTitle>
            </DialogHeader>
            {/* Unified KPI row with icons */}
            <div className="flex items-center justify-around py-3 mt-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Total</p>
                  <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(modalMetrics.totalValue)}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-border/50" />
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pedidos</p>
                  <p className="text-sm font-bold text-foreground tabular-nums">{modalMetrics.uniqueOrders}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-border/50" />
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Médio</p>
                  <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(modalMetrics.avgValue)}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-4 mt-2 !bg-transparent backdrop-blur-xl">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modalEvolutionData} margin={{ top: 30, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 18%, 89%)" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: "hsl(230, 12%, 48%)" }} axisLine={false} tickLine={false} />

                    <Tooltip content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const idx = modalEvolutionData.findIndex(d => d.period === label);
                      const current = modalEvolutionData[idx]?.total ?? 0;
                      const prev = idx > 0 ? modalEvolutionData[idx - 1] : undefined;
                      const next = idx < modalEvolutionData.length - 1 ? modalEvolutionData[idx + 1] : undefined;
                      const varPrev = formatVariation(current, prev?.total);
                      const varNext = formatVariation(current, next?.total);
                      return (
                        <div className="glass-card backdrop-blur-md rounded-2xl p-4 shadow-2xl text-sm min-w-[220px]">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                          <p className="text-2xl font-bold text-foreground tabular-nums mb-2">{formatCurrency(current)}</p>
                          {(varPrev || varNext) && (
                            <div className="flex gap-4">
                              {varPrev && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">vs anterior</span>
                                  <span className={cn("text-xs font-bold flex items-center gap-1", varPrev.positive ? "text-kpi-down" : "text-kpi-up")}>
                                    {varPrev.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {varPrev.text}
                                  </span>
                                </div>
                              )}
                              {varNext && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">vs seguinte</span>
                                  <span className={cn("text-xs font-bold flex items-center gap-1", varNext.positive ? "text-kpi-down" : "text-kpi-up")}>
                                    {varNext.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {varNext.text}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }} cursor={{ fill: "hsl(258, 60%, 52%, 0.05)" }} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#714B67">
                      <LabelList dataKey="total" position="top" offset={12} formatter={(v: number) => formatCompactCurrency(v)} style={{ fontSize: 10, fill: labelColor, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
