import { describe, it, expect } from "vitest";
import { fmtH, parseVacationDate, formatDateToMMDD } from "@/lib/bsaUtils";
import { pctColor } from "@/lib/directSalesUtils";
import { pctColorDsm, sellerRankingScore, aggregateSellers, aggregateCompanyFromSellers } from "@/lib/desempenhoUtils";
import type { RawRow } from "@/lib/desempenhoUtils";

// ── fmtH ─────────────────────────────────────────────────────────────────────
describe("fmtH", () => {
  it("inteiro → sem minutos", () => expect(fmtH(6)).toBe("6h"));
  it("0.5 → 30min", () => expect(fmtH(6.5)).toBe("6h30m"));
  it("0.25 → 15min", () => expect(fmtH(1.25)).toBe("1h15m"));
  it("0.75 → 45min", () => expect(fmtH(0.75)).toBe("0h45m"));
  it("zero → 0h", () => expect(fmtH(0)).toBe("0h"));
  it("minutos com zero à esquerda", () => expect(fmtH(1.05)).toBe("1h03m"));
});

// ── parseVacationDate ─────────────────────────────────────────────────────────
describe("parseVacationDate", () => {
  it("formato válido → ISO", () => expect(parseVacationDate("06/15", 2026)).toBe("2026-06-15"));
  it("dia/mês single-digit → zero-padded", () => expect(parseVacationDate("1/5", 2026)).toBe("2026-01-05"));
  it("formato inválido → null", () => expect(parseVacationDate("15-06", 2026)).toBeNull());
  it("string vazia → null", () => expect(parseVacationDate("", 2026)).toBeNull());
  it("mês 0 → null", () => expect(parseVacationDate("0/15", 2026)).toBeNull());
  it("mês 13 → null", () => expect(parseVacationDate("13/01", 2026)).toBeNull());
  it("dia 0 → null", () => expect(parseVacationDate("06/0", 2026)).toBeNull());
  it("dia 32 → null", () => expect(parseVacationDate("06/32", 2026)).toBeNull());
  it("com espaços → válido (trim)", () => expect(parseVacationDate(" 06/15 ", 2026)).toBe("2026-06-15"));
});

// ── formatDateToMMDD ──────────────────────────────────────────────────────────
describe("formatDateToMMDD", () => {
  it("ISO → MM/DD", () => expect(formatDateToMMDD("2026-06-15")).toBe("06/15"));
  it("janeiro → 01/01", () => expect(formatDateToMMDD("2026-01-01")).toBe("01/01"));
});

// ── pctColor (directSalesUtils) ───────────────────────────────────────────────
describe("pctColor", () => {
  it("100% → verde", () => expect(pctColor(100)).toBe("text-[hsl(var(--kpi-up))]"));
  it("150% → verde", () => expect(pctColor(150)).toBe("text-[hsl(var(--kpi-up))]"));
  it("70% → laranja", () => expect(pctColor(70)).toBe("text-[hsl(35,90%,55%)]"));
  it("99.9% → laranja", () => expect(pctColor(99.9)).toBe("text-[hsl(35,90%,55%)]"));
  it("69.9% → vermelho", () => expect(pctColor(69.9)).toBe("text-[hsl(var(--kpi-down))]"));
  it("0% → vermelho", () => expect(pctColor(0)).toBe("text-[hsl(var(--kpi-down))]"));
});

// ── pctColorDsm (desempenhoUtils — threshold 80%, Tailwind literals) ──────────
describe("pctColorDsm", () => {
  it("100% → emerald", () => expect(pctColorDsm(100)).toBe("text-emerald-500"));
  it("80% → amber (threshold diferente de pctColor)", () => expect(pctColorDsm(80)).toBe("text-amber-400"));
  it("79.9% → red", () => expect(pctColorDsm(79.9)).toBe("text-red-400"));
  it("0% → red", () => expect(pctColorDsm(0)).toBe("text-red-400"));
});

// ── sellerRankingScore ────────────────────────────────────────────────────────
describe("sellerRankingScore", () => {
  it("ambos ≥100% → 100 + media", () => expect(sellerRankingScore(100, 100)).toBe(200));
  it("MRR 120 NRR 110 → 100 + 115", () => expect(sellerRankingScore(120, 110)).toBe(215));
  it("só MRR ≥100% → media simples", () => expect(sellerRankingScore(100, 50)).toBe(75));
  it("ambos abaixo → media simples", () => expect(sellerRankingScore(80, 60)).toBe(70));
  it("zeros → 0", () => expect(sellerRankingScore(0, 0)).toBe(0));
});

// ── aggregateSellers — regras de negócio core ─────────────────────────────────
function makeRow(overrides: Partial<RawRow>): RawRow {
  return {
    user_id: 1,
    user_name: "Ana",
    manager_id: 10,
    manager_name: "Gerente",
    plan_name: "MRR Plan",
    plan_type: "MRR",
    date_from: "2026-06-01",
    target_amount: 10000,
    achieved: 8000,
    commission: 500,
    skip_record: false,
    active: true,
    team_name: "Time A",
    team_type: null,
    ...overrides,
  };
}

describe("aggregateSellers", () => {
  it("vendedor ativo → achieved + target contam", () => {
    const result = aggregateSellers([makeRow({})]);
    expect(result[0].mrr.achieved).toBe(8000);
    expect(result[0].mrr.target).toBe(10000);
  });

  it("férias → achieved conta, target zerado", () => {
    const result = aggregateSellers([makeRow({ skip_record: true, plan_name: "MRR Plan" })]);
    expect(result[0].mrr.achieved).toBe(8000);
    expect(result[0].mrr.target).toBe(0);
    expect(result[0].status).toBe("férias");
  });

  it("ramp-up → achieved conta, target zerado", () => {
    const result = aggregateSellers([makeRow({ skip_record: true, plan_name: "[RAMP-UP] MRR" })]);
    expect(result[0].mrr.achieved).toBe(8000);
    expect(result[0].mrr.target).toBe(0);
    expect(result[0].status).toBe("ramp-up");
  });

  it("inativo linha01 (achieved=0) → ignorado", () => {
    const result = aggregateSellers([makeRow({ active: false, achieved: 0 })]);
    expect(result).toHaveLength(0);
  });

  it("inativo linha02 (0 < achieved ≤ target) → só achieved", () => {
    const result = aggregateSellers([makeRow({ active: false, achieved: 5000, target_amount: 10000 })]);
    expect(result[0].mrr.achieved).toBe(5000);
    expect(result[0].mrr.target).toBe(0);
  });

  it("inativo linha03 (achieved > target) → achieved + target", () => {
    const result = aggregateSellers([makeRow({ active: false, achieved: 12000, target_amount: 10000 })]);
    expect(result[0].mrr.achieved).toBe(12000);
    expect(result[0].mrr.target).toBe(10000);
  });

  it("MRR + NRR → total correto", () => {
    const rows = [
      makeRow({ plan_type: "MRR", achieved: 8000, target_amount: 10000 }),
      makeRow({ plan_type: "NRR", achieved: 3000, target_amount: 5000 }),
    ];
    const result = aggregateSellers(rows);
    expect(result[0].total.achieved).toBe(11000);
    expect(result[0].total.target).toBe(15000);
  });

  it("pct calculado corretamente", () => {
    const result = aggregateSellers([makeRow({ achieved: 8000, target_amount: 10000 })]);
    expect(result[0].mrr.pct).toBeCloseTo(80);
  });

  it("target zero → pct zero (sem divisão por zero)", () => {
    const result = aggregateSellers([makeRow({ target_amount: 0, achieved: 5000 })]);
    expect(result[0].mrr.pct).toBe(0);
  });
});

// ── aggregateCompanyFromSellers ───────────────────────────────────────────────
describe("aggregateCompanyFromSellers", () => {
  it("soma achieved de todos os vendors incluindo férias/ramp-up", () => {
    const sellers = aggregateSellers([
      makeRow({ user_name: "Ana", achieved: 8000, target_amount: 10000 }),
      makeRow({ user_name: "Bob", achieved: 3000, target_amount: 5000, skip_record: true }),
    ]);
    const company = aggregateCompanyFromSellers(sellers);
    expect(company.mrr.achieved).toBe(11000);
  });

  it("lista vazia → zeros", () => {
    const company = aggregateCompanyFromSellers([]);
    expect(company.mrr.achieved).toBe(0);
    expect(company.total.pct).toBe(0);
  });
});
