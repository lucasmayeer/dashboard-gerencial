// Tipos, constantes e helpers compartilhados entre as views BSA

export interface BSAQuarterData {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  billable: number;
  meta: number;
  pct: number;
  hasData: boolean;
}

export interface ChartPoint {
  dateLabel: string;   // "01/05"
  dateKey: string;     // "2026-05-01"
  cumBillable: number;
  cumMeta: number;
}

export const QUARTER_MONTHS: Record<string, number[]> = {
  Q1: [1, 2, 3],
  Q2: [4, 5, 6],
  Q3: [7, 8, 9],
  Q4: [10, 11, 12],
};

export const QUARTER_LABEL: Record<string, string> = {
  Q1: "Quarter 01", Q2: "Quarter 02", Q3: "Quarter 03", Q4: "Quarter 04",
};

// Verbose format "6h 30min" — divergência intencional de bsaUtils.fmtH ("6h30m" compacto)
export function fmtH(v: number): string {
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export const fmt2 = (n: number | null) => n != null ? String(n).padStart(2, "0") : "00";
