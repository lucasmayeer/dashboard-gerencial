import { useMemo, useState, useCallback, useEffect } from "react";
import { useFilters } from "@/lib/filters";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, Order } from "@/lib/data";
import { MONTH_NAMES, MONTH_NAMES_FULL, BADGE_COLORS, getBadgeColor, capitalize, formatMonthLabel, statusBadge, formatDate, OUTLIER_THRESHOLD } from "@/lib/facilitiesUtils";
import { InconsistenciasButton } from "@/components/facilities/InconsistenciasButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpRight, ArrowDownRight, Minus, Search, DollarSign,
  ChevronRight, ChevronDown, Wallet, BarChart2, Info, CalendarDays,
  FileText
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NfeDownloadButton } from "@/components/facilities/NfeDownloadButton";
import { PerspectiveCard } from "@/components/PerspectiveCard";
import { OutlierBadge } from "@/components/facilities/OutlierBadge";


function getCurrentMonthKey(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

export function ResumoMensalPage() {
  const { allData, removeOutliers } = useFilters();
  const { profile, user } = useAuth();
  const [fornecedorSearch, setFornecedorSearch] = useState("");
  const [selectedTipo, setSelectedTipo] = useState("Todos");
  const [expandedFornecedor, setExpandedFornecedor] = useState<Set<string>>(new Set());
  const [expandedPedido, setExpandedPedido] = useState<Set<string>>(new Set());
  const [expandedTipo, setExpandedTipo] = useState<Set<string>>(new Set());
  const [fornecedorPage, setFornecedorPage] = useState(1);

  const [selectedMonth, setSelectedMonth] = useState("");

  const rawName = profile?.full_name || (profile?.display_name || user?.email || "").split("@")[0] || "Usuário";
  const displayName = capitalize(rawName);
  const currentMonth = selectedMonth;

  // Working data respects global outlier filter
  const workingData = useMemo(() => {
    if (!removeOutliers) return allData;
    return allData.filter(o => o.valorTotal <= OUTLIER_THRESHOLD);
  }, [allData, removeOutliers]);

  // Available months from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    workingData.forEach((o) => { if (o.mesRef) months.add(o.mesRef); });
    return Array.from(months).sort((a, b) => {
      const [ma, ya] = a.split("/").map(Number);
      const [mb, yb] = b.split("/").map(Number);
      return yb - ya || mb - ma;
    });
  }, [workingData]);

  // Snap to latest available month if current selection has no data
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths]);

  const currentMonthFullLabel = useMemo(() => {
    const [m, y] = currentMonth.split("/").map(Number);
    if (isNaN(m) || isNaN(y) || m < 1 || m > 12) return currentMonth;
    return `${MONTH_NAMES_FULL[m - 1]}/${y}`;
  }, [currentMonth]);

  // Current month data
  const currentMonthData = useMemo(
    () => workingData.filter((o) => o.mesRef === currentMonth),
    [workingData, currentMonth]
  );

  const totalMesAtual = useMemo(
    () => currentMonthData.reduce((s, o) => s + o.valorTotal, 0),
    [currentMonthData]
  );

  // Comparisons
  const comparisons = useMemo(() => {
    const [cm, cy] = currentMonth.split("/").map(Number);
    if (isNaN(cm) || isNaN(cy)) return [];
    return [1, 2, 3].map((back) => {
      const d = new Date(cy, cm - 1 - back, 1);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const monthData = workingData.filter((o) => o.mesRef === key);
      const total = monthData.reduce((s, o) => s + o.valorTotal, 0);
      const hasData = monthData.length > 0;
      const diff = hasData ? totalMesAtual - total : null;
      const pct = hasData && total > 0 ? ((totalMesAtual - total) / total) * 100 : null;
      return { key, label: formatMonthLabel(key), total, hasData, diff, pct };
    });
  }, [workingData, currentMonth, totalMesAtual]);

  // Historical stats
  const historicalStats = useMemo(() => {
    const byMonth = new Map<string, number>();
    workingData.forEach((o) => {
      if (!o.mesRef) return;
      byMonth.set(o.mesRef, (byMonth.get(o.mesRef) || 0) + o.valorTotal);
    });
    const totalAcum = workingData.reduce((s, o) => s + o.valorTotal, 0);
    const count = byMonth.size || 1;
    const totalForAvg = Array.from(byMonth.values()).reduce((s, v) => s + v, 0);
    return { totalAcum, mediaMensal: totalForAvg / count };
  }, [workingData]);

  // ---- 3 months before selectedMonth (for chips) ----
  const prev3Months = useMemo(() => {
    const toNum = (key: string) => { const [m, y] = key.split("/"); return Number(y) * 100 + Number(m); };
    const currNum = toNum(currentMonth);
    return Array.from(new Set(workingData.map(o => o.mesRef).filter(Boolean) as string[]))
      .filter(m => toNum(m) < currNum)
      .sort((a, b) => toNum(b) - toNum(a))
      .slice(0, 1);
  }, [workingData, currentMonth]);

  const prev3Stats = useMemo(() => {
    const result = new Map<string, Map<string, { total: number; cats: Map<string, number> }>>();
    prev3Months.forEach(m => result.set(m, new Map()));
    workingData.forEach((o) => {
      if (!o.mesRef || !result.has(o.mesRef) || !o.tipo) return;
      const mMap = result.get(o.mesRef)!;
      if (!mMap.has(o.tipo)) mMap.set(o.tipo, { total: 0, cats: new Map() });
      const t = mMap.get(o.tipo)!;
      t.total += o.valorTotal;
      if (o.cat) t.cats.set(o.cat, (t.cats.get(o.cat) || 0) + o.valorTotal);
    });
    return result;
  }, [workingData, prev3Months]);

  // ---- Hierarchy data ----
  const hierarchyData = useMemo(() => {
    const map = new Map<string, { total: number; mesAtual: number; cats: Map<string, { total: number; mesAtual: number }> }>();
    workingData.forEach((o) => {
      if (!o.tipo || !o.cat) return;
      if (!map.has(o.tipo)) map.set(o.tipo, { total: 0, mesAtual: 0, cats: new Map() });
      const t = map.get(o.tipo)!;
      t.total += o.valorTotal;
      if (o.mesRef === currentMonth) t.mesAtual += o.valorTotal;
      if (!t.cats.has(o.cat)) t.cats.set(o.cat, { total: 0, mesAtual: 0 });
      const c = t.cats.get(o.cat)!;
      c.total += o.valorTotal;
      if (o.mesRef === currentMonth) c.mesAtual += o.valorTotal;
    });
    return Array.from(map.entries())
      .map(([tipo, data]) => ({
        tipo, total: data.total, mesAtual: data.mesAtual,
        cats: Array.from(data.cats.entries())
          .map(([cat, cData]) => ({ cat, total: cData.total, mesAtual: cData.mesAtual }))
          .sort((a, b) => a.cat.localeCompare(b.cat)),
      }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo));
  }, [workingData, currentMonth]);

  // ---- Fornecedores ----
  const fornecedoresData = useMemo(() => {
    const map = new Map<string, { total: number; tipos: Set<string>; orders: Order[] }>();
    currentMonthData.forEach((o) => {
      if (!o.fornecedor || /^\d+$/.test(o.fornecedor)) return;
      if (!map.has(o.fornecedor)) map.set(o.fornecedor, { total: 0, tipos: new Set(), orders: [] });
      const f = map.get(o.fornecedor)!;
      f.total += o.valorTotal;
      if (o.tipo) f.tipos.add(o.tipo);
      f.orders.push(o);
    });
    let result = Array.from(map.entries())
      .map(([name, data]) => {
        const pedidoMap = new Map<string, Order[]>();
        data.orders.forEach((o) => {
          const key = o.codPedido || `avulso-${o.produto}-${o.valorTotal}`;
          if (!pedidoMap.has(key)) pedidoMap.set(key, []);
          pedidoMap.get(key)!.push(o);
        });
        const pedidos = Array.from(pedidoMap.entries()).map(([cod, items]) => ({
          cod,
          total: items.reduce((s, i) => s + i.valorTotal, 0),
          itens: items.length,
          data: items[0].dataPedido,
          items,
        })).sort((a, b) => b.total - a.total);
        return { name, total: data.total, tipos: Array.from(data.tipos), pedidos };
      })
      .sort((a, b) => b.total - a.total);
    if (selectedTipo !== "Todos") {
      result = result.filter((f) => f.tipos.includes(selectedTipo));
    }
    if (fornecedorSearch) {
      const q = fornecedorSearch.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }
    return result;
  }, [currentMonthData, fornecedorSearch, selectedTipo]);

  const FORNECEDOR_PAGE_SIZE = 10;
  const totalFornecedorPages = Math.ceil(fornecedoresData.length / FORNECEDOR_PAGE_SIZE);
  const pagedFornecedores = fornecedoresData.slice((fornecedorPage - 1) * FORNECEDOR_PAGE_SIZE, fornecedorPage * FORNECEDOR_PAGE_SIZE);

  const toggleFornecedor = useCallback((name: string) => {
    setExpandedFornecedor((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }, []);
  const togglePedido = useCallback((key: string) => {
    setExpandedPedido((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);
  const toggleTipo = useCallback((tipo: string) => {
    setExpandedTipo((prev) => { const n = new Set(prev); n.has(tipo) ? n.delete(tipo) : n.add(tipo); return n; });
  }, []);

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in-delayed stagger-1">
        <div>
          <h2 className="text-5xl font-extrabold animate-gradient-text pb-2">
            Bem-vindo, {displayName}
          </h2>
          <p className="text-lg text-muted-foreground mt-3">
            Resumo de gastos do mês de <span className="font-semibold text-foreground">{currentMonthFullLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <InconsistenciasButton />
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setFornecedorPage(1); setSelectedTipo("Todos"); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs glass-button border-0">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {formatMonthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main KPI card + Category chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <PerspectiveCard className="lg:col-span-3 animate-fade-in-delayed stagger-2">
          <div className="glass-card rounded-2xl p-10" style={{ transformStyle: "preserve-3d" }}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                Neste mês, foi gasto o total de:
              </span>
              <DollarSign className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-5xl font-bold tracking-tight text-foreground tabular-nums">
              {formatCurrency(totalMesAtual)}
              <OutlierBadge show={removeOutliers} />
            </p>
            {currentMonthData.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">Nenhum registro encontrado para este mês.</p>
            )}

            {/* Comparisons */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {comparisons.map((c) => (
                <div key={c.key} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">vs {c.label}</span>
                  {c.hasData ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        c.diff !== null && c.diff > 0 ? "text-destructive" : c.diff !== null && c.diff < 0 ? "text-kpi-up" : "text-muted-foreground"
                      )}>
                        {c.diff !== null ? formatCurrency(Math.abs(c.diff)) : "—"}
                      </span>
                      <span className="text-muted-foreground/40">|</span>
                      <div className="flex items-center gap-0.5">
                        {c.diff !== null && c.diff > 0 && <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />}
                        {c.diff !== null && c.diff < 0 && <ArrowDownRight className="h-3.5 w-3.5 text-kpi-up" />}
                        {c.diff !== null && c.diff === 0 && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={cn(
                          "text-sm font-semibold tabular-nums",
                          c.pct !== null && c.pct > 0 ? "text-destructive" : c.pct !== null && c.pct < 0 ? "text-kpi-up" : "text-muted-foreground"
                        )}>
                          {c.pct !== null ? `${c.pct > 0 ? "+" : ""}${c.pct.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem dados</span>
                  )}
                </div>
              ))}
            </div>

            {/* Historical */}
            <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-border/20">
              <div className="flex items-start gap-3">
                <Wallet className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Acumulado</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(historicalStats.totalAcum)}<OutlierBadge show={removeOutliers} /></p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart2 className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Média Mensal</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(historicalStats.mediaMensal)}<OutlierBadge show={removeOutliers} /></p>
                  {totalMesAtual < historicalStats.mediaMensal ? (
                    <p className="text-[11px] text-kpi-up mt-1">
                      Falta {formatCurrency(historicalStats.mediaMensal - totalMesAtual)} para atingir a média mensal
                    </p>
                  ) : (
                    <p className="text-[11px] text-destructive mt-1">
                      Média mensal já atingida (+{formatCurrency(totalMesAtual - historicalStats.mediaMensal)})
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </PerspectiveCard>

        {/* Category chart */}
        <PerspectiveCard className="lg:col-span-2 animate-fade-in-delayed stagger-3">
          <h3 className="text-sm font-semibold text-foreground mb-6">Gastos por Tipo</h3>
          {hierarchyData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma categoria com dados.</p>
          ) : (
            <div className="space-y-1">
              {hierarchyData.filter(t => t.mesAtual > 0).map((tipo) => {
                const tipoOpen = expandedTipo.has(tipo.tipo);
                const maxMesAtual = Math.max(...hierarchyData.filter(t => t.mesAtual > 0).map(t => t.mesAtual), 1);
                const barWidth = maxMesAtual > 0 ? (tipo.mesAtual / maxMesAtual) * 100 : 0;
                return (
                  <div key={tipo.tipo}>
                    <button onClick={() => toggleTipo(tipo.tipo)} className="w-full text-left px-3 py-3 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        {tipoOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="text-sm font-medium text-foreground flex-1">{tipo.tipo}</span>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {prev3Months.map(m => {
                            const prevTotal = prev3Stats.get(m)?.get(tipo.tipo)?.total || 0;
                            if (prevTotal === 0) return null;
                            const pct = tipo.mesAtual > 0 ? ((tipo.mesAtual - prevTotal) / prevTotal) * 100 : null;
                            const up = pct !== null && pct > 0;
                            return (
                              <span key={m} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted border border-border/40 text-muted-foreground whitespace-nowrap">
                                {m}: {formatCurrency(prevTotal)}
                                {pct !== null && (
                                  <span className={cn("font-semibold", up ? "text-destructive" : "text-kpi-up")}>
                                    {" "}{up ? "↑+" : "↓"}{Math.abs(pct).toFixed(1)}%
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        <span className="text-sm tabular-nums text-foreground font-medium ml-2">{formatCurrency(tipo.mesAtual)}</span>
                      </div>
                      <div className="ml-5.5">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-[#714B67] transition-all duration-500" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    </button>
                    {tipoOpen && (
                      <div className="ml-6 space-y-0.5">
                        {tipo.cats.filter(c => c.mesAtual > 0).map((cat) => {
                          const maxCatMes = Math.max(...tipo.cats.map(c => c.mesAtual), 1);
                          const catBarWidth = maxCatMes > 0 ? (cat.mesAtual / maxCatMes) * 100 : 0;
                          return (
                            <div key={cat.cat} className="px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                                <span className="text-sm text-foreground/80 flex-1">{cat.cat}</span>
                                {prev3Months[0] && (() => {
                                  const prevCatTotal = prev3Stats.get(prev3Months[0])?.get(tipo.tipo)?.cats.get(cat.cat) || 0;
                                  if (prevCatTotal === 0) return null;
                                  const pct = cat.mesAtual > 0 ? ((cat.mesAtual - prevCatTotal) / prevCatTotal) * 100 : null;
                                  const up = pct !== null && pct > 0;
                                  return (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted border border-border/40 text-muted-foreground whitespace-nowrap">
                                      {prev3Months[0]}: {formatCurrency(prevCatTotal)}
                                      {pct !== null && (
                                        <span className={cn("font-semibold", up ? "text-destructive" : "text-kpi-up")}>
                                          {" "}{up ? "↑+" : "↓"}{Math.abs(pct).toFixed(1)}%
                                        </span>
                                      )}
                                    </span>
                                  );
                                })()}
                                <span className="text-xs tabular-nums text-muted-foreground ml-1">{formatCurrency(cat.mesAtual)}</span>
                              </div>
                              <div className="ml-3.5">
                                <div className="h-1 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${catBarWidth}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </PerspectiveCard>
      </div>

      {/* Fornecedores do Mês */}
      <TooltipProvider delayDuration={100}>
        <div className="animate-fade-in-delayed stagger-4">
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-foreground mt-4 mb-3">Registros do Mês</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="glass-button flex items-center gap-2 px-3 py-1.5 rounded-xl">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Procurar fornecedor..."
                  value={fornecedorSearch}
                  onChange={(e) => { setFornecedorSearch(e.target.value); setFornecedorPage(1); }}
                  className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground w-[140px]"
                />
              </div>
              {["Todos", ...Array.from(new Set(currentMonthData.map((o) => o.tipo).filter(Boolean))).sort()].map((t) => (
                <button
                  key={t}
                  onClick={() => { setSelectedTipo(t!); setFornecedorPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                    selectedTipo === t
                      ? "bg-primary/20 border border-primary/40 text-primary shadow-sm"
                      : "glass-button text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {pagedFornecedores.map((f, i) => {
              const isOpen = expandedFornecedor.has(f.name);
              return (
                <div key={f.name} className="glass-card rounded-2xl overflow-hidden">
                  <button
                    onClick={() => toggleFornecedor(f.name)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="text-[11px] tabular-nums text-muted-foreground w-5">{(fornecedorPage - 1) * FORNECEDOR_PAGE_SIZE + i + 1}</span>
                    <span className="text-sm font-semibold text-foreground flex-1 text-left truncate">{f.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {f.tipos.map((t) => (
                        <span key={t} className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", getBadgeColor(t))}>
                          {t}
                        </span>
                      ))}
                      <span className="text-sm font-bold tabular-nums text-foreground ml-2">{formatCurrency(f.total)}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border/20">
                      {f.pedidos.map((p) => {
                        const pedidoKey = `${f.name}::${p.cod}`;
                        const pedidoOpen = expandedPedido.has(pedidoKey);
                        return (
                          <div key={p.cod}>
                            <button
                              onClick={() => togglePedido(pedidoKey)}
                              className="w-full flex items-center gap-3 px-8 py-3 hover:bg-muted/20 transition-colors border-t border-border/10"
                            >
                              {pedidoOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <span className="text-sm text-foreground/80 flex-1 text-left font-mono">{p.cod}</span>
                              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                <span>{p.itens} {p.itens === 1 ? "item" : "itens"}</span>
                                <span>{formatDate(p.data)}</span>
                                <span className="text-xs font-semibold tabular-nums text-foreground">{formatCurrency(p.total)}</span>
                              </div>
                            </button>

                            {pedidoOpen && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border/10">
                                      <th className="px-4 pl-14 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cat/SubCat</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Produto</th>
                                      <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Val. Unit.</th>
                                      <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Qtde</th>
                                      <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Val. Total</th>
                                      <th className="px-3 py-2 w-8"></th>
                                      <th className="px-3 py-2 w-8"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.items.map((o, idx) => (
                                      <tr key={idx} className="border-b border-border/5 last:border-0 hover:bg-muted/20 transition-colors">
                                        <td className="px-4 pl-14 py-2.5 text-muted-foreground whitespace-nowrap tabular-nums">{formatDate(o.dataPedido)}</td>
                                        <td className="px-3 py-2.5">
                                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", statusBadge(o.status))}>
                                            {o.status || "—"}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-1 flex-wrap">
                                            {o.cat && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                                                {o.cat}
                                              </span>
                                            )}
                                            {o.subCat && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent-foreground">
                                                {o.subCat}
                                              </span>
                                            )}
                                            {!o.cat && !o.subCat && "—"}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-foreground truncate max-w-[160px]">{o.produto || "—"}</td>
                                        <td className="px-3 py-2.5 tabular-nums text-right text-muted-foreground">{formatCurrency(o.valorUnit)}</td>
                                        <td className="px-3 py-2.5 tabular-nums text-right text-muted-foreground">{o.qtde}</td>
                                        <td className="px-3 py-2.5 tabular-nums text-right text-foreground font-medium">{formatCurrency(o.valorTotal)}</td>
                                        <td className="px-3 py-2.5">
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button type="button" className="inline-flex">
                                                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent side="left" align="center" className="w-72 text-xs space-y-2 z-50">
                                              <div>
                                                <p className="font-semibold text-foreground mb-1">Motivo / Descrição</p>
                                                <p className="text-muted-foreground">{o.descricao || "Sem justificativa/descrição cadastrada"}</p>
                                              </div>
                                              <div>
                                                <p className="font-semibold text-foreground mb-1">Solicitante</p>
                                                <p className="text-muted-foreground">{o.solicitante || "—"}</p>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          {o.nfe && <NfeDownloadButton nfeFileName={o.nfe} />}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {fornecedoresData.length === 0 && (
              <div className="glass-card rounded-2xl py-12 text-center text-sm text-muted-foreground">
                Nenhum fornecedor neste mês
              </div>
            )}
            {totalFornecedorPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-4">
                {Array.from({ length: totalFornecedorPages }, (_, i) => i + 1).map((page) => {
                  const isActive = page === fornecedorPage;
                  return (
                    <button
                      key={page}
                      onClick={() => setFornecedorPage(page)}
                      className={cn(
                        "h-6 w-6 flex items-center justify-center rounded-full text-[10px] font-bold transition-all",
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
