import { getDummyFacilitiesRows, getDummyEquipmentRows } from "@/lib/dummyDataLoader";

export interface Order {
  status: string;
  solicitante: string;
  tipo: string;
  codPedido: string;
  dataPedido: Date | null;
  mesRef: string;
  idProd: string;
  produto: string;
  qtde: number;
  valorUnit: number;
  valorTotal: number;
  valorFrete: number;
  cat: string;
  subCat: string;
  descricao: string;
  fornecedor: string;
  nfe: string;
  vencimento: Date | null;
}

function parseDate(val: string | null): Date | null {
  if (!val || val.trim() === "") return null;
  const parts = val.trim().split("/");
  if (parts.length === 3) {
    const day   = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year    = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  const isoParts = val.trim().split("-");
  if (isoParts.length === 3) {
    const year  = parseInt(isoParts[0], 10);
    const month = parseInt(isoParts[1], 10) - 1;
    const day   = parseInt(isoParts[2].split("T")[0], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) return new Date(year, month, day);
  }
  return null;
}

export async function loadData(): Promise<Order[]> {
  const rows = await getDummyFacilitiesRows();
  const mesRefRegex = /^\d{2}\/\d{4}$/;
  return rows
    .map((row) => ({
      status:      row.status.trim(),
      solicitante: row.solicitante.trim(),
      tipo:        row.tipo.trim(),
      codPedido:   row.cod_pedido.trim(),
      dataPedido:  parseDate(row.data_pedido),
      mesRef:      row.mes_ref.trim(),
      idProd:      row.id_prod.trim(),
      produto:     row.produto.trim(),
      qtde:        row.qtde,
      valorUnit:   row.valor_unit,
      valorTotal:  row.valor_total,
      valorFrete:  row.valor_frete,
      cat:         row.cat.trim(),
      subCat:      row.sub_cat.trim(),
      descricao:   row.descricao.trim(),
      fornecedor:  row.fornecedor.trim(),
      nfe:         row.nfe.trim(),
      vencimento:  parseDate(row.vencimento),
    }))
    .filter((o) => mesRefRegex.test(o.mesRef) && o.tipo !== "");
}

// ── Equipment — no dummy data yet, returns empty ─────────────────────────────

export interface Equipment {
  nomeEquipamento: string;
  funcionario: string;
  numeroSerie: string;
  categoria: string;
  custo: number;
  modelo: string;
}

export function extractPatrimonialId(nome: string): string | null {
  const match = nome.match(/\[(\d{5})\]/);
  return match ? match[1] : null;
}

export async function loadEquipment(): Promise<Equipment[]> {
  const rows = await getDummyEquipmentRows();
  return rows.map((r) => ({
    nomeEquipamento: r["Nome do equipamento"]  ?? "",
    funcionario:     r["Funcionário atribuído"] ?? "",
    numeroSerie:     r["Número de série"]       ?? "",
    categoria:       r["Categoria de equipamento"] ?? "",
    custo:           parseFloat((r["Custo"] ?? "").replace(/,/g, "")) || 0,
    modelo:          r["Modelo"] ?? "",
  }));
}

// ── Sync stubs — UI buttons preserved, no backend ────────────────────────────

export async function getLastSync(): Promise<{ status: string; finishedAt: string | null; rowsProcessed: number } | null> {
  return null;
}

export async function triggerSync(): Promise<{ success: boolean; rowsProcessed?: number; error?: string }> {
  return { success: false, error: "Sync não disponível na versão demo." };
}

export async function triggerSyncDS(): Promise<{ success: boolean; rowsProcessed?: number; error?: string }> {
  return { success: false, error: "Sync não disponível na versão demo." };
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function getUniqueValues(orders: Order[], key: keyof Order): string[] {
  const values = new Set<string>();
  orders.forEach((o) => {
    const v = String(o[key] || "").trim();
    if (v && v !== "-") values.add(v);
  });
  return Array.from(values).sort();
}
