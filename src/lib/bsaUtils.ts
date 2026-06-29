// Meta padrão por dia útil (horas decimais: 6.5 = 6h 30min)
export const DEFAULT_DAILY_BILLABLE_HOURS = 6.5;

// "YYYY-MM" do mês atual
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Formato compacto "6h30m" — diverge de BSAShared.fmtH ("6h 30min") intencionalmente: ranking usa espaço comprimido; KPI cards usam verbose para legibilidade
export function fmtH(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins > 0 ? `${hours}h${String(mins).padStart(2, "0")}m` : `${hours}h`;
}

// "MM/DD" + year → "YYYY-MM-DD". Returns null if format invalid.
export function parseVacationDate(mmdd: string, year: number): string | null {
  const match = mmdd.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const mm = Number(match[1]);
  const dd = Number(match[2]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// "YYYY-MM-DD" → "MM/DD"
export function formatDateToMMDD(isoDate: string): string {
  return isoDate.slice(5).replace("-", "/");
}
