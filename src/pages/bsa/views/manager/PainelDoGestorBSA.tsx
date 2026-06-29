import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Building2, CalendarDays, Users, Search, X, ChevronDown, Check } from "lucide-react";
import { formatMonthLabel } from "@/lib/directSalesUtils";
import { useIsDark } from "@/hooks/useIsDark";
import { useBSAContext } from "@/contexts/BSAContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_DAILY_BILLABLE_HOURS, formatDateToMMDD, parseVacationDate } from "@/lib/bsaUtils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Local sub-components ──────────────────────────────────────────────────────

function BSATeamBadge({ teamName }: { teamName: string | undefined }) {
  if (!teamName) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-px text-[8px] font-semibold tracking-wide shrink-0"
      style={{ background: "rgba(91,137,158,0.15)", border: "1px solid rgba(91,137,158,0.28)", color: "#5B899E" }}
    >
      {teamName}
    </span>
  );
}

function AnalystCard({
  name,
  teamName,
  isDark,
  children,
}: {
  name: string;
  teamName: string | undefined;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-[62px] rounded-xl">
      {/* Blur layer — absolute, does NOT clip children */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background:          isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.28)",
          border:              `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.60)"}`,
          backdropFilter:      "blur(20px) saturate(1.6)",
          WebkitBackdropFilter:"blur(20px) saturate(1.6)",
          boxShadow: isDark ? "0 1px 0 rgba(255,255,255,0.04) inset" : "0 1px 0 rgba(255,255,255,0.80) inset",
        }}
      />
      {/* Content layer — no backdrop-filter, overflow visible */}
      <div className="relative flex items-center justify-between gap-3 px-3 py-2.5 min-h-[62px]">
        <div className="flex flex-col gap-1 min-w-0 items-start">
          <span
            className="text-[11px] font-semibold leading-tight truncate w-full"
            style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)" }}
          >
            {name}
          </span>
          <BSATeamBadge teamName={teamName} />
        </div>
        {children}
      </div>
    </div>
  );
}

function ToggleControl({
  label,
  active,
  isSaving,
  isDark,
  activeColor,
  onOff,
  onOn,
  compact,
}: {
  label: string;
  active: boolean;
  isSaving: boolean;
  isDark: boolean;
  activeColor: { bg: string; text: string };
  onOff: () => void;
  onOn: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-0.5 shrink-0 mr-2", isSaving && "opacity-50 pointer-events-none")}>
      <span
        className={cn("font-bold uppercase tracking-[0.10em]", compact ? "text-[7px]" : "text-[8px]")}
        style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
      >
        {label}
      </span>
      <div
        className="flex items-center rounded-lg p-0.5"
        style={{
          background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.07)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}`,
        }}
      >
        <button
          className={cn(compact ? "px-2 py-0.5 rounded-md text-[8px]" : "px-2.5 py-0.5 rounded-md text-[9px]", "font-bold transition-all")}
          style={!active ? {
            background: isDark ? "rgba(52,211,153,0.18)" : "rgba(5,150,105,0.12)",
            color:      isDark ? "#34d399" : "#047857",
            boxShadow:  "0 1px 3px rgba(0,0,0,0.15)",
          } : { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
          onClick={onOff}
        >
          Off
        </button>
        <button
          className={cn(compact ? "px-2 py-0.5 rounded-md text-[8px]" : "px-2.5 py-0.5 rounded-md text-[9px]", "font-bold transition-all")}
          style={active ? {
            background: activeColor.bg,
            color:      activeColor.text,
            boxShadow:  "0 1px 3px rgba(0,0,0,0.15)",
          } : { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
          onClick={onOn}
        >
          On
        </button>
      </div>
    </div>
  );
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (n: number) => void }) {
  return (
    <div className="shrink-0 flex items-center justify-center gap-1.5 py-3">
      {Array.from({ length: total }).map((_, idx) => (
        <button
          key={idx}
          onClick={() => onChange(idx)}
          className={cn(
            "h-6 w-6 rounded-full text-[10px] font-bold transition-all",
            idx === current ? "glass-button-active" : "text-muted-foreground/50 hover:text-foreground"
          )}
        >
          {idx + 1}
        </button>
      ))}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

type ActivePage    = "ferias" | "rampup" | "desconto";
type DescontoMode  = "todos" | "intervalo" | "dia";

const PAGE_LABELS: Record<ActivePage, string> = {
  ferias:   "Férias",
  rampup:   "Regra Ramp-Up",
  desconto: "Desconto de Horas",
};

// ── Main component ────────────────────────────────────────────────────────────

export function PainelDoGestorBSA({ onClose, onRefresh }: { onClose: () => void; onRefresh?: () => void }) {
  const {
    analysts,
    analystsByManager,
    teamLeaders,
    analystTeamName,
    selectedMonth,
    availableMonths,
  } = useBSAContext();

  const [month,       setMonth]       = useState(selectedMonth);
  const [teamFilter,  setTeamFilter]  = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen,  setSearchOpen]  = useState(false);

  const [feriasActive,      setFeriasActive]      = useState<Record<string, boolean>>({});
  const [feriasSavedActive, setFeriasSavedActive] = useState<Record<string, boolean>>({});
  const [feriasStart,       setFeriasStart]       = useState<Record<string, string>>({});
  const [feriasEnd,         setFeriasEnd]         = useState<Record<string, string>>({});
  // "saved" tracks what's committed to DB — used to clear old range correctly
  const [feriasSavedStart,  setFeriasSavedStart]  = useState<Record<string, string>>({});
  const [feriasSavedEnd,    setFeriasSavedEnd]    = useState<Record<string, string>>({});
  const [savingFerias,     setSavingFerias]     = useState<Record<string, boolean>>({});

  const [rampupOverrides,      setRampupOverrides]      = useState<Record<string, boolean>>({});
  const [rampupSavedOverrides, setRampupSavedOverrides] = useState<Record<string, boolean>>({});
  const [savingRampup,         setSavingRampup]         = useState<Record<string, boolean>>({});
  const [rampupMetaValues,     setRampupMetaValues]     = useState<Record<string, number | "">>({});
  const [rampupSavedMetaValues,setRampupSavedMetaValues]= useState<Record<string, number | "">>({});
  const [savingRampupMeta,     setSavingRampupMeta]     = useState<Record<string, boolean>>({});

  const [descontoValues,      setDescontoValues]      = useState<Record<string, number | "">>({});
  const [descontoSavedValues, setDescontoSavedValues] = useState<Record<string, number | "">>({});
  const [descontoMode,        setDescontoMode]        = useState<Record<string, DescontoMode>>({});
  const [descontoStart,       setDescontoStart]       = useState<Record<string, string>>({});
  const [descontoEnd,         setDescontoEnd]         = useState<Record<string, string>>({});
  const [descontoDay,         setDescontoDay]         = useState<Record<string, string>>({});
  const [descontoSavedMode,   setDescontoSavedMode]   = useState<Record<string, DescontoMode>>({});
  const [descontoSavedStart,  setDescontoSavedStart]  = useState<Record<string, string>>({});
  const [descontoSavedEnd,    setDescontoSavedEnd]    = useState<Record<string, string>>({});
  const [descontoSavedDay,    setDescontoSavedDay]    = useState<Record<string, string>>({});
  const [savingDesconto,      setSavingDesconto]      = useState<Record<string, boolean>>({});
  const [descontoDropdown,    setDescontoDropdown]    = useState<{ name: string; top: number; left: number } | null>(null);

  const [loadingState, setLoadingState] = useState(true);
  const [cardPage,     setCardPage]     = useState(0);
  const [activePage,   setActivePage]   = useState<ActivePage>("ferias");
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [menuPos,      setMenuPos]      = useState<{ top: number; left: number } | null>(null);

  const pageMenuRef   = useRef<HTMLDivElement>(null);
  const pageButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef     = useRef<HTMLInputElement>(null);
  const isDark        = useIsDark();

  // Consolidated fetch: vacation ranges (3-month window) + rampup + discount_hours (current month)
  useEffect(() => {
    setCardPage(0);
    setLoadingState(true);
    let cancelled = false;
    async function fetchMonthState() {
      const [year, mon] = month.split("-").map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      const dateFrom = `${month}-01`;
      const dateTo   = `${month}-${String(lastDay).padStart(2, "0")}`;

      // Single query: all BUSINESS DAY rows for the selected month
      const { data, error } = await (supabase as any)
        .from("billable_report")
        .select("user_name, report_date, skip_record, is_rampup, discount_hours, expected_billable_hours")
        .eq("day_type", "BUSINESS DAY")
        .gte("report_date", dateFrom)
        .lte("report_date", dateTo);

      if (cancelled) return;
      if (error) {
        toast({ title: "Erro ao carregar painel", description: error.message, variant: "destructive" });
        setLoadingState(false);
        return;
      }

      type MonthRow = {
        user_name:               string | null;
        report_date:             string | null;
        skip_record:             boolean | null;
        is_rampup:               boolean | null;
        discount_hours:          number | null;
        expected_billable_hours: number | null;
      };

      const vacationDates: Record<string, string[]>    = {};
      const rampup:        Record<string, boolean>     = {};
      const desconto:      Record<string, number | ""> = {};
      const rampupMeta:    Record<string, number | ""> = {};
      const discountDates: Record<string, string[]>    = {};
      const businessDayCnt: Record<string, number>     = {};

      for (const row of (data ?? []) as MonthRow[]) {
        if (!row.user_name || !row.report_date) continue;
        businessDayCnt[row.user_name] = (businessDayCnt[row.user_name] ?? 0) + 1;
        if (row.skip_record) {
          vacationDates[row.user_name] = vacationDates[row.user_name] ?? [];
          vacationDates[row.user_name].push(row.report_date);
        }
        if (row.is_rampup) {
          rampup[row.user_name] = true;
          if (row.expected_billable_hours != null && row.expected_billable_hours > 0) {
            rampupMeta[row.user_name] = row.expected_billable_hours;
          }
        }
        if (row.discount_hours != null && row.discount_hours > 0) {
          desconto[row.user_name] = row.discount_hours;
          discountDates[row.user_name] = discountDates[row.user_name] ?? [];
          discountDates[row.user_name].push(row.report_date);
        }
      }

      const fActive: Record<string, boolean> = {};
      const fStart:  Record<string, string>  = {};
      const fEnd:    Record<string, string>  = {};
      for (const [name, dates] of Object.entries(vacationDates)) {
        if (dates.length === 0) continue;
        dates.sort();
        fActive[name] = true;
        fStart[name]  = formatDateToMMDD(dates[0]);
        fEnd[name]    = formatDateToMMDD(dates[dates.length - 1]);
      }

      // Derive desconto mode from discount date patterns
      const dMode:  Record<string, DescontoMode> = {};
      const dStart: Record<string, string>        = {};
      const dEnd:   Record<string, string>        = {};
      const dDay:   Record<string, string>        = {};
      for (const [name, dates] of Object.entries(discountDates)) {
        if (dates.length === 0) continue;
        dates.sort();
        if (dates.length === 1) {
          dMode[name] = "dia";
          dDay[name]  = formatDateToMMDD(dates[0]);
        } else if (dates.length >= (businessDayCnt[name] ?? 0)) {
          dMode[name] = "todos";
        } else {
          dMode[name]  = "intervalo";
          dStart[name] = formatDateToMMDD(dates[0]);
          dEnd[name]   = formatDateToMMDD(dates[dates.length - 1]);
        }
      }

      setFeriasActive(fActive);
      setFeriasSavedActive(fActive);
      setFeriasStart(fStart);
      setFeriasEnd(fEnd);
      setFeriasSavedStart(fStart);
      setFeriasSavedEnd(fEnd);
      setRampupOverrides(rampup);
      setRampupSavedOverrides(rampup);
      setRampupMetaValues(rampupMeta);
      setRampupSavedMetaValues(rampupMeta);
      setDescontoValues(desconto);
      setDescontoSavedValues(desconto);
      setDescontoMode(dMode);
      setDescontoStart(dStart);
      setDescontoEnd(dEnd);
      setDescontoDay(dDay);
      setDescontoSavedMode(dMode);
      setDescontoSavedStart(dStart);
      setDescontoSavedEnd(dEnd);
      setDescontoSavedDay(dDay);
      setRampupMetaValues(rampupMeta);
      if (!cancelled) setLoadingState(false);
    }
    fetchMonthState();
    return () => { cancelled = true; };
  }, [month]);

  useEffect(() => { setCardPage(0); }, [teamFilter, searchQuery, activePage]);

  // ── Férias: save vacation range (cross-month supported) ──────────────────
  // NOTE: year-boundary edge case (e.g., Dec→Jan) uses selected month's year for both dates.
  // Cross-year vacations are unsupported — not a realistic scenario for this team.
  const saveVacationRange = useCallback(async (
    name: string,
    active: boolean,
    startMMDD: string,
    endMMDD: string,
  ) => {
    if (savingFerias[name]) return;
    const year = Number(month.split("-")[0]);

    // OFF path: clear using SAVED range (not live input) to avoid stale-closure issues
    if (!active) {
      const clearStart = parseVacationDate(feriasSavedStart[name] ?? "", year)
        ?? `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const clearEnd = parseVacationDate(feriasSavedEnd[name] ?? "", year)
        ?? `${month}-${String(lastDay).padStart(2, "0")}`;

      setSavingFerias((s) => ({ ...s, [name]: true }));
      setFeriasActive((o) => ({ ...o, [name]: false }));

      const { error } = await (supabase as any)
        .from("billable_report")
        .update({ skip_record: false, expected_billable_hours: DEFAULT_DAILY_BILLABLE_HOURS })
        .eq("user_name", name)
        .eq("day_type", "BUSINESS DAY")
        .gte("report_date", clearStart)
        .lte("report_date", clearEnd);

      setSavingFerias((s) => ({ ...s, [name]: false }));
      if (error) {
        setFeriasActive((o) => ({ ...o, [name]: true }));
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        setFeriasSavedActive((o) => ({ ...o, [name]: false }));
        setFeriasStart((o) => ({ ...o, [name]: "" }));
        setFeriasEnd((o) => ({ ...o, [name]: "" }));
        setFeriasSavedStart((o) => ({ ...o, [name]: "" }));
        setFeriasSavedEnd((o) => ({ ...o, [name]: "" }));
        onRefresh?.();
      }
      return;
    }

    // ON path: requires valid dates
    const parsedStart = parseVacationDate(startMMDD, year);
    const parsedEnd   = parseVacationDate(endMMDD, year);
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) return;

    setSavingFerias((s) => ({ ...s, [name]: true }));

    // Step 1: clear SAVED range — uses saved baseline so narrowing a range clears orphaned days
    const savedStart = parseVacationDate(feriasSavedStart[name] ?? "", year);
    const savedEnd   = parseVacationDate(feriasSavedEnd[name] ?? "", year);
    if (savedStart && savedEnd && (savedStart !== parsedStart || savedEnd !== parsedEnd)) {
      await (supabase as any)
        .from("billable_report")
        .update({ skip_record: false, expected_billable_hours: DEFAULT_DAILY_BILLABLE_HOURS })
        .eq("user_name", name)
        .eq("day_type", "BUSINESS DAY")
        .gte("report_date", savedStart)
        .lte("report_date", savedEnd);
    }

    // Step 2: set new range — business days only
    const { data, error } = await (supabase as any)
      .from("billable_report")
      .update({ skip_record: true, expected_billable_hours: 0 })
      .eq("user_name", name)
      .eq("day_type", "BUSINESS DAY")
      .gte("report_date", parsedStart)
      .lte("report_date", parsedEnd)
      .select("report_date");

    setSavingFerias((s) => ({ ...s, [name]: false }));
    if (error) {
      setFeriasActive((o) => ({ ...o, [name]: false }));
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else if (!data || data.length === 0) {
      // Revert optimistic toggle — DB was not updated
      setFeriasActive((o) => ({ ...o, [name]: false }));
      setFeriasStart((o) => ({ ...o, [name]: "" }));
      setFeriasEnd((o) => ({ ...o, [name]: "" }));
      toast({ title: "Nenhum registro atualizado", description: `Sem dias úteis para ${name} no período informado. Verifique se as datas existem no banco.`, variant: "destructive" });
    } else {
      // Commit live inputs to saved baseline
      setFeriasActive((o) => ({ ...o, [name]: true }));
      setFeriasSavedActive((o) => ({ ...o, [name]: true }));
      setFeriasStart((o) => ({ ...o, [name]: startMMDD }));
      setFeriasEnd((o) => ({ ...o, [name]: endMMDD }));
      setFeriasSavedStart((o) => ({ ...o, [name]: startMMDD }));
      setFeriasSavedEnd((o) => ({ ...o, [name]: endMMDD }));
      onRefresh?.();
    }
  }, [savingFerias, feriasSavedStart, feriasSavedEnd, month, onRefresh]);

  // ── Ramp-Up toggle ────────────────────────────────────────────────────────
  const toggleIsRampup = useCallback(async (name: string, value: boolean) => {
    if (savingRampup[name]) return;
    const prev = rampupOverrides[name] ?? false;
    setSavingRampup((s) => ({ ...s, [name]: true }));
    setRampupOverrides((o) => ({ ...o, [name]: value }));
    const [year, mon] = month.split("-").map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const dateTo  = `${month}-${String(lastDay).padStart(2, "0")}`;
    const { data, error } = await (supabase as any)
      .from("billable_report")
      .update({ is_rampup: value })
      .eq("user_name", name)
      .gte("report_date", `${month}-01`)
      .lte("report_date", dateTo)
      .select("report_date");
    setSavingRampup((s) => ({ ...s, [name]: false }));
    if (error) {
      setRampupOverrides((o) => ({ ...o, [name]: prev }));
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else if (!data || data.length === 0) {
      setRampupOverrides((o) => ({ ...o, [name]: prev }));
      toast({ title: "Nenhum registro atualizado", description: `Sem dados para ${name} em ${formatMonthLabel(month)}`, variant: "destructive" });
    } else {
      if (value) {
        setRampupOverrides((o)      => ({ ...o, [name]: true }));
        setRampupSavedOverrides((o) => ({ ...o, [name]: true }));
        setRampupMetaValues((o) => ({ ...o, [name]: o[name] || DEFAULT_DAILY_BILLABLE_HOURS }));
      }
      if (!value) {
        await (supabase as any)
          .from("billable_report")
          .update({ expected_billable_hours: DEFAULT_DAILY_BILLABLE_HOURS, discount_hours: 0 })
          .eq("user_name", name)
          .eq("day_type", "BUSINESS DAY")
          .gte("report_date", `${month}-01`)
          .lte("report_date", dateTo)
          .select("report_date");
        setRampupSavedOverrides((o)  => ({ ...o, [name]: false }));
        setRampupMetaValues((o)      => ({ ...o, [name]: DEFAULT_DAILY_BILLABLE_HOURS }));
        setRampupSavedMetaValues((o) => ({ ...o, [name]: DEFAULT_DAILY_BILLABLE_HOURS }));
        setDescontoValues((o)        => ({ ...o, [name]: "" }));
        setDescontoSavedValues((o)   => ({ ...o, [name]: "" }));
        setDescontoMode((o)          => { const n = { ...o }; delete n[name]; return n; });
        setDescontoSavedMode((o)     => { const n = { ...o }; delete n[name]; return n; });
        setDescontoSavedStart((o)    => { const n = { ...o }; delete n[name]; return n; });
        setDescontoSavedEnd((o)      => { const n = { ...o }; delete n[name]; return n; });
        setDescontoSavedDay((o)      => { const n = { ...o }; delete n[name]; return n; });
      }
      onRefresh?.();
    }
  }, [savingRampup, rampupOverrides, month, onRefresh]);

  // ── Ramp-Up meta save (on blur / Enter) → overwrites expected_billable_hours workdays
  const saveRampupMeta = useCallback(async (name: string, value: number | "") => {
    if (savingRampupMeta[name]) return;
    const numValue = value === "" ? 0 : value;
    const prev = rampupMetaValues[name] ?? "";
    setSavingRampupMeta((s) => ({ ...s, [name]: true }));
    const [year, mon] = month.split("-").map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const dateTo  = `${month}-${String(lastDay).padStart(2, "0")}`;
    const { data, error } = await (supabase as any)
      .from("billable_report")
      .update({ expected_billable_hours: numValue })
      .eq("user_name", name)
      .eq("day_type", "BUSINESS DAY")
      .gte("report_date", `${month}-01`)
      .lte("report_date", dateTo)
      .select("report_date");
    setSavingRampupMeta((s) => ({ ...s, [name]: false }));
    if (error) {
      setRampupMetaValues((o) => ({ ...o, [name]: prev }));
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else if (!data || data.length === 0) {
      setRampupMetaValues((o) => ({ ...o, [name]: prev }));
      toast({ title: "Nenhum registro atualizado", description: `Sem dados para ${name} em ${formatMonthLabel(month)}`, variant: "destructive" });
    } else {
      setRampupSavedMetaValues((o) => ({ ...o, [name]: numValue }));
      onRefresh?.();
    }
  }, [savingRampupMeta, rampupMetaValues, month, onRefresh]);

  // ── Desconto save ─────────────────────────────────────────────────────────
  // mode="todos"     → write all business days of month
  // mode="intervalo" → clear month → write start..end (business days)
  // mode="dia"       → clear month → write single day
  // value=0/""       → clear entire month regardless of mode
  const saveDescontoRange = useCallback(async (
    name:       string,
    value:      number | "",
    mode:       DescontoMode,
    startOrDay: string,  // MM/DD: start for intervalo, the day for dia, ignored for todos
    end:        string,  // MM/DD: end for intervalo, ignored otherwise
  ) => {
    if (savingDesconto[name]) return;
    const numValue = value === "" ? 0 : value;
    const year = Number(month.split("-")[0]);
    const [, mon] = month.split("-").map(Number);
    const lastDay  = new Date(year, mon, 0).getDate();
    const monthStart = `${month}-01`;
    const monthEnd   = `${month}-${String(lastDay).padStart(2, "0")}`;

    setSavingDesconto((s) => ({ ...s, [name]: true }));

    // value=0 → clear entire month
    if (numValue === 0) {
      await (supabase as any)
        .from("billable_report")
        .update({ discount_hours: 0 })
        .eq("user_name", name)
        .eq("day_type", "BUSINESS DAY")
        .gte("report_date", monthStart)
        .lte("report_date", monthEnd);
      setSavingDesconto((s) => ({ ...s, [name]: false }));
      setDescontoValues((o)      => ({ ...o, [name]: "" }));
      setDescontoSavedValues((o) => ({ ...o, [name]: "" }));
      setDescontoMode((o)        => { const n = { ...o }; delete n[name]; return n; });
      setDescontoSavedMode((o)   => { const n = { ...o }; delete n[name]; return n; });
      setDescontoSavedStart((o)  => { const n = { ...o }; delete n[name]; return n; });
      setDescontoSavedEnd((o)    => { const n = { ...o }; delete n[name]; return n; });
      setDescontoSavedDay((o)    => { const n = { ...o }; delete n[name]; return n; });
      onRefresh?.();
      return;
    }

    if (mode === "todos") {
      const { data, error } = await (supabase as any)
        .from("billable_report")
        .update({ discount_hours: numValue })
        .eq("user_name", name)
        .eq("day_type", "BUSINESS DAY")
        .gte("report_date", monthStart)
        .lte("report_date", monthEnd)
        .select("report_date");
      setSavingDesconto((s) => ({ ...s, [name]: false }));
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else if (!data || data.length === 0) {
        toast({ title: "Nenhum registro atualizado", description: `Sem dias úteis para ${name} em ${formatMonthLabel(month)}`, variant: "destructive" });
      } else {
        setDescontoSavedValues((o) => ({ ...o, [name]: numValue }));
        setDescontoSavedMode((o)   => ({ ...o, [name]: "todos" }));
        onRefresh?.();
      }
      return;
    }

    // intervalo or dia
    const parsedStart = parseVacationDate(startOrDay, year);
    const parsedEnd   = mode === "dia" ? parsedStart : parseVacationDate(end, year);
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
      setSavingDesconto((s) => ({ ...s, [name]: false }));
      return;
    }

    // Step 1: clear entire month
    await (supabase as any)
      .from("billable_report")
      .update({ discount_hours: 0 })
      .eq("user_name", name)
      .eq("day_type", "BUSINESS DAY")
      .gte("report_date", monthStart)
      .lte("report_date", monthEnd);

    // Step 2: apply to range (business days only)
    const { data, error } = await (supabase as any)
      .from("billable_report")
      .update({ discount_hours: numValue })
      .eq("user_name", name)
      .eq("day_type", "BUSINESS DAY")
      .gte("report_date", parsedStart)
      .lte("report_date", parsedEnd)
      .select("report_date");

    setSavingDesconto((s) => ({ ...s, [name]: false }));
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else if (!data || data.length === 0) {
      toast({ title: "Nenhum registro atualizado", description: `Sem dias úteis para ${name} no período informado`, variant: "destructive" });
    } else {
      setDescontoSavedValues((o) => ({ ...o, [name]: numValue }));
      setDescontoSavedMode((o)   => ({ ...o, [name]: mode }));
      if (mode === "intervalo") {
        setDescontoSavedStart((o) => ({ ...o, [name]: startOrDay }));
        setDescontoSavedEnd((o)   => ({ ...o, [name]: end }));
      } else {
        setDescontoSavedDay((o) => ({ ...o, [name]: startOrDay }));
      }
      onRefresh?.();
    }
  }, [savingDesconto, month, onRefresh]);

  const filteredAnalysts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = teamFilter !== "todos" ? (analystsByManager[teamFilter] ?? []) : analysts;
    return [...base]
      .filter((name) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b));
  }, [analysts, analystsByManager, teamFilter, searchQuery]);

  const totalPages   = Math.max(1, Math.ceil(filteredAnalysts.length / PAGE_SIZE));
  const pageAnalysts = filteredAnalysts.slice(cardPage * PAGE_SIZE, (cardPage + 1) * PAGE_SIZE);

  // Derived from fetched state (not from analysts) — avoids timing gap where analysts hasn't loaded
  const allAusentes    = Object.entries(feriasActive).filter(([, v]) => v).map(([k]) => k).sort();
  const allRampup      = Object.entries(rampupOverrides).filter(([, v]) => v).map(([k]) => k).sort();
  const allComDesconto = Object.entries(descontoValues)
    .filter(([, v]) => v !== "" && v !== undefined && Number(v) > 0)
    .map(([k]) => k).sort();

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
      const t = e.target as Node;
      if (!pageButtonRef.current?.contains(t) && !pageMenuRef.current?.contains(t)) {
        setPageMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pageMenuOpen]);

  const glassCtrl: React.CSSProperties = {
    background:          isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.55)",
    border:              `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)"}`,
    backdropFilter:      "blur(12px) saturate(1.4)",
    WebkitBackdropFilter:"blur(12px) saturate(1.4)",
    color:               isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.6)",
  };

  const modal = createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backdropFilter:      "blur(8px) saturate(1.2)",
        WebkitBackdropFilter:"blur(8px) saturate(1.2)",
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.74) 100%)",
      }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-3xl overflow-hidden w-[1070px] max-w-[95vw] h-[715px] max-h-[90vh]"
        style={{
          background:          isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.52)",
          backdropFilter:      "blur(48px) saturate(2)",
          WebkitBackdropFilter:"blur(48px) saturate(2)",
          border:    isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(180,195,210,0.35)",
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

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div
          className="relative z-10 flex items-center gap-4 px-6 py-3.5 shrink-0 justify-between"
          style={{
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(255,255,255,0.55)",
            background:   isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.30)",
          }}
        >
          <div className="flex items-center gap-3 shrink-0">
            <Building2 className="h-4 w-4 shrink-0" style={{ color: isDark ? "#5eead4" : "#017E84" }} />
            <span
              className="text-[13px] font-bold tracking-[0.12em] uppercase"
              style={{ color: isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.78)" }}
            >
              Painel do Gestor — BSA
            </span>

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
                  placeholder="Buscar analista…"
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
                {[...teamLeaders].sort((a, b) => a.localeCompare(b)).map((tl) => (
                  <SelectItem key={tl} value={tl} className="text-xs">{tl}</SelectItem>
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

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 h-7 rounded-xl text-[11px] font-semibold transition-all hover:scale-[1.03] active:scale-[0.97] shrink-0"
              style={{
                background:          isDark ? "rgba(239,68,68,0.14)" : "rgba(220,38,38,0.09)",
                border:              "1px solid rgba(239,68,68,0.28)",
                backdropFilter:      "blur(12px)",
                WebkitBackdropFilter:"blur(12px)",
                color:               isDark ? "#fca5a5" : "#dc2626",
              }}
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              Sair
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col flex-1 overflow-hidden">

          {/* ── Férias ─────────────────────────────────────────────────────── */}
          {activePage === "ferias" && (
            <>
              <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4 flex flex-col gap-4">
                <div
                  className="rounded-xl px-4 py-3 flex items-start gap-3 shrink-0"
                  style={{
                    background: isDark ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.12)",
                    border:     `1px solid ${isDark ? "rgba(251,191,36,0.22)" : "rgba(251,191,36,0.35)"}`,
                  }}
                >
                  <span className="text-base leading-none mt-px">🌴</span>
                  <span className="text-[11px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.65)" }}>
                    Analistas em férias têm a <strong>Meta Billable reduzida</strong> apenas nos dias úteis do período informado e recebem o badge <strong>🌴 Férias</strong> na página principal. Datas no formato <strong>MM/DD</strong>.
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span
                    className="text-[11px] font-bold tracking-[0.10em] uppercase"
                    style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}
                  >
                    Ausentes em {formatMonthLabel(month)}
                  </span>
                  {allAusentes.length === 0 ? (
                    <span className="text-[11px] italic" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)" }}>
                      Nenhum analista marcado como ausente neste mês.
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {allAusentes.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            background: isDark ? "rgba(251,191,36,0.13)" : "rgba(251,191,36,0.15)",
                            border: `1px solid ${isDark ? "rgba(251,191,36,0.30)" : "rgba(251,191,36,0.45)"}`,
                            color: isDark ? "#fbbf24" : "#b45309",
                          }}
                        >
                          🌴 {name.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px w-full shrink-0" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

                {loadingState ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}>Carregando…</span>
                  </div>
                ) : filteredAnalysts.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)" }}>Nenhum analista encontrado.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {[...pageAnalysts, ...Array(PAGE_SIZE - pageAnalysts.length).fill(null)].map((name, idx) => {
                      if (!name) return <div key={`ghost-${idx}`} className="h-[62px] rounded-xl" />;
                      const active   = feriasActive[name] ?? false;
                      const isSaving = !!savingFerias[name];
                      const start    = feriasStart[name] ?? "";
                      const end      = feriasEnd[name] ?? "";
                      const bothValid = /^\d{1,2}\/\d{1,2}$/.test(start) && /^\d{1,2}\/\d{1,2}$/.test(end);
                      const isDirtyFerias =
                        active !== (feriasSavedActive[name] ?? false) ||
                        start  !== (feriasSavedStart[name]  ?? "")    ||
                        end    !== (feriasSavedEnd[name]    ?? "");
                      const sepStyle = { background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)" };
                      const inputStyle = {
                        color:      isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                        background: isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.05)",
                        border:     `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}`,
                      };
                      return (
                        <AnalystCard key={name} name={name} teamName={analystTeamName[name]} isDark={isDark}>
                          <div className={cn("flex items-center gap-1.5 shrink-0", isSaving && "opacity-50 pointer-events-none")}>

                            {/* Off / On inline toggle */}
                            <div
                              className="flex items-center rounded-lg p-0.5 shrink-0"
                              style={{ background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.07)", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}` }}
                            >
                              <button
                                className="px-2 py-0.5 rounded-md text-[8px] font-bold transition-all"
                                style={!active ? { background: isDark ? "rgba(52,211,153,0.18)" : "rgba(5,150,105,0.12)", color: isDark ? "#34d399" : "#047857", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" } : { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                                onClick={() => setFeriasActive((o) => ({ ...o, [name]: false }))}
                              >Off</button>
                              <button
                                className="px-2 py-0.5 rounded-md text-[8px] font-bold transition-all"
                                style={active ? { background: isDark ? "rgba(251,191,36,0.20)" : "rgba(251,191,36,0.18)", color: isDark ? "#fbbf24" : "#b45309", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" } : { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                                onClick={() => {
                                  setFeriasActive((o) => ({ ...o, [name]: true }));
                                  // Clear stale dates from other months when activating fresh
                                  if (!active) { setFeriasStart((o) => ({ ...o, [name]: "" })); setFeriasEnd((o) => ({ ...o, [name]: "" })); }
                                }}
                              >On</button>
                            </div>

                            {/* Date range — visible when active */}
                            {active && (
                              <>
                                <div className="w-px h-3.5 shrink-0" style={sepStyle} />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <input
                                    type="text" maxLength={5} value={start}
                                    onChange={(e) => setFeriasStart((o) => ({ ...o, [name]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                    placeholder="MM/DD"
                                    className="w-[36px] outline-none border-none text-[9px] font-semibold text-center rounded h-5"
                                    style={inputStyle}
                                  />
                                  <span className="text-[8px] font-bold shrink-0" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)" }}>→</span>
                                  <input
                                    type="text" maxLength={5} value={end}
                                    onChange={(e) => setFeriasEnd((o) => ({ ...o, [name]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                    placeholder="MM/DD"
                                    className="w-[36px] outline-none border-none text-[9px] font-semibold text-center rounded h-5"
                                    style={inputStyle}
                                  />
                                </div>
                              </>
                            )}

                            {/* save icon */}
                            {isDirtyFerias && (
                              <>
                                <div className="w-px h-3.5 shrink-0" style={sepStyle} />
                                <button
                                  onClick={() => saveVacationRange(name, active, start, end)}
                                  disabled={isSaving || (active && !bothValid)}
                                  className="h-6 w-6 flex items-center justify-center rounded-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-40"
                                  style={{ background: isDark ? "rgba(52,211,153,0.10)" : "rgba(5,150,105,0.08)", border: `1px solid ${isDark ? "rgba(52,211,153,0.22)" : "rgba(5,150,105,0.18)"}`, color: isDark ? "#34d399" : "#047857" }}
                                ><Check className="w-3 h-3" /></button>
                              </>
                            )}
                          </div>
                        </AnalystCard>
                      );
                    })}
                  </div>
                )}
              </div>
              {totalPages > 1 && <Pagination current={cardPage} total={totalPages} onChange={setCardPage} />}
            </>
          )}

          {/* ── Ramp-Up ────────────────────────────────────────────────────── */}
          {activePage === "rampup" && (
            <>
              <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4 flex flex-col gap-4">
                <div
                  className="rounded-xl px-4 py-3 flex items-start gap-3 shrink-0"
                  style={{
                    background: isDark ? "rgba(91,137,158,0.10)" : "rgba(91,137,158,0.10)",
                    border:     `1px solid ${isDark ? "rgba(91,137,158,0.25)" : "rgba(91,137,158,0.30)"}`,
                  }}
                >
                  <span className="text-base leading-none mt-px">🚀</span>
                  <span className="text-[11px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.65)" }}>
                    Analistas em Ramp-Up recebem uma <strong>meta menor e personalizada</strong> para o mês — definida pelo gestor no campo ao lado. Além disso, recebem o badge <strong>🚀 Ramp-up</strong> em sua tela inicial.
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span
                    className="text-[11px] font-bold tracking-[0.10em] uppercase"
                    style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}
                  >
                    Em Ramp-Up em {formatMonthLabel(month)}
                  </span>
                  {allRampup.length === 0 ? (
                    <span className="text-[11px] italic" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)" }}>
                      Nenhum analista em Ramp-Up neste mês.
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {allRampup.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            background: isDark ? "rgba(91,137,158,0.18)" : "rgba(91,137,158,0.14)",
                            border: `1px solid ${isDark ? "rgba(91,137,158,0.35)" : "rgba(91,137,158,0.40)"}`,
                            color: isDark ? "#7eb8d4" : "#3a7a96",
                          }}
                        >
                          🚀 {name.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px w-full shrink-0" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

                {loadingState ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}>Carregando…</span>
                  </div>
                ) : filteredAnalysts.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)" }}>Nenhum analista encontrado.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {[...pageAnalysts, ...Array(PAGE_SIZE - pageAnalysts.length).fill(null)].map((name, idx) => {
                      if (!name) return <div key={`ghost-${idx}`} className="h-[62px] rounded-xl" />;
                      const emRampup     = rampupOverrides[name] ?? false;
                      const isSaving     = !!savingRampup[name];
                      const isSavingMeta = !!savingRampupMeta[name];
                      const isDirtyRampup =
                        emRampup !== (rampupSavedOverrides[name] ?? false) ||
                        (emRampup && rampupMetaValues[name] !== (rampupSavedMetaValues[name] ?? ""));
                      const sepStyleR = { background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)" };
                      return (
                        <AnalystCard key={name} name={name} teamName={analystTeamName[name]} isDark={isDark}>
                          <div className={cn("flex items-center gap-1.5 shrink-0", (isSaving || isSavingMeta) && "opacity-50 pointer-events-none")}>

                            {/* Off / On inline toggle */}
                            <div
                              className="flex items-center rounded-lg p-0.5 shrink-0"
                              style={{ background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.07)", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}` }}
                            >
                              <button
                                className="px-2 py-0.5 rounded-md text-[8px] font-bold transition-all"
                                style={!emRampup ? { background: isDark ? "rgba(52,211,153,0.18)" : "rgba(5,150,105,0.12)", color: isDark ? "#34d399" : "#047857", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" } : { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                                onClick={() => setRampupOverrides((o) => ({ ...o, [name]: false }))}
                              >Off</button>
                              <button
                                className="px-2 py-0.5 rounded-md text-[8px] font-bold transition-all"
                                style={emRampup ? { background: isDark ? "rgba(91,137,158,0.22)" : "rgba(91,137,158,0.18)", color: isDark ? "#7eb8d4" : "#3a7a96", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" } : { color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                                onClick={() => setRampupOverrides((o) => ({ ...o, [name]: true }))}
                              >On</button>
                            </div>

                            {/* Meta/dia input — visible when active */}
                            {emRampup && (
                              <>
                                <div className="w-px h-3.5 shrink-0" style={sepStyleR} />
                                <div
                                  className="flex items-center rounded-lg px-1.5 h-6 shrink-0"
                                  style={{ background: isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.05)", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}` }}
                                >
                                  <input
                                    type="number" min={0} step={0.5}
                                    value={rampupMetaValues[name] ?? ""}
                                    onChange={(e) => setRampupMetaValues((o) => ({ ...o, [name]: e.target.value === "" ? "" : Number(e.target.value) }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                    placeholder="6.5"
                                    className="w-8 bg-transparent outline-none border-none text-[9px] font-semibold text-center"
                                    style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)" }}
                                  />
                                  <span className="text-[8px] ml-0.5" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}>h</span>
                                </div>
                              </>
                            )}

                            {/* save icon */}
                            {isDirtyRampup && (
                              <>
                                <div className="w-px h-3.5 shrink-0" style={sepStyleR} />
                                <button
                                  onClick={async () => {
                                    const savedActive = rampupSavedOverrides[name] ?? false;
                                    if (emRampup !== savedActive) { await toggleIsRampup(name, emRampup); }
                                    if (emRampup) { await saveRampupMeta(name, rampupMetaValues[name] ?? ""); }
                                  }}
                                  disabled={isSaving || isSavingMeta}
                                  className="h-6 w-6 flex items-center justify-center rounded-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-40"
                                  style={{ background: isDark ? "rgba(91,137,158,0.12)" : "rgba(91,137,158,0.10)", border: `1px solid ${isDark ? "rgba(91,137,158,0.28)" : "rgba(91,137,158,0.22)"}`, color: isDark ? "#7eb8d4" : "#3a7a96" }}
                                ><Check className="w-3 h-3" /></button>
                              </>
                            )}
                          </div>
                        </AnalystCard>
                      );
                    })}
                  </div>
                )}
              </div>
              {totalPages > 1 && <Pagination current={cardPage} total={totalPages} onChange={setCardPage} />}
            </>
          )}

          {/* ── Desconto de Horas ──────────────────────────────────────────── */}
          {activePage === "desconto" && (
            <>
              <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4 flex flex-col gap-4">
                <div
                  className="rounded-xl px-4 py-3 flex items-start gap-3 shrink-0"
                  style={{
                    background: isDark ? "rgba(113,75,103,0.10)" : "rgba(113,75,103,0.08)",
                    border:     `1px solid ${isDark ? "rgba(113,75,103,0.28)" : "rgba(113,75,103,0.28)"}`,
                  }}
                >
                  <span className="text-base leading-none mt-px">⏱️</span>
                  <span className="text-[11px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.65)" }}>
                    Defina o desconto de horas para cada analista. Escolha o modo: <strong>Todos</strong> os dias úteis do mês, um <strong>Intervalo</strong> de datas (MM/DD → MM/DD) ou um <strong>Dia</strong> único (MM/DD). O desconto <strong>reduz a meta diária</strong> automaticamente.
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span
                    className="text-[11px] font-bold tracking-[0.10em] uppercase"
                    style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}
                  >
                    Descontos ativos em {formatMonthLabel(month)}
                  </span>
                  {allComDesconto.length === 0 ? (
                    <span className="text-[11px] italic" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)" }}>
                      Nenhum analista com desconto ativo neste mês.
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {allComDesconto.map((name) => {
                        const sMode = descontoSavedMode[name] ?? "todos";
                        const rangeSuffix = sMode === "intervalo"
                          ? ` | ${descontoSavedStart[name]}–${descontoSavedEnd[name]}`
                          : sMode === "dia"
                            ? ` | ${descontoSavedDay[name]}`
                            : "";
                        return (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{
                              background: isDark ? "rgba(113,75,103,0.18)" : "rgba(113,75,103,0.12)",
                              border: `1px solid ${isDark ? "rgba(113,75,103,0.38)" : "rgba(113,75,103,0.32)"}`,
                              color: isDark ? "#c084b0" : "#714B67",
                            }}
                          >
                            ⏱️ {name.toUpperCase()} — {descontoValues[name]}h{rangeSuffix}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="h-px w-full shrink-0" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

                {loadingState ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}>Carregando…</span>
                  </div>
                ) : filteredAnalysts.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)" }}>Nenhum analista encontrado.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {[...pageAnalysts, ...Array(PAGE_SIZE - pageAnalysts.length).fill(null)].map((name, idx) => {
                      if (!name) return <div key={`ghost-${idx}`} className="h-[62px] rounded-xl" />;
                      const isSaving = !!savingDesconto[name];
                      const curVal   = descontoValues[name] ?? "";
                      const curMode  = descontoMode[name] ?? "todos";
                      const curStart = descontoStart[name] ?? "";
                      const curEnd   = descontoEnd[name] ?? "";
                      const curDay   = descontoDay[name] ?? "";
                      const isDirtyDesconto =
                        curVal   !== (descontoSavedValues[name] ?? "")      ||
                        curMode  !== (descontoSavedMode[name]  ?? "todos")  ||
                        curStart !== (descontoSavedStart[name] ?? "")       ||
                        curEnd   !== (descontoSavedEnd[name]   ?? "")       ||
                        curDay   !== (descontoSavedDay[name]   ?? "");
                      const isDropOpen = descontoDropdown?.name === name;
                      const sepStyleD  = { background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)" };
                      const modeLabel  = curMode === "todos" ? "Todos" : curMode === "intervalo" ? "Intervalo" : "Dia";
                      return (
                        <AnalystCard key={name} name={name} teamName={analystTeamName[name]} isDark={isDark}>
                          <div className={cn("flex items-center gap-1.5 shrink-0", isSaving && "opacity-50 pointer-events-none")}>

                            {/* Mode pill — dropdown rendered via portal */}
                            <button
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDescontoDropdown(isDropOpen ? null : { name, top: rect.bottom + 4, left: rect.left });
                              }}
                              className="flex items-center gap-1 px-2 h-6 rounded-lg text-[8px] font-semibold shrink-0 transition-all hover:opacity-80"
                              style={{ background: isDark ? "rgba(113,75,103,0.30)" : "rgba(113,75,103,0.14)", color: isDark ? "#c084b0" : "#714B67", border: `1px solid ${isDark ? "rgba(113,75,103,0.40)" : "rgba(113,75,103,0.22)"}` }}
                            >
                              {modeLabel}
                              <ChevronDown className={cn("w-2.5 h-2.5 transition-transform duration-150", isDropOpen && "rotate-180")} />
                            </button>

                            <div className="w-px h-3.5 shrink-0" style={sepStyleD} />

                            {/* Hours input */}
                            <div
                              className="flex items-center rounded-lg px-1.5 h-6 shrink-0"
                              style={{ background: isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.05)", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}` }}
                            >
                              <input
                                type="number" min={0} step={0.5}
                                value={curVal}
                                onChange={(e) => setDescontoValues((o) => ({ ...o, [name]: e.target.value === "" ? "" : Number(e.target.value) }))}
                                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                placeholder="0"
                                className="w-8 bg-transparent outline-none border-none text-[9px] font-semibold text-center"
                                style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)" }}
                              />
                              <span className="text-[8px] ml-0.5" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}>h</span>
                            </div>

                            {/* Intervalo date inputs */}
                            {curMode === "intervalo" && (
                              <>
                                <div className="w-px h-3.5 shrink-0" style={sepStyleD} />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <input
                                    type="text" placeholder="MM/DD" maxLength={5} value={curStart}
                                    onChange={(e) => setDescontoStart((o) => ({ ...o, [name]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                    className="w-[36px] outline-none border-none text-[9px] font-semibold text-center rounded h-5"
                                    style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)", background: isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.05)", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}` }}
                                  />
                                  <span className="text-[8px] font-bold shrink-0" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)" }}>→</span>
                                  <input
                                    type="text" placeholder="MM/DD" maxLength={5} value={curEnd}
                                    onChange={(e) => setDescontoEnd((o) => ({ ...o, [name]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                    className="w-[36px] outline-none border-none text-[9px] font-semibold text-center rounded h-5"
                                    style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)", background: isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.05)", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}` }}
                                  />
                                </div>
                              </>
                            )}

                            {/* Dia único date input */}
                            {curMode === "dia" && (
                              <>
                                <div className="w-px h-3.5 shrink-0" style={sepStyleD} />
                                <input
                                  type="text" placeholder="MM/DD" maxLength={5} value={curDay}
                                  onChange={(e) => setDescontoDay((o) => ({ ...o, [name]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                  className="w-[36px] outline-none border-none text-[9px] font-semibold text-center rounded h-5 shrink-0"
                                  style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)", background: isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.05)", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"}` }}
                                />
                              </>
                            )}

                            {/* save icon */}
                            {isDirtyDesconto && (
                              <>
                                <div className="w-px h-3.5 shrink-0" style={sepStyleD} />
                                <button
                                  onClick={() => saveDescontoRange(name, curVal, curMode, curMode === "dia" ? curDay : curStart, curMode === "intervalo" ? curEnd : "")}
                                  disabled={isSaving}
                                  className="h-6 w-6 flex items-center justify-center rounded-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-40"
                                  style={{ background: isDark ? "rgba(113,75,103,0.14)" : "rgba(113,75,103,0.10)", border: `1px solid ${isDark ? "rgba(113,75,103,0.35)" : "rgba(113,75,103,0.22)"}`, color: isDark ? "#c084b0" : "#714B67" }}
                                ><Check className="w-3 h-3" /></button>
                              </>
                            )}
                          </div>
                        </AnalystCard>
                      );
                    })}
                  </div>
                )}
              </div>
              {totalPages > 1 && <Pagination current={cardPage} total={totalPages} onChange={setCardPage} />}
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

      {descontoDropdown && createPortal(
        <>
          <div className="fixed inset-0 z-[10000]" onClick={() => setDescontoDropdown(null)} />
          <div
            className="fixed z-[10001] min-w-[100px] rounded-xl overflow-hidden"
            style={{
              top:        descontoDropdown.top,
              left:       descontoDropdown.left,
              background: isDark ? "rgba(18,18,28,0.98)" : "white",
              border:     `1px solid ${isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)"}`,
              boxShadow:  isDark ? "0 8px 24px rgba(0,0,0,0.55)" : "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            {(["todos", "intervalo", "dia"] as DescontoMode[]).map((m) => {
              const curM = descontoMode[descontoDropdown.name] ?? "todos";
              const isSelected = curM === m;
              return (
                <button
                  key={m}
                  onClick={() => { setDescontoMode((o) => ({ ...o, [descontoDropdown.name]: m })); setDescontoDropdown(null); }}
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[9px] font-medium text-left"
                  style={{
                    background: isSelected ? (isDark ? "rgba(113,75,103,0.55)" : "#714B67") : "transparent",
                    color:      isSelected ? "white" : (isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.68)"),
                  }}
                >
                  {isSelected
                    ? <Check className="w-2.5 h-2.5 shrink-0" />
                    : <span className="w-2.5 shrink-0 inline-block" />
                  }
                  {m === "todos" ? "Todos" : m === "intervalo" ? "Intervalo" : "Dia"}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}

      {pageMenuOpen && menuPos && createPortal(
        <div
          ref={pageMenuRef}
          className="min-w-[200px] rounded-xl overflow-hidden py-1"
          style={{
            position:            "fixed",
            top:                 menuPos.top,
            left:                menuPos.left,
            zIndex:              10002,
            background:          isDark ? "rgba(20,20,28,0.92)" : "rgba(255,255,255,0.96)",
            border:              isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
            backdropFilter:      "blur(20px)",
            WebkitBackdropFilter:"blur(20px)",
            boxShadow:           "0 8px 32px rgba(0,0,0,0.24)",
          }}
        >
          {(["ferias", "rampup", "desconto"] as const).map((key) => (
            <button
              key={key}
              onClick={() => { setActivePage(key); setPageMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-left transition-colors"
              style={{
                color:      isDark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.72)",
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
