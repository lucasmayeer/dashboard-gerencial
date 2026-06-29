import { useMemo, useState, useCallback } from "react";
import { useFilters } from "@/lib/filters";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, Order } from "@/lib/data";
import { MONTH_NAMES, YEAR_COLORS, capitalize, statusBadge, formatDate, OUTLIER_THRESHOLD } from "@/lib/facilitiesUtils";
import { InconsistenciasButton } from "@/components/facilities/InconsistenciasButton";
import {
  ArrowUpRight, ArrowDownRight, Minus, Search, DollarSign,
  ChevronRight, ChevronDown, BarChart2, Info, ShoppingCart,
} from "lucide-react";
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

export function OverviewPage() {
  const { allData, removeOutliers } = useFilters();
  const { profile, user } = useAuth();
  const [fornecedorSearch, setFornecedorSearch] = useState("");
  const [expandedFornecedor, setExpandedFornecedor] = useState<Set<string>>(new Set());
  const [expandedPedido, setExpandedPedido] = useState<Set<string>>(new Set());
  const [expandedTipo, setExpandedTipo] = useState<Set<string>>(new Set());
  const [selectedTipo, setSelectedTipo] = useState("Todos");
  const [fornecedorPage, setFornecedorPage] = useState(1);

  const rawName = (profile?.display_name || user?.email || "").split("@")[0] || "Usuário";
  const displayName = capitalize(rawName);

  // Use allData but respect outliers from global context
  const workingData = useMemo(() => {
    if (!removeOutliers) return allData;
    return allData.filter(o => o.valorTotal <= OUTLIER_THRESHOLD);
  }, [allData, removeOutliers]);

  // ---- Period range ----
  const periodRange = useMemo(() => {
    const validFormat = /^\d{2}\/\d{4}$/;
    const months = workingData.map((o) => o.mesRef).filter((m) => validFormat.test(m)).sort((a, b) => {
      const [mA, yA] = a.split("/").map(Number);
      const [mB, yB] = b.split("/").map(Number);
      return yA !== yB ? yA - yB : mA - mB;
    });
    if (!months.length) return "—";
    const format = (ref: string) => {
      const [m, y] = ref.split("/").map(Number);
      if (isNaN(m) || isNaN(y) || m < 1 || m > 12) return "—";
      return `${MONTH_NAMES[m - 1]}/${y}`;
    };
    return `${format(months[0])} até ${format(months[months.length - 1])}`;
  }, [workingData]);

  // ---- Year-based stats ----
  const yearStats = useMemo(() => {
    const byYear = new Map<number, number>();
    workingData.forEach((o) => {
      if (!o.mesRef) return;
      const [, yStr] = o.mesRef.split("/");
      const year = Number(yStr);
      if (isNaN(year)) return;
      byYear.set(year, (byYear.get(year) || 0) + o.valorTotal);
    });
    const years = Array.from(byYear.keys()).sort();
    return years.map((y, i) => {
      const total = byYear.get(y)!;
      const prev = i > 0 ? byYear.get(years[i - 1])! : null;
      const pct = prev !== null && prev > 0 ? ((total - prev) / prev) * 100 : null;
      const diff = prev !== null ? total - prev : null;
      return { year: y, total, diff, pct };
    });
  }, [workingData]);

  const totalGasto = useMemo(() => workingData.reduce((s, o) => s + o.valorTotal, 0), [workingData]);

  // ---- Media Anual + Ticket Medio ----
  const bottomCards = useMemo(() => {
    const byYear = new Map<number, number>();
    const pedidos = new Set<string>();
    workingData.forEach((o) => {
      if (!o.mesRef) return;
      const [, yStr] = o.mesRef.split("/");
      const year = Number(yStr);
      if (!isNaN(year)) byYear.set(year, (byYear.get(year) || 0) + o.valorTotal);
      if (o.codPedido) pedidos.add(o.codPedido);
    });
    const yearCount = byYear.size || 1;
    const totalForAvg = Array.from(byYear.values()).reduce((s, v) => s + v, 0);
    const mediaAnual = totalForAvg / yearCount;
    const ticketMedio = pedidos.size > 0 ? totalGasto / pedidos.size : 0;
    return { mediaAnual, ticketMedio, pedidosUnicos: pedidos.size };
  }, [workingData, totalGasto]);

  // ---- Hierarchy data (Tipo → Cat) with year breakdown for chart ----
  const hierarchyData = useMemo(() => {
    const map = new Map<string, { total: number; byYear: Map<number, number>; cats: Map<string, { total: number; byYear: Map<number, number> }> }>();
    workingData.forEach((o) => {
      if (!o.tipo || !o.cat) return;
      const [, yStr] = (o.mesRef || "").split("/");
      const year = Number(yStr);
      if (!map.has(o.tipo)) map.set(o.tipo, { total: 0, byYear: new Map(), cats: new Map() });
      const t = map.get(o.tipo)!;
      t.total += o.valorTotal;
      if (!isNaN(year)) t.byYear.set(year, (t.byYear.get(year) || 0) + o.valorTotal);
      if (!t.cats.has(o.cat)) t.cats.set(o.cat, { total: 0, byYear: new Map() });
      const c = t.cats.get(o.cat)!;
      c.total += o.valorTotal;
      if (!isNaN(year)) c.byYear.set(year, (c.byYear.get(year) || 0) + o.valorTotal);
    });
    return Array.from(map.entries())
      .map(([tipo, data]) => ({
        tipo, total: data.total, byYear: data.byYear,
        cats: Array.from(data.cats.entries())
          .map(([cat, cData]) => ({ cat, total: cData.total, byYear: cData.byYear }))
          .sort((a, b) => a.cat.localeCompare(b.cat)),
      }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo));
  }, [workingData]);

  const allYears = useMemo(() => {
    const s = new Set<number>();
    workingData.forEach((o) => { const [, y] = (o.mesRef || "").split("/"); const n = Number(y); if (!isNaN(n)) s.add(n); });
    return Array.from(s).sort();
  }, [workingData]);

  // ---- Fornecedores with cascading pedidos → itens + year badges ----
  const fornecedoresData = useMemo(() => {
    const map = new Map<string, { total: number; tipos: Set<string>; orders: Order[]; byYear: Map<number, number> }>();
    workingData.forEach((o) => {
      if (!o.fornecedor || /^\d+$/.test(o.fornecedor)) return;
      if (!map.has(o.fornecedor)) map.set(o.fornecedor, { total: 0, tipos: new Set(), orders: [], byYear: new Map() });
      const f = map.get(o.fornecedor)!;
      f.total += o.valorTotal;
      if (o.tipo) f.tipos.add(o.tipo);
      f.orders.push(o);
      const [, yStr] = (o.mesRef || "").split("/");
      const year = Number(yStr);
      if (!isNaN(year)) f.byYear.set(year, (f.byYear.get(year) || 0) + o.valorTotal);
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
        return { name, total: data.total, tipos: Array.from(data.tipos), pedidos, byYear: data.byYear };
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
  }, [workingData, fornecedorSearch, selectedTipo]);

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
      <div className="animate-fade-in-delayed stagger-1">
        <div className="flex items-center justify-between">
          <h2 className="text-5xl font-extrabold animate-gradient-text pb-2">
            Agora, você vê tudo
          </h2>
          <InconsistenciasButton />
        </div>
        <p className="text-lg text-muted-foreground mt-3">
          Resumo de gastos do período <span className="font-semibold text-foreground">{periodRange}</span>
        </p>
      </div>

      {/* Main KPI card + Category chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* KPI Card - 3 cols */}
        <PerspectiveCard className="lg:col-span-3 animate-fade-in-delayed stagger-2">
          <div className="glass-card rounded-2xl p-10" style={{ transformStyle: "preserve-3d" }}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                No histórico, foi gasto o total de:
              </span>
              <DollarSign className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-5xl font-bold tracking-tight text-foreground tabular-nums">
              {formatCurrency(totalGasto)}
              <OutlierBadge show={removeOutliers} />
            </p>

            {/* Year comparisons */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {yearStats.map((ys) => (
                <div key={ys.year} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-semibold">{ys.year}</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(ys.total)}</span>
                  {ys.pct !== null ? (
                    <div className="flex items-center gap-1">
                      {ys.diff! > 0 && <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />}
                      {ys.diff! < 0 && <ArrowDownRight className="h-3.5 w-3.5 text-kpi-up" />}
                      {ys.diff === 0 && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        ys.pct > 0 ? "text-destructive" : ys.pct < 0 ? "text-kpi-up" : "text-muted-foreground"
                      )}>
                        {ys.pct > 0 ? "+" : ""}{ys.pct.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">vs {ys.year - 1}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom cards */}
            <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-border/20">
              <div className="flex items-start gap-3">
                <BarChart2 className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Média Anual</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(bottomCards.mediaAnual)}<OutlierBadge show={removeOutliers} /></p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShoppingCart className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ticket Médio por Pedido</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(bottomCards.ticketMedio)}<OutlierBadge show={removeOutliers} /></p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {bottomCards.pedidosUnicos.toLocaleString("pt-BR")} pedidos únicos
                  </p>
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
              {hierarchyData.map((tipo) => {
                const tipoOpen = expandedTipo.has(tipo.tipo);
                return (
                  <div key={tipo.tipo}>
                    <button onClick={() => toggleTipo(tipo.tipo)} className="w-full text-left px-3 py-3 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        {tipoOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="text-sm font-medium text-foreground flex-1">{tipo.tipo}</span>
                        <span className="text-sm tabular-nums text-foreground font-medium">{formatCurrency(tipo.total)}</span>
                      </div>
                      {/* Stacked bar */}
                      <div className="ml-5.5 relative group/bar">
                        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                          {allYears.map((y) => {
                            const val = tipo.byYear.get(y) || 0;
                            const pct = tipo.total > 0 ? (val / tipo.total) * 100 : 0;
                            if (pct === 0) return null;
                            return (
                              <div key={y} className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: YEAR_COLORS[y] || "hsl(200,50%,50%)" }} />
                            );
                          })}
                        </div>
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block z-50">
                          <div className="glass-card rounded-xl px-5 py-4 text-xs shadow-lg border border-border/30 min-w-[220px]">
                            <p className="font-bold text-sm text-foreground mb-3">{tipo.tipo}</p>
                            <div className="space-y-2.5">
                              {allYears.map((y, idx) => {
                                const val = tipo.byYear.get(y) || 0;
                                if (val === 0) return null;
                                const prevYear = idx > 0 ? allYears[idx - 1] : null;
                                const prevVal = prevYear ? (tipo.byYear.get(prevYear) || 0) : 0;
                                const pctChange = prevYear && prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : null;
                                return (
                                  <div key={y} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: YEAR_COLORS[y] }} />
                                      <span className="font-semibold text-foreground">{y}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="tabular-nums font-medium text-foreground">{formatCurrency(val)}</span>
                                      {pctChange !== null && (
                                        <span className={cn("text-[10px] font-bold tabular-nums flex items-center gap-0.5", pctChange > 0 ? "text-destructive" : "text-kpi-up")}>
                                          {pctChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                          {pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                    {tipoOpen && (
                      <div className="ml-6 space-y-0.5">
                        {tipo.cats.map((cat) => (
                          <div key={cat.cat} className="px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                              <span className="text-sm text-foreground/80 flex-1">{cat.cat}</span>
                              <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(cat.total)}</span>
                            </div>
                            <div className="ml-3.5 relative group/catbar">
                              <div className="h-1 rounded-full bg-muted overflow-hidden flex">
                                {allYears.map((y) => {
                                  const val = cat.byYear.get(y) || 0;
                                  const pct = cat.total > 0 ? (val / cat.total) * 100 : 0;
                                  if (pct === 0) return null;
                                  return (
                                    <div key={y} className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: YEAR_COLORS[y] || "hsl(200,50%,50%)" }} />
                                  );
                                })}
                              </div>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/catbar:block z-50">
                                <div className="glass-card rounded-xl px-5 py-4 text-xs shadow-lg border border-border/30 min-w-[200px]">
                                  <p className="font-bold text-sm text-foreground mb-3">{cat.cat}</p>
                                  <div className="space-y-2.5">
                                    {allYears.map((y, idx) => {
                                      const val = cat.byYear.get(y) || 0;
                                      if (val === 0) return null;
                                      const prevYear = idx > 0 ? allYears[idx - 1] : null;
                                      const prevVal = prevYear ? (cat.byYear.get(prevYear) || 0) : 0;
                                      const pctChange = prevYear && prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : null;
                                      return (
                                        <div key={y} className="flex items-center justify-between gap-4">
                                          <div className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: YEAR_COLORS[y] }} />
                                            <span className="font-semibold text-foreground">{y}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="tabular-nums font-medium text-foreground">{formatCurrency(val)}</span>
                                            {pctChange !== null && (
                                              <span className={cn("text-[10px] font-bold tabular-nums flex items-center gap-0.5", pctChange > 0 ? "text-destructive" : "text-kpi-up")}>
                                                {pctChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                {pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 ml-3 text-[10px] text-muted-foreground">
            {allYears.map((y) => (
              <span key={y} className="flex items-center gap-1.5">
                <span className="h-2 w-6 rounded-full inline-block" style={{ backgroundColor: YEAR_COLORS[y] || "hsl(200,50%,50%)" }} />
                {y}
              </span>
            ))}
          </div>
        </PerspectiveCard>
      </div>

      {/* Registros de Compras */}
      <TooltipProvider delayDuration={100}>
        <div className="animate-fade-in-delayed stagger-4">
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-foreground mt-4 mb-3">Registros de Compras</h3>
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
              {["Todos", ...Array.from(new Set(workingData.map((o) => o.tipo).filter(Boolean))).sort()].map((t) => (
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
                      {allYears.map((y) => {
                        const val = f.byYear.get(y) || 0;
                        if (val === 0) return null;
                        return (
                          <span key={y} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: YEAR_COLORS[y] || "#888" }}>
                            {y}: {formatCurrency(val)}
                          </span>
                        );
                      })}
                      <span className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(f.total)}</span>
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
                                          {(o.descricao || o.solicitante) && (
                                            <UITooltip>
                                              <TooltipTrigger asChild>
                                                <button type="button" className="inline-flex">
                                                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="left" align="center" className="max-w-[300px] z-50">
                                                {o.descricao && <p className="text-xs mb-1"><span className="font-medium">Despesa:</span> {o.descricao}</p>}
                                                {o.solicitante && <p className="text-xs"><span className="font-medium">Solicitante:</span> {o.solicitante}</p>}
                                              </TooltipContent>
                                            </UITooltip>
                                          )}
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
                Nenhum fornecedor encontrado
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
