import { Order } from "./data";

export interface Inconsistency {
  order: Order;
  type: "math" | "date" | "duplicate" | "outlier" | "qty" | "negative" | "aggregation";
  message: string;
}

export interface ValidationReport {
  totalRecords: number;
  validRecords: number;
  score: number;
  mathIntegrityScore: number;
  healthColor: "green" | "yellow" | "red";
  inconsistencies: Inconsistency[];
  byType: {
    math: number;
    date: number;
    duplicate: number;
    outlier: number;
    qty: number;
    negative: number;
    aggregation: number;
  };
  lastAnalysis: Date;
}

const WEIGHTS: Record<Inconsistency["type"], number> = {
  math: 5,
  negative: 5,
  aggregation: 5,
  duplicate: 3,
  date: 2,
  qty: 2,
  outlier: 1,
};

function getMinValidYear(orders: Order[]): number {
  const countByYear = new Map<number, number>();
  orders.forEach((o) => {
    if (!o.dataPedido) return;
    const y = o.dataPedido.getFullYear();
    countByYear.set(y, (countByYear.get(y) || 0) + 1);
  });
  const validYears = Array.from(countByYear.entries())
    .filter(([, count]) => count >= 3)
    .map(([year]) => year)
    .sort((a, b) => a - b);
  return validYears.length > 0 ? validYears[0] : new Date().getFullYear();
}

function findDuplicates(orders: Order[]): Set<number> {
  const groups = new Map<string, number[]>();
  orders.forEach((o, idx) => {
    if (!o.codPedido) return;

    // Rule: if NFe is missing entirely, we can't definitively call it a duplicate 
    // based on just metadata, as purchases could be identical but apart. 
    // However, if the rule requires exact match, we must group them.
    // If NFe is different, they are definitely distinct items, so they shouldn't match.
    // By adding NFe to the group key, identical items with different NFe's end up in different buckets!
    const dateStr = o.dataPedido ? o.dataPedido.toISOString().slice(0, 10) : "";
    const nfeStr = (o.nfe || "").trim().toLowerCase();

    // Key format: codPedido|produto|qtde|date|valor|NFE
    const key = `${o.codPedido}|${o.produto}|${o.qtde}|${dateStr}|${Math.round(o.valorTotal * 100)}|${nfeStr}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(idx);
  });

  const dupIndices = new Set<number>();
  groups.forEach((indices) => {
    if (indices.length >= 2) {
      indices.forEach((i) => dupIndices.add(i));
    }
  });
  return dupIndices;
}

function crossCheckTotals(orders: Order[]): number {
  // Sum item by item
  const itemTotal = orders.reduce((s, o) => s + o.valorTotal, 0);

  // Sum grouped by month
  const byMonth = new Map<string, number>();
  orders.forEach((o) => {
    if (!o.mesRef) return;
    byMonth.set(o.mesRef, (byMonth.get(o.mesRef) || 0) + o.valorTotal);
  });
  const monthTotal = Array.from(byMonth.values()).reduce((s, v) => s + v, 0);

  // Sum grouped by year
  const byYear = new Map<string, number>();
  orders.forEach((o) => {
    if (!o.mesRef) return;
    const y = o.mesRef.split("/")[1];
    if (y) byYear.set(y, (byYear.get(y) || 0) + o.valorTotal);
  });
  const yearTotal = Array.from(byYear.values()).reduce((s, v) => s + v, 0);

  const maxDiff = Math.max(
    Math.abs(itemTotal - monthTotal),
    Math.abs(itemTotal - yearTotal),
    Math.abs(monthTotal - yearTotal)
  );
  return maxDiff;
}

export function validateData(orders: Order[]): ValidationReport {
  const now = new Date();
  const currentYear = now.getFullYear();
  const minValidYear = getMinValidYear(orders);
  const duplicateIndices = findDuplicates(orders);
  const inconsistencies: Inconsistency[] = [];
  const seenOrders = new Set<string>(); // track already-flagged orders per type

  orders.forEach((order, idx) => {
    const orderKey = `${order.codPedido}-${order.idProd}-${idx}`;

    // Math inconsistency
    const expected = (order.qtde * order.valorUnit) + order.valorFrete;
    if (Math.abs(order.valorTotal - expected) > 0.02) {
      inconsistencies.push({
        order,
        type: "math",
        message: `Valor total ${order.valorTotal.toFixed(2)} diverge do esperado ${expected.toFixed(2)}`,
      });
    }

    // Negative values
    if (order.valorUnit < 0 || order.valorFrete < 0 || order.valorTotal < 0) {
      inconsistencies.push({
        order,
        type: "negative",
        message: `Valor negativo detectado`,
      });
    }

    // QTDE invalid
    if (order.qtde <= 0) {
      inconsistencies.push({
        order,
        type: "qty",
        message: `Quantidade inválida: ${order.qtde}`,
      });
    }

    // Date validation (dynamic)
    if (order.dataPedido) {
      const year = order.dataPedido.getFullYear();
      if (year < minValidYear || year > currentYear + 1) {
        inconsistencies.push({
          order,
          type: "date",
          message: `Data fora do intervalo esperado (${minValidYear}–${currentYear + 1})`,
        });
      }
    }

    // Duplicates
    if (duplicateIndices.has(idx)) {
      inconsistencies.push({
        order,
        type: "duplicate",
        message: `Possível duplicidade detectada`,
      });
    }

    // Outlier
    if (order.valorTotal > 15000) {
      inconsistencies.push({
        order,
        type: "outlier",
        message: `Compra acima de R$ 15.000`,
      });
    }
  });

  // Cross-check aggregation
  const aggregationDiff = crossCheckTotals(orders);
  if (aggregationDiff > 0.05) {
    // Add as a single aggregation inconsistency (use first order as reference)
    if (orders.length > 0) {
      inconsistencies.push({
        order: orders[0],
        type: "aggregation",
        message: `Divergência de agregação de R$ ${aggregationDiff.toFixed(2)}`,
      });
    }
  }

  // Count by type
  const byType = { math: 0, date: 0, duplicate: 0, outlier: 0, qty: 0, negative: 0, aggregation: 0 };
  inconsistencies.forEach((i) => byType[i.type]++);

  // Weighted score
  const totalRecords = orders.length || 1;
  const penaltySum = Object.entries(byType).reduce(
    (sum, [type, count]) => sum + count * WEIGHTS[type as Inconsistency["type"]],
    0
  );
  const penaltyRate = penaltySum / totalRecords;
  const score = Math.max(0, Math.min(100, 100 - penaltyRate * 20));

  // Math integrity score (secondary)
  const mathPenalty = (byType.math * WEIGHTS.math + byType.negative * WEIGHTS.negative + byType.aggregation * WEIGHTS.aggregation);
  const mathRate = mathPenalty / totalRecords;
  const mathIntegrityScore = Math.max(0, Math.min(100, 100 - mathRate * 20));

  // Unique orders with inconsistencies
  const ordersWithIssues = new Set(inconsistencies.map((i) => `${i.order.codPedido}-${i.order.idProd}`));
  const validRecords = totalRecords - ordersWithIssues.size;

  const healthColor: ValidationReport["healthColor"] =
    score >= 95 ? "green" : score >= 85 ? "yellow" : "red";

  return {
    totalRecords: orders.length,
    validRecords: Math.max(0, validRecords),
    score: Math.round(score * 10) / 10,
    mathIntegrityScore: Math.round(mathIntegrityScore * 10) / 10,
    healthColor,
    inconsistencies,
    byType,
    lastAnalysis: now,
  };
}
