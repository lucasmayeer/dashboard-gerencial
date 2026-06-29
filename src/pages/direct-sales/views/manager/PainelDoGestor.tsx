import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Building2, CalendarDays, Users, Search, X, ChevronDown, Check, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatMonthLabel } from "@/lib/directSalesUtils";
import {
  toMonthKeyStr, aggregateSellers, stripTetragram,
  type TeamMetrics, type RawRow, type SellerMetrics,
} from "@/lib/desempenhoUtils";
import { useIsDark, TeamBadgeDsm } from "../DesempenhoShared";
import {
  TL_OPS, generateTlLabel,
  type TlOp, type TlMultiplierRow,
} from "@/lib/tlUtils";
import { useTlBracketMutation } from "@/hooks/useTlBracketMutation";

export function PainelDoGestor({
  teams,
  allRaw,
  initialMonth,
  onClose,
  tlRows,
  onTlRowsChange,
  tlLoading = false,
  onRefresh,
}: {
  teams: TeamMetrics[];
  allRaw: RawRow[];
  initialMonth: string;
  onClose: () => void;
  tlRows: TlMultiplierRow[];
  onTlRowsChange: (rows: TlMultiplierRow[]) => void;
  tlLoading?: boolean;
  onRefresh?: () => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [teamFilter, setTeamFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [feriasOverrides, setFeriasOverrides] = useState<Record<string, boolean>>({});
  const [savingFerias, setSavingFerias] = useState<Record<string, boolean>>({});
  const [cardPage, setCardPage] = useState(0);
  const [activePage, setActivePage] = useState<"ferias" | "comissao-tls" | "rampup">("ferias");
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const pageButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isDark = useIsDark();
  const { saving: tlSaving, saveBracket } = useTlBracketMutation(tlRows, onTlRowsChange);

  const [tlEditing, setTlEditing] = useState<{
    idx: number; minOp: TlOp; minPct: string; maxOp: TlOp; maxPct: string;
    mrrMultiplier: string; nrrMultiplier: string;
  } | null>(null);
  const [opMenu, setOpMenu] = useState<{ rowIdx: number; field: "min" | "max"; pos: { top: number; left: number } } | null>(null);
  const opMenuRef = useRef<HTMLDivElement>(null);

  const PAGE_LABELS: Record<typeof activePage, string> = {
    "ferias": "Férias",
    "comissao-tls": "Métrica Comissão TLs",
    "rampup": "Regra Ramp-Up",
  };

  const PAGE_SIZE = 12;

  const availableMonths = useMemo(() => {
    const keys = new Set(allRaw.map((r) => toMonthKeyStr(r.date_from ?? "")).filter(Boolean));
    return Array.from(keys).sort().reverse();
  }, [allRaw]);

  useEffect(() => {
    setCardPage(0);
    setFeriasOverrides({});
  }, [month]);

  useEffect(() => {
    setCardPage(0);
  }, [teamFilter, searchQuery]);

  const monthSellers = useMemo(() => {
    const rows = allRaw.filter((r) => toMonthKeyStr(r.date_from ?? "") === month);
    return aggregateSellers(rows);
  }, [allRaw, month]);

  const filteredSellers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthSellers
      .filter((s) => {
        if (teamFilter !== "todos" && s.managerName !== teamFilter) return false;
        if (q && !s.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => stripTetragram(a.name).localeCompare(stripTetragram(b.name)));
  }, [monthSellers, teamFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSellers.length / PAGE_SIZE));
  const pageSellers = filteredSellers.slice(cardPage * PAGE_SIZE, (cardPage + 1) * PAGE_SIZE);

  const isFerias = (seller: SellerMetrics) =>
    feriasOverrides[seller.name] !== undefined
      ? feriasOverrides[seller.name]
      : seller.status === "férias";

  const feriasOnMonth = monthSellers.filter((s) => isFerias(s));

  async function toggleSkipRecord(seller: SellerMetrics, value: boolean) {
    if (!seller.userId || savingFerias[seller.name]) {
      return;
    }
    const prev = isFerias(seller);
    setSavingFerias((s) => ({ ...s, [seller.name]: true }));
    setFeriasOverrides((o) => ({ ...o, [seller.name]: value }));
    const { data, error } = await supabase
      .from("commissions_report")
      .update({ skip_record: value })
      .eq("user_id", seller.userId)
      .gte("date_from", `${month}-01`)
      .lte("date_from", `${month}-31`)
      .select("id");
    setSavingFerias((s) => ({ ...s, [seller.name]: false }));
    if (error) {
      setFeriasOverrides((o) => ({ ...o, [seller.name]: prev }));
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else if (!data || data.length === 0) {
      setFeriasOverrides((o) => ({ ...o, [seller.name]: prev }));
      toast({ title: "Sem permissão ou registro não encontrado", description: `0 rows atualizadas para user_id=${seller.userId} em ${month}`, variant: "destructive" });
    } else {
      onRefresh?.();
    }
  }

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

  useEffect(() => {
    if (!pageMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedButton = pageButtonRef.current?.contains(target);
      const clickedMenu = pageMenuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) setPageMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pageMenuOpen]);

  useEffect(() => {
    if (!opMenu) return;
    const handler = (e: MouseEvent) => {
      if (!opMenuRef.current?.contains(e.target as Node)) setOpMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [opMenu]);

  // Zipa MRR e NRR por índice — mesmos brackets, só muda o multiplier
  const tlBrackets = useMemo(() => {
    const mrr = tlRows.filter((r) => r.plan_type === "MRR").sort((a, b) => a.min_pct - b.min_pct);
    const nrr = tlRows.filter((r) => r.plan_type === "NRR").sort((a, b) => a.min_pct - b.min_pct);
    return mrr.map((m, i) => ({
      label: m.label,
      minPct: m.min_pct,
      maxPct: m.max_pct,
      minOp: m.min_op,
      maxOp: m.max_op,
      mrrId: m.id,
      nrrId: nrr[i]?.id,
      mrrMultiplier: m.multiplier,
      nrrMultiplier: nrr[i]?.multiplier ?? 0,
    }));
  }, [tlRows]);

  async function handleSaveTlBracket() {
    if (!tlEditing) return;
    const b = tlBrackets[tlEditing.idx];
    const ok = await saveBracket({
      mrrId: b.mrrId,
      nrrId: b.nrrId,
      minOp: tlEditing.minOp,
      maxOp: tlEditing.maxOp,
      minPctStr: tlEditing.minPct,
      maxPctStr: tlEditing.maxPct,
      mrrMultiplierStr: tlEditing.mrrMultiplier,
      nrrMultiplierStr: tlEditing.nrrMultiplier,
    });
    if (ok) { setTlEditing(null); setOpMenu(null); }
  }

  const glassCtrl: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.55)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)"}`,
    backdropFilter: "blur(12px) saturate(1.4)",
    WebkitBackdropFilter: "blur(12px) saturate(1.4)",
    color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.6)",
  };

  const modal = createPortal(
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
        className="relative flex flex-col rounded-3xl overflow-hidden w-[1070px] max-w-[95vw] h-[715px] max-h-[90vh]"
        style={{
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.52)",
          backdropFilter: "blur(48px) saturate(2)",
          WebkitBackdropFilter: "blur(48px) saturate(2)",
          border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(180,195,210,0.35)",
          boxShadow: isDark
            ? "0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 96px rgba(0,0,0,0.60), 0 8px 32px rgba(0,0,0,0.40), 0 2px 8px rgba(0,0,0,0.30)"
            : "0 0 0 1px rgba(255,255,255,0.50) inset, 0 32px 96px rgba(0,0,0,0.22), 0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px z-10"
          style={{
            background: isDark
              ? "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.30) 40%, rgba(255,255,255,0.22) 60%, transparent 95%)"
              : "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.50) 40%, rgba(255,255,255,0.38) 60%, transparent 95%)",
          }}
        />
        <span
          className="pointer-events-none absolute inset-0 z-0 rounded-3xl"
          style={{
            background: isDark
              ? "radial-gradient(ellipse 70% 30% at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 70%)"
              : "radial-gradient(ellipse 70% 30% at 50% 0%, rgba(255,255,255,0.60) 0%, transparent 70%)",
          }}
        />

        {/* Header */}
        <div
          className="relative z-10 flex items-center gap-4 px-6 py-3.5 shrink-0 justify-between"
          style={{
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(255,255,255,0.55)",
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.30)",
          }}
        >
          <div className="flex items-center gap-3 shrink-0">
            <Building2 className="h-4 w-4 shrink-0" style={{ color: isDark ? "#5eead4" : "#017E84" }} />
            <span
              className="text-[13px] font-bold tracking-[0.12em] uppercase"
              style={{ color: isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.78)" }}
            >
              Painel do Gestor
            </span>

            {/* Page switcher */}
            <button
              ref={pageButtonRef}
              onClick={() => {
                if (!pageMenuOpen) {
                  const rect = pageButtonRef.current?.getBoundingClientRect();
                  if (rect) setMenuPos({ top: rect.bottom + 6, left: rect.left });
                }
                setPageMenuOpen((o) => !o);
              }}
              className="flex items-center gap-1.5 px-3 h-7 rounded-xl text-[11px] font-semibold transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={glassCtrl}
            >
              {PAGE_LABELS[activePage]}
              <ChevronDown
                className="h-3 w-3 shrink-0 opacity-60 transition-transform duration-200"
                style={{ transform: pageMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 transition-opacity duration-200"
              style={{
                opacity: (activePage === "comissao-tls" || activePage === "rampup") ? 0.35 : 1,
                pointerEvents: (activePage === "comissao-tls" || activePage === "rampup") ? "none" : "auto",
              }}
            >
            {!searchOpen ? (
              <button
                onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
                className="h-7 w-7 rounded-full flex items-center justify-center transition-all hover:scale-105 shrink-0"
                style={glassCtrl}
              >
                <Search className="h-3 w-3 shrink-0" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full px-2.5 h-7 w-[180px] transition-all" style={glassCtrl}>
                <Search className="h-3 w-3 shrink-0 opacity-40" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar colaborador…"
                  className="flex-1 bg-transparent outline-none border-none text-[11px] font-medium min-w-0"
                  style={{ color: isDark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.65)" }}
                />
                <button
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                  className="flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity shrink-0"
                >
                  <X className="h-3 w-3 shrink-0" />
                </button>
              </div>
            )}

            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[160px] h-7 text-[11px] gap-1.5 rounded-xl !ring-0 !shadow-none" style={glassCtrl}>
                <Users className="h-3 w-3 shrink-0 opacity-60" />
                <SelectValue placeholder="Selecionar time" />
              </SelectTrigger>
              <SelectContent className="!z-[10000]">
                <SelectItem value="todos" className="text-xs">Todos os times</SelectItem>
                {[...teams]
                  .sort((a, b) => a.managerName.localeCompare(b.managerName))
                  .map((t) => (
                    <SelectItem key={t.managerName} value={t.managerName} className="text-xs">
                      {stripTetragram(t.managerName)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[140px] h-7 text-[11px] gap-1.5 rounded-xl !ring-0 !shadow-none" style={glassCtrl}>
                <CalendarDays className="h-3 w-3 shrink-0 opacity-60" />
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent className="!z-[10000]">
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">{formatMonthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 h-7 rounded-xl text-[11px] font-semibold transition-all hover:scale-[1.03] active:scale-[0.97] shrink-0"
              style={{
                background: isDark ? "rgba(239,68,68,0.14)" : "rgba(220,38,38,0.09)",
                border: "1px solid rgba(239,68,68,0.28)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                color: isDark ? "#fca5a5" : "#dc2626",
              }}
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              Sair
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
          {activePage === "rampup" ? (
            <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4 flex flex-col gap-4">
              <span
                className="text-[11px] font-bold tracking-[0.10em] uppercase"
                style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}
              >
                Regra de Negócio — Ramp-Up
              </span>

              {/* Callout — Como identificar */}
              <div
                className="rounded-2xl px-4 py-3.5 flex flex-col gap-2"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.40)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">🔍</span>
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)" }}
                  >
                    Como é definido no sistema
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.58)" }}>
                  O status Ramp-Up é definido diretamente no <strong style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)" }}>sistema</strong>, atribuindo ao colaborador um plano de comissão cujo nome começa com{" "}
                  <code
                    className="rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold"
                    style={{
                      background: isDark ? "rgba(56,189,248,0.15)" : "rgba(56,189,248,0.12)",
                      color: isDark ? "#7dd3fc" : "#0369a1",
                    }}
                  >
                    [RAMP-UP]
                  </code>
                  . O dashboard detecta esse prefixo automaticamente — nenhuma configuração manual é necessária aqui.
                </p>
                <div
                  className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 mt-0.5"
                  style={{
                    background: isDark ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.04)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
                  }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)" }}>
                    Exemplos de nome de plano:
                  </p>
                  {["[RAMP-UP] Vendedor Júnior MRR", "[RAMP-UP] Executivo de Contas NRR"].map((ex) => (
                    <code
                      key={ex}
                      className="block rounded px-2 py-0.5 text-[11px] font-mono"
                      style={{
                        background: isDark ? "rgba(56,189,248,0.08)" : "rgba(56,189,248,0.08)",
                        color: isDark ? "rgba(147,210,248,0.85)" : "#0369a1",
                      }}
                    >
                      {ex}
                    </code>
                  ))}
                </div>
              </div>

              {/* Callout — Impacto no relatório */}
              <div
                className="rounded-2xl px-4 py-3.5 flex flex-col gap-3"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.40)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">📊</span>
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)" }}
                  >
                    Impacto no relatório
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {[
                    { label: "Time original", target: false, achieved: false, note: "Removido completamente. Não distorce o atingimento da equipe." },
                    { label: "Empresa (visão geral)", target: false, achieved: true, note: "Target excluído; achieved soma se positivo." },
                    { label: "Ranking de vendedores", target: null, achieved: true, note: "Entra normalmente no ranking mensal e histórico." },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl px-3 py-2.5 flex flex-col gap-1"
                      style={{
                        background: isDark ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.03)",
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.70)" }}>
                          {row.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {row.target !== null && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: row.target
                                  ? isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)"
                                  : isDark ? "rgba(239,68,68,0.15)" : "rgba(220,38,38,0.10)",
                                color: row.target
                                  ? isDark ? "#34d399" : "#047857"
                                  : isDark ? "#fca5a5" : "#dc2626",
                              }}
                            >
                              TARGET {row.target ? "✓" : "✕"}
                            </span>
                          )}
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: row.achieved
                                ? isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.10)"
                                : isDark ? "rgba(239,68,68,0.15)" : "rgba(220,38,38,0.10)",
                              color: row.achieved
                                ? isDark ? "#34d399" : "#047857"
                                : isDark ? "#fca5a5" : "#dc2626",
                            }}
                          >
                            ACHIEVED {row.achieved ? "✓" : "✕"}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.42)" }}>
                        {row.note}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  className="flex items-start gap-2 rounded-xl px-3 py-2 mt-0.5"
                  style={{
                    background: isDark ? "rgba(56,189,248,0.08)" : "rgba(56,189,248,0.07)",
                    border: `1px solid ${isDark ? "rgba(56,189,248,0.20)" : "rgba(56,189,248,0.22)"}`,
                  }}
                >
                  <span className="text-[11px] mt-px">💡</span>
                  <p className="text-[11px] leading-relaxed" style={{ color: isDark ? "rgba(147,210,248,0.80)" : "#0369a1" }}>
                    O colaborador em ramp-up é exibido num <strong>time virtual "Ramp-up"</strong> separado, fora do ranking de times — evitando que metas menores distorçam a competição entre os times produtivos.
                  </p>
                </div>
              </div>
            </div>
          ) : activePage === "comissao-tls" ? (
            <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
              <span
                className="text-[11px] font-bold tracking-[0.10em] uppercase mb-4 block"
                style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}
              >
                Regras de Comissão — Team Leaders
              </span>

              {/* Callout — explicação da regra */}
              <div
                className="rounded-2xl px-4 py-3.5 mb-4 flex flex-col gap-2"
                style={{
                  background: isDark ? "rgba(113,75,103,0.38)" : "rgba(113,75,103,0.16)",
                  border: `1px solid ${isDark ? "rgba(113,75,103,0.35)" : "rgba(113,75,103,0.22)"}`,
                  boxShadow: isDark
                    ? "0 6px 24px rgba(113,75,103,0.35)"
                    : "0 6px 24px rgba(113,75,103,0.18)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">💡</span>
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: isDark ? "rgba(200,160,190,0.90)" : "#714B67" }}
                  >
                    Como funciona
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.58)" }}>
                  O sistema verifica o <strong style={{ color: isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.75)" }}>% atingido do time</strong> no mês e encontra o bracket correspondente. O multiplicador daquele bracket é aplicado separadamente para{" "}
                  <strong style={{ color: isDark ? "rgba(180,130,170,0.90)" : "#714B67" }}>MRR</strong> e{" "}
                  <strong style={{ color: isDark ? "rgba(0,200,210,0.85)" : "#017E84" }}>NRR</strong>{" "}
                  para calcular a comissão do Team Leader. Times com atingimento maior podem cair em brackets com multipliers diferentes — cada plano é avaliado de forma independente.
                </p>
                <div
                  className="flex items-start gap-2 rounded-xl px-3 py-2 mt-0.5"
                  style={{
                    background: isDark ? "rgba(239,68,68,0.10)" : "rgba(220,38,38,0.06)",
                    border: `1px solid ${isDark ? "rgba(239,68,68,0.22)" : "rgba(220,38,38,0.16)"}`,
                  }}
                >
                  <span className="text-[11px] mt-px">⚠️</span>
                  <p className="text-[12px] leading-relaxed font-bold" style={{ color: isDark ? "rgba(255,160,160,0.90)" : "rgba(185,28,28,0.90)" }}>
                    Alterar os multiplicadores afeta diretamente o cálculo de comissão de todos os Team Leaders. Confirme os valores antes de salvar qualquer mudança.
                  </p>
                </div>
              </div>

              {tlLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="text-[12px]" style={{ color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.28)" }}>
                    Carregando…
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Cabeçalho da tabela — 8 colunas: op_min|val_min|op_max|val_max|mrr|nrr|resumo|action */}
                  <div
                    className="grid px-4 py-2 gap-1.5"
                    style={{ gridTemplateColumns: "34px 68px 34px 68px 1fr 1fr 1.4fr 32px" }}
                  >
                    <span />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.38)" }}>Min %</span>
                    <span />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.38)" }}>Max %</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: "#714B67" }}>MRR multi</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: "#017E84" }}>NRR multi</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.38)" }}>Resumo da Regra</span>
                    <span />
                  </div>

                  {/* Linhas de brackets — cada uma num card separado */}
                  {tlBrackets.map((b, i) => {
                    const isEditingThis = tlEditing?.idx === i;

                    const inputBase: React.CSSProperties = {
                      background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"}`,
                      borderRadius: 8, padding: "3px 6px", fontSize: 11, fontWeight: 500,
                      color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                      outline: "none", width: "100%", textAlign: "center" as const,
                    };

                    const opBtnStyle: React.CSSProperties = {
                      background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"}`,
                      color: isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.72)",
                    };

                    const previewLabel = isEditingThis
                      ? generateTlLabel(
                          tlEditing.minOp,
                          parseFloat(tlEditing.minPct) || 0,
                          tlEditing.maxOp,
                          tlEditing.maxPct.trim() === "" ? null : parseFloat(tlEditing.maxPct) || null,
                        )
                      : b.label;

                    const kd = (e: React.KeyboardEvent) => {
                      if (e.key === "Enter") handleSaveTlBracket();
                      if (e.key === "Escape") setTlEditing(null);
                    };

                    const openOpMenu = (field: "min" | "max", btn: HTMLButtonElement) => {
                      const rect = btn.getBoundingClientRect();
                      setOpMenu({ rowIdx: i, field, pos: { top: rect.bottom + 4, left: rect.left } });
                    };

                    return (
                      <div
                        key={b.mrrId}
                        className="grid items-center gap-1.5 px-4 py-3 rounded-2xl"
                        style={{
                          gridTemplateColumns: "34px 68px 34px 68px 1fr 1fr 1.4fr 32px",
                          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.28)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.60)"}`,
                        }}
                      >
                        {/* op_min */}
                        {isEditingThis ? (
                          <button
                            type="button" disabled={tlSaving}
                            onClick={(e) => openOpMenu("min", e.currentTarget)}
                            className="h-[26px] w-full rounded-md text-[11px] font-bold tabular-nums transition-all hover:scale-105 disabled:opacity-40"
                            style={opBtnStyle}
                          >
                            {tlEditing.minOp}
                          </button>
                        ) : (
                          <span className="text-[12px] font-bold tabular-nums text-center" style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}>
                            {b.minOp}
                          </span>
                        )}

                        {/* val_min */}
                        {isEditingThis ? (
                          <input style={inputBase} type="text" inputMode="decimal"
                            value={tlEditing.minPct} disabled={tlSaving}
                            onChange={(e) => setTlEditing((p) => p && ({ ...p, minPct: e.target.value }))}
                            onKeyDown={kd}
                          />
                        ) : (
                          <span className="text-[12px] font-medium tabular-nums text-center" style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.68)" }}>
                            {b.minPct}%
                          </span>
                        )}

                        {/* op_max */}
                        {isEditingThis ? (
                          <button
                            type="button" disabled={tlSaving}
                            onClick={(e) => openOpMenu("max", e.currentTarget)}
                            className="h-[26px] w-full rounded-md text-[11px] font-bold tabular-nums transition-all hover:scale-105 disabled:opacity-40"
                            style={opBtnStyle}
                          >
                            {tlEditing.maxOp}
                          </button>
                        ) : (
                          <span className="text-[12px] font-bold tabular-nums text-center" style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}>
                            {b.maxPct !== null ? b.maxOp : "—"}
                          </span>
                        )}

                        {/* val_max */}
                        {isEditingThis ? (
                          <input style={inputBase} type="text" inputMode="decimal"
                            value={tlEditing.maxPct} placeholder="∞" disabled={tlSaving}
                            onChange={(e) => setTlEditing((p) => p && ({ ...p, maxPct: e.target.value }))}
                            onKeyDown={kd}
                          />
                        ) : (
                          <span className="text-[12px] font-medium tabular-nums text-center" style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.68)" }}>
                            {b.maxPct !== null ? `${b.maxPct}%` : ""}
                          </span>
                        )}

                        {/* mrr_multi */}
                        {isEditingThis ? (
                          <input style={{ ...inputBase, color: isDark ? "rgba(180,130,170,0.90)" : "#714B67" }}
                            type="text" inputMode="decimal" value={tlEditing.mrrMultiplier} disabled={tlSaving}
                            onChange={(e) => setTlEditing((p) => p && ({ ...p, mrrMultiplier: e.target.value }))}
                            onKeyDown={kd}
                          />
                        ) : (
                          <span className="text-[12px] font-semibold tabular-nums text-center" style={{ color: isDark ? "rgba(180,130,170,0.90)" : "#714B67" }}>
                            {b.mrrMultiplier.toFixed(9)}
                          </span>
                        )}

                        {/* nrr_multi */}
                        {isEditingThis ? (
                          <input style={{ ...inputBase, color: isDark ? "rgba(0,200,210,0.85)" : "#017E84" }}
                            type="text" inputMode="decimal" value={tlEditing.nrrMultiplier} disabled={tlSaving}
                            onChange={(e) => setTlEditing((p) => p && ({ ...p, nrrMultiplier: e.target.value }))}
                            onKeyDown={kd}
                          />
                        ) : (
                          <span className="text-[12px] font-semibold tabular-nums text-center" style={{ color: isDark ? "rgba(0,200,210,0.85)" : "#017E84" }}>
                            {b.nrrMultiplier.toFixed(9)}
                          </span>
                        )}

                        {/* resumo_regra (auto) */}
                        <span className="text-[11px] font-medium italic truncate"
                          style={{ color: isEditingThis
                            ? isDark ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.38)"
                            : isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)" }}
                        >
                          {previewLabel}
                        </span>

                        {/* actions */}
                        {isEditingThis ? (
                          <div className="flex flex-col gap-1">
                            <button onClick={handleSaveTlBracket} disabled={tlSaving}
                              className="flex items-center justify-center h-[22px] w-[28px] rounded-lg transition-all hover:scale-105 disabled:opacity-40"
                              style={{ background: isDark ? "rgba(52,211,153,0.18)" : "rgba(5,150,105,0.12)", border: "1px solid rgba(52,211,153,0.28)" }}
                              title="Salvar"
                            >
                              <Check className="h-3 w-3" style={{ color: isDark ? "#34d399" : "#047857" }} />
                            </button>
                            <button onClick={() => { setTlEditing(null); setOpMenu(null); }} disabled={tlSaving}
                              className="flex items-center justify-center h-[22px] w-[28px] rounded-lg transition-all hover:scale-105 disabled:opacity-40"
                              style={{ background: isDark ? "rgba(239,68,68,0.12)" : "rgba(220,38,38,0.08)", border: "1px solid rgba(239,68,68,0.24)" }}
                              title="Cancelar"
                            >
                              <X className="h-3 w-3" style={{ color: isDark ? "#fca5a5" : "#dc2626" }} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setTlEditing({ idx: i, minOp: b.minOp, minPct: String(b.minPct), maxOp: b.maxOp, maxPct: b.maxPct !== null ? String(b.maxPct) : "", mrrMultiplier: String(b.mrrMultiplier), nrrMultiplier: String(b.nrrMultiplier) }); setOpMenu(null); }}
                            className="flex items-center justify-center h-[28px] w-[28px] rounded-lg transition-all hover:scale-105 opacity-40 hover:opacity-90"
                            style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}` }}
                            title="Editar"
                          >
                            <Pencil className="h-3 w-3" style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.60)" }} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Seção de frases — interpretação humana de cada regra */}
              {tlBrackets.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-1"
                    style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.32)" }}
                  >
                    Interpretação
                  </span>
                  {tlBrackets.map((b, i) => {
                    const isEditing = tlEditing?.idx === i;
                    const minOp  = isEditing ? tlEditing.minOp  : b.minOp;
                    const minPct = isEditing ? (parseFloat(tlEditing.minPct) || 0) : b.minPct;
                    const maxOp  = isEditing ? tlEditing.maxOp  : b.maxOp;
                    const maxPct = isEditing
                      ? (tlEditing.maxPct.trim() === "" ? null : parseFloat(tlEditing.maxPct) || null)
                      : b.maxPct;
                    const mrr = isEditing ? (parseFloat(tlEditing.mrrMultiplier) || 0) : b.mrrMultiplier;
                    const nrr = isEditing ? (parseFloat(tlEditing.nrrMultiplier) || 0) : b.nrrMultiplier;
                    const condition = maxPct !== null
                      ? `${minOp}${minPct}% and ${maxOp}${maxPct}%`
                      : `${minOp}${minPct}%`;
                    return (
                      <p key={i} className="text-[11px] px-1 leading-relaxed"
                        style={{ color: isDark ? "rgba(255,255,255,0.52)" : "rgba(0,0,0,0.52)" }}
                      >
                        Se % Achieved{" "}
                        <span className="font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.72)" }}>
                          {condition}
                        </span>
                        {" "}então: multiplica <strong style={{ color: isDark ? "rgba(180,130,170,0.90)" : "#714B67" }}>MRR</strong> por{" "}
                        <span className="font-semibold tabular-nums" style={{ color: isDark ? "rgba(180,130,170,0.90)" : "#714B67" }}>
                          {mrr.toFixed(9)}
                        </span>
                        {" "}e <strong style={{ color: isDark ? "rgba(0,200,210,0.85)" : "#017E84" }}>NRR</strong> por{" "}
                        <span className="font-semibold tabular-nums" style={{ color: isDark ? "rgba(0,200,210,0.85)" : "#017E84" }}>
                          {nrr.toFixed(9)}
                        </span>
                        {" "}para definir a comissão do Team Leader.
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
          <>
          <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4 flex flex-col gap-5">

            {/* Funcionários em férias */}
            <div className="flex flex-col gap-2.5">
              <span
                className="text-[11px] font-bold tracking-[0.10em] uppercase"
                style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}
              >
                Funcionários em férias em {formatMonthLabel(month)}
              </span>
              <div className="flex flex-col gap-1.5">
                {feriasOnMonth.length === 0 ? (
                  <span className="text-[11px] italic" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)" }}>
                    Nenhum colaborador em férias neste mês.
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {feriasOnMonth.map((s) => {
                      const tetra = s.name.match(/\(([^)]+)\)$/)?.[1] ?? stripTetragram(s.name);
                      return (
                        <span
                          key={s.name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            background: isDark ? "rgba(251,191,36,0.13)" : "rgba(251,191,36,0.15)",
                            border: `1px solid ${isDark ? "rgba(251,191,36,0.30)" : "rgba(251,191,36,0.45)"}`,
                            color: isDark ? "#fbbf24" : "#b45309",
                          }}
                        >
                          🌴 {tetra.toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="h-px w-full shrink-0" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

            {/* Cards dos colaboradores */}
            <div className="flex flex-col flex-1 min-h-0">
              {filteredSellers.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)" }}>
                    Nenhum colaborador encontrado.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {[...pageSellers, ...Array(PAGE_SIZE - pageSellers.length).fill(null)].map((seller, idx) => {
                    if (!seller) return <div key={`ghost-${idx}`} className="h-[62px] rounded-xl" />;
                    const onFerias = isFerias(seller);
                    const isSaving = !!savingFerias[seller.name];
                    return (
                      <div
                        key={seller.name}
                        className="h-[62px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl"
                        style={{
                          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.28)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.60)"}`,
                          backdropFilter: "blur(20px) saturate(1.6)",
                          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                          boxShadow: isDark ? "0 1px 0 rgba(255,255,255,0.04) inset" : "0 1px 0 rgba(255,255,255,0.80) inset",
                        }}
                      >
                        <div className="flex flex-col gap-1 min-w-0 items-start">
                          <span
                            className="text-[11px] font-semibold leading-tight truncate w-full"
                            style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)" }}
                          >
                            {seller.name}
                          </span>
                          <TeamBadgeDsm teamName={seller.teamName} />
                        </div>

                        <div className="flex flex-col items-center gap-0.5 shrink-0 mr-2">
                          <span
                            className="text-[8px] font-bold uppercase tracking-[0.10em]"
                            style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                          >
                            {isSaving ? "Salvando…" : "Férias?"}
                          </span>
                          <div
                            className={cn("flex items-center rounded-lg p-0.5", isSaving && "opacity-50 pointer-events-none")}
                            style={{
                              background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.07)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}`,
                            }}
                          >
                            <button
                              className="px-2.5 py-0.5 rounded-md text-[9px] font-bold transition-all"
                              style={!onFerias ? {
                                background: isDark ? "rgba(52,211,153,0.18)" : "rgba(5,150,105,0.12)",
                                color: isDark ? "#34d399" : "#047857",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                              } : { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                              onClick={() => toggleSkipRecord(seller, false)}
                            >
                              Off
                            </button>
                            <button
                              className="px-2.5 py-0.5 rounded-md text-[9px] font-bold transition-all"
                              style={onFerias ? {
                                background: isDark ? "rgba(251,191,36,0.20)" : "rgba(251,191,36,0.18)",
                                color: isDark ? "#fbbf24" : "#b45309",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                              } : { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                              onClick={() => toggleSkipRecord(seller, true)}
                            >
                              On
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-1.5 py-3">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCardPage(idx)}
                  className={cn(
                    "h-6 w-6 rounded-full text-[10px] font-bold transition-all",
                    idx === cardPage ? "glass-button-active" : "text-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {modal}

      {/* Dropdown de seleção de operador */}
      {opMenu && tlEditing && createPortal(
        <div
          ref={opMenuRef}
          className="min-w-[80px] rounded-xl overflow-hidden py-1"
          style={{
            position: "fixed",
            top: opMenu.pos.top,
            left: opMenu.pos.left,
            zIndex: 10003,
            background: isDark ? "rgba(20,20,28,0.94)" : "rgba(255,255,255,0.97)",
            border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
          }}
        >
          {TL_OPS.map((op) => {
            const active = opMenu.field === "min" ? tlEditing.minOp === op : tlEditing.maxOp === op;
            return (
              <button
                key={op}
                onClick={() => {
                  setTlEditing((p) => p && (opMenu.field === "min" ? { ...p, minOp: op } : { ...p, maxOp: op }));
                  setOpMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-bold tabular-nums text-left transition-colors"
                style={{
                  color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                  background: active
                    ? isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"
                    : "transparent",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = active ? (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)") : "transparent"; }}
              >
                <Check className="h-3 w-3 shrink-0" style={{ opacity: active ? 1 : 0, color: isDark ? "#5eead4" : "#017E84" }} />
                {op}
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {pageMenuOpen && menuPos && createPortal(
        <div
          ref={pageMenuRef}
          className="min-w-[200px] rounded-xl overflow-hidden py-1"
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 10002,
            background: isDark ? "rgba(20,20,28,0.92)" : "rgba(255,255,255,0.96)",
            border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
          }}
        >
          {(["ferias", "comissao-tls", "rampup"] as const).map((key) => (
            <button
              key={key}
              onClick={() => { setActivePage(key); setPageMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-left transition-colors"
              style={{
                color: isDark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.72)",
                background: activePage === key
                  ? isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"
                  : "transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = activePage === key
                  ? isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"
                  : "transparent";
              }}
            >
              <Check
                className="h-3 w-3 shrink-0"
                style={{ opacity: activePage === key ? 1 : 0, color: isDark ? "#5eead4" : "#017E84" }}
              />
              {PAGE_LABELS[key]}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
