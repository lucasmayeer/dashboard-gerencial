import { useEffect, useState, useMemo } from "react";
import { Timer, Target, LayoutDashboard, ArrowDown, TrendingUp, CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PainelDoGestorBSA } from "./views/manager/PainelDoGestorBSA";
import { BSAFilterBar } from "@/components/bsa/BSAFilterBar";
import { BSAPageHeader } from "@/components/bsa/BSAPageHeader";
import { BSAKpiCard } from "@/components/bsa/BSAKpiCard";
import { useIsDark } from "@/hooks/useIsDark";
import { useBSAContext } from "@/contexts/BSAContext";
import lucasMayerImg from "@/assets/lucas_mayer.png";
import rodrigoMarbaImg from "@/assets/rodrigo_marba.png";
import { DEFAULT_DAILY_BILLABLE_HOURS } from "@/lib/bsaUtils";
import { useBSAAnalystBadges } from "@/hooks/useBSAAnalystBadges";
import { useBSAChartData } from "@/hooks/useBSAChartData";
import { useBSADailyMetrics } from "@/hooks/useBSADailyMetrics";
import { useBSAKpis } from "@/hooks/useBSAKpis";
import { fmtH } from "./views/BSAShared";
import type { ChartPoint } from "./views/BSAShared";
import { BSABillableChart } from "./views/BSABillableChart";
import { AnalystRightPanel } from "./views/AnalystRightPanel";
import { TeamManagerRightPanel } from "./views/TeamManagerRightPanel";

export function ResumoHorasPage() {
  const { viewMode, analysts, analystsByManager, analystTeamName, loadingAnalysts, selectedAnalyst, selectedTeamLeader, teamNames, selectedMonth } = useBSAContext();

  const [selectedChartAnalyst, setSelectedChartAnalyst] = useState<string | null>(null);
  const [selectedChartTeam,    setSelectedChartTeam]    = useState<string | null>(null);
  const [showPainel, setShowPainel] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const monthLastDay = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  // Reset dia ao trocar mês
  useEffect(() => { setSelectedDay(null); }, [selectedMonth]);

  const badgeName = viewMode === "analyst" ? (selectedAnalyst ?? null) : null;
  const { streakCount, sellerRank, analystRank, rankNeighbors } = useBSAAnalystBadges(badgeName, selectedMonth);
  const { billable, meta, monthRawMeta, monthDiscountHours, monthWorkdays, isOnFerias, isOnRampup } = useBSAKpis({
    viewMode, selectedAnalyst, selectedTeamLeader,
    selectedMonth, refreshKey,
  });

  const { doneToDate, expectedToDate, saldoAcumulado } = useBSADailyMetrics({
    viewMode, selectedAnalyst, selectedTeamLeader,
    selectedMonth, refreshKey, selectedDay,
  });

  // Reset chart filters on team leader / month change
  useEffect(() => {
    setSelectedChartAnalyst(null);
    setSelectedChartTeam(null);
  }, [selectedTeamLeader, selectedMonth]);

  const chartData = useBSAChartData({
    viewMode, selectedAnalyst, selectedTeamLeader,
    selectedChartAnalyst, selectedChartTeam,
    selectedMonth, refreshKey,
  });

  const isDark = useIsDark();
  const noSelection =
    !loadingAnalysts &&
    ((viewMode === "analyst" && !selectedAnalyst) ||
     (viewMode === "team_leader" && !selectedTeamLeader));

  return (
    <div className="space-y-8">

      {/* Heading */}
      <div className="animate-fade-in-delayed stagger-1 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <BSAPageHeader
            isOnFerias={isOnFerias}
            isOnRampup={isOnRampup}
            streakCount={streakCount}
            analystRank={analystRank}
          />
        </div>
        <div className="flex items-center gap-3">
          {viewMode === "manager" && (
            <button
              onClick={() => setShowPainel(true)}
              className="glass-button flex items-center gap-2 h-8 px-3 rounded-xl text-[11px] font-semibold text-foreground/70 hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
              Painel do Gestor
            </button>
          )}
          <Select
            value={selectedDay !== null ? String(selectedDay) : "all"}
            onValueChange={(v) => setSelectedDay(v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="w-[110px] h-8 text-xs glass-button border-0 gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Dia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todo o mês</SelectItem>
              {Array.from({ length: monthLastDay }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)} className="text-xs">Dia {d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <BSAFilterBar />
        </div>
      </div>

      {showPainel && (
        <PainelDoGestorBSA
          onClose={() => setShowPainel(false)}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {noSelection ? (
        <div className="flex items-center justify-center h-48 text-foreground/35 text-sm font-medium">
          Sem dados para o mês
        </div>
      ) : (
      <div className="flex gap-5 items-stretch">

        {/* Coluna esquerda */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">

          {/* 2 KPI cards */}
          <div className="grid grid-cols-2 gap-4">
            <BSAKpiCard
              title={viewMode === "analyst" ? "Seu Ritmo Mensal" : viewMode === "team_leader" ? "Ritmo do Time" : "Ritmo do Departamento"}
              color="#5B899E"
              icon={Timer}
              value={doneToDate !== null ? "" : undefined}
              valueNode={(() => {
                if (doneToDate === null || expectedToDate === null) return undefined;
                const goalMet = expectedToDate > 0 ? doneToDate >= expectedToDate : doneToDate > 0;
                return (
                  <span className="flex items-baseline gap-1.5 leading-none">
                    <span className="font-extrabold tabular-nums" style={{ fontSize: 27, color: "#E4A900" }}>{fmtH(doneToDate)}</span>
                    <span className="font-bold" style={{ fontSize: 23, color: "rgba(150,150,150,0.4)" }}>/</span>
                    <span className="font-extrabold tabular-nums" style={{ fontSize: 37, color: goalMet ? "#E4A900" : "#ef4444" }}>{fmtH(expectedToDate)}</span>
                  </span>
                );
              })()}
              hideBottomGrid
              infoContent={(() => {
                if (doneToDate === null || expectedToDate === null) return undefined;
                const pct        = expectedToDate > 0 ? (doneToDate / expectedToDate) * 100 : 0;
                const saldo      = Math.max(0, expectedToDate - doneToDate);
                const isAhead    = doneToDate >= expectedToDate;
                const subject    = viewMode === "analyst" ? "Você" : viewMode === "team_leader" ? "O time" : "O departamento";
                const titleLabel = viewMode === "analyst" ? "Seu Ritmo Mensal" : viewMode === "team_leader" ? "Ritmo do Time" : "Ritmo do Departamento";
                const cutoffLabel = selectedDay != null ? `até o dia ${selectedDay}` : "até hoje";
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Timer style={{ width: 18, height: 18, color: "#5B899E", flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>{titleLabel}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, opacity: 0.60, lineHeight: 1.6 }}>
                      Compara o total faturado {cutoffLabel} com o esperado no mesmo período do mês.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <div style={{ background: "rgba(91,137,158,0.10)", border: "1px solid rgba(91,137,158,0.20)", borderRadius: 9, padding: "8px 10px" }}>
                        <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>% Atingido</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#5B899E", lineHeight: 1 }}>{pct.toFixed(1)}%</div>
                      </div>
                      <div style={{ background: isAhead ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${isAhead ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`, borderRadius: 9, padding: "8px 10px" }}>
                        <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Saldo acumulado</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: isAhead ? "#22c55e" : "#ef4444", lineHeight: 1 }}>{isAhead ? "—" : fmtH(saldo)}</div>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, opacity: 0.58, lineHeight: 1.6 }}>
                      {isAhead
                        ? <>{subject} está <b style={{ color: "#22c55e" }}>no ritmo</b> — faturado supera o esperado {cutoffLabel}.</>
                        : <>{subject} está <b style={{ color: "#ef4444" }}>{fmtH(saldo)} abaixo do esperado</b> {cutoffLabel} ({pct.toFixed(0)}% atingido).</>
                      }
                    </p>
                  </div>
                );
              })()}
            />
            <BSAKpiCard
              title="Meta Billable"
              color="#714B67"
              icon={Target}
              value={billable !== null && meta !== null ? "" : undefined}
              valueNode={(() => {
                if (billable === null || meta === null) return undefined;
                const goalMet = meta > 0 && billable >= meta;
                return (
                  <span className="flex items-baseline gap-1.5 leading-none">
                    <span className="font-extrabold tabular-nums" style={{ fontSize: 27, color: "#E4A900" }}>{fmtH(billable)}</span>
                    <span className="font-bold" style={{ fontSize: 23, color: "rgba(150,150,150,0.4)" }}>/</span>
                    <span className="font-extrabold tabular-nums" style={{ fontSize: 37, color: goalMet ? "#E4A900" : "#ef4444" }}>{fmtH(meta)}</span>
                  </span>
                );
              })()}
              infoContent={(() => {
                if (billable === null || meta === null) return undefined;
                const pct        = meta > 0 ? (billable / meta) * 100 : 0;
                const acum       = saldoAcumulado ?? 0;
                const mBillableMet  = meta > 0 && billable >= meta;
                const mRowColor  = mBillableMet ? "#22c55e" : "#ef4444";
                const mRowBorder = mBillableMet ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)";
                const resultadoMes = meta - billable;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Target style={{ width: 18, height: 18, color: "#714B67", flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>Meta Billable</span>
                    </div>

                    {/* Texto */}
                    <p style={{ margin: 0, fontSize: 12, opacity: 0.60, lineHeight: 1.6 }}>
                      Total de horas faturadas vs meta mensal. Descontos do gestor já refletidos na meta.
                    </p>

                    {/* Grid 3 cards: % Atingido | Saldo devedor | Meta do mês */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      <div style={{ background: "rgba(91,137,158,0.10)", border: "1px solid rgba(91,137,158,0.20)", borderRadius: 9, padding: "8px 10px" }}>
                        <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>% Atingido</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#5B899E", lineHeight: 1 }}>{pct.toFixed(1)}%</div>
                      </div>
                      <div style={{ background: acum > 0 ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${acum > 0 ? "rgba(239,68,68,0.18)" : "rgba(34,197,94,0.18)"}`, borderRadius: 9, padding: "8px 10px" }}>
                        <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Saldo devedor</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: acum > 0 ? "#ef4444" : "#22c55e", lineHeight: 1 }}>{acum > 0 ? fmtH(acum) : "—"}</div>
                      </div>
                      <div style={{ background: mBillableMet ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${mBillableMet ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)"}`, borderRadius: 9, padding: "8px 10px" }}>
                        <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>Meta do mês</div>
                        <div style={{ fontSize: 11, lineHeight: 1 }}>{mBillableMet ? "✅" : "❌"}</div>
                      </div>
                    </div>

                    {/* Explicação */}
                    <p style={{ margin: 0, fontSize: 11, opacity: 0.58, lineHeight: 1.6 }}>
                      {mBillableMet
                        ? <><b style={{ color: "#714B67" }}>{fmtH(billable)} faturados</b> — meta de {fmtH(meta)} atingida com <b style={{ color: "#22c55e" }}>{fmtH(Math.abs(resultadoMes))} de saldo extra.</b></>
                        : <><b style={{ color: "#714B67" }}>{fmtH(billable)} faturados</b> de uma meta de {fmtH(meta)}. Ainda faltam <b style={{ color: "#714B67" }}>{fmtH(Math.abs(resultadoMes))} para atingir a meta do mês.</b></>
                      }
                    </p>

                    {/* Tabela */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#714B67", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, opacity: 0.8 }}>DETALHAMENTO DOS VALORES</div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                          {(() => {
                            const monthRampupDiscount = Math.max(0, DEFAULT_DAILY_BILLABLE_HOURS * monthWorkdays - (monthRawMeta ?? 0));
                            const hasMonthDiscounts = (isOnRampup && monthRampupDiscount > 0.01) || monthDiscountHours > 0;
                            const rows2 = [
                              { icon: Target, label: "Meta Total do Mês", value: fmtH(meta), valueColor: mRowColor, isTotal: false, isDiscount: false },
                              ...(hasMonthDiscounts ? [{ icon: Target, label: "Meta Padrão", value: fmtH(DEFAULT_DAILY_BILLABLE_HOURS * monthWorkdays), valueColor: "rgba(150,150,150,0.55)", isTotal: false, isDiscount: true }] : []),
                              ...(isOnRampup && monthRampupDiscount > 0.01
                                ? [{ icon: ArrowDown, label: "Desconto Ramp-Up", value: `-${fmtH(monthRampupDiscount)}`, valueColor: "#5B899E", isTotal: false, isDiscount: true }]
                                : []),
                              ...(monthDiscountHours > 0
                                ? [{ icon: ArrowDown, label: "Desconto de Horas", value: `-${fmtH(monthDiscountHours)}`, valueColor: "#b87fa8", isTotal: false, isDiscount: true }]
                                : []),
                              { icon: CalendarDays, label: "Faturado até hoje", value: fmtH(billable), valueColor: mBillableMet ? "#22c55e" : "#E4A900", isTotal: false, isDiscount: false },
                              { icon: TrendingUp, label: "Resultado do Mês", value: (resultadoMes <= 0 ? "-" : "+") + fmtH(Math.abs(resultadoMes)), valueColor: resultadoMes <= 0 ? "#22c55e" : "#ef4444", isTotal: true, isDiscount: false },
                            ] as { icon: any; label: string; value: string; valueColor: string; isTotal: boolean; isDiscount: boolean }[];
                            return rows2.map(({ icon: Ic, label, value, valueColor, isTotal, isDiscount }, i, arr) => {
                              const nextIsDiscount = i < arr.length - 1 && arr[i + 1].isDiscount;
                              const isLastDiscount = isDiscount && (i === arr.length - 1 || !arr[i + 1].isDiscount);
                              const showBorder = i < arr.length - 1 && !isTotal && (!isDiscount || isLastDiscount) && !nextIsDiscount;
                              return (
                                <tr key={i} style={{ borderBottom: showBorder ? "1px solid rgba(128,128,128,0.12)" : "none", borderTop: isTotal ? `1px solid ${resultadoMes <= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` : undefined }}>
                                  <td style={{ padding: isTotal ? "8px 0" : isDiscount ? "3px 0" : "6px 0", paddingRight: 12 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: isDiscount ? 16 : 0 }}>
                                      <Ic style={{ width: 9, height: 9, color: valueColor, opacity: isDiscount ? 0.50 : (isTotal ? 1 : 0.7), flexShrink: 0 }} />
                                      <span style={{ fontSize: isTotal ? 12 : (isDiscount ? 10 : 11), opacity: isTotal ? 0.85 : (isDiscount ? 0.60 : 0.75), fontWeight: isDiscount ? 500 : 700, color: isTotal ? "inherit" : valueColor }}>{label}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: isTotal ? "8px 0" : isDiscount ? "3px 0" : "6px 0", fontSize: isTotal ? 16 : (isDiscount ? 10 : 12), fontWeight: isTotal ? 800 : (isDiscount ? 500 : 700), textAlign: "right", color: valueColor, whiteSpace: "nowrap", opacity: isDiscount ? 0.70 : 1 }}>{value}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>

                  </div>
                );
              })()}
              hideBottomGrid
            />
          </div>

          {/* Gráfico de tendência — todas as views */}
          {chartData.length > 0 && (
            <div className="flex-1 min-h-[280px]">
              {(() => {
                // analystsByTeam derivado de analystTeamName (user → team)
                const analystsByTeam: Record<string, string[]> = {};
                for (const [user, team] of Object.entries(analystTeamName)) {
                  if (!analystsByTeam[team]) analystsByTeam[team] = [];
                  analystsByTeam[team].push(user);
                }

                const isManagerView = viewMode === "manager";
                const teamAnalysts  = isManagerView && selectedChartTeam
                  ? (analystsByTeam[selectedChartTeam] ?? []).sort((a, b) => a.localeCompare(b))
                  : undefined;

                return (
                  <BSABillableChart
                    data={chartData}
                    isDark={isDark}
                    title={
                      viewMode === "analyst"     ? "Sua linha de tendência" :
                      viewMode === "team_leader" ? "Tendência do time"      :
                                                  "Tendência do departamento"
                    }
                    teamOptions={isManagerView ? teamNames : undefined}
                    selectedChartTeam={isManagerView ? selectedChartTeam : undefined}
                    onChartTeamChange={isManagerView ? (v) => {
                      setSelectedChartTeam(v);
                      setSelectedChartAnalyst(null);
                    } : undefined}
                    analystOptions={
                      viewMode === "team_leader" && selectedTeamLeader
                        ? (analystsByManager[selectedTeamLeader] ?? [])
                        : teamAnalysts
                    }
                    selectedChartAnalyst={selectedChartAnalyst}
                    onChartAnalystChange={setSelectedChartAnalyst}
                  />
                );
              })()}
            </div>
          )}


        </div>

        {/* Card lateral direito — condicional por view */}
        {viewMode === "analyst"
          ? <AnalystRightPanel rank={sellerRank} rankNeighbors={rankNeighbors} />
          : <TeamManagerRightPanel />
        }

      </div>
      )}

      {/* Autor */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-[9px] text-muted-foreground/35 font-medium tracking-wider">Criado por:</span>
        <a href="https://www.linkedin.com/in/lucasmayer00" target="_blank" rel="noopener noreferrer" className="no-underline shrink-0">
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-white/10 backdrop-blur-sm transition-[opacity,transform] duration-150 hover:opacity-75 hover:scale-[1.04]"
            style={{ background: "rgba(228, 110, 120, 0.22)" }}
          >
            <img src={lucasMayerImg} alt="Lucas Mayer" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
            <span className="text-[8px] font-medium text-foreground/50 dark:text-white/50 whitespace-nowrap">Lucas Mayer</span>
          </div>
        </a>
        <a href="https://www.linkedin.com/in/rodrigomarba" target="_blank" rel="noopener noreferrer" className="no-underline shrink-0">
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-white/10 backdrop-blur-sm transition-[opacity,transform] duration-150 hover:opacity-75 hover:scale-[1.04]"
            style={{ background: "rgba(228, 169, 0, 0.18)" }}
          >
            <img src={rodrigoMarbaImg} alt="Rodrigo Marba" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
            <span className="text-[8px] font-medium text-foreground/50 dark:text-white/50 whitespace-nowrap">Rodrigo Marba</span>
          </div>
        </a>
      </div>
    </div>
  );
}
