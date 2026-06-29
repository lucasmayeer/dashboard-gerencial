import { TrendingUp, User, Users } from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { ChartPoint } from "./BSAShared";
import { fmtH } from "./BSAShared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function BSABillableChart({
  data, isDark, title = "Sua linha de tendência",
  analystOptions, selectedChartAnalyst, onChartAnalystChange,
  teamOptions, selectedChartTeam, onChartTeamChange,
  hideHeader = false,
}: {
  data: ChartPoint[];
  isDark: boolean;
  title?: string;
  analystOptions?: string[];
  selectedChartAnalyst?: string | null;
  onChartAnalystChange?: (v: string | null) => void;
  teamOptions?: string[];
  selectedChartTeam?: string | null;
  onChartTeamChange?: (v: string | null) => void;
  hideHeader?: boolean;
}) {
  const axisColor = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // Split cumBillable: solid up to today, dashed from today onward
  // Today is the join point — appears in both so lines connect seamlessly
  const todayKey = new Date().toISOString().split("T")[0];
  const enriched = data.map((p) => ({
    ...p,
    cumBillableActual: p.dateKey <= todayKey ? p.cumBillable : null,
    cumBillableFuture: p.dateKey >= todayKey ? p.cumBillable : null,
  }));

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const cumB =
      payload.find((p: any) => p.dataKey === "cumBillableActual" && p.value != null)?.value ??
      payload.find((p: any) => p.dataKey === "cumBillableFuture" && p.value != null)?.value ??
      0;
    const cumM = payload.find((p: any) => p.dataKey === "cumMeta")?.value ?? 0;
    const gap = Math.max(0, cumM - cumB);
    return (
      <div style={{
        background: isDark ? "rgba(14,15,24,0.95)" : "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
        borderRadius: 10, padding: "10px 14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        minWidth: 160,
      }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}>{label}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: "#b87fa8" }}>● Faturado: <b>{fmtH(cumB)}</b></span>
          <span style={{ fontSize: 11, color: "#ef4444" }}>— Meta: <b>{fmtH(cumM)}</b></span>
          {gap > 0 && <span style={{ fontSize: 11, color: "#f87171" }}>⚠ Gap: <b>{fmtH(gap)}</b></span>}
          {gap === 0 && cumM > 0 && <span style={{ fontSize: 11, color: "#22c55e" }}>✓ Meta atingida</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-2">
      {!hideHeader && (
        <div className="flex flex-col gap-2 mb-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 shrink-0" style={{ color: "#5B899E" }} />
              <span className="text-[12px] font-semibold text-muted-foreground/55 tracking-wide uppercase">{title}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {teamOptions && teamOptions.length > 0 && onChartTeamChange && (
                <Select
                  value={selectedChartTeam ?? "__all__"}
                  onValueChange={(v) => onChartTeamChange(v === "__all__" ? null : v)}
                >
                  <SelectTrigger className="h-6 w-[150px] text-[10px] glass-button border-0 gap-1.5 shrink-0">
                    <Users className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Todo o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">Todo o departamento</SelectItem>
                    {teamOptions.map((name) => (
                      <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {analystOptions && analystOptions.length > 0 && onChartAnalystChange && (
                <Select
                  value={selectedChartAnalyst ?? "__all__"}
                  onValueChange={(v) => onChartAnalystChange(v === "__all__" ? null : v)}
                >
                  <SelectTrigger className="h-6 w-[150px] text-[10px] glass-button border-0 gap-1.5 shrink-0">
                    <User className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Todo o time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">Todo o time</SelectItem>
                    {analystOptions.map((name) => (
                      <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 pl-[22px]">
            <div className="flex items-center gap-1.5">
              <svg width="18" height="8" style={{ display: "block" }}>
                <line x1="0" y1="4" x2="18" y2="4" stroke="#b87fa8" strokeWidth="1.5" />
              </svg>
              <span className="text-[12px] text-muted-foreground/45 font-medium">Faturado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="18" height="8" style={{ display: "block" }}>
                <line x1="0" y1="4" x2="9" y2="4" stroke="#b87fa8" strokeWidth="1" strokeOpacity={0.4} strokeDasharray="4 3" />
                <line x1="9" y1="4" x2="18" y2="4" stroke="#b87fa8" strokeWidth="1" strokeOpacity={0.4} strokeDasharray="4 3" />
              </svg>
              <span className="text-[12px] text-muted-foreground/30 font-medium">Sem dados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="18" height="8" style={{ display: "block" }}>
                <line x1="0" y1="4" x2="18" y2="4" stroke="#ef4444" strokeWidth="1.2" />
              </svg>
              <span className="text-[12px] text-muted-foreground/45 font-medium">Meta</span>
            </div>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={enriched} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 8, fill: axisColor, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={36}
          />
          <YAxis
            tickFormatter={(v) => fmtH(v)}
            tick={{ fontSize: 9, fill: axisColor, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />

          <Area
            type="natural"
            dataKey="cumMeta"
            stroke="#ef4444"
            strokeWidth={1.2}
            fill="none"
            fillOpacity={0}
            dot={false}
            activeDot={{ r: 5, fill: "#ef4444" }}
            isAnimationActive={false}
          />
          <Line
            type="natural"
            dataKey="cumBillableActual"
            stroke="#b87fa8"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 5, fill: "#b87fa8" }}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            type="natural"
            dataKey="cumBillableFuture"
            stroke="#b87fa8"
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeOpacity={0.4}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
