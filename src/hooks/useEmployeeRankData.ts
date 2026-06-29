// Rank async — filterUserId=null (admin preview) retorna null, parent calcula via useMemo

import { useState, useEffect } from "react";
import { getDummySalesRows } from "@/lib/dummyDataLoader";
import { sellerRankingScore, sellerHistoricScore } from "@/lib/desempenhoUtils";
import type { RankNeighbors } from "@/lib/desempenhoUtils";

interface UseEmployeeRankDataParams {
  viewMode: string;
  filterUserId: number | null;
  activeEmployeeId: number | null;
  selectedMonth: string;
}

interface UseEmployeeRankDataResult {
  sellerRank: number | null;
  rankNeighbors: RankNeighbors | null;
  goatRank: number | null;
  topRankStreak: { top1: number; top2: number; top3: number } | null;
}

export function useEmployeeRankData({
  viewMode,
  filterUserId,
  activeEmployeeId,
  selectedMonth,
}: UseEmployeeRankDataParams): UseEmployeeRankDataResult {
  const [sellerRank, setSellerRank] = useState<number | null>(null);
  const [rankNeighbors, setRankNeighbors] = useState<RankNeighbors | null>(null);
  const [goatRank, setGoatRank] = useState<number | null>(null);
  const [topRankStreak, setTopRankStreak] = useState<{ top1: number; top2: number; top3: number } | null>(null);

  // ── Rank do mês + vizinhos ────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "employee" || filterUserId === null || !activeEmployeeId || !selectedMonth) {
      setSellerRank(null);
      setRankNeighbors(null);
      return;
    }

    async function computeRank() {
      const allData = await getDummySalesRows();
      const data = allData.filter((r) => (r.date_from ?? "").slice(0, 7) === selectedMonth);

      type RankEntry = { userId: number; name: string; mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
      const byPerson = new Map<number, RankEntry>();

      for (const r of data) {
        const uid = r.user_id;
        if (!uid) continue;
        const planType = (r.plan_type ?? "").toUpperCase();
        const isRampUpRow = (r.plan_name ?? "").toUpperCase().startsWith("[RAMP-UP]");
        const status = r.active === false ? "inativo"
          : r.skip_record && isRampUpRow ? "ramp-up"
            : r.skip_record ? "férias" : "ativo";

        if (status === "inativo" && r.achieved <= 0) continue;

        const addAchieved = status === "ativo" ? r.achieved : status === "inativo" ? r.achieved : Math.max(0, r.achieved);
        const addTarget = status === "ativo" ? r.target_amount
          : status === "inativo" && r.target_amount > 0 && r.achieved > r.target_amount ? r.target_amount : 0;

        if (!byPerson.has(uid)) byPerson.set(uid, { userId: uid, name: r.user_name, mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
        const p = byPerson.get(uid)!;
        if (planType === "MRR") { p.mrr.achieved += addAchieved; p.mrr.target += addTarget; }
        else if (planType === "NRR") { p.nrr.achieved += addAchieved; p.nrr.target += addTarget; }
      }

      const sorted = Array.from(byPerson.values()).sort((a, b) => {
        const mPctA = a.mrr.target > 0 ? (a.mrr.achieved / a.mrr.target) * 100 : 0;
        const nPctA = a.nrr.target > 0 ? (a.nrr.achieved / a.nrr.target) * 100 : 0;
        const mPctB = b.mrr.target > 0 ? (b.mrr.achieved / b.mrr.target) * 100 : 0;
        const nPctB = b.nrr.target > 0 ? (b.nrr.achieved / b.nrr.target) * 100 : 0;
        return sellerRankingScore(mPctB, nPctB) - sellerRankingScore(mPctA, nPctA);
      });

      const idx = sorted.findIndex((p) => p.userId === activeEmployeeId);
      setSellerRank(idx >= 0 ? idx + 1 : null);

      const above = idx > 0
        ? { name: sorted[idx - 1].name, rank: idx, total: sorted[idx - 1].mrr.achieved + sorted[idx - 1].nrr.achieved }
        : null;
      const below = idx >= 0 && idx < sorted.length - 1
        ? { name: sorted[idx + 1].name, rank: idx + 2, total: sorted[idx + 1].mrr.achieved + sorted[idx + 1].nrr.achieved }
        : null;
      setRankNeighbors(idx >= 0 ? { above, below, total: sorted.length } : null);
    }

    computeRank();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, filterUserId, activeEmployeeId, selectedMonth]);

  // ── Rank histórico G.O.A.T ──────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "employee" || filterUserId === null || !activeEmployeeId) {
      setGoatRank(null);
      return;
    }

    async function computeGoat() {
      const data = await getDummySalesRows();

      type GoatEntry = { mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
      const byPerson = new Map<number, GoatEntry>();

      for (const r of data) {
        const uid = r.user_id;
        if (!uid) continue;
        const planType = (r.plan_type ?? "").toUpperCase();
        const isRampUpRow = (r.plan_name ?? "").toUpperCase().startsWith("[RAMP-UP]");
        const status = r.active === false ? "inativo"
          : r.skip_record && isRampUpRow ? "ramp-up"
            : r.skip_record ? "férias" : "ativo";

        if (status === "inativo" && r.achieved <= 0) continue;

        const addAch = status === "ativo" ? r.achieved : status === "inativo" ? r.achieved : Math.max(0, r.achieved);
        const addTgt = status === "ativo" ? r.target_amount
          : status === "inativo" && r.target_amount > 0 && r.achieved > r.target_amount ? r.target_amount : 0;

        if (!byPerson.has(uid)) byPerson.set(uid, { mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
        const p = byPerson.get(uid)!;
        if (planType === "MRR") { p.mrr.achieved += addAch; p.mrr.target += addTgt; }
        else if (planType === "NRR") { p.nrr.achieved += addAch; p.nrr.target += addTgt; }
      }

      const sorted = Array.from(byPerson.entries()).sort(([, a], [, b]) =>
        sellerHistoricScore(b.mrr, b.nrr) - sellerHistoricScore(a.mrr, a.nrr)
      );
      const idx = sorted.findIndex(([uid]) => uid === activeEmployeeId);
      setGoatRank(idx >= 0 ? idx + 1 : null);
    }

    computeGoat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, filterUserId, activeEmployeeId]);

  // ── Top-rank streak anual ────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "employee" || filterUserId === null || !activeEmployeeId || !selectedMonth) {
      setTopRankStreak(null);
      return;
    }

    const year = selectedMonth.slice(0, 4);

    async function computeTopRankStreak() {
      const allData = await getDummySalesRows();
      const yearRows = allData.filter((r) => (r.date_from ?? "").startsWith(year));
      const months = [...new Set(yearRows.map((r) => (r.date_from ?? "").slice(0, 7)).filter(Boolean))];

      type StreakEntry = { mrr: { achieved: number; target: number }; nrr: { achieved: number; target: number } };
      let top1 = 0, top2 = 0, top3 = 0;

      for (const month of months) {
        const monthRows = yearRows.filter((r) => (r.date_from ?? "").slice(0, 7) === month);
        const byPerson = new Map<number, StreakEntry>();

        for (const r of monthRows) {
          if (!r.user_id) continue;
          const planType = (r.plan_type ?? "").toUpperCase();
          const status = r.active === false ? "inativo"
            : r.skip_record && (r.plan_name ?? "").toUpperCase().startsWith("[RAMP-UP]") ? "ramp-up"
              : r.skip_record ? "férias" : "ativo";

          if (status === "inativo" && r.achieved <= 0) continue;

          const addAch = status !== "férias" && status !== "ramp-up" ? r.achieved : Math.max(0, r.achieved);
          const addTgt = status === "ativo" ? r.target_amount
            : status === "inativo" && r.target_amount > 0 && r.achieved > r.target_amount ? r.target_amount : 0;

          const uid = r.user_id;
          if (!byPerson.has(uid)) byPerson.set(uid, { mrr: { achieved: 0, target: 0 }, nrr: { achieved: 0, target: 0 } });
          const p = byPerson.get(uid)!;
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

      setTopRankStreak({ top1, top2, top3 });
    }

    computeTopRankStreak();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, filterUserId, activeEmployeeId, selectedMonth]);

  return { sellerRank, rankNeighbors, goatRank, topRankStreak };
}
