export const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const MONTH_NAMES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const OUTLIER_THRESHOLD = 15000;

export const YEAR_COLORS: Record<number, string> = {
  2024: "#8F8F8F",
  2025: "#714B67",
  2026: "#5B899E",
};

export const BADGE_COLORS: Record<string, string> = {
  "Insumos": "bg-[hsl(215,65%,55%)] text-white",
  "Ativos de escritório": "bg-[hsl(280,50%,60%)] text-white",
  "Eventos": "bg-[hsl(330,55%,58%)] text-white",
  "Serviços": "bg-[hsl(195,70%,50%)] text-white",
};

export function getBadgeColor(tipo: string): string {
  return BADGE_COLORS[tipo] || "bg-[hsl(260,45%,65%)] text-white";
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Returns "Jan 2025" format (space-separated, used in facilities month selectors)
export function formatMonthLabel(key: string): string {
  const [m, y] = key.split("/").map(Number);
  if (isNaN(m) || isNaN(y) || m < 1 || m > 12) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function statusBadge(status: string): string {
  if (status === "Pendente") return "bg-status-pending/10 text-status-pending";
  if (status === "Entregue") return "bg-kpi-up/10 text-kpi-up";
  return "bg-muted text-muted-foreground";
}

export function formatDate(d: Date | null): string {
  return d ? d.toLocaleDateString("pt-BR") : "—";
}
