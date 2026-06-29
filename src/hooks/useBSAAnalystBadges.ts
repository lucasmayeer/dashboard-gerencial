import { useState, useEffect } from "react";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import type { RankNeighbors } from "@/lib/desempenhoUtils";

interface BSAAnalystBadges {
  streakCount: number;
  sellerRank: number | null;
  analystRank: 1 | 2 | 3 | null;
  rankNeighbors: RankNeighbors | null;
  loading: boolean;
}

export function useBSAAnalystBadges(
  name: string | null,
  month: string,
): BSAAnalystBadges {
  const [streakCount, setStreakCount]     = useState(0);
  const [sellerRank, setSellerRank]       = useState<number | null>(null);
  const [analystRank, setAnalystRank]     = useState<1 | 2 | 3 | null>(null);
  const [rankNeighbors, setRankNeighbors] = useState<RankNeighbors | null>(null);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    if (!name) {
      setStreakCount(0);
      setSellerRank(null);
      setAnalystRank(null);
      setRankNeighbors(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchBadges() {
      const [year, m] = month.split("-").map(Number);
      const lastDay   = new Date(year, m, 0).getDate();
      const monthFrom = `${year}-${String(m).padStart(2, "0")}-01`;
      const monthTo   = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const yearFrom  = `${year}-01-01`;

      const allRows = await getDummyImplantacaoRows();

      // ── Streak: meses YTD onde billable >= meta ────────────────────────────
      const streakRows = allRows.filter((r) => r.user_name === name && r.report_date >= yearFrom && r.report_date <= monthTo);

      if (!cancelled) {
        const byMonth = new Map<string, { billable: number; meta: number }>();
        for (const r of streakRows) {
          const mk = r.report_date.slice(0, 7);
          if (!byMonth.has(mk)) byMonth.set(mk, { billable: 0, meta: 0 });
          const e = byMonth.get(mk)!;
          e.billable += r.billable_hours ?? 0;
          if (!r.skip_record) {
            e.meta += Math.max(0, (r.expected_billable_hours ?? 0) - (r.discount_hours ?? 0));
          }
        }
        let count = 0;
        for (const { billable, meta } of byMonth.values()) {
          if (meta > 0 && billable >= meta) count++;
        }
        setStreakCount(count);
      }

      // ── Rank: posição do analista no mês atual ────────────────────────────
      const rankRows = allRows.filter((r) => r.report_date >= monthFrom && r.report_date <= monthTo);

      if (!cancelled) {
        const byUser = new Map<string, { billable: number; meta: number }>();
        for (const r of rankRows) {
          if (!byUser.has(r.user_name)) byUser.set(r.user_name, { billable: 0, meta: 0 });
          const e = byUser.get(r.user_name)!;
          e.billable += r.billable_hours ?? 0;
          if (!r.skip_record) {
            e.meta += Math.max(0, (r.expected_billable_hours ?? 0) - (r.discount_hours ?? 0));
          }
        }
        const sorted = Array.from(byUser.entries())
          .filter(([, v]) => v.meta > 0)
          .sort(([, a], [, b]) => (b.billable / b.meta) - (a.billable / a.meta));

        const idx = sorted.findIndex(([u]) => u === name);
        const pos = idx + 1;
        setSellerRank(idx >= 0 ? pos : null);
        setAnalystRank(pos >= 1 && pos <= 3 ? (pos as 1 | 2 | 3) : null);

        if (idx >= 0) {
          const above = idx > 0
            ? { name: sorted[idx - 1][0], rank: idx, total: sorted[idx - 1][1].billable }
            : null;
          const below = idx < sorted.length - 1
            ? { name: sorted[idx + 1][0], rank: idx + 2, total: sorted[idx + 1][1].billable }
            : null;
          setRankNeighbors({ above, below, total: sorted.length });
        } else {
          setRankNeighbors(null);
        }
      }

      if (!cancelled) setLoading(false);
    }

    fetchBadges();
    return () => { cancelled = true; };
  }, [name, month]);

  return { streakCount, sellerRank, analystRank, rankNeighbors, loading };
}
