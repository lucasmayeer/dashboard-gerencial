import type { Tables } from "@/integrations/supabase/types";

// =============================================================================
// TIPOS COMPARTILHADOS — Direct Sales
// =============================================================================

export interface CommissionRowStatus {
  plan_name: string;
  skip_record: boolean;
  active: boolean;
}

// =============================================================================
// HELPERS DE STATUS — usam apenas CommissionRowStatus (duck typing)
// =============================================================================

export function isRampUp(row: CommissionRowStatus): boolean {
  return row.plan_name.toUpperCase().startsWith("[RAMP-UP]");
}

export function isOnLeave(row: CommissionRowStatus): boolean {
  return row.skip_record === true && !isRampUp(row);
}

export function getStatus(row: CommissionRowStatus): "ativo" | "ramp-up" | "férias" | "inativo" {
  if (row.active === false) return "inativo";
  if (isRampUp(row)) return "ramp-up";
  if (isOnLeave(row)) return "férias";
  return "ativo";
}

// Ex: new Date(2026,0,15) → "2026-01"
export function toMonthKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

// =============================================================================
// CONSTANTES COMPARTILHADAS — Direct Sales
// =============================================================================

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const MRR_COLOR = "#714B67";
export const NRR_COLOR = "#017E84";

export const MRR_BADGE_COLOR = "#b87fa8";
export const NRR_BADGE_COLOR = "#0fb8c0";

export const MRR_BADGE_STYLE = {
  background: "rgba(113,75,103,0.18)",
  border: "1px solid rgba(113,75,103,0.40)",
  color: "#b87fa8",
} as const;

export const NRR_BADGE_STYLE = {
  background: "rgba(1,126,132,0.16)",
  border: "1px solid rgba(1,126,132,0.38)",
  color: "#0fb8c0",
} as const;

// =============================================================================
// FORMATADORES
// =============================================================================

export function formatMonthLabel(key: string): string {
  const [yyyy, mm] = key.split("-");
  const monthIndex = parseInt(mm, 10) - 1;
  return `${MONTH_NAMES[monthIndex] ?? mm} ${yyyy}`;
}

export const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// ≥100%: verde · ≥70%: laranja · <70%: vermelho
export function pctColor(pct: number): string {
  if (pct >= 100) return "text-[hsl(var(--kpi-up))]";
  if (pct >= 70) return "text-[hsl(35,90%,55%)]";
  return "text-[hsl(var(--kpi-down))]";
}

// =============================================================================
// PALETAS DE TIME — identificação visual
// =============================================================================

export const TEAM_PALETTE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "1-5": {
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.22)",
    text: "#34d399",
    dot: "#10b981",
  },
  "5+": {
    bg: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.22)",
    text: "#a78bfa",
    dot: "#8b5cf6",
  },
  "outbound": {
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.22)",
    text: "#fbbf24",
    dot: "#f59e0b",
  },
  "ramp-up": {
    bg: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.22)",
    text: "#60a5fa",
    dot: "#3b82f6",
  },
};

export function resolveTeamPalette(teamType: string | null) {
  if (teamType === "1-5") return TEAM_PALETTE["1-5"];
  if (teamType === "5+") return TEAM_PALETTE["5+"];
  return TEAM_PALETTE["outbound"];
}

// Cores fixas por nome de time — identidade visual definida pelo branding.
export const TEAM_NAME_FIXED_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Guamdes Contas":   { bg: "rgba(56,176,157,0.13)",  border: "rgba(56,176,157,0.32)",  text: "#38B09D" },
  "Majestosos":       { bg: "rgba(109,15,31,0.22)",    border: "rgba(180,55,75,0.38)",   text: "#d9606f" },
  "BOPE":             { bg: "rgba(211,175,55,0.13)",   border: "rgba(211,175,55,0.32)",  text: "#D3AF37" },
  "Arrastão":         { bg: "rgba(91,137,158,0.13)",   border: "rgba(91,137,158,0.32)",  text: "#5B899E" },
  "GABN of Thrones":  { bg: "rgba(228,169,0,0.13)",    border: "rgba(228,169,0,0.32)",   text: "#E4A900" },
  "Power Nacers":     { bg: "rgba(0,79,157,0.18)",     border: "rgba(35,115,210,0.35)",  text: "#5aabf8" },
  "Fomáfia":          { bg: "rgba(0,100,55,0.18)",     border: "rgba(0,148,80,0.35)",    text: "#2ecb78" },
};

// Fallback de cores para times não mapeados (hash determinístico)
export const TEAM_NAME_FALLBACK_COLORS = [
  { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   text: "#f87171" },
  { bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.25)",  text: "#fb923c" },
  { bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.25)",   text: "#facc15" },
  { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.25)",   text: "#4ade80" },
  { bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.25)",   text: "#22d3ee" },
  { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)",  text: "#60a5fa" },
  { bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.25)",  text: "#a78bfa" },
  { bg: "rgba(217,70,239,0.12)",  border: "rgba(217,70,239,0.25)",  text: "#e879f9" },
  { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.25)",  text: "#f472b6" },
  { bg: "rgba(20,184,166,0.12)",  border: "rgba(20,184,166,0.25)",  text: "#2dd4bf" },
];

export function hashTeamName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % TEAM_NAME_FALLBACK_COLORS.length;
}

// =============================================================================
// COMISSÕES — tipos base + parseRow (compartilhados por rankingUtils e previaUtils)
// =============================================================================

export type RawCommissionRow = Pick<
  Tables<"commissions_report">,
  | "user_name" | "manager_name" | "plan_name" | "plan_type" | "date_from"
  | "target_amount" | "forecast" | "achieved" | "commission"
  | "team_type" | "skip_record" | "active" | "team_name"
>;

export type PlanType = "MRR" | "NRR";

export interface CommissionRow {
  user_name: string | null;
  manager_name: string | null;
  plan_name: string;
  plan_type: PlanType | null;
  date_from: Date;
  target_amount: number | null;
  forecast: number | null;
  achieved: number | null;
  commission: number | null;
  team_name: string | null;
  team_type: string | null;
  skip_record: boolean;
  active: boolean;
}

// uses new Date(year, month-1, day) to avoid UTC-3 day boundary issues with ISO strings
export function parseRow(raw: RawCommissionRow): CommissionRow {
  const [year, month, day] = raw.date_from.split("-").map(Number);
  return {
    user_name: raw.user_name,
    manager_name: raw.manager_name,
    plan_name: raw.plan_name ?? "",
    plan_type: raw.plan_type as PlanType | null,
    date_from: new Date(year, month - 1, day),
    target_amount: raw.target_amount,
    forecast: raw.forecast,
    achieved: raw.achieved,
    commission: raw.commission,
    team_name: raw.team_name,
    team_type: raw.team_type,
    skip_record: raw.skip_record ?? false,
    active: raw.active ?? true,
  };
}
