// Loads and caches dummy CSV data for portfolio demo.
// Replaces all Supabase queries for Facilities and Direct Sales.

// ── CSV parser (RFC 4180: handles quoted fields + embedded commas) ─────────────

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === "," && !inQuote) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()]));
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SalesRow {
  id: number;
  user_id: number;
  user_name: string;
  date_from: string;
  forecast: number;
  target_amount: number;
  achieved: number;
  commission: number;
  plan_id: number;
  plan_name: string;
  plan_type: string;
  amount: number;
  active: boolean;
  team_id: number;
  team_name: string;
  manager_id: number;
  manager_name: string;
  team_type: string;
  created_at: string;
  skip_record: boolean;
}

export interface FacilitiesRow {
  id: string;
  status: string;
  solicitante: string;
  tipo: string;
  cod_pedido: string;
  data_pedido: string;
  mes_ref: string;
  id_prod: string;
  produto: string;
  qtde: number;
  valor_unit: number;
  valor_total: number;
  valor_frete: number;
  cat: string;
  sub_cat: string;
  descricao: string;
  fornecedor: string;
  nfe: string;
  vencimento: string;
}

// ── Cache ────────────────────────────────────────────────────────────────────

let salesCache: SalesRow[] | null = null;
let facilitiesCache: FacilitiesRow[] | null = null;
let equipmentCache: Record<string, string>[] | null = null;

// ── Loaders ──────────���─────────────────────────��──────────────────────────────

export async function getDummySalesRows(): Promise<SalesRow[]> {
  if (salesCache) return salesCache;
  const res = await fetch("/data/sales.csv");
  const text = await res.text();
  const rows = parseCSV(text);
  salesCache = rows.map((r) => ({
    id:            Number(r.id) || 0,
    user_id:       Number(r.user_id) || 0,
    user_name:     r.user_name ?? "",
    date_from:     r.date_from ?? "",
    forecast:      parseFloat(r.forecast) || 0,
    target_amount: parseFloat(r.target_amount) || 0,
    achieved:      parseFloat(r.achieved) || 0,
    commission:    parseFloat(r.commission) || 0,
    plan_id:       Number(r.plan_id) || 0,
    plan_name:     r.plan_name ?? "",
    plan_type:     r.plan_type ?? "",
    amount:        parseFloat(r.amount) || 0,
    active:        r.active === "true",
    team_id:       Number(r.team_id) || 0,
    team_name:     r.team_name ?? "",
    manager_id:    Number(r.manager_id) || 0,
    manager_name:  r.manager_name ?? "",
    team_type:     r.team_type ?? "",
    created_at:    r.created_at ?? "",
    skip_record:   r.skip_record === "true",
  }));
  return salesCache;
}

export async function getDummyFacilitiesRows(): Promise<FacilitiesRow[]> {
  if (facilitiesCache) return facilitiesCache;
  const res = await fetch("/data/facilities.csv");
  const text = await res.text();
  const rows = parseCSV(text);
  facilitiesCache = rows.map((r) => ({
    id:          r.id ?? "",
    status:      r.status ?? "",
    solicitante: r.solicitante ?? "",
    tipo:        r.tipo ?? "",
    cod_pedido:  r.cod_pedido ?? "",
    data_pedido: r.data_pedido ?? "",
    mes_ref:     r.mes_ref ?? "",
    id_prod:     r.id_prod ?? "",
    produto:     r.produto ?? "",
    qtde:        parseFloat(r.qtde) || 0,
    valor_unit:  parseFloat(r.valor_unit) || 0,
    valor_total: parseFloat(r.valor_total) || 0,
    valor_frete: parseFloat(r.valor_frete) || 0,
    cat:         r.cat ?? "",
    sub_cat:     r.sub_cat ?? "",
    descricao:   r.descricao ?? "",
    fornecedor:  r.fornecedor ?? "",
    nfe:         r.nfe ?? "",
    vencimento:  r.vencimento ?? "",
  }));
  return facilitiesCache;
}

export async function getDummyEquipmentRows(): Promise<Record<string, string>[]> {
  if (equipmentCache) return equipmentCache;
  const res = await fetch("/data/equipaments.csv");
  const text = await res.text();
  equipmentCache = parseCSV(text);
  return equipmentCache;
}

// ── Implantacao (BSA) ─────────────────────────────────────────────────────────

export interface ImplantacaoRow {
  user_id: number;
  team_id: number;
  manager_id: number;
  user_name: string;
  manager_name: string;
  team_name: string;
  report_date: string;
  day_type: string;
  billable_hours: number;
  expected_billable_hours: number;
  discount_hours: number;
  skip_record: boolean;
  is_rampup: boolean;
}

let implantacaoCache: ImplantacaoRow[] | null = null;

export async function getDummyImplantacaoRows(): Promise<ImplantacaoRow[]> {
  if (implantacaoCache) return implantacaoCache;
  const res = await fetch("/data/implantacao.csv");
  const text = await res.text();
  const rows = parseCSV(text);
  implantacaoCache = rows.map((r) => ({
    user_id:                 Number(r.user_id) || 0,
    team_id:                 Number(r.team_id) || 0,
    manager_id:              Number(r.manager_id) || 0,
    user_name:               r.user_name ?? "",
    manager_name:            r.manager_name ?? "",
    team_name:               r.team_name ?? "",
    report_date:             r.report_date ?? "",
    day_type:                r.day_type ?? "",
    billable_hours:          parseFloat(r.billable_hours) || 0,
    expected_billable_hours: parseFloat(r.expected_billable_hours) || 0,
    discount_hours:          parseFloat(r.discount_hours) || 0,
    skip_record:             r.skip_record === "true",
    is_rampup:               r.is_rampup === "true",
  }));
  return implantacaoCache;
}
