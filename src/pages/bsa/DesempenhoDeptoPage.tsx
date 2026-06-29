import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import { BSABillableChart } from "./views/BSABillableChart";
import { BSAFilterBar } from "@/components/bsa/BSAFilterBar";
import { useBSAContext } from "@/contexts/BSAContext";
import { useIsDark } from "@/hooks/useIsDark";
import type { ChartPoint } from "./views/BSAShared";

export function DesempenhoDeptoPage() {
  const { selectedMonth } = useBSAContext();
  const isDark = useIsDark();
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchChart() {
      const [year, month] = selectedMonth.split("-").map(Number);
      const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay  = new Date(year, month, 0).getDate();
      const dateTo   = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const allRows = await getDummyImplantacaoRows();
      const rows = allRows.filter((r) => r.report_date >= dateFrom && r.report_date <= dateTo);

      if (cancelled) return;

      const byDate: Record<string, { b: number; e: number }> = {};
      for (const r of rows) {
        if (!byDate[r.report_date]) byDate[r.report_date] = { b: 0, e: 0 };
        byDate[r.report_date].b += r.billable_hours ?? 0;
        byDate[r.report_date].e += r.skip_record
          ? 0
          : Math.max(0, (r.expected_billable_hours ?? 0) - (r.discount_hours ?? 0));
      }

      const points: ChartPoint[] = [];
      let cumB = 0, cumE = 0;
      for (let d = 1; d <= lastDay; d++) {
        const dd  = String(d).padStart(2, "0");
        const mm  = String(month).padStart(2, "0");
        const key = `${year}-${mm}-${dd}`;
        const day = byDate[key] ?? { b: 0, e: 0 };
        cumB += day.b;
        cumE += day.e;
        points.push({
          dateLabel:   `${dd}/${mm}`,
          dateKey:     key,
          cumBillable: parseFloat(cumB.toFixed(1)),
          cumMeta:     parseFloat(cumE.toFixed(1)),
        });
      }

      setChartData(points);
    }

    fetchChart();
    return () => { cancelled = true; };
  }, [selectedMonth]);

  return (
    <div className="space-y-8">

      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-delayed stagger-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-2xl shrink-0"
            style={{
              background: "rgba(1,126,132,0.10)",
              border:     "1px solid rgba(1,126,132,0.20)",
            }}
          >
            <TrendingUp className="h-5 w-5" style={{ color: "#017E84" }} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.18em]">
              BSA · Visão Geral
            </span>
            <h2
              className="leading-tight tracking-tight font-black animate-gradient-text"
              style={{ fontSize: "clamp(1.4rem, 2.5vw, 1.9rem)" }}
            >
              Desempenho do Departamento
            </h2>
            {/* Legenda do gráfico */}
            <div className="flex items-center gap-4 mt-0.5">
              <div className="flex items-center gap-1.5">
                <svg width="18" height="8" style={{ display: "block" }}>
                  <line x1="0" y1="4" x2="18" y2="4" stroke="#b87fa8" strokeWidth="1.5" />
                </svg>
                <span className="text-[11px] text-muted-foreground/45 font-medium">Faturado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="18" height="8" style={{ display: "block" }}>
                  <line x1="0" y1="4" x2="9" y2="4" stroke="#b87fa8" strokeWidth="1" strokeOpacity={0.4} strokeDasharray="4 3" />
                  <line x1="9" y1="4" x2="18" y2="4" stroke="#b87fa8" strokeWidth="1" strokeOpacity={0.4} strokeDasharray="4 3" />
                </svg>
                <span className="text-[11px] text-muted-foreground/30 font-medium">Sem dados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="18" height="8" style={{ display: "block" }}>
                  <line x1="0" y1="4" x2="18" y2="4" stroke="#ef4444" strokeWidth="1.2" />
                </svg>
                <span className="text-[11px] text-muted-foreground/45 font-medium">Meta</span>
              </div>
            </div>
          </div>
        </div>
        <BSAFilterBar hidePictureMode />
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────────── */}
      <div className="h-[calc(100vh-260px)] min-h-[380px]">
        <BSABillableChart
          data={chartData}
          isDark={isDark}
          hideHeader
        />
      </div>

    </div>
  );
}
