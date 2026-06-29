// =============================================================================
// TIPOS — Desempenho Mensal
// =============================================================================

import type { Tables } from "@/integrations/supabase/types";

export type RawRow = Pick<
  Tables<"commissions_report">,
  | "user_id"
  | "user_name"
  | "manager_id"
  | "manager_name"
  | "plan_name"
  | "plan_type"
  | "date_from"
  | "target_amount"
  | "achieved"
  | "commission"
  | "skip_record"
  | "active"
  | "team_name"
  | "team_type"
>;

export type PlanType = "MRR" | "NRR";

export interface PlanMetrics {
  target: number;
  achieved: number;
  commission: number;
  pct: number;
}

export interface SellerMetrics {
  userId: number | null;
  name: string;
  teamName: string | null;
  managerName: string | null;
  mrr: PlanMetrics;
  nrr: PlanMetrics;
  total: PlanMetrics;
  status: "ativo" | "ramp-up" | "férias" | "inativo";
}

export interface TeamMetrics {
  managerName: string;
  mrr: PlanMetrics;
  nrr: PlanMetrics;
  total: PlanMetrics;
  sellers: SellerMetrics[];
}

export interface MonthlyPoint {
  key: string;
  month: string;
  mrr: number;
  nrr: number;
  total: number;
  commission: number;
}

export interface RankNeighbor {
  name: string;
  rank: number;
  total: number;
}

export interface RankNeighbors {
  above: RankNeighbor | null;
  below: RankNeighbor | null;
  total: number;
}

export interface QuarterMetrics {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  mrr: { achieved: number; target: number; pct: number };
  nrr: { achieved: number; target: number; pct: number };
  hasData: boolean;
}

// =============================================================================
// CONSTANTES
// =============================================================================

export const ZERO_PLAN: PlanMetrics = { target: 0, achieved: 0, commission: 0, pct: 0 };

// =============================================================================
// HELPERS DE NOME
// =============================================================================

export function stripTetragram(name: string): string {
  return name.replace(/\s*\([a-zA-Z0-9]{2,6}\)\s*$/, "").trim();
}

export function extractTetragramFromName(name: string): string {
  const match = name.match(/\(([a-zA-Z0-9]{2,6})\)\s*$/);
  return match ? match[1].toUpperCase() : name.slice(0, 4).toUpperCase();
}

export function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// =============================================================================
// HELPERS
// =============================================================================

export function toMonthKeyStr(dateFrom: string): string {
  return dateFrom.slice(0, 7);
}

/** plan_name começa com "[RAMP-UP]" (case-insensitive) */
export function isRampUpPlan(planName: string): boolean {
  return (planName ?? "").toUpperCase().startsWith("[RAMP-UP]");
}

/** Deriva status a partir dos campos nullable do Supabase row */
export function getRowStatus(row: RawRow): "ativo" | "ramp-up" | "férias" | "inativo" {
  if (row.active === false) return "inativo";
  if (isRampUpPlan(row.plan_name ?? "")) return "ramp-up";
  if (row.skip_record) return "férias";
  return "ativo";
}

export function addPlan(a: PlanMetrics, b: Partial<PlanMetrics>): PlanMetrics {
  const next = {
    target: a.target + (b.target ?? 0),
    achieved: a.achieved + (b.achieved ?? 0),
    commission: a.commission + (b.commission ?? 0),
    pct: 0,
  };
  next.pct = next.target > 0 ? (next.achieved / next.target) * 100 : 0;
  return next;
}

export function combinePlan(mrr: PlanMetrics, nrr: PlanMetrics): PlanMetrics {
  return addPlan(mrr, nrr);
}

export const formatPct = (v: number) =>
  `${v < 0 ? 0 : Math.round(v)}%`;

export function sellerRankingScore(mrrPct: number, nrrPct: number): number {
  const media = (mrrPct + nrrPct) / 2;
  return mrrPct >= 100 && nrrPct >= 100 ? 100 + media : media;
}

/** Score histórico (G.O.A.T): R$ bruto + bônus por meta batida. */
export function sellerHistoricScore(
  mrr: { achieved: number; target: number },
  nrr: { achieved: number; target: number },
): number {
  const base = mrr.achieved + nrr.achieved;
  const mrrMet = mrr.target > 0 && mrr.achieved >= mrr.target;
  const nrrMet = nrr.target > 0 && nrr.achieved >= nrr.target;
  const bonus = mrrMet && nrrMet ? 100 : mrrMet || nrrMet ? 50 : 0;
  return base + bonus;
}

export const formatCompact = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
};

/** Cor do texto por % atingido — usa Tailwind literals (≠ pctColor de directSalesUtils) */
export const pctColorDsm = (pct: number) =>
  pct >= 100 ? "text-emerald-500" : pct >= 80 ? "text-amber-400" : "text-red-400";

// =============================================================================
// AGREGAÇÃO
// =============================================================================

export function aggregateSellers(rows: RawRow[]): SellerMetrics[] {
  const byPerson = new Map<string, SellerMetrics>();

  for (const r of rows) {
    const name = r.user_name ?? "Sem Nome";
    const type = (r.plan_type ?? "").toUpperCase() as PlanType | string;
    const status = getRowStatus(r);
    const rawAchieved = r.achieved ?? 0;
    const rawTarget = r.target_amount ?? 0;
    const rawCommission = r.commission ?? 0;

    // linha 01 inativo: ignora
    if (status === "inativo" && rawAchieved <= 0) continue;

    if (!byPerson.has(name)) {
      byPerson.set(name, {
        userId: r.user_id,
        name,
        teamName: r.team_name,
        managerName: r.manager_name,
        mrr: { ...ZERO_PLAN },
        nrr: { ...ZERO_PLAN },
        total: { ...ZERO_PLAN },
        status,
      });
    }
    const p = byPerson.get(name)!;

    let addTarget = 0;
    let addAchieved = 0;
    let addCommission = 0;

    if (status === "ativo") {
      addTarget = rawTarget;
      addAchieved = rawAchieved;
      addCommission = rawCommission;
    } else if (status === "inativo") {
      // linha 02: só achieved; linha 03: achieved + target
      addAchieved = rawAchieved;
      if (rawTarget > 0 && rawAchieved > rawTarget) addTarget = rawTarget;
      addCommission = rawCommission;
    } else if (status === "ramp-up") {
      addAchieved = Math.max(0, rawAchieved);
      addCommission = rawCommission;
    } else if (status === "férias") {
      addAchieved = Math.max(0, rawAchieved);
      addCommission = rawCommission;
    }

    if (type === "MRR") {
      p.mrr = addPlan(p.mrr, { target: addTarget, achieved: addAchieved, commission: addCommission });
    } else if (type === "NRR") {
      p.nrr = addPlan(p.nrr, { target: addTarget, achieved: addAchieved, commission: addCommission });
    }
  }

  for (const p of byPerson.values()) {
    p.total = combinePlan(p.mrr, p.nrr);
  }

  return Array.from(byPerson.values()).sort((a, b) => b.total.achieved - a.total.achieved);
}

/** Agrega métricas por time (manager_name). */
export function aggregateTeams(sellers: SellerMetrics[]): TeamMetrics[] {
  const byManager = new Map<string, TeamMetrics>();

  for (const s of sellers) {
    const mgr = s.managerName ?? "Sem Gerente";
    if (!byManager.has(mgr)) {
      byManager.set(mgr, {
        managerName: mgr,
        mrr: { ...ZERO_PLAN },
        nrr: { ...ZERO_PLAN },
        total: { ...ZERO_PLAN },
        sellers: [],
      });
    }
    const t = byManager.get(mgr)!;
    if (s.status !== "ramp-up" && s.status !== "férias") {
      t.mrr = addPlan(t.mrr, s.mrr);
      t.nrr = addPlan(t.nrr, s.nrr);
    }
    t.sellers.push(s);
  }

  for (const t of byManager.values()) {
    t.total = combinePlan(t.mrr, t.nrr);
  }

  return Array.from(byManager.values()).sort((a, b) => b.total.achieved - a.total.achieved);
}

/** Totais da empresa (soma de todos os times). */
export function aggregateCompany(
  teams: TeamMetrics[],
): { mrr: PlanMetrics; nrr: PlanMetrics; total: PlanMetrics } {
  let mrr = { ...ZERO_PLAN };
  let nrr = { ...ZERO_PLAN };
  for (const t of teams) {
    mrr = addPlan(mrr, t.mrr);
    nrr = addPlan(nrr, t.nrr);
  }
  return { mrr, nrr, total: combinePlan(mrr, nrr) };
}

// Férias/ramp-up contam no achieved da empresa (≠ aggregateTeams que exclui)
export function aggregateCompanyFromSellers(
  sellers: SellerMetrics[],
): { mrr: PlanMetrics; nrr: PlanMetrics; total: PlanMetrics } {
  let mrr = { ...ZERO_PLAN };
  let nrr = { ...ZERO_PLAN };
  for (const s of sellers) {
    mrr = addPlan(mrr, s.mrr);
    nrr = addPlan(nrr, s.nrr);
  }
  return { mrr, nrr, total: combinePlan(mrr, nrr) };
}
