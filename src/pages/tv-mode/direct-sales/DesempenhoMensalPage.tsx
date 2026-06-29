import { useEffect, useMemo, useRef, useState } from "react";
import { getDummySalesRows } from "@/lib/dummyDataLoader";
import { AlertCircle } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { SellerTopCard } from "@/components/direct-sales/SellerTopCard";
import {
  MRR_COLOR, NRR_COLOR, toMonthKey,
} from "@/lib/directSalesUtils";
import {
  parseRow,
  aggregateByManager,
  aggregateCompanyTotals,
  buildCombinedRanking,
  buildSellerRanking,
} from "@/lib/previaUtils";
import type { RawCommissionRow, CommissionRow, CombinedManagerData } from "@/lib/previaUtils";
import { TotalCard } from "./views/TotalCard";
import { CombinedManagerCard } from "./views/CombinedManagerCard";
import { SellerRow } from "./views/SellerRow";

export function DesempenhoMensalPage() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [viewMode, setViewMode] = useState<"time" | "vendedor">("time");
  const [sellerPage, setSellerPage] = useState(1);
  const SELLER_PAGE_SIZE = 10;
  const [displayMode, setDisplayMode] = useState<"time" | "vendedor">("time");
  const [exiting, setExiting] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const isAnimationMode = useMemo(() => {
    return new URLSearchParams(window.location.search).get("animation") !== "false";
  }, []);

  const hasFetchedOnce = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setFetchError(null);
      if (!hasFetchedOnce.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      if (cancelled) return;

      const allRows = await getDummySalesRows();
      setRows(allRows.map((r) => parseRow(r as unknown as RawCommissionRow)));

      hasFetchedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, refetchTrigger]);

  // ── Filtro de período ──────────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rows) keys.add(toMonthKey(r.date_from));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const filteredRows = useMemo(() => {
    if (!selectedMonth) return rows;
    return rows.filter((r) => toMonthKey(r.date_from) === selectedMonth);
  }, [rows, selectedMonth]);

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const mrrByManager = useMemo(() => aggregateByManager(filteredRows, "MRR"), [filteredRows]);
  const nrrByManager = useMemo(() => aggregateByManager(filteredRows, "NRR"), [filteredRows]);


  const mrrTotals = useMemo(() => aggregateCompanyTotals(filteredRows, "MRR"), [filteredRows]);
  const nrrTotals = useMemo(() => aggregateCompanyTotals(filteredRows, "NRR"), [filteredRows]);

  const combinedManagersRaw = useMemo(() => buildCombinedRanking(filteredRows), [filteredRows]);

  const combinedManagers = combinedManagersRaw;

  const filteredSellers = useMemo(() => buildSellerRanking(filteredRows), [filteredRows]);

  useEffect(() => { setSellerPage(1); }, [selectedMonth]);

  const pagedSellers = useMemo(() => {
    const start = (sellerPage - 1) * SELLER_PAGE_SIZE;
    return filteredSellers.slice(start, start + SELLER_PAGE_SIZE);
  }, [filteredSellers, sellerPage, SELLER_PAGE_SIZE]);

  const totalSellerPages = Math.ceil(filteredSellers.length / SELLER_PAGE_SIZE);

  // ── Transição suave ao mudar viewMode ─────────────────────────────────────
  useEffect(() => {
    if (viewMode === displayMode) return;
    setExiting(true);
    const t = setTimeout(() => {
      setDisplayMode(viewMode);
      setExiting(false);
    }, 180);
    return () => clearTimeout(t);
  }, [viewMode, displayMode]);

  // ── Modo TV (?animation=true) — alterna a cada 60s ────────────────────────
  useEffect(() => {
    if (!isAnimationMode) return;
    const id = setInterval(() => {
      setViewMode((v) => (v === "time" ? "vendedor" : "time"));
    }, 60_000);
    return () => clearInterval(id);
  }, [isAnimationMode]);

  // ── Wake Lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAnimationMode) return;
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;

    async function acquire() {
      try {
        lock = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request("screen");
      } catch {
        // permissão negada ou API indisponível
      }
    }

    acquire();
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release();
    };
  }, [isAnimationMode]);

  // ── Auto-refetch a cada 5min no modo TV ───────────────────────────────────
  useEffect(() => {
    if (!isAnimationMode) return;
    const id = setInterval(() => setRefetchTrigger((t) => t + 1), 60 * 60_000);
    return () => clearInterval(id);
  }, [isAnimationMode]);

  // ── Canvas rAF — keep-alive para prevenir sleep em TVs ────────────────────
  useEffect(() => {
    if (!isAnimationMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf: number;
    function tick() {
      ctx?.clearRect(0, 0, 1, 1);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isAnimationMode]);

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-[hsl(var(--kpi-down))]" />
        <p className="text-sm font-semibold text-foreground">Erro ao carregar dados</p>
        <p className="text-xs text-muted-foreground max-w-sm">{fetchError}</p>
      </div>
    );
  }

  // ── UI principal ───────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={200}>
      {/* Canvas 1×1 invisível — mantém browser ativo para prevenir sleep em TVs */}
      <canvas ref={canvasRef} width={1} height={1} style={{ position: "fixed", opacity: 0, pointerEvents: "none" }} />

      <div className="flex flex-col gap-6">

        {filteredRows.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            Nenhum dado encontrado para o período selecionado.
          </p>
        ) : (
          <>
            {/* CARDS DE TOTAIS — apenas na view por times */}
            {displayMode === "time" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl p-6">
                  <TotalCard label="MRR" target={mrrTotals.target} achieved={mrrTotals.achieved} pct={mrrTotals.pct} accentColor={MRR_COLOR} />
                </div>
                <div className="glass-card rounded-2xl p-6">
                  <TotalCard label="NRR" target={nrrTotals.target} achieved={nrrTotals.achieved} pct={nrrTotals.pct} accentColor={NRR_COLOR} />
                </div>
              </div>
            )}

            {/* LISTA — fade ao trocar visualização */}
            <div
              className="transition-[opacity,transform] duration-[180ms] ease-in"
              style={{
                opacity: exiting ? 0 : 1,
                transform: exiting ? "translateY(-8px)" : "translateY(0)",
              }}
            >
              {displayMode === "time" ? (
                combinedManagers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem resultados para a busca.</p>
                ) : (
                  <div key="time-view" className="space-y-3">
                    {combinedManagers.some((d) => d.rank <= 3) && (
                      <div className="flex items-end justify-center gap-4 pb-2">
                        {([2, 1, 3] as const).map((targetRank, i) => {
                          const d = combinedManagers.find((x) => x.rank === targetRank);
                          if (!d) return null;
                          return (
                            <div
                              key={d.managerName}
                              className={`list-item-reveal w-72 shrink-0 ${targetRank === 1 ? "mb-12" : ""}`}
                              style={{ animationDelay: `${i * 80}ms` }}
                            >
                              <SellerTopCard
                                rank={d.rank as 1 | 2 | 3}
                                name={d.teamName ?? d.managerName}
                                teamName={d.teamType}
                                mrrAchieved={d.mrr?.achieved ?? 0}
                                mrrTarget={d.mrr?.target ?? 0}
                                mrrPct={d.mrr?.pct ?? 0}
                                nrrAchieved={d.nrr?.achieved ?? 0}
                                nrrTarget={d.nrr?.target ?? 0}
                                nrrPct={d.nrr?.pct ?? 0}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {combinedManagers
                      .filter((d) => d.rank > 3)
                      .map((d, idx) => (
                        <div key={d.managerName} className="list-item-reveal" style={{ animationDelay: `${(idx + 3) * 40}ms` }}>
                          <CombinedManagerCard data={d} />
                        </div>
                      ))}
                  </div>
                )
              ) : (
                filteredSellers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem resultados para a busca.</p>
                ) : (
                  <div key="seller-view" className="space-y-3">
                    {sellerPage === 1 && pagedSellers.some((s) => s.rank <= 3) && (
                      <div className="flex items-end justify-center gap-4 pb-2">
                        {([2, 1, 3] as const)
                          .map((targetRank, i) => {
                            const s = pagedSellers.find((x) => x.rank === targetRank);
                            if (!s) return null;
                            return (
                              <div
                                key={s.sellerName}
                                className={`list-item-reveal w-72 shrink-0 ${targetRank === 1 ? "mb-12" : ""}`}
                                style={{ animationDelay: `${i * 80}ms` }}
                              >
                                <SellerTopCard
                                  rank={s.rank as 1 | 2 | 3}
                                  name={s.sellerName}
                                  teamName={s.teamName}
                                  mrrAchieved={s.mrr?.achieved ?? 0}
                                  mrrTarget={s.mrr?.target ?? 0}
                                  mrrPct={s.mrr?.pct ?? 0}
                                  nrrAchieved={s.nrr?.achieved ?? 0}
                                  nrrTarget={s.nrr?.target ?? 0}
                                  nrrPct={s.nrr?.pct ?? 0}
                                  avatarUrl={avatarMap.get(s.sellerName)}
                                />
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {pagedSellers
                      .filter((s) => !(sellerPage === 1 && s.rank <= 3))
                      .map((s, i) => (
                        <div
                          key={s.sellerName}
                          className="list-item-reveal"
                          style={{ animationDelay: `${(i + (sellerPage === 1 ? 3 : 0)) * 40}ms` }}
                        >
                          <SellerRow data={s} />
                        </div>
                      ))}
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
