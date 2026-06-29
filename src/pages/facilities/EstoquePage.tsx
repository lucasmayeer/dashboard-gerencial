import { useState, useMemo, useRef, useEffect } from "react";
import { extractPatrimonialId, formatCurrency } from "@/lib/data";
import {
  CategoryData,
  FilterMode,
  TypeFilter,
  getConfig,
  groupLabel,
  typeBadgeClass,
  classifyItem,
  splitEquipmentName,
} from "@/lib/estoquUtils";
import { useEquipmentData } from "@/hooks/useEquipmentData";
import { PerspectiveCard } from "@/components/PerspectiveCard";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Laptop,
  Wifi,
  Package,
  AlertTriangle,
  Search,
  Info,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Animation sequencing:
// HIDE:  zoom-out (350ms) → remove from grid after fade → grid reflows
// SHOW:  add to grid (invisible) → wait for grid reflow (500ms) → zoom-in
//
// Key insight: visible cards must delay zoom-in long enough for ALL hiding cards
// to be removed from the DOM first, so the grid reflows before we zoom in.
function AnimatedCard({
  children,
  visible,
}: {
  children: React.ReactNode;
  visible: boolean;
}) {
  const [displayed, setDisplayed] = useState(visible);
  const [revealed, setRevealed] = useState(visible);
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t1.current) clearTimeout(t1.current);
    if (t2.current) clearTimeout(t2.current);

    if (visible) {
      setDisplayed(true);
      t2.current = setTimeout(() => setRevealed(true), 500);
    } else {
      setRevealed(false);
      t1.current = setTimeout(() => setDisplayed(false), 400);
    }
    return () => {
      if (t1.current) clearTimeout(t1.current);
      if (t2.current) clearTimeout(t2.current);
    };
  }, [visible]);

  if (!displayed) return null;

  return (
    <div
      style={{
        transform: revealed ? "scale(1)" : "scale(0.84)",
        opacity: revealed ? 1 : 0,
        transition: revealed
          ? "transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease"
          : "transform 0.35s cubic-bezier(0.4,0,0.6,0), opacity 0.3s ease",
        pointerEvents: revealed ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

interface CategoryCardProps {
  cat: CategoryData;
  onOpenModal: (name: string) => void;
  onOpenModelModal: (cat: CategoryData) => void;
}

function CategoryCard({ cat, onOpenModal, onOpenModelModal }: CategoryCardProps) {
  const Icon = cat.config.icon;
  const cfg = cat.config;
  const isGroup2 = cfg.group === 2;

  return (
    <PerspectiveCard className="glass-card rounded-3xl p-4 flex flex-col min-h-[240px]">
      {/* Top row: right-side stacked badges */}
      <div className="flex items-start justify-end gap-1.5 mb-1.5">
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-lg", typeBadgeClass(cfg.group))}>
          {groupLabel(cfg.group)}
        </span>
        <span
          className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-lg"
          style={{ background: "rgba(228,169,0,0.18)", color: "#B8860B" }}
        >
          {cat.total} {cat.total === 1 ? "item" : "itens"}
        </span>
      </div>

      {/* Title row: icon + name */}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm font-semibold text-foreground leading-tight">{cat.name}</p>
      </div>

      {/* Count-only cards (Locker/Parking/Books) */}
      {cfg.showCountOnly ? (
        <>
          <p className="text-xl font-bold text-foreground mb-2 tabular-nums">
            {cat.total} {cfg.countLabel}
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground mb-auto">
            <p>{cfg.labels.employee}: <span className="font-medium text-foreground">{cat.withEmployee}</span></p>
            <p>{cfg.labels.stock}: <span className="font-medium text-foreground">{cat.inStock}</span></p>
          </div>
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-foreground mb-2 tabular-nums">{formatCurrency(cat.totalValue)}</p>

          <div className="space-y-1.5 mb-auto">
            {isGroup2 ? (
              cfg.showModelVariation && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Modelos: <span className="font-medium text-foreground tabular-nums">{cat.modelCount}</span></span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenModelModal(cat); }}
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {cfg.showAvg ? (
                  <p>Média: <span className="font-medium text-foreground tabular-nums">{formatCurrency(cat.avgValue)}</span></p>
                ) : (
                  <p></p>
                )}
                {cfg.showModelVariation ? (
                  <div className="flex items-center gap-1">
                    <span>Modelos: <span className="font-medium text-foreground tabular-nums">{cat.modelCount}</span></span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenModelModal(cat); }}
                      className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-muted/50 transition-colors"
                    >
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <p></p>
                )}
              </div>
            )}

            {!isGroup2 && (
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>{cfg.labels.employee}: <span className="font-medium text-foreground">{cat.withEmployee}</span></p>
                <p>{cfg.labels.stock}: <span className="font-medium text-foreground">{cat.inStock}</span></p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer: Ver Estoque button */}
      <div className="border-t border-border/10 pt-2.5 mt-auto">
        <button
          onClick={() => onOpenModal(cat.name)}
          className="w-full text-center py-2 rounded-2xl transition-all hover:bg-white/[0.04]"
          style={{
            background: "rgba(0,0,0,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <span className="font-bold tracking-wide text-sm animate-gradient-text">Verificar o Estoque</span>
        </button>
      </div>
    </PerspectiveCard>
  );
}

export function EstoquePage() {
  const { equipment, loading, validations } = useEquipmentData();
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [validationOpen, setValidationOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalFilter, setModalFilter] = useState<FilterMode>("all");
  const [modelModalCategory, setModelModalCategory] = useState<CategoryData | null>(null);

  const filtered = useMemo(() => {
    let result = equipment;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.funcionario.toLowerCase().includes(q) ||
          e.nomeEquipamento.toLowerCase().includes(q) ||
          e.modelo.toLowerCase().includes(q)
      );
    }
    if (filterMode === "instock") {
      result = result.filter((e) => classifyItem(e, getConfig(e.categoria)) === "stock");
    }
    if (filterMode === "employee") {
      result = result.filter((e) => classifyItem(e, getConfig(e.categoria)) === "employee");
    }
    return result;
  }, [equipment, search, filterMode]);

  const categories = useMemo(() => {
    const catMap = new Map<string, typeof equipment>();
    filtered.forEach((e) => {
      const cat = e.categoria || "Sem Categoria";
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(e);
    });

    const result: CategoryData[] = [];
    catMap.forEach((items, name) => {
      const cfg = getConfig(name);
      const totalValue = items.reduce((s, i) => s + i.custo, 0);
      const withEmployee = items.filter((i) => classifyItem(i, cfg) === "employee").length;
      const inStock = items.filter((i) => classifyItem(i, cfg) === "stock").length;

      const modelMap = new Map<string, { total: number; count: number }>();
      items.forEach((i) => {
        const m = i.modelo || "Sem modelo";
        if (!modelMap.has(m)) modelMap.set(m, { total: 0, count: 0 });
        const entry = modelMap.get(m)!;
        entry.total += i.custo;
        entry.count += 1;
      });
      const modelBreakdown = Array.from(modelMap.entries())
        .map(([model, data]) => ({
          model,
          avgCost: data.count > 0 ? data.total / data.count : 0,
          count: data.count,
        }))
        .sort((a, b) => b.count - a.count);

      result.push({
        name, totalValue,
        avgValue: items.length > 0 ? totalValue / items.length : 0,
        withEmployee, inStock, total: items.length, items, config: cfg,
        modelCount: modelMap.size,
        modelBreakdown,
      });
    });

    return result.sort((a, b) => b.totalValue - a.totalValue);
  }, [filtered]);

  const group1 = categories.filter((c) => c.config.group === 1);
  const group2 = categories.filter((c) => c.config.group === 2);
  const group3 = categories.filter((c) => c.config.group === 3);

  const allCategories = useMemo(() => [...group1, ...group2, ...group3], [group1, group2, group3]);

  const visibleNames = useMemo(() => {
    if (typeFilter === "all") return new Set(allCategories.map((c) => c.name));
    return new Set(allCategories.filter((c) => c.config.group === typeFilter).map((c) => c.name));
  }, [typeFilter, allCategories]);

  const { totalInvested, totalItems } = useMemo(() => ({
    totalInvested: filtered.reduce((s, e) => s + e.custo, 0),
    totalItems: filtered.length,
  }), [filtered]);

  const group1Total = useMemo(() => group1.reduce((s, c) => s + c.totalValue, 0), [group1]);
  const group1Items = useMemo(() => group1.reduce((s, c) => s + c.total, 0), [group1]);
  const group2Total = useMemo(() => group2.reduce((s, c) => s + c.totalValue, 0), [group2]);
  const group2Items = useMemo(() => group2.reduce((s, c) => s + c.total, 0), [group2]);

  const modalItems = useMemo(() => {
    if (!modalCategory) return [];
    const cat = categories.find((c) => c.name === modalCategory);
    if (!cat) return [];
    let items = cat.items;
    if (modalSearch) {
      const q = modalSearch.toLowerCase();
      items = items.filter(
        (e) =>
          e.nomeEquipamento.toLowerCase().includes(q) ||
          e.funcionario.toLowerCase().includes(q) ||
          e.numeroSerie.toLowerCase().includes(q) ||
          e.modelo.toLowerCase().includes(q)
      );
    }
    if (modalFilter === "employee") items = items.filter((e) => classifyItem(e, cat.config) === "employee");
    if (modalFilter === "instock") items = items.filter((e) => classifyItem(e, cat.config) === "stock");
    return items;
  }, [modalCategory, categories, modalSearch, modalFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <h2 className="text-5xl font-extrabold animate-gradient-text pb-2">Nosso Estoque</h2>
        <p className="text-sm text-muted-foreground mt-2">Estoque cadastrado em sistema.</p>
      </div>

      {/* Summary KPI cards */}
      <div className="flex flex-wrap gap-4">
        {([
          {
            icon: DollarSign, iconClass: "text-muted-foreground/60",
            label: "Total Investido", value: formatCurrency(totalInvested),
            subValue: totalItems,
          },
          {
            icon: Laptop, iconClass: "text-primary/60",
            label: "Equipamentos", value: formatCurrency(group1Total),
            subValue: group1Items,
          },
          {
            icon: Wifi, iconClass: "text-accent/60",
            label: "Eletro & Internet", value: formatCurrency(group2Total),
            subValue: group2Items,
          },
        ]).map(({ icon: KpiIcon, iconClass, label, value, subValue }) => (
          <PerspectiveCard key={label} className="rounded-3xl flex-1 min-w-[260px]">
            <div
              className="rounded-3xl p-5 flex flex-col justify-between h-full"
              style={{
                backdropFilter: "blur(40px) saturate(2.2)",
                WebkitBackdropFilter: "blur(40px) saturate(2.2)",
                background: "hsla(var(--glass-bg))",
                border: "1px solid hsla(var(--glass-border))",
                boxShadow: "0 4px 20px -4px hsla(var(--glass-shadow)), inset 0 1px 0 hsla(0 0% 100% / 0.22)",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <KpiIcon className={cn("h-4 w-4", iconClass)} />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold whitespace-nowrap">{label}</p>
              </div>
              <p className="text-4xl font-extrabold text-foreground tabular-nums tracking-tighter leading-none mt-1.5 mb-0.5">{value}</p>

              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/10">
                <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
                <p className="text-xs font-semibold text-muted-foreground tabular-nums">{subValue} itens cadastrados</p>
              </div>
            </div>
          </PerspectiveCard>
        ))}
      </div>

      {/* Filters & Actions row */}
      <div className="flex flex-wrap items-end justify-between gap-4 w-full">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="min-w-[200px]">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Pesquisar</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
              <Input
                placeholder="Procurar Equipamento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-[10px] rounded-lg border border-border/60 bg-white/80 dark:bg-muted/30 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 placeholder:text-muted-foreground/40 placeholder:text-[10px]"
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</span>
            <div className="flex gap-1">
              {(["all", "employee", "instock"] as FilterMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterMode(m)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                    filterMode === m
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "glass-button text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "all" ? "Todos" : m === "employee" ? "Com Funcionário" : "Em Estoque"}
                </button>
              ))}
            </div>
          </div>

          <div className="h-7 w-px bg-border/50 self-end mb-0.5" />

          {/* Type filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tipo</span>
            <div className="flex gap-1">
              <button
                onClick={() => setTypeFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                  typeFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "glass-button text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </button>
              {([1, 2, 3] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setTypeFilter(g)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                    typeFilter === g
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "glass-button text-muted-foreground hover:text-foreground"
                  )}
                >
                  {groupLabel(g)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Validation badge */}
        {validations.length > 0 && (
          <div className="flex flex-col gap-1 ml-auto">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium opacity-0 select-none">·</span>
            <button
              onClick={() => setValidationOpen(true)}
              className="glass-button flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold h-7 text-amber-600 dark:text-amber-500 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all shadow-sm"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="tabular-nums">{validations.length} inconsistências</span>
            </button>
          </div>
        )}
      </div>

      {/* Animated category grid */}
      {allCategories.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {allCategories.map((cat) => (
            <AnimatedCard key={cat.name} visible={visibleNames.has(cat.name)}>
              <CategoryCard
                cat={cat}
                onOpenModal={(name) => { setModalCategory(name); setModalSearch(""); setModalFilter("all"); }}
                onOpenModelModal={setModelModalCategory}
              />
            </AnimatedCard>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhuma categoria encontrada.</p>
      )}

      {/* Modal "Ver Estoque" */}
      <Dialog open={!!modalCategory} onOpenChange={(open) => { if (!open) setModalCategory(null); }}>
        <DialogContent
          className="glass-card border-border/50 max-w-4xl rounded-3xl p-0 overflow-hidden [&>button]:text-foreground"
          style={{ backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", background: "hsl(var(--card) / 0.85)" }}
        >
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                {modalCategory && (() => { const Icon = getConfig(modalCategory).icon; return <Icon className="h-5 w-5 text-primary" />; })()}
                {modalCategory}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[180px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Pesquisar</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar item…"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="pl-8 h-7 text-[11px] rounded-lg border border-border/60 bg-white/80 dark:bg-muted/30 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</span>
                <div className="flex gap-1">
                  {(["all", "employee", "instock"] as FilterMode[]).map((m) => {
                    const cfg = modalCategory ? getConfig(modalCategory) : null;
                    return (
                      <button
                        key={m}
                        onClick={() => setModalFilter(m)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                          modalFilter === m
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "glass-button text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {m === "all" ? "Todos" : m === "employee" ? (cfg?.labels.employee || "Com Funcionário") : (cfg?.labels.stock || "Em Estoque")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 max-h-[65vh] overflow-auto pr-1">
              {modalItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum item encontrado.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {modalItems.map((item, idx) => {
                    const cfg = getConfig(item.categoria);
                    const Icon = cfg.icon;
                    const { mainName } = splitEquipmentName(item.nomeEquipamento);
                    const patrimonialId = cfg.needsPatrimonialId ? extractPatrimonialId(item.nomeEquipamento) : null;
                    return (
                      <div key={idx} className="glass-card rounded-xl p-4 flex flex-col min-h-[130px]">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold text-foreground leading-tight">{mainName}</p>
                          </div>
                          {patrimonialId && (
                            <span className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded shrink-0">
                              {patrimonialId}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-muted-foreground space-y-0.5 mb-auto">
                          {item.funcionario && <p>👤 {item.funcionario}</p>}
                          {item.modelo && <p>Modelo: <span className="text-foreground">{item.modelo}</span></p>}
                          {item.numeroSerie && <p>SN: <span className="tabular-nums text-foreground">{item.numeroSerie}</span></p>}
                        </div>

                        {item.custo > 0 && (
                          <p className="text-xs font-medium text-foreground tabular-nums mt-2">{formatCurrency(item.custo)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Model Variation Modal */}
      <Dialog open={!!modelModalCategory} onOpenChange={(open) => { if (!open) setModelModalCategory(null); }}>
        <DialogContent
          className="glass-card border-border/50 max-w-md rounded-3xl p-0 overflow-hidden [&>button]:text-foreground"
          style={{ backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", background: "hsl(var(--card) / 0.75)" }}
        >
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                {modelModalCategory && (() => { const Icon = modelModalCategory.config.icon; return <Icon className="h-4 w-4 text-primary" />; })()}
                Variação de Modelos — {modelModalCategory?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 max-h-[50vh] overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                    <th className="text-left py-2 font-medium">Modelo</th>
                    <th className="text-right py-2 font-medium">Qtde</th>
                    <th className="text-right py-2 font-medium">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {modelModalCategory?.modelBreakdown.map((m) => (
                    <tr key={m.model} className="border-b border-border/10 last:border-0">
                      <td className="py-2 text-foreground truncate max-w-[200px]">{m.model}</td>
                      <td className="py-2 text-right tabular-nums text-foreground">{m.count}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(m.avgCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Modal */}
      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="glass-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Inconsistências Estruturais</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-auto">
            {validations.map((v, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-xl bg-muted/30">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground capitalize">
                    {v.type === "duplicate_id" ? "ID duplicado"
                      : v.type === "duplicate_employee" ? "Funcionário duplicado"
                        : v.type === "improper_employee" ? "Funcionário indevido"
                          : v.type === "missing_id" ? "ID ausente"
                            : "Classificação"}
                  </span>
                  <p className="text-muted-foreground mt-0.5">{v.description}</p>
                </div>
              </div>
            ))}
            {validations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma inconsistência encontrada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
