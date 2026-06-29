export const TL_OPS = ["=", ">", ">=", "<", "<="] as const;
export type TlOp = typeof TL_OPS[number];

export type TlMultiplierRow = {
  id: number;
  plan_type: "MRR" | "NRR";
  min_pct: number;
  max_pct: number | null;
  min_op: TlOp;
  max_op: TlOp;
  multiplier: number;
  label: string;
  active: boolean;
  updated_at: string;
};

export function generateTlLabel(
  minOp: TlOp,
  minPct: number,
  maxOp: TlOp,
  maxPct: number | null,
): string {
  const lower = `${minOp}${minPct}%`;
  return maxPct === null ? lower : `${lower} and ${maxOp}${maxPct}%`;
}

function matchesOp(pct: number, op: TlOp, bound: number): boolean {
  switch (op) {
    case ">":  return pct >  bound;
    case ">=": return pct >= bound;
    case "=":  return pct === bound;
    case "<":  return pct <  bound;
    case "<=": return pct <= bound;
  }
}

export function lookupTlMultiplier(
  pct: number,
  rows: TlMultiplierRow[],
  planType: "MRR" | "NRR",
): TlMultiplierRow | null {
  const planRows = rows.filter((r) => r.plan_type === planType && r.active);
  for (const row of planRows) {
    if (!matchesOp(pct, row.min_op, row.min_pct)) continue;
    if (row.max_pct !== null && !matchesOp(pct, row.max_op, row.max_pct)) continue;
    return row;
  }
  return null;
}

export type TlCommissionResult = {
  mrrResult: number;
  nrrResult: number;
  total: number;
  mrrRow: TlMultiplierRow | null;
  nrrRow: TlMultiplierRow | null;
};

export function computeTlCommission(
  team: { mrr: { achieved: number; pct: number }; nrr: { achieved: number; pct: number } },
  rows: TlMultiplierRow[],
): TlCommissionResult {
  const mrrRow = lookupTlMultiplier(team.mrr.pct, rows, "MRR");
  const nrrRow = lookupTlMultiplier(team.nrr.pct, rows, "NRR");
  const mrrResult = mrrRow ? team.mrr.achieved * mrrRow.multiplier : 0;
  const nrrResult = nrrRow ? team.nrr.achieved * nrrRow.multiplier : 0;
  return { mrrResult, nrrResult, total: mrrResult + nrrResult, mrrRow, nrrRow };
}
