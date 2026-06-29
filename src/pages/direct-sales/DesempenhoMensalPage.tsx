import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDummySalesRows } from "@/lib/dummyDataLoader";
import { cn } from "@/lib/utils";
import { useDirectSalesContext } from "@/contexts/DirectSalesContext";
import { useAuth } from "@/hooks/useAuth";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, CalendarDays, Camera, BarChart2, User, Users } from "lucide-react";
import {
  TEAM_NAME_FIXED_COLORS,
  TEAM_NAME_FALLBACK_COLORS,
  hashTeamName,
  formatMonthLabel,
} from "@/lib/directSalesUtils";
import {
  aggregateSellers,
  aggregateTeams,
  aggregateCompany,
  aggregateCompanyFromSellers,
  sellerRankingScore,
  sellerHistoricScore,
  getRowStatus,
  toMonthKeyStr,
  stripTetragram,
  extractTetragramFromName,
  getInitials,
} from "@/lib/desempenhoUtils";
import type { RawRow, RankNeighbors, TeamMetrics, SellerMetrics } from "@/lib/desempenhoUtils";
import { useEmployeeRankData } from "@/hooks/useEmployeeRankData";
import { DirectSalesPageControls } from "@/components/direct-sales/DirectSalesPageControls";
import {
  TeamBadgeDsm,
  TOP_PERFORMANCE_SELLERS,
  TopPerformanceBadge,
  GoatBadge,
  RankBadge,
  TopRankStreakBadge,
  StreakBadge,
  VacationBadge,
  getLeaderPhotoByName,
} from "./views/DesempenhoShared";
import { EmployeeView } from "./views/DesempenhoEmployee";
import { TeamLeaderView } from "./views/DesempenhoTeamLeader";
import { ManagerView } from "./views/DesempenhoManager";
import { PictureModePanel } from "./views/manager/PictureModePanel";
import { GeneralAnalyticsPanel } from "./views/manager/GeneralAnalyticsPanel";
import { type TlMultiplierRow } from "@/lib/tlUtils";
import { DummyDataBadge } from "@/components/DummyDataBadge";

export function DesempenhoMensalPage() {
  const { viewMode, filterUserId, filterManagerId, filterTeamLeaderId, roleLoading, dsUser } = useDirectSalesContext();
  const { user, profile } = useAuth();

  const [raw, setRaw] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(new Map());
  const [activeManagerIds, setActiveManagerIds] = useState<Set<number>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedTeamManager, setSelectedTeamManager] = useState<string | null>(null);
  const [painelOpen, setPainelOpen] = useState(false);
  const [pictureModeOpen, setPictureModeOpen] = useState(false);
  const [generalAnalyticsOpen, setGeneralAnalyticsOpen] = useState(false);
  const [managerTeamTarget, setManagerTeamTarget] = useState<TeamMetrics | null>(null);
  const [managerSellerTarget, setManagerSellerTarget] = useState<SellerMetrics | null>(null);
  const [tlSellerTarget, setTlSellerTarget] = useState<SellerMetrics | null>(null);
  const [tlRows, setTlRows] = useState<TlMultiplierRow[]>([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (roleLoading) return;

    async function load() {
      setLoading(true);
      let rows = await getDummySalesRows();

      if (filterUserId !== null) {
        rows = rows.filter((r) => r.user_id === filterUserId);
      } else if (filterManagerId !== null && filterTeamLeaderId !== null) {
        rows = rows.filter((r) => r.manager_id === filterManagerId || r.user_id === filterTeamLeaderId);
      }

      setRaw(rows as unknown as RawRow[]);
      setActiveManagerIds(new Set(rows.map((r) => r.manager_id).filter((id): id is number => id > 0)));
      setLoading(false);
    }

    load();
  }, [roleLoading, filterUserId, filterManagerId, filterTeamLeaderId, refreshKey]);

  useEffect(() => {
    setTlLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("tl_commission_multipliers" as any) as any)
      .select("id, plan_type, min_pct, max_pct, min_op, max_op, multiplier, label, active, updated_at")
      .eq("active", true)
      .order("plan_type")
      .order("min_pct")
      .then(({ data, error }: { data: TlMultiplierRow[] | null; error: unknown }) => {
        if (!error && data) setTlRows(data);
        setTlLoading(false);
      });
  }, []);

  useEffect(() => { setSelectedEmployeeId(null); setSelectedTeamManager(null); }, [selectedMonth]);

  // ── Meses disponíveis ─────────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const keys = new Set(raw.map((r) => toMonthKeyStr(r.date_from ?? "")));
    return Array.from(keys).sort().reverse();
  }, [raw]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // ── Dados do mês ──────────────────────────────────────────────────────────
  const monthRows = useMemo(
    () => raw.filter((r) => toMonthKeyStr(r.date_from ?? "") === selectedMonth),
    [raw, selectedMonth]
  );

  const sellers = useMemo(() => aggregateSellers(monthRows), [monthRows]);
  const teams = useMemo(() => aggregateTeams(sellers), [sellers]);
  // aggregateCompany(teams) exclui férias/ramp-up — usado apenas internamente se necessário
  const company = useMemo(() => aggregateCompanyFromSellers(sellers), [sellers]);

  // ── Simulação de time para admin em team_leader view ──────────────────────
  const activeTeamManager = useMemo(() => {
    if (filterManagerId !== null) return null;
    return selectedTeamManager ?? teams[0]?.managerName ?? null;
  }, [filterManagerId, selectedTeamManager, teams]);

  const tlTeams = useMemo(() => {
    if (filterManagerId !== null || !activeTeamManager) return teams;
    return teams.filter((t) => t.managerName === activeTeamManager);
  }, [filterManagerId, activeTeamManager, teams]);

  const tlAllRaw = useMemo(() => {
    if (filterManagerId !== null || !activeTeamManager) return raw;
    return raw.filter((r) => r.manager_name === activeTeamManager);
  }, [filterManagerId, activeTeamManager, raw]);

  const managerTeamRaw = useMemo(() => {
    if (!managerTeamTarget) return undefined;
    return raw.filter((r) => r.manager_name === managerTeamTarget.managerName);
  }, [managerTeamTarget, raw]);

  // ── userId efetivo para a view employee ──────────────────────────────────
  const activeEmployeeId = filterUserId ?? selectedEmployeeId ?? sellers[0]?.userId ?? null;

  // ── Rank admin (calculado de raw completo via useMemo) ────────────────────
  const rankedSellers = useMemo(
    () => [...sellers].sort((a, b) => sellerRankingScore(b.mrr.pct, b.nrr.pct) - sellerRankingScore(a.mrr.pct, a.nrr.pct)),
    [sellers]
  );

  const managerSellerRankData = useMemo(() => {
    const targetId = managerSellerTarget?.userId ?? null;
    if (!targetId) return { sellerRank: null, goatRank: null, topRankStreak: null, mrrStreak: 0, nrrStreak: 0 };

    const rankIdx = rankedSellers.findIndex((s) => s.userId === targetId);
    const sellerRankVal = rankIdx >= 0 ? rankIdx + 1 : null;

    type GoatEntry = { mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
    const goatByPerson = new Map<number, GoatEntry>();
    for (const r of raw) {
      if (r.user_id == null) continue;
      const status = getRowStatus(r);
      const rawAchieved = r.achieved ?? 0;
      const rawTarget = r.target_amount ?? 0;
      const planType = (r.plan_type ?? "").toUpperCase();
      if (status === "inativo" && rawAchieved <= 0) continue;
      const addAch = status === "ativo" ? rawAchieved : status === "inativo" ? rawAchieved : Math.max(0, rawAchieved);
      const addTgt = status === "ativo" ? rawTarget : status === "inativo" && rawTarget > 0 && rawAchieved > rawTarget ? rawTarget : 0;
      if (!goatByPerson.has(r.user_id)) goatByPerson.set(r.user_id, { mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
      const p = goatByPerson.get(r.user_id)!;
      if (planType === "MRR") { p.mrr.achieved += addAch; p.mrr.target += addTgt; }
      else if (planType === "NRR") { p.nrr.achieved += addAch; p.nrr.target += addTgt; }
    }
    const goatSorted = Array.from(goatByPerson.entries()).sort(([, a], [, b]) => sellerHistoricScore(b.mrr, b.nrr) - sellerHistoricScore(a.mrr, a.nrr));
    const goatIdx = goatSorted.findIndex(([uid]) => uid === targetId);
    const goatRankVal = goatIdx >= 0 ? goatIdx + 1 : null;

    const year = selectedMonth.slice(0, 4);
    const yearRows = raw.filter((r) => (r.date_from ?? "").startsWith(year));
    const months = [...new Set(yearRows.map((r) => toMonthKeyStr(r.date_from ?? "")).filter(Boolean))];
    type StreakEntry = { mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
    let top1 = 0, top2 = 0, top3 = 0;
    for (const month of months) {
      const mRows = yearRows.filter((r) => toMonthKeyStr(r.date_from ?? "") === month);
      const byPerson = new Map<number, StreakEntry>();
      for (const r of mRows) {
        if (r.user_id == null) continue;
        const status = getRowStatus(r);
        const ach = r.achieved ?? 0;
        const tgt = r.target_amount ?? 0;
        const planType = (r.plan_type ?? "").toUpperCase();
        if (status === "inativo" && ach <= 0) continue;
        const addAch = status !== "férias" && status !== "ramp-up" ? ach : Math.max(0, ach);
        const addTgt = status === "ativo" ? tgt : status === "inativo" && tgt > 0 && ach > tgt ? tgt : 0;
        if (!byPerson.has(r.user_id)) byPerson.set(r.user_id, { mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
        const p = byPerson.get(r.user_id)!;
        if (planType === "MRR") { p.mrr.achieved += addAch; p.mrr.target += addTgt; }
        else if (planType === "NRR") { p.nrr.achieved += addAch; p.nrr.target += addTgt; }
      }
      const sorted = [...byPerson.entries()].sort(([, a], [, b]) => {
        const mPA = a.mrr.target > 0 ? (a.mrr.achieved / a.mrr.target) * 100 : 0;
        const nPA = a.nrr.target > 0 ? (a.nrr.achieved / a.nrr.target) * 100 : 0;
        const mPB = b.mrr.target > 0 ? (b.mrr.achieved / b.mrr.target) * 100 : 0;
        const nPB = b.nrr.target > 0 ? (b.nrr.achieved / b.nrr.target) * 100 : 0;
        return sellerRankingScore(mPB, nPB) - sellerRankingScore(mPA, nPA);
      });
      const idx = sorted.findIndex(([uid]) => uid === targetId);
      if (idx === 0) top1++;
      else if (idx === 1) top2++;
      else if (idx === 2) top3++;
    }

    const userYearRaw = raw.filter((r) => r.user_id === targetId && (r.date_from ?? "").startsWith(year));
    const byMonthType = new Map<string, { achieved: number; target: number }>();
    for (const r of userYearRaw) {
      if (r.skip_record) continue;
      const type = (r.plan_type ?? "").toUpperCase();
      if (type !== "MRR" && type !== "NRR") continue;
      const key = `${toMonthKeyStr(r.date_from ?? "")}_${type}`;
      if (!byMonthType.has(key)) byMonthType.set(key, { achieved: 0, target: 0 });
      const e = byMonthType.get(key)!;
      e.achieved += r.achieved ?? 0;
      e.target += r.target_amount ?? 0;
    }
    let mrrStreak = 0, nrrStreak = 0;
    for (const [key, val] of byMonthType.entries()) {
      if (val.target <= 0 || val.achieved < val.target) continue;
      if (key.endsWith("_MRR")) mrrStreak++;
      else nrrStreak++;
    }

    return { sellerRank: sellerRankVal, goatRank: goatRankVal, topRankStreak: { top1, top2, top3 }, mrrStreak, nrrStreak };
  }, [managerSellerTarget, raw, selectedMonth, rankedSellers]);

  const tlSellerRankData = useMemo(() => {
    const targetId = tlSellerTarget?.userId ?? null;
    if (!targetId) return { sellerRank: null, goatRank: null, topRankStreak: null, mrrStreak: 0, nrrStreak: 0 };

    const rankIdx = rankedSellers.findIndex((s) => s.userId === targetId);
    const sellerRankVal = rankIdx >= 0 ? rankIdx + 1 : null;

    type GoatEntry = { mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
    const goatByPerson = new Map<number, GoatEntry>();
    for (const r of tlAllRaw) {
      if (r.user_id == null) continue;
      const status = getRowStatus(r);
      const rawAchieved = r.achieved ?? 0;
      const rawTarget = r.target_amount ?? 0;
      const planType = (r.plan_type ?? "").toUpperCase();
      if (status === "inativo" && rawAchieved <= 0) continue;
      const addAch = status === "ativo" ? rawAchieved : status === "inativo" ? rawAchieved : Math.max(0, rawAchieved);
      const addTgt = status === "ativo" ? rawTarget : status === "inativo" && rawTarget > 0 && rawAchieved > rawTarget ? rawTarget : 0;
      if (!goatByPerson.has(r.user_id)) goatByPerson.set(r.user_id, { mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
      const p = goatByPerson.get(r.user_id)!;
      if (planType === "MRR") { p.mrr.achieved += addAch; p.mrr.target += addTgt; }
      else if (planType === "NRR") { p.nrr.achieved += addAch; p.nrr.target += addTgt; }
    }
    const goatSorted = Array.from(goatByPerson.entries()).sort(([, a], [, b]) => sellerHistoricScore(b.mrr, b.nrr) - sellerHistoricScore(a.mrr, a.nrr));
    const goatIdx = goatSorted.findIndex(([uid]) => uid === targetId);
    const goatRankVal = goatIdx >= 0 ? goatIdx + 1 : null;

    const year = selectedMonth.slice(0, 4);
    const yearRows = tlAllRaw.filter((r) => (r.date_from ?? "").startsWith(year));
    const months = [...new Set(yearRows.map((r) => toMonthKeyStr(r.date_from ?? "")).filter(Boolean))];
    type StreakEntry = { mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
    let top1 = 0, top2 = 0, top3 = 0;
    for (const month of months) {
      const mRows = yearRows.filter((r) => toMonthKeyStr(r.date_from ?? "") === month);
      const byPerson = new Map<number, StreakEntry>();
      for (const r of mRows) {
        if (r.user_id == null) continue;
        const status = getRowStatus(r);
        const ach = r.achieved ?? 0;
        const tgt = r.target_amount ?? 0;
        const planType = (r.plan_type ?? "").toUpperCase();
        if (status === "inativo" && ach <= 0) continue;
        const addAch = status !== "férias" && status !== "ramp-up" ? ach : Math.max(0, ach);
        const addTgt = status === "ativo" ? tgt : status === "inativo" && tgt > 0 && ach > tgt ? tgt : 0;
        if (!byPerson.has(r.user_id)) byPerson.set(r.user_id, { mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
        const p = byPerson.get(r.user_id)!;
        if (planType === "MRR") { p.mrr.achieved += addAch; p.mrr.target += addTgt; }
        else if (planType === "NRR") { p.nrr.achieved += addAch; p.nrr.target += addTgt; }
      }
      const sorted = [...byPerson.entries()].sort(([, a], [, b]) => {
        const mPA = a.mrr.target > 0 ? (a.mrr.achieved / a.mrr.target) * 100 : 0;
        const nPA = a.nrr.target > 0 ? (a.nrr.achieved / a.nrr.target) * 100 : 0;
        const mPB = b.mrr.target > 0 ? (b.mrr.achieved / b.mrr.target) * 100 : 0;
        const nPB = b.nrr.target > 0 ? (b.nrr.achieved / b.nrr.target) * 100 : 0;
        return sellerRankingScore(mPB, nPB) - sellerRankingScore(mPA, nPA);
      });
      const idx = sorted.findIndex(([uid]) => uid === targetId);
      if (idx === 0) top1++;
      else if (idx === 1) top2++;
      else if (idx === 2) top3++;
    }

    const userYearRaw = tlAllRaw.filter((r) => r.user_id === targetId && (r.date_from ?? "").startsWith(year));
    const byMonthType = new Map<string, { achieved: number; target: number }>();
    for (const r of userYearRaw) {
      if (r.skip_record) continue;
      const type = (r.plan_type ?? "").toUpperCase();
      if (type !== "MRR" && type !== "NRR") continue;
      const key = `${toMonthKeyStr(r.date_from ?? "")}_${type}`;
      if (!byMonthType.has(key)) byMonthType.set(key, { achieved: 0, target: 0 });
      const e = byMonthType.get(key)!;
      e.achieved += r.achieved ?? 0;
      e.target += r.target_amount ?? 0;
    }
    let mrrStreak = 0, nrrStreak = 0;
    for (const [key, val] of byMonthType.entries()) {
      if (val.target <= 0 || val.achieved < val.target) continue;
      if (key.endsWith("_MRR")) mrrStreak++;
      else nrrStreak++;
    }

    return { sellerRank: sellerRankVal, goatRank: goatRankVal, topRankStreak: { top1, top2, top3 }, mrrStreak, nrrStreak };
  }, [tlSellerTarget, tlAllRaw, selectedMonth, rankedSellers]);

  const adminSellerRank = useMemo(() => {
    if (viewMode !== "employee" || filterUserId !== null || !activeEmployeeId) return null;
    const idx = rankedSellers.findIndex((s) => s.userId === activeEmployeeId);
    return idx >= 0 ? idx + 1 : null;
  }, [viewMode, filterUserId, activeEmployeeId, rankedSellers]);

  const adminRankNeighbors = useMemo((): RankNeighbors | null => {
    if (viewMode !== "employee" || filterUserId !== null || adminSellerRank === null) return null;
    const r = adminSellerRank;
    const above = r > 1 ? { name: rankedSellers[r - 2].name, rank: r - 1, total: rankedSellers[r - 2].total.achieved } : null;
    const below = r < rankedSellers.length ? { name: rankedSellers[r].name, rank: r + 1, total: rankedSellers[r].total.achieved } : null;
    return { above, below, total: rankedSellers.length };
  }, [viewMode, filterUserId, adminSellerRank, rankedSellers]);

  const adminGoatRank = useMemo(() => {
    if (viewMode !== "employee" || filterUserId !== null || !activeEmployeeId) return null;
    type GoatEntry = { mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
    const byPerson = new Map<number, GoatEntry>();
    for (const r of raw) {
      if (r.user_id == null) continue;
      const status = getRowStatus(r);
      const rawAchieved = r.achieved ?? 0;
      const rawTarget = r.target_amount ?? 0;
      const planType = (r.plan_type ?? "").toUpperCase();
      if (status === "inativo" && rawAchieved <= 0) continue;
      const addAch = status === "ativo" ? rawAchieved : status === "inativo" ? rawAchieved : Math.max(0, rawAchieved);
      const addTgt = status === "ativo" ? rawTarget : status === "inativo" && rawTarget > 0 && rawAchieved > rawTarget ? rawTarget : 0;
      if (!byPerson.has(r.user_id)) byPerson.set(r.user_id, { mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
      const p = byPerson.get(r.user_id)!;
      if (planType === "MRR") { p.mrr.achieved += addAch; p.mrr.target += addTgt; }
      else if (planType === "NRR") { p.nrr.achieved += addAch; p.nrr.target += addTgt; }
    }
    const sorted = Array.from(byPerson.entries()).sort(([, a], [, b]) =>
      sellerHistoricScore(b.mrr, b.nrr) - sellerHistoricScore(a.mrr, a.nrr)
    );
    const idx = sorted.findIndex(([uid]) => uid === activeEmployeeId);
    return idx >= 0 ? idx + 1 : null;
  }, [viewMode, filterUserId, activeEmployeeId, raw]);

  const adminTopRankStreak = useMemo(() => {
    if (viewMode !== "employee" || filterUserId !== null || !activeEmployeeId || !selectedMonth) return null;
    const year = selectedMonth.slice(0, 4);
    const yearRows = raw.filter((r) => (r.date_from ?? "").startsWith(year));
    const months = [...new Set(yearRows.map((r) => toMonthKeyStr(r.date_from ?? "")).filter(Boolean))];
    type StreakEntry = { mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
    let top1 = 0, top2 = 0, top3 = 0;
    for (const month of months) {
      const mRows = yearRows.filter((r) => toMonthKeyStr(r.date_from ?? "") === month);
      const byPerson = new Map<number, StreakEntry>();
      for (const r of mRows) {
        if (r.user_id == null) continue;
        const status = getRowStatus(r);
        const ach = r.achieved ?? 0;
        const tgt = r.target_amount ?? 0;
        const planType = (r.plan_type ?? "").toUpperCase();
        if (status === "inativo" && ach <= 0) continue;
        const addAch = status !== "férias" && status !== "ramp-up" ? ach : Math.max(0, ach);
        const addTgt = status === "ativo" ? tgt : status === "inativo" && tgt > 0 && ach > tgt ? tgt : 0;
        if (!byPerson.has(r.user_id)) byPerson.set(r.user_id, { mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
        const p = byPerson.get(r.user_id)!;
        if (planType === "MRR") { p.mrr.achieved += addAch; p.mrr.target += addTgt; }
        else if (planType === "NRR") { p.nrr.achieved += addAch; p.nrr.target += addTgt; }
      }
      const sorted = [...byPerson.entries()].sort(([, a], [, b]) => {
        const mPA = a.mrr.target > 0 ? (a.mrr.achieved / a.mrr.target) * 100 : 0;
        const nPA = a.nrr.target > 0 ? (a.nrr.achieved / a.nrr.target) * 100 : 0;
        const mPB = b.mrr.target > 0 ? (b.mrr.achieved / b.mrr.target) * 100 : 0;
        const nPB = b.nrr.target > 0 ? (b.nrr.achieved / b.nrr.target) * 100 : 0;
        return sellerRankingScore(mPB, nPB) - sellerRankingScore(mPA, nPA);
      });
      const idx = sorted.findIndex(([uid]) => uid === activeEmployeeId);
      if (idx === 0) top1++;
      else if (idx === 1) top2++;
      else if (idx === 2) top3++;
    }
    return { top1, top2, top3 };
  }, [viewMode, filterUserId, activeEmployeeId, selectedMonth, raw]);

  // ── Rank async para funcionário real (hook trata as queries separadas) ─────
  const empRankData = useEmployeeRankData({ viewMode, filterUserId, activeEmployeeId, selectedMonth });

  const sellerRank = filterUserId !== null ? empRankData.sellerRank : adminSellerRank;
  const rankNeighbors = filterUserId !== null ? empRankData.rankNeighbors : adminRankNeighbors;
  const goatRank = filterUserId !== null ? empRankData.goatRank : adminGoatRank;
  const topRankStreak = filterUserId !== null ? empRankData.topRankStreak : adminTopRankStreak;

  // ── Rank global do time para picture mode (team_leader view) ─────────────
  // Pool único: todos os times, score = avg(mrrPct, nrrPct) + bônus se ambos ≥ 100%
  const teamPictureModeRank = useMemo(() => {
    if (viewMode !== "team_leader" || !tlTeams[0]) return null;
    const myManager = tlTeams[0].managerName;
    const sorted = [...teams].sort(
      (a, b) => sellerRankingScore(b.mrr.pct, b.nrr.pct) - sellerRankingScore(a.mrr.pct, a.nrr.pct)
    );
    const idx = sorted.findIndex((t) => t.managerName === myManager);
    return idx >= 0 ? idx + 1 : null;
  }, [viewMode, teams, tlTeams]);

  // ── Streak anual do employee ──────────────────────────────────────────────
  const employeeCurrentSeller = useMemo(() => {
    if (viewMode !== "employee") return null;
    if (filterUserId != null) return sellers.find((s) => s.userId === filterUserId) ?? sellers[0] ?? null;
    if (activeEmployeeId) return sellers.find((s) => s.userId === activeEmployeeId) ?? sellers[0] ?? null;
    return sellers[0] ?? null;
  }, [viewMode, filterUserId, sellers, activeEmployeeId]);

  const { empMrrStreak, empNrrStreak } = useMemo(() => {
    if (viewMode !== "employee" || !employeeCurrentSeller?.userId) return { empMrrStreak: 0, empNrrStreak: 0 };
    const year = selectedMonth.slice(0, 4);
    const targetUserId = employeeCurrentSeller.userId;
    const userYearRaw = raw.filter((r) => r.user_id === targetUserId && (r.date_from ?? "").startsWith(year));
    const byMonthType = new Map<string, { achieved: number; target: number }>();
    for (const r of userYearRaw) {
      if (r.skip_record) continue;
      const type = (r.plan_type ?? "").toUpperCase();
      if (type !== "MRR" && type !== "NRR") continue;
      const key = `${toMonthKeyStr(r.date_from ?? "")}_${type}`;
      if (!byMonthType.has(key)) byMonthType.set(key, { achieved: 0, target: 0 });
      const e = byMonthType.get(key)!;
      e.achieved += r.achieved ?? 0;
      e.target += r.target_amount ?? 0;
    }
    let mrr = 0, nrr = 0;
    for (const [key, val] of byMonthType.entries()) {
      if (val.target <= 0 || val.achieved < val.target) continue;
      if (key.endsWith("_MRR")) mrr++;
      else nrr++;
    }
    return { empMrrStreak: mrr, empNrrStreak: nrr };
  }, [viewMode, employeeCurrentSeller?.userId, raw, selectedMonth]);

  // ── Título + heading data ─────────────────────────────────────────────────
  const currentTeamName = useMemo(() => {
    if (viewMode === "employee") {
      const seller = filterUserId != null
        ? sellers.find((s) => s.userId === filterUserId) ?? sellers[0]
        : (activeEmployeeId ? sellers.find((s) => s.userId === activeEmployeeId) : null) ?? sellers[0];
      return seller?.teamName ?? null;
    }
    if (viewMode === "team_leader") return tlTeams[0]?.sellers[0]?.teamName ?? sellers[0]?.teamName ?? null;
    return null;
  }, [viewMode, sellers, tlTeams, filterUserId, activeEmployeeId]);

  const pageTitle = useMemo(() => {
    if (viewMode === "employee") return "Seu Overview";
    if (viewMode === "team_leader") {
      if (filterManagerId !== null) {
        const teamName = sellers[0]?.teamName ?? dsUser?.userName ?? "";
        return teamName ? `Overview do seu time: ${teamName}` : "Overview do seu Time";
      }
      if (activeTeamManager) {
        const teamName = tlTeams[0]?.sellers[0]?.teamName ?? stripTetragram(activeTeamManager);
        return `Overview do time: ${teamName}`;
      }
      return "Overview do Time";
    }
    return "Overview do Direct Sales";
  }, [viewMode, sellers, dsUser?.userName, filterManagerId, activeTeamManager, tlTeams]);

  const leaderName = useMemo(() => {
    if (viewMode !== "team_leader") return "";
    if (filterManagerId !== null) return dsUser?.userName ? stripTetragram(dsUser.userName) : "";
    if (activeTeamManager) return stripTetragram(activeTeamManager);
    return "";
  }, [viewMode, filterManagerId, dsUser?.userName, activeTeamManager]);

  const leaderPhoto = useMemo(() => getLeaderPhotoByName(leaderName), [leaderName]);

  const teamColorForHeading = useMemo(() => {
    if (!currentTeamName) return null;
    return TEAM_NAME_FIXED_COLORS[currentTeamName] ?? TEAM_NAME_FALLBACK_COLORS[hashTeamName(currentTeamName)];
  }, [currentTeamName]);

  const teamTetragrams = useMemo(() => {
    if (viewMode !== "team_leader") return [];
    const teamSellers = tlTeams[0]?.sellers ?? sellers;
    return teamSellers.map((s) => extractTetragramFromName(s.name)).filter(Boolean);
  }, [viewMode, tlTeams, sellers]);

  const managerDisplayName = useMemo(() => {
    if (viewMode !== "manager") return "";
    return dsUser?.userName ? stripTetragram(dsUser.userName) : (user?.user_metadata?.full_name ?? "");
  }, [viewMode, dsUser?.userName, user?.user_metadata?.full_name]);

  const managerPhoto = useMemo(
    () => profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? getLeaderPhotoByName(managerDisplayName) ?? null,
    [managerDisplayName, profile?.avatar_url, user?.user_metadata?.avatar_url]
  );

  const managerTeamNames = useMemo(() => {
    if (viewMode !== "manager") return [] as string[];
    const names = new Set(sellers.map((s) => s.teamName).filter((n): n is string => !!n));
    return Array.from(names);
  }, [viewMode, sellers]);

  const employeeDisplayName = useMemo(() => {
    if (viewMode !== "employee") return "";
    if (employeeCurrentSeller) return stripTetragram(employeeCurrentSeller.name);
    return dsUser?.userName ? stripTetragram(dsUser.userName) : (user?.user_metadata?.full_name ?? "");
  }, [viewMode, employeeCurrentSeller, dsUser?.userName, user?.user_metadata?.full_name]);

  const employeeInitials = useMemo(() => getInitials(employeeDisplayName || "U"), [employeeDisplayName]);

  const employeeAvatarUrl = useMemo(() => {
    if (viewMode !== "employee") return null;
    if (filterUserId === null) return null;
    return profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;
  }, [viewMode, filterUserId, profile?.avatar_url, user?.user_metadata?.avatar_url]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <DirectSalesPageControls
        extra={
          viewMode === "employee" && !filterUserId && sellers.length > 0 ? (
            <Select value={String(activeEmployeeId ?? "")} onValueChange={(v) => setSelectedEmployeeId(Number(v))}>
              <SelectTrigger className="w-[170px] h-7 text-[10px] glass-button border-0 gap-1.5 shrink-0">
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {[...sellers].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                  <SelectItem key={s.userId ?? s.name} value={String(s.userId ?? "")} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : viewMode === "team_leader" && filterManagerId === null && teams.length > 0 ? (
            <Select value={activeTeamManager ?? ""} onValueChange={setSelectedTeamManager}>
              <SelectTrigger className="w-[170px] h-7 text-[10px] glass-button border-0 gap-1.5 shrink-0">
                <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecionar time" />
              </SelectTrigger>
              <SelectContent>
                {[...teams].sort((a, b) => a.managerName.localeCompare(b.managerName)).map((t) => (
                  <SelectItem key={t.managerName} value={t.managerName} className="text-xs">
                    {stripTetragram(t.managerName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      {/* Título */}
      <div className="animate-fade-in-delayed stagger-1 flex items-center justify-between gap-4">
        {viewMode === "team_leader" && leaderName ? (
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div
                className="absolute -inset-2 rounded-full blur-xl opacity-40 pointer-events-none"
                style={{
                  background: teamColorForHeading
                    ? `radial-gradient(circle, ${teamColorForHeading.text} 0%, transparent 70%)`
                    : "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)",
                }}
              />
              <div
                className="relative w-[72px] h-[72px] rounded-full overflow-hidden"
                style={{
                  boxShadow: teamColorForHeading
                    ? `0 0 0 2px ${teamColorForHeading.border}, 0 0 18px ${teamColorForHeading.text}50`
                    : "0 0 0 2px rgba(255,255,255,0.2)",
                }}
              >
                {leaderPhoto ? (
                  <img src={leaderPhoto} alt={leaderName} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-lg font-bold"
                    style={{
                      background: teamColorForHeading?.bg ?? "rgba(255,255,255,0.08)",
                      color: teamColorForHeading?.text ?? "#ffffff",
                    }}
                  >
                    {getInitials(leaderName)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {currentTeamName && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold self-start tracking-wide uppercase"
                  style={{
                    background: teamColorForHeading?.bg ?? "rgba(255,255,255,0.08)",
                    border: `1px solid ${teamColorForHeading?.border ?? "rgba(255,255,255,0.2)"}`,
                    color: teamColorForHeading?.text ?? "#ffffff",
                    letterSpacing: "0.06em",
                  }}
                >
                  {currentTeamName}
                </span>
              )}
              <h1 className="leading-tight tracking-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
                <span className="font-light text-muted-foreground/35 mr-1">Olá Líder,</span>
                <span className="font-black animate-gradient-text">{leaderName}</span>
              </h1>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-xs italic text-muted-foreground/60">Overview Geral do time:</span>
                {teamTetragrams.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{
                      background: teamColorForHeading?.bg ?? "rgba(255,255,255,0.08)",
                      border: `1px solid ${teamColorForHeading?.border ?? "rgba(255,255,255,0.18)"}`,
                      color: teamColorForHeading?.text ?? "#ffffff",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : viewMode === "employee" && employeeDisplayName ? (
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div
                className="absolute -inset-2 rounded-full blur-xl opacity-35 pointer-events-none"
                style={{ background: "radial-gradient(circle, #714B67 0%, transparent 70%)" }}
              />
              <div
                className="relative w-[72px] h-[72px] rounded-full overflow-hidden"
                style={{ boxShadow: "0 0 0 2px rgba(113,75,103,0.40), 0 0 18px rgba(113,75,103,0.35)" }}
              >
                {employeeAvatarUrl ? (
                  <img src={employeeAvatarUrl} alt={employeeDisplayName} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-lg font-bold"
                    style={{ background: "rgba(113,75,103,0.25)", color: "#b87fa8" }}
                  >
                    {employeeInitials}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {currentTeamName && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold self-start tracking-wide uppercase"
                  style={{
                    background: teamColorForHeading?.bg ?? "rgba(113,75,103,0.14)",
                    border: `1px solid ${teamColorForHeading?.border ?? "rgba(113,75,103,0.35)"}`,
                    color: teamColorForHeading?.text ?? "#b87fa8",
                    letterSpacing: "0.06em",
                  }}
                >
                  {currentTeamName}
                </span>
              )}
              <h1 className="leading-tight tracking-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
                <span className="font-light text-muted-foreground/35 mr-1">Olá,</span>
                <span className="font-black animate-gradient-text">{employeeDisplayName}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-1.5">
                {TOP_PERFORMANCE_SELLERS.includes(employeeCurrentSeller?.name ?? "") && <TopPerformanceBadge />}
                {goatRank !== null && goatRank <= 3 && <GoatBadge rank={goatRank as 1 | 2 | 3} />}
                {sellerRank !== null && sellerRank <= 3 && <RankBadge rank={sellerRank as 1 | 2 | 3} month={selectedMonth} />}
                {topRankStreak !== null && topRankStreak.top1 >= 2 && <TopRankStreakBadge rank={1} count={topRankStreak.top1} />}
                {topRankStreak !== null && topRankStreak.top2 >= 2 && <TopRankStreakBadge rank={2} count={topRankStreak.top2} />}
                {topRankStreak !== null && topRankStreak.top3 >= 2 && <TopRankStreakBadge rank={3} count={topRankStreak.top3} />}
                {empMrrStreak >= 2 && <StreakBadge type="MRR" count={empMrrStreak} />}
                {empNrrStreak >= 2 && <StreakBadge type="NRR" count={empNrrStreak} />}
                {employeeCurrentSeller?.status === "férias" && <VacationBadge />}
              </div>
            </div>
          </div>
        ) : viewMode === "manager" && managerDisplayName ? (
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div
                className="absolute -inset-2 rounded-full blur-xl opacity-40 pointer-events-none"
                style={{ background: "radial-gradient(circle, #017E84 0%, transparent 70%)" }}
              />
              <div
                className="relative w-[72px] h-[72px] rounded-full overflow-hidden"
                style={{ boxShadow: "0 0 0 2px rgba(1,126,132,0.40), 0 0 18px rgba(1,126,132,0.35)" }}
              >
                {managerPhoto ? (
                  <img src={managerPhoto} alt={managerDisplayName} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-lg font-bold"
                    style={{ background: "rgba(1,126,132,0.25)", color: "#2dd4bf" }}
                  >
                    {getInitials(managerDisplayName)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.18em] self-start">
                Painel do Gestor
              </span>
              <h1 className="leading-tight tracking-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
                <span className="font-light text-muted-foreground/35 mr-1">Olá Gestor,</span>
                <span className="font-black animate-gradient-text">{managerDisplayName}</span>
              </h1>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-xs italic text-muted-foreground/60">Overview Geral dos times:</span>
                {managerTeamNames.map((teamName) => (
                  <TeamBadgeDsm key={teamName} teamName={teamName} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <h2 className="text-base font-semibold text-muted-foreground/60 tracking-wide">{pageTitle}</h2>
            </div>
            <p className="text-xs font-semibold italic text-muted-foreground/60 pl-6">
              Um overview geral do desempenho do seu departamento no período selecionado.
            </p>
            <DummyDataBadge className="ml-6 mt-0.5" />
          </div>
        )}

        {/* Controles: seletores + ações */}
        <div className="flex items-center gap-2 shrink-0">
          {viewMode === "manager" && (
            <button
              onClick={() => setPainelOpen(true)}
              className="glass-button flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              Painel do Gestor
            </button>
          )}
          {(viewMode === "employee" || viewMode === "team_leader") && (
            <button
              onClick={() => setPictureModeOpen(true)}
              className="glass-button flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Camera className="h-3.5 w-3.5 shrink-0" />
              Picture Mode
            </button>
          )}
          <button
            onClick={() => setGeneralAnalyticsOpen(true)}
            className="glass-button flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <BarChart2 className="h-3.5 w-3.5 shrink-0" />
            General Analytics
          </button>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[155px] h-8 text-xs glass-button border-0 gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">{formatMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conteúdo */}
      {(loading || roleLoading) ? (
        <div className="flex items-center justify-center py-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : sellers.length === 0 ? (
        <p className="text-muted-foreground text-sm py-16 text-center">
          Nenhum dado encontrado para o período selecionado.
        </p>
      ) : (
        <div className="animate-fade-in-delayed stagger-2">
          {viewMode === "employee" && (
            <EmployeeView
              sellers={sellers}
              rank={sellerRank}
              goatRank={goatRank}
              selectedEmployeeId={activeEmployeeId}
              allRaw={raw}
              selectedMonth={selectedMonth}
              rankNeighbors={rankNeighbors}
            />
          )}
          {viewMode === "team_leader" && (
            <TeamLeaderView teams={tlTeams} allRaw={tlAllRaw} selectedMonth={selectedMonth} avatarMap={avatarMap} onSellerAnalytics={setTlSellerTarget} />
          )}
          {viewMode === "manager" && (
            <ManagerView
              teams={teams}
              company={company}
              allRaw={raw}
              selectedMonth={selectedMonth}
              painelOpen={painelOpen}
              onClosePainel={() => setPainelOpen(false)}
              tlRows={tlRows}
              onTlRowsChange={setTlRows}
              tlLoading={tlLoading}
              onRefresh={() => setRefreshKey((k) => k + 1)}
              avatarMap={avatarMap}
              onTeamAnalytics={setManagerTeamTarget}
              onSellerAnalytics={setManagerSellerTarget}
            />
          )}
        </div>
      )}

      {pictureModeOpen && (
        <PictureModePanel
          onClose={() => setPictureModeOpen(false)}
          seller={sellers.find((s) => s.userId === activeEmployeeId) ?? sellers[0] ?? null}
          selectedMonth={selectedMonth}
          sellerRank={viewMode === "team_leader" ? teamPictureModeRank : sellerRank}
          sellers={sellers}
          goatRank={goatRank}
          topRankStreak={topRankStreak}
          mrrStreak={empMrrStreak}
          nrrStreak={empNrrStreak}
          isTeamLeader={viewMode === "team_leader"}
          leaderName={viewMode === "team_leader"
            ? (filterManagerId !== null ? (dsUser?.userName ?? leaderName) : (activeTeamManager ?? leaderName)) || undefined
            : undefined}
          teamName={viewMode === "team_leader" ? currentTeamName : undefined}
          teamMrrPct={viewMode === "team_leader" ? (tlTeams[0]?.mrr.pct ?? 0) : undefined}
          teamNrrPct={viewMode === "team_leader" ? (tlTeams[0]?.nrr.pct ?? 0) : undefined}
          teamTetragrams={viewMode === "team_leader" ? teamTetragrams : undefined}
          teamColor={viewMode === "team_leader" ? teamColorForHeading : undefined}
        />
      )}
      {generalAnalyticsOpen && (
        <GeneralAnalyticsPanel
          onClose={() => setGeneralAnalyticsOpen(false)}
          viewMode={viewMode}
          seller={viewMode === "employee" ? employeeCurrentSeller : null}
          sellers={sellers}
          allRaw={viewMode === "team_leader" ? tlAllRaw : raw}
          selectedMonth={selectedMonth}
          sellerRank={sellerRank}
          goatRank={goatRank}
          topRankStreak={topRankStreak}
          avatarUrl={
            viewMode === "employee"
              ? (employeeAvatarUrl ?? avatarMap.get(employeeCurrentSeller?.name ?? "") ?? null)
              : null
          }
          mrrStreak={empMrrStreak}
          nrrStreak={empNrrStreak}
          teamName={viewMode === "team_leader" ? (currentTeamName ?? undefined) : undefined}
          leaderName={viewMode === "team_leader" ? (leaderName ?? undefined) : undefined}
          activeManagerIds={activeManagerIds}
        />
      )}
      {managerSellerTarget && (
        <GeneralAnalyticsPanel
          onClose={() => setManagerSellerTarget(null)}
          viewMode="employee"
          seller={managerSellerTarget}
          sellers={sellers}
          allRaw={raw}
          selectedMonth={selectedMonth}
          sellerRank={managerSellerRankData.sellerRank}
          goatRank={managerSellerRankData.goatRank}
          topRankStreak={managerSellerRankData.topRankStreak}
          avatarUrl={avatarMap.get(managerSellerTarget.name) ?? null}
          mrrStreak={managerSellerRankData.mrrStreak}
          nrrStreak={managerSellerRankData.nrrStreak}
          activeManagerIds={activeManagerIds}
        />
      )}
      {managerTeamTarget && (
        <GeneralAnalyticsPanel
          onClose={() => setManagerTeamTarget(null)}
          viewMode="team_leader"
          seller={null}
          sellers={managerTeamTarget.sellers.filter((s) => s.status !== "inativo")}
          allRaw={managerTeamRaw}
          selectedMonth={selectedMonth}
          teamName={managerTeamTarget.sellers[0]?.teamName ?? undefined}
          leaderName={stripTetragram(managerTeamTarget.managerName)}
          avatarUrl={avatarMap.get(managerTeamTarget.managerName) ?? null}
          sellerRank={null}
          goatRank={null}
          topRankStreak={null}
          mrrStreak={0}
          nrrStreak={0}
          activeManagerIds={activeManagerIds}
        />
      )}
      {tlSellerTarget && (
        <GeneralAnalyticsPanel
          onClose={() => setTlSellerTarget(null)}
          viewMode="employee"
          seller={tlSellerTarget}
          sellers={sellers}
          allRaw={tlAllRaw}
          selectedMonth={selectedMonth}
          sellerRank={tlSellerRankData.sellerRank}
          goatRank={tlSellerRankData.goatRank}
          topRankStreak={tlSellerRankData.topRankStreak}
          avatarUrl={avatarMap.get(tlSellerTarget.name) ?? null}
          mrrStreak={tlSellerRankData.mrrStreak}
          nrrStreak={tlSellerRankData.nrrStreak}
          hideCommission
          activeManagerIds={activeManagerIds}
        />
      )}
    </div>
  );
}
