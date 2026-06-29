import { isRampUp, getStatus } from "@/lib/directSalesUtils";
import { sellerRankingScore } from "@/lib/desempenhoUtils";

export type { RawCommissionRow, PlanType, CommissionRow } from "@/lib/directSalesUtils";
export { parseRow } from "@/lib/directSalesUtils";
import type { CommissionRow, PlanType } from "@/lib/directSalesUtils";

export interface TeamMetrics {
  managerName: string;
  teamName?: string | null;
  teamType: string | null;
  target: number;
  achieved: number;
  pct: number;
  people: PersonMetrics[];
  rawNegativeAchieved?: number;
}

export interface PersonMetrics {
  name: string;
  target: number;
  achieved: number;
  pct: number;
  status: "ativo" | "ramp-up" | "férias" | "inativo";
  metaGeralAchieved?: number;
}

export interface CombinedManagerData {
  managerName: string;
  teamName?: string | null;
  teamType: string | null;
  mrr: TeamMetrics | null;
  nrr: TeamMetrics | null;
  rank: number;
}

export interface CombinedSellerData {
  sellerName: string;
  mrr: PersonMetrics | null;
  nrr: PersonMetrics | null;
  rank: number;
  teamName: string | null;
  teamType: string | null;
}


export function aggregateByManager(rows: CommissionRow[], planType: PlanType): TeamMetrics[] {
  const filtered = rows.filter(
    (r) => r.plan_type === planType && !isRampUp(r)  );

  const byManager = new Map<string, CommissionRow[]>();
  for (const r of filtered) {
    const manager = r.manager_name ?? "Sem Gerente";
    if (!byManager.has(manager)) byManager.set(manager, []);
    byManager.get(manager)!.push(r);
  }

  return Array.from(byManager.entries()).map(([managerName, items]) => {
    const teamType = items[0]?.team_type ?? null;

    const byPerson = new Map<string, {
      target: number;
      achieved: number;
      metaGeralAchieved: number;
      status: "ativo" | "ramp-up" | "férias" | "inativo";
    }>();

    for (const r of items) {
      const name = r.user_name ?? "Sem Nome";
      const status = getStatus(r);

      if (status === "inativo" && (r.achieved ?? 0) <= 0) continue;

      if (!byPerson.has(name)) byPerson.set(name, { target: 0, achieved: 0, metaGeralAchieved: 0, status });
      const p = byPerson.get(name)!;

      if (status === "ativo") {
        p.target += r.target_amount ?? 0;
        p.achieved += r.achieved ?? 0;
      } else if (status === "inativo") {
        const raw = r.achieved ?? 0;
        const tgt = r.target_amount ?? 0;
        if (raw > 0) {
          p.achieved += raw;
          if (tgt > 0 && raw > tgt) p.target += tgt;
        }
      } else if (status === "férias") {
        const raw = r.achieved ?? 0;
        if (raw > 0) p.metaGeralAchieved += raw;
      }
    }

    const people: PersonMetrics[] = Array.from(byPerson.entries())
      .map(([name, v]) => ({
        name,
        target: v.target,
        achieved: v.achieved,
        pct: v.target > 0 ? (v.achieved / v.target) * 100 : 0,
        status: v.status,
        ...(v.metaGeralAchieved > 0 ? { metaGeralAchieved: v.metaGeralAchieved } : {}),
      }))
      .sort((a, b) => {
        const order = { ativo: 0, inativo: 1, férias: 2, "ramp-up": 3 };
        const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
        if (diff !== 0) return diff;
        return b.achieved - a.achieved;
      });

    const teamTarget = people
      .filter(p => p.status === "ativo" || (p.status === "inativo" && p.target > 0))
      .reduce((sum, p) => sum + p.target, 0);
    const teamAchieved = people
      .filter(p => p.status === "ativo" || (p.status === "inativo" && p.target > 0))
      .reduce((sum, p) => sum + p.achieved, 0);
    const teamPct = teamTarget > 0 ? (teamAchieved / teamTarget) * 100 : 0;

    const teamName = items.find((r) => r.team_name)?.team_name ?? null;
    return { managerName, teamName, teamType, target: teamTarget, achieved: teamAchieved, pct: teamPct, people };
  })
  .filter((team) => team.people.length > 0);
}

export function aggregateRampUpTeam(rows: CommissionRow[], planType: PlanType): TeamMetrics | null {
  const rampUpRows = rows.filter(
    (r) => r.plan_type === planType && isRampUp(r) && r.active !== false
  );
  if (rampUpRows.length === 0) return null;

  const byPerson = new Map<string, { target: number; achieved: number }>();
  for (const r of rampUpRows) {
    const name = r.user_name ?? "Sem Nome";
    if (!byPerson.has(name)) byPerson.set(name, { target: 0, achieved: 0 });
    const p = byPerson.get(name)!;
    p.target += r.target_amount ?? 0;
    const raw = r.achieved ?? 0;
    if (raw > 0) p.achieved += raw;
  }

  const people: PersonMetrics[] = Array.from(byPerson.entries())
    .map(([name, v]) => ({
      name,
      target: v.target,
      achieved: v.achieved,
      pct: v.target > 0 ? (v.achieved / v.target) * 100 : 0,
      status: "ramp-up" as const,
    }))
    .sort((a, b) => b.achieved - a.achieved);

  const teamTarget = people.reduce((sum, p) => sum + p.target, 0);
  const teamAchieved = people.reduce((sum, p) => sum + p.achieved, 0);
  const teamPct = teamTarget > 0 ? (teamAchieved / teamTarget) * 100 : 0;

  return { managerName: "Ramp-up", teamType: null, target: teamTarget, achieved: teamAchieved, pct: teamPct, people };
}

export function aggregateCompanyTotals(rows: CommissionRow[], planType: PlanType) {
  const filtered = rows.filter((r) => r.plan_type === planType);
  let target = 0;
  let achieved = 0;

  for (const r of filtered) {
    if (r.active === false) {
      const raw = r.achieved ?? 0;
      const tgt = r.target_amount ?? 0;
      if (raw <= 0) continue;
      achieved += raw;
      if (tgt > 0 && raw > tgt) target += tgt;
      continue;
    }
    if (!r.skip_record) {
      target += r.target_amount ?? 0;
    }
    const raw = r.achieved ?? 0;
    if (!r.skip_record) {
      achieved += raw;
    } else if (raw > 0) {
      achieved += raw;
    }
  }

  return { target, achieved, pct: target > 0 ? (achieved / target) * 100 : 0 };
}

export function aggregateSellersByPlan(rows: CommissionRow[], planType: PlanType): PersonMetrics[] {
  const filtered = rows.filter(
    (r) => r.plan_type === planType && r.active !== false
  );
  const byPerson = new Map<string, {
    target: number;
    achieved: number;
    status: "ativo" | "ramp-up" | "férias" | "inativo";
  }>();

  for (const r of filtered) {
    const name = r.user_name ?? "Sem Nome";
    const status = getStatus(r);
    if (!byPerson.has(name)) byPerson.set(name, { target: 0, achieved: 0, status });
    const p = byPerson.get(name)!;
    if (status === "ativo" || status === "férias") {
      p.target += r.target_amount ?? 0;
      p.achieved += r.achieved ?? 0;
    }
  }

  return Array.from(byPerson.entries()).map(([name, v]) => ({
    name,
    target: v.target,
    achieved: v.achieved,
    pct: v.target > 0 ? (v.achieved / v.target) * 100 : 0,
    status: v.status,
  }));
}

export function buildCombinedRanking(rows: CommissionRow[]): CombinedManagerData[] {
  const mrrGroups = aggregateByManager(rows, "MRR");
  const nrrGroups = aggregateByManager(rows, "NRR");

  const allManagers = new Set<string>();
  for (const g of mrrGroups) allManagers.add(g.managerName);
  for (const g of nrrGroups) allManagers.add(g.managerName);

  const mrrMap = new Map(mrrGroups.map((g) => [g.managerName, g]));
  const nrrMap = new Map(nrrGroups.map((g) => [g.managerName, g]));

  const combined = Array.from(allManagers).map((managerName) => {
    const mrr = mrrMap.get(managerName) ?? null;
    const nrr = nrrMap.get(managerName) ?? null;
    const teamType = mrr?.teamType ?? nrr?.teamType ?? null;
    const teamName = mrr?.teamName ?? nrr?.teamName ?? null;
    return { managerName, teamName, teamType, mrr, nrr, rank: 0 };
  });

  combined.sort((a, b) =>
    sellerRankingScore(b.mrr?.pct ?? 0, b.nrr?.pct ?? 0) -
    sellerRankingScore(a.mrr?.pct ?? 0, a.nrr?.pct ?? 0)
  );

  const rankCounters = new Map<string | null, number>();
  combined.forEach((d) => {
    const counter = (rankCounters.get(d.teamType) ?? 0) + 1;
    rankCounters.set(d.teamType, counter);
    d.rank = counter;
  });

  return combined;
}
