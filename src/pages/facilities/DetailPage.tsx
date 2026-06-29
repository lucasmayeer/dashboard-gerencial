import { useMemo, useState, useCallback, useRef, useEffect, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { useFilters } from "@/lib/filters";
import { formatCurrency, Order, getUniqueValues } from "@/lib/data";
import { BADGE_COLORS, getBadgeColor, statusBadge, formatDate } from "@/lib/facilitiesUtils";
import {
  Search, DollarSign, FileText, Info, Filter as FilterIcon,
  ClipboardList, PackageCheck, FileCheck, Clock, FileX, FilterX, Sheet, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NfeDownloadButton } from "@/components/facilities/NfeDownloadButton";
import { PerspectiveCard } from "@/components/PerspectiveCard";
import { OutlierBadge } from "@/components/facilities/OutlierBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from "xlsx";

const ROW_HEIGHT = 41;
const BUFFER = 20;

// Memoized table row
const OrderRow = memo(({ o, idx, inconsistency }: { o: Order; idx: number; inconsistency?: { type: string, message: string } }) => (
  <tr key={`${o.codPedido}-${o.idProd}-${idx}`} className={cn("border-b border-border/10 transition-colors", inconsistency ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/20")}>
    <td className="px-4 py-2.5">
      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", statusBadge(o.status))}>
        {o.status || "—"}
      </span>
    </td>
    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatDate(o.dataPedido)}</td>
    <td className="px-4 py-2.5">
      <div className="flex flex-wrap gap-1">
        {o.tipo && <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", getBadgeColor(o.tipo))}>{o.tipo}</span>}
        {o.cat && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">{o.cat}</span>}
        {o.subCat && <span className="px-1.5 py-0.5 rounded text-[9px] bg-muted/50 text-muted-foreground">{o.subCat}</span>}
      </div>
    </td>
    <td className="px-4 py-2.5 text-foreground max-w-[200px]" title={o.produto}>
      <div className="truncate">{o.produto || "—"}</div>
      {inconsistency && (
        <div className="mt-1 flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-500 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded w-max max-w-full">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
          <span className="leading-tight break-words whitespace-normal">{inconsistency.message}</span>
        </div>
      )}
    </td>
    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{o.qtde ?? "—"}</td>
    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(o.valorUnit)}</td>
    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{o.valorFrete > 0 ? formatCurrency(o.valorFrete) : "—"}</td>
    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground">{formatCurrency(o.valorTotal)}</td>
    <td className="px-4 py-2.5 text-center">
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-xs space-y-2">
          <div>
            <p className="font-semibold text-foreground mb-1">Motivo / Descrição</p>
            <p className="text-muted-foreground">{o.descricao || "Sem justificativa/descrição cadastrada"}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Solicitante</p>
            <p className="text-muted-foreground">{o.solicitante || "—"}</p>
          </div>
          {o.fornecedor && (
            <div>
              <p className="font-semibold text-foreground mb-1">Fornecedor</p>
              <p className="text-muted-foreground">{o.fornecedor}</p>
            </div>
          )}
          {o.codPedido && (
            <div>
              <p className="font-semibold text-foreground mb-1">Cód. Pedido</p>
              <p className="text-muted-foreground">{o.codPedido}</p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </td>
    <td className="px-4 py-2.5 text-center">
      {o.nfe ? (
        <NfeDownloadButton nfeFileName={o.nfe} />
      ) : (
        <FileText className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />
      )}
    </td>
  </tr>
));
OrderRow.displayName = "OrderRow";

export function DetailPage() {
  const { allData, removeOutliers, validationReport } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [localSolicitante, setLocalSolicitante] = useState("Todos");
  const [localTipo, setLocalTipo] = useState("Todos");
  const [filterPendentes, setFilterPendentes] = useState(false);
  const [filterSemNfe, setFilterSemNfe] = useState(false);
  const [filterInconsistencias, setFilterInconsistencias] = useState(false);
  const [selectedYear, setSelectedYear] = useState("Todos");
  const [selectedMonth, setSelectedMonth] = useState("Todos");

  // Read query param for inconsistencies filter
  useEffect(() => {
    if (searchParams.get("inconsistencias") === "true") {
      setFilterInconsistencias(true);
      // Clean up URL
      searchParams.delete("inconsistencias");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const inconsistenciesMap = useMemo(() => {
    if (!validationReport || !filterInconsistencias) return new Map();
    const map = new Map();
    validationReport.inconsistencies.forEach(inc => {
      // Use codPedido and idProd as the strict universal key
      const key = `${inc.order.codPedido}-${inc.order.idProd}`;
      map.set(key, inc);
    });
    return map;
  }, [validationReport, filterInconsistencias]);

  // Virtualization state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const solicitantes = useMemo(() => ["Todos", ...getUniqueValues(allData, "solicitante")], [allData]);
  const tipos = useMemo(() => ["Todos", ...getUniqueValues(allData, "tipo")], [allData]);

  const yearMonthMap = useMemo(() => {
    const all = getUniqueValues(allData, "mesRef");
    const sorted = all.sort((a, b) => {
      const [mA, yA] = a.split("/").map(Number);
      const [mB, yB] = b.split("/").map(Number);
      return yA !== yB ? yA - yB : mA - mB;
    });
    const groups = new Map<string, string[]>();
    sorted.forEach(m => {
      const y = m.split("/")[1];
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y)!.push(m);
    });
    return groups;
  }, [allData]);

  const years = useMemo(() => ["Todos", ...Array.from(yearMonthMap.keys())], [yearMonthMap]);
  const availableMonths = useMemo(() => {
    if (selectedYear === "Todos") return [];
    return yearMonthMap.get(selectedYear) || [];
  }, [selectedYear, yearMonthMap]);

  // Use allData directly (period validation now handled by dataValidation engine)
  const validData = allData;

  const localFiltered = useMemo(() => {
    let data = [...validData];

    // Filter inconsistencies
    if (filterInconsistencias && validationReport) {
      data = data.filter((o) => inconsistenciesMap.has(`${o.codPedido}-${o.idProd}`));
    }

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(o =>
        o.fornecedor.toLowerCase().includes(q) ||
        o.produto.toLowerCase().includes(q) ||
        o.descricao.toLowerCase().includes(q) ||
        o.codPedido.toLowerCase().includes(q) ||
        o.solicitante.toLowerCase().includes(q)
      );
    }
    if (localSolicitante !== "Todos") data = data.filter(o => o.solicitante === localSolicitante);
    if (selectedYear !== "Todos") {
      if (selectedMonth !== "Todos") {
        data = data.filter(o => o.mesRef === selectedMonth);
      } else {
        data = data.filter(o => o.mesRef?.split("/")[1] === selectedYear);
      }
    }
    if (localTipo !== "Todos") data = data.filter(o => o.tipo === localTipo);
    if (filterPendentes) data = data.filter(o => o.status === "Pendente");
    if (filterSemNfe) data = data.filter(o => !o.nfe);
    return data.sort((a, b) => {
      const da = a.dataPedido ? a.dataPedido.getTime() : 0;
      const db = b.dataPedido ? b.dataPedido.getTime() : 0;
      return db - da;
    });
  }, [validData, search, localSolicitante, selectedYear, selectedMonth, localTipo, filterPendentes, filterSemNfe, filterInconsistencias, validationReport]);

  const summary = useMemo(() => {
    const valorTotal = localFiltered.reduce((s, o) => s + o.valorTotal, 0);
    const pedidos = new Set(localFiltered.map(o => o.codPedido).filter(Boolean));
    const entregues = localFiltered.filter(o => o.status === "Entregue").length;
    const comNfe = localFiltered.filter(o => o.nfe).length;
    const pendentes = localFiltered.filter(o => o.status === "Pendente").length;
    const semNfe = localFiltered.filter(o => !o.nfe).length;
    return { valorTotal, pedidos: pedidos.size, entregues, comNfe, pendentes, semNfe };
  }, [localFiltered]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setLocalSolicitante("Todos");
    setLocalTipo("Todos");
    setSelectedYear("Todos");
    setSelectedMonth("Todos");
    setFilterPendentes(false);
    setFilterSemNfe(false);
    setFilterInconsistencias(false);
  }, []);

  const hasActiveFilters = search || localSolicitante !== "Todos" || localTipo !== "Todos" || selectedYear !== "Todos" || filterPendentes || filterSemNfe || filterInconsistencias;

  const exportXlsx = useCallback(() => {
    const rows = localFiltered.map(o => ({
      "Status": o.status,
      "Data": o.dataPedido ? o.dataPedido.toLocaleDateString("pt-BR") : "",
      "Tipo": o.tipo,
      "Categoria": o.cat,
      "SubCategoria": o.subCat,
      "Produto": o.produto,
      "Qtde": o.qtde,
      "Valor Unitário": o.valorUnit,
      "Valor Frete": o.valorFrete,
      "Valor Total": o.valorTotal,
      "Solicitante": o.solicitante,
      "Fornecedor": o.fornecedor,
      "Cód. Pedido": o.codPedido,
      "Mês Ref": o.mesRef,
      "NFe": o.nfe || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, `detalhamento_pedidos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [localFiltered]);

  // Virtualization
  const containerHeight = 720;
  const totalHeight = localFiltered.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endIndex = Math.min(localFiltered.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER);
  const visibleRows = localFiltered.slice(startIndex, endIndex);
  const paddingTop = startIndex * ROW_HEIGHT;
  const paddingBottom = Math.max(0, (localFiltered.length - endIndex) * ROW_HEIGHT);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div className="animate-fade-in-delayed stagger-1">
        <h2 className="text-5xl font-extrabold animate-gradient-text pb-2">
          Detalhamento dos Pedidos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Entendendo mais a fundo os itens comprados
        </p>
      </div>

      {/* KPI Cards */}
      <TooltipProvider delayDuration={100}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in-delayed stagger-2">
          {/* 1. Valor Total */}
          <PerspectiveCard>
            <div className="glass-card rounded-2xl p-5 text-center h-full" style={{ transformStyle: "preserve-3d" }}>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Valor Total</p>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(summary.valorTotal)}</p>
            </div>
          </PerspectiveCard>

          {/* 2. Pedidos Solicitados */}
          <PerspectiveCard>
            <div className="glass-card rounded-2xl p-5 text-center h-full" style={{ transformStyle: "preserve-3d" }}>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Solicitados</p>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{summary.pedidos}</p>
            </div>
          </PerspectiveCard>

          {/* 3. Entregues */}
          <PerspectiveCard>
            <div className="glass-card rounded-2xl p-5 text-center h-full" style={{ transformStyle: "preserve-3d" }}>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <PackageCheck className="h-3.5 w-3.5 text-kpi-up/60" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entregues</p>
              </div>
              <p className="text-xl font-bold text-kpi-up tabular-nums">{summary.entregues}</p>
            </div>
          </PerspectiveCard>

          {/* 4. Com NFe */}
          <PerspectiveCard>
            <div className="glass-card rounded-2xl p-5 text-center h-full" style={{ transformStyle: "preserve-3d" }}>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <FileCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Com NFe</p>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{summary.comNfe}</p>
            </div>
          </PerspectiveCard>

          {/* 5. Pendentes (filterable) */}
          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <PerspectiveCard>
                  <div
                    onClick={() => setFilterPendentes(!filterPendentes)}
                    className={cn(
                      "glass-card rounded-2xl p-5 text-center h-full cursor-pointer transition-all",
                      filterPendentes && "ring-2 ring-status-pending/40"
                    )}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <Clock className="h-3.5 w-3.5 text-status-pending/60" />
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pendentes</p>
                      <FilterIcon className={cn("h-2.5 w-2.5 transition-colors", filterPendentes ? "text-status-pending" : "text-muted-foreground/30")} />
                    </div>
                    <p className="text-xl font-bold text-status-pending tabular-nums">{summary.pendentes}</p>
                  </div>
                </PerspectiveCard>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Pressione para filtrar pedidos pendentes</p>
            </TooltipContent>
          </UITooltip>

          {/* 6. Sem NFe (filterable) */}
          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <PerspectiveCard>
                  <div
                    onClick={() => setFilterSemNfe(!filterSemNfe)}
                    className={cn(
                      "glass-card rounded-2xl p-5 text-center h-full cursor-pointer transition-all",
                      filterSemNfe && "ring-2 ring-primary/40"
                    )}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <FileX className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sem NFe</p>
                      <FilterIcon className={cn("h-2.5 w-2.5 transition-colors", filterSemNfe ? "text-primary" : "text-muted-foreground/30")} />
                    </div>
                    <p className={cn("text-xl font-bold tabular-nums", filterSemNfe ? "text-primary" : "text-foreground")}>{summary.semNfe}</p>
                  </div>
                </PerspectiveCard>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Pressione para filtrar itens sem nota fiscal</p>
            </TooltipContent>
          </UITooltip>
        </div>
      </TooltipProvider>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-5 animate-fade-in-delayed stagger-3">
        <div className="flex flex-wrap items-end gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Pesquisar</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar pedidos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-transparent border-0 rounded-xl glass-button"
              />
            </div>
          </div>

          {/* Solicitante */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Solicitante</span>
            <select value={localSolicitante} onChange={e => setLocalSolicitante(e.target.value)} className="glass-button rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer">
              {solicitantes.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Tipo - segmented buttons */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tipo</span>
            <div className="flex gap-1">
              {tipos.map(t => (
                <button
                  key={t}
                  onClick={() => setLocalTipo(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                    localTipo === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "glass-button text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Ano */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ano</span>
            <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedMonth("Todos"); }} className="glass-button rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer">
              {years.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Mês (conditional) */}
          {selectedYear !== "Todos" && availableMonths.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Mês</span>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="glass-button rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer">
                <option value="Todos">Todos</option>
                {availableMonths.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* Actions: Clear & Export as icons */}
          <TooltipProvider delayDuration={200}>
            <div className="flex gap-2 ml-auto">
              <UITooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className={cn(
                      "glass-button rounded-xl p-2 transition-colors",
                      hasActiveFilters
                        ? "text-foreground hover:bg-destructive/10 hover:text-destructive"
                        : "text-muted-foreground/40 cursor-not-allowed opacity-50"
                    )}
                  >
                    <FilterX className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Clique aqui para limpar os filtros</p>
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={exportXlsx}
                    className="glass-button rounded-xl p-2 text-foreground hover:bg-primary/10 transition-colors"
                  >
                    <Sheet className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Exportar para XLSX</p>
                </TooltipContent>
              </UITooltip>
            </div>
          </TooltipProvider>
        </div>

        <p className="text-xs text-muted-foreground mt-3">{localFiltered.length} registro{localFiltered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Inconsistency filter toggle */}
      {validationReport && validationReport.inconsistencies.length > 0 && (
        <button
          onClick={() => setFilterInconsistencias(!filterInconsistencias)}
          className={cn(
            "glass-button flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all",
            filterInconsistencias && "ring-2 ring-amber-400/40"
          )}
        >
          <AlertTriangle className={cn("h-3.5 w-3.5", filterInconsistencias ? "text-amber-400" : "text-muted-foreground")} />
          Filtrar Inconsistências
          <span className="tabular-nums text-muted-foreground">({validationReport.inconsistencies.length})</span>
        </button>
      )}

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in-delayed stagger-4">
        <div className="overflow-x-auto">
          <div ref={scrollRef} className="max-h-[720px] overflow-y-auto" style={{ willChange: "transform" }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border/20 bg-muted/50 backdrop-blur-sm">
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tipo / Cat / SubCat</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Produto</th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Qtde</th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Val. Unit.</th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Val. Frete</th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Val. Total</th>
                  <th className="px-4 py-3 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Info</th>
                  <th className="px-4 py-3 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider">NFe</th>
                </tr>
              </thead>
              <tbody>
                {localFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  <>
                    {paddingTop > 0 && (
                      <tr style={{ height: paddingTop }} aria-hidden="true"><td colSpan={10} /></tr>
                    )}
                    {visibleRows.map((o, i) => (
                      <OrderRow
                        key={`${o.codPedido}-${o.idProd}-${startIndex + i}`}
                        o={o}
                        idx={startIndex + i}
                        inconsistency={inconsistenciesMap.get(`${o.codPedido}-${o.idProd}`)}
                      />
                    ))}
                    {paddingBottom > 0 && (
                      <tr style={{ height: paddingBottom }} aria-hidden="true"><td colSpan={10} /></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
