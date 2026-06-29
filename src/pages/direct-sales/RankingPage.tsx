import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDummySalesRows } from "@/lib/dummyDataLoader";
import { useDirectSalesContext } from "@/contexts/DirectSalesContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Target,
  Percent,
  Search,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PerspectiveCard } from "@/components/PerspectiveCard";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DirectSalesPageControls } from "@/components/direct-sales/DirectSalesPageControls";
import { SellerTopCard } from "@/components/direct-sales/SellerTopCard";
import {
  MONTH_NAMES,
  MRR_COLOR,
  NRR_COLOR,
  formatMonthLabel,
  fmt,
  fmtPct,
  pctColor,
  resolveTeamPalette,
  TEAM_NAME_FIXED_COLORS,
  TEAM_NAME_FALLBACK_COLORS,
  hashTeamName,
  isOnLeave,
  toMonthKey,
  MRR_BADGE_STYLE,
  NRR_BADGE_STYLE,
} from "@/lib/directSalesUtils";
import {
  parseRow,
  aggregateByManager,
  aggregateRampUpTeam,
  aggregateCompanyTotals,
  aggregateSellersByPlan,
  buildCombinedRanking,
} from "@/lib/rankingUtils";
import type {
  RawCommissionRow,
  CommissionRow,
  PlanType,
  TeamMetrics,
  PersonMetrics,
  CombinedManagerData,
  CombinedSellerData,
} from "@/lib/rankingUtils";
import { RankIcon } from "@/components/direct-sales/RankIcon";
import { StatusBadge } from "@/components/direct-sales/StatusBadge";
import { TeamBadge } from "@/components/direct-sales/TeamBadge";
import { DummyDataBadge } from "@/components/DummyDataBadge";

// monthly ranking scores by % achievement; intentionally differs from HistoricoRankingPage (R$ score)

function sellerRankingScore(mrrPct: number, nrrPct: number): number {
  const media = (mrrPct + nrrPct) / 2;
  return mrrPct >= 100 && nrrPct >= 100 ? 100 + media : media;
}

function buildSellerRanking(rows: CommissionRow[]): CombinedSellerData[] {
  const mrrSellers = aggregateSellersByPlan(rows, "MRR");
  const nrrSellers = aggregateSellersByPlan(rows, "NRR");

  const sellerTeamMap = new Map<string, { teamName: string | null; teamType: string | null }>();
  for (const r of rows) {
    if (r.active === false) continue;
    const name = r.user_name ?? "Sem Nome";
    if (!sellerTeamMap.has(name)) {
      sellerTeamMap.set(name, {
        teamName: r.team_name,
        teamType: r.team_type,
      });
    }
  }

  const allSellers = new Set<string>();
  for (const p of mrrSellers) allSellers.add(p.name);
  for (const p of nrrSellers) allSellers.add(p.name);

  const mrrMap = new Map(mrrSellers.map((p) => [p.name, p]));
  const nrrMap = new Map(nrrSellers.map((p) => [p.name, p]));

  const combined = Array.from(allSellers).map((sellerName) => {
    const teamInfo = sellerTeamMap.get(sellerName);
    return {
      sellerName,
      mrr: mrrMap.get(sellerName) ?? null,
      nrr: nrrMap.get(sellerName) ?? null,
      rank: 0,
      teamName: teamInfo?.teamName ?? null,
      teamType: teamInfo?.teamType ?? null,
    };
  });

  combined.sort((a, b) => {
    const scoreA = sellerRankingScore(a.mrr?.pct ?? 0, a.nrr?.pct ?? 0);
    const scoreB = sellerRankingScore(b.mrr?.pct ?? 0, b.nrr?.pct ?? 0);
    return scoreB - scoreA;
  });

  combined.forEach((d, i) => { d.rank = i + 1; });

  return combined;
}

function TotalCard({
  label, target, achieved, pct, accentColor,
}: {
  label: string;
  target: number;
  achieved: number;
  pct: number;
  accentColor: string;
}) {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: accentColor }} />
        <h3 className="text-lg font-bold text-foreground">{label}</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" /> Meta
          </h2>
          <p className="text-xl font-bold tabular-nums text-foreground">{fmt(target)}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /> Atingido
          </h2>
          <p className="text-xl font-bold tabular-nums text-foreground">{fmt(achieved)}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" /> Atingido
          </h2>
          {/* 🎉 aparece no card geral quando a meta global do plan_type é batida */}
          <p className={cn("text-xl font-bold tabular-nums", pctColor(pct))}>
            {fmtPct(pct)}{pct >= 100 && " 🎉"}
          </p>
        </div>
      </div>

      {/* Barra de progresso capped em 100% (overflow não distorce o visual) */}
      <Progress
        value={Math.min(pct, 100)}
        className="h-2"
        style={{ "--progress-bg": accentColor } as React.CSSProperties}
      />
    </div>
  );
}

function RankingColumnHeader() {
  const subCols = [
    { label: "Meta",     w: 110 },
    { label: "Atingido", w: 110 },
    { label: "%",        w: 90  },
  ] as const;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 mb-1">
      {/* Espelha a área de nome/rank (flex-1) */}
      <div className="w-4 shrink-0" />
      <span className="text-[11px] font-medium text-muted-foreground flex-1 min-w-0 uppercase tracking-wide">
        Time / Colaborador
      </span>

      {/* Grupos de colunas — gap-6 idêntico ao das linhas de dados */}
      <div className="flex items-center gap-6 shrink-0">

        {/* ── MRR ── */}
        <div className="flex flex-col gap-0.5">
          {/* Grupo label centralizado */}
          <div className="flex justify-center mb-0.5" style={{ width: 350 }}>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              MRR
            </span>
          </div>
          {/* Sub-labels individuais, alinhados com cada coluna */}
          <div className="flex items-center gap-5">
            {subCols.map(({ label, w }) => (
              <div key={label} className="flex justify-center" style={{ width: w }}>
                <span className="text-[9px] font-medium text-muted-foreground/45 uppercase tracking-wide whitespace-nowrap">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Separador invisível — mantém o espaçamento do | das linhas de dados */}
        <span className="opacity-0 text-lg select-none">|</span>

        {/* ── NRR ── */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-center mb-0.5" style={{ width: 350 }}>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              NRR
            </span>
          </div>
          <div className="flex items-center gap-5">
            {subCols.map(({ label, w }) => (
              <div key={label} className="flex justify-center" style={{ width: w }}>
                <span className="text-[9px] font-medium text-muted-foreground/45 uppercase tracking-wide whitespace-nowrap">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function CombinedManagerCard({
  data, expanded, onToggle, isRampUpTeam = false, hideTeamSellers = false,
}: {
  data: CombinedManagerData;
  expanded: boolean;
  onToggle: () => void;
  isRampUpTeam?: boolean;
  hideTeamSellers?: boolean;
}) {
  const mrrPct = data.mrr?.pct ?? 0;
  const nrrPct = data.nrr?.pct ?? 0;

  const headerInner = (
    <>
      {!hideTeamSellers && (
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      )}

      {!isRampUpTeam && (
        <span className="flex items-center shrink-0 w-5 justify-center">
          <RankIcon rank={data.rank} size={15} />
        </span>
      )}

      <span className="text-sm font-semibold text-foreground truncate flex-1 min-w-0 text-left">
        {data.teamName ?? data.managerName}
      </span>

      <div className="flex items-center gap-4 tabular-nums shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center rounded-full text-[8px] font-bold tracking-wider uppercase shrink-0 w-[36px] h-[18px]"
            style={MRR_BADGE_STYLE}
          >
            MRR
          </span>
          <div className="flex items-end gap-3">
            <div className="flex flex-col items-center gap-0.5 w-[110px]">
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Meta</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
{fmt(data.mrr?.target ?? 0)}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 w-[110px]">
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Atingido</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-foreground whitespace-nowrap">
{fmt(data.mrr?.achieved ?? 0)}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 w-[80px]">
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">%</span>
              <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap", pctColor(mrrPct))}>
{fmtPct(mrrPct)}{mrrPct >= 100 && " 🎉"}
              </span>
            </div>
          </div>
        </div>

        <span className="text-muted-foreground/20 text-lg self-center">|</span>

        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center rounded-full text-[8px] font-bold tracking-wider uppercase shrink-0 w-[36px] h-[18px]"
            style={NRR_BADGE_STYLE}
          >
            NRR
          </span>
          <div className="flex items-end gap-3">
            <div className="flex flex-col items-center gap-0.5 w-[110px]">
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Meta</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
{fmt(data.nrr?.target ?? 0)}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 w-[110px]">
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Atingido</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-foreground whitespace-nowrap">
{fmt(data.nrr?.achieved ?? 0)}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 w-[80px]">
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">%</span>
              <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap", pctColor(nrrPct))}>
{fmtPct(nrrPct)}{nrrPct >= 100 && " 🎉"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className={cn(
      "glass-card rounded-xl overflow-hidden transition-all duration-300",
      !hideTeamSellers && expanded
        ? "ring-1 ring-white/20 shadow-[0_0_24px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)]"
        : "hover:ring-1 hover:ring-white/10"
    )}>
      {hideTeamSellers ? (
        <div className="w-full flex items-center gap-2 px-4 py-3">
          {headerInner}
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 transition-colors"
        >
          {headerInner}
        </button>
      )}

      {/* ── Linhas dos vendedores (expandido) — oculto para EMPLOYEE ── */}
      {!hideTeamSellers && expanded && (
        <div className="border-t border-white/8 bg-white/[0.02]">
          {(() => {
            const allNames = new Set<string>();
            data.mrr?.people.forEach((p) => allNames.add(p.name));
            data.nrr?.people.forEach((p) => allNames.add(p.name));

            const people = Array.from(allNames)
              .map((name) => {
                const mrr = data.mrr?.people.find((p) => p.name === name);
                const nrr = data.nrr?.people.find((p) => p.name === name);
                return {
                  name,
                  mrr,
                  nrr,
                };
              })
              .sort((a, b) =>
                sellerRankingScore(b.mrr?.pct ?? 0, b.nrr?.pct ?? 0) -
                sellerRankingScore(a.mrr?.pct ?? 0, a.nrr?.pct ?? 0)
              );

            return people.map((p, idx) => {
              const isInativo = p.mrr?.status === "inativo" || p.nrr?.status === "inativo";
              const isFérias = p.mrr?.status === "férias" || p.nrr?.status === "férias";
              const isRampUp = p.mrr?.status === "ramp-up" || p.nrr?.status === "ramp-up";
              // Ramp-up: só exibe target quando atingiu 100% (achieved >= target)
              const mrrShowTarget = isRampUp ? (p.mrr?.pct ?? 0) >= 100 : (!isInativo || (p.mrr?.target ?? 0) > 0);
              const nrrShowTarget = isRampUp ? (p.nrr?.pct ?? 0) >= 100 : (!isInativo || (p.nrr?.target ?? 0) > 0);
              const mrrMetaGeral = p.mrr?.metaGeralAchieved ?? 0;
              const nrrMetaGeral = p.nrr?.metaGeralAchieved ?? 0;
              return (
              <div
                key={p.name}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors border-b border-border/10 last:border-0",
                  isInativo && "opacity-60"
                )}
              >
                <div className="w-4 shrink-0" />

                {/* Ranking do vendedor dentro do time */}
                <span className="text-[10px] text-muted-foreground font-mono w-[18px] shrink-0 flex items-center gap-1.5">
                  {idx + 1 <= 3 ? (
                    <RankIcon rank={idx + 1} size={12} />
                  ) : (
                    `#${idx + 1}`
                  )}
                </span>

                {/* Nome do vendedor + badge de status com tooltip */}
                <span className="flex items-center gap-1.5 flex-1 min-w-0 ml-1.5">
                  <span className={cn("text-xs truncate", isInativo ? "text-muted-foreground" : "text-foreground")}>
                    {p.name}
                  </span>
                  {/* "inativo" tem tooltip próprio dentro do StatusBadge */}
                  {p.mrr?.status === "inativo" && (
                    <StatusBadge status="inativo" />
                  )}
                  {p.mrr?.status && p.mrr.status !== "ativo" && p.mrr.status !== "inativo" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span><StatusBadge status={p.mrr.status} /></span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs font-medium">Meta/Atingido não contabilizado!</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Círculo cinza: valor de férias contabilizado somente para meta geral */}
                  {isFérias && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block h-2 w-2 rounded-full bg-gray-400/70 shrink-0 cursor-default" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs font-medium">o valor contabilizado somente para meta geral</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>

                {/* Métricas individuais: MRR | NRR — espaçador alinha com badge do heading */}
                <div className="flex items-center gap-4 tabular-nums shrink-0">
                  {/* — MRR — */}
                  <div className="flex items-center gap-2.5">
                    {/* Espaçador: mesma largura do badge MRR no heading */}
                    <div className="w-[36px] shrink-0" />
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap w-[110px]">
                        {mrrShowTarget ? fmt(p.mrr?.target ?? 0) : "—"}
                      </span>
                      <span className={cn("inline-flex items-center justify-center gap-1 text-[10px] whitespace-nowrap w-[110px]", isInativo ? "text-muted-foreground" : mrrMetaGeral > 0 ? "text-muted-foreground/60" : "text-foreground")}>
        {fmt(mrrMetaGeral > 0 ? mrrMetaGeral : (p.mrr?.achieved ?? 0))}
                      </span>
                      <span className={cn("inline-flex items-center justify-center gap-1 text-[10px] font-bold whitespace-nowrap w-[80px]", pctColor(p.mrr?.pct ?? 0))}>
        {fmtPct(p.mrr?.pct ?? 0)}
                        {(p.mrr?.pct ?? 0) >= 100 && " 🎉"}
                      </span>
                    </div>
                  </div>

                  <span className="text-muted-foreground/20 text-lg self-center">|</span>

                  {/* — NRR — */}
                  <div className="flex items-center gap-2.5">
                    {/* Espaçador: mesma largura do badge NRR no heading */}
                    <div className="w-[36px] shrink-0" />
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap w-[110px]">
                        {nrrShowTarget ? fmt(p.nrr?.target ?? 0) : "—"}
                      </span>
                      <span className={cn("inline-flex items-center justify-center gap-1 text-[10px] whitespace-nowrap w-[110px]", isInativo ? "text-muted-foreground" : nrrMetaGeral > 0 ? "text-muted-foreground/60" : "text-foreground")}>
        {fmt(nrrMetaGeral > 0 ? nrrMetaGeral : (p.nrr?.achieved ?? 0))}
                      </span>
                      <span className={cn("inline-flex items-center justify-center gap-1 text-[10px] font-bold whitespace-nowrap w-[80px]", pctColor(p.nrr?.pct ?? 0))}>
        {fmtPct(p.nrr?.pct ?? 0)}
                        {(p.nrr?.pct ?? 0) >= 100 && " 🎉"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

function SellerRow({ data }: { data: CombinedSellerData }) {
  const mrrPct = data.mrr?.pct ?? 0;
  const nrrPct = data.nrr?.pct ?? 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden hover:ring-1 hover:ring-white/10 transition-all duration-200">
      <div className="w-full flex items-center gap-3 px-6 py-4">
        {/* Ranking global — ícone para top 3, número para demais */}
        <span className="text-muted-foreground text-xs font-mono flex items-center justify-center shrink-0 w-[28px]">
          {data.rank <= 3 ? (
            <RankIcon rank={data.rank} size={14} />
          ) : (
            `#${data.rank}`
          )}
        </span>

        {/* Nome do vendedor + badge de time */}
        <span className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{data.sellerName}</span>
          <TeamBadge teamName={data.teamName} />
        </span>

        {/* Métricas: MRR | NRR */}
        <div className="flex items-center gap-4 tabular-nums shrink-0">
          {/* — MRR — */}
          <div className="flex items-center gap-2.5">
            {/* Badge MRR */}
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase shrink-0 self-center"
              style={MRR_BADGE_STYLE}
            >
              MRR
            </span>
            <div className="flex items-end gap-3">
              {/* Meta */}
              <div className="flex flex-col items-center gap-0.5 w-[110px]">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Meta</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
  {fmt(data.mrr?.target ?? 0)}
                </span>
              </div>
              {/* Atingido */}
              <div className="flex flex-col items-center gap-0.5 w-[110px]">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Atingido</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-foreground whitespace-nowrap">
  {fmt(data.mrr?.achieved ?? 0)}
                </span>
              </div>
              {/* % */}
              <div className="flex flex-col items-center gap-0.5 w-[80px]">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">%</span>
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap", pctColor(mrrPct))}>
  {fmtPct(mrrPct)}{mrrPct >= 100 && " 🎉"}
                </span>
              </div>
            </div>
          </div>

          <span className="text-muted-foreground/20 text-lg self-center">|</span>

          {/* — NRR — */}
          <div className="flex items-center gap-2.5">
            {/* Badge NRR */}
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase shrink-0 self-center"
              style={NRR_BADGE_STYLE}
            >
              NRR
            </span>
            <div className="flex items-end gap-3">
              {/* Meta */}
              <div className="flex flex-col items-center gap-0.5 w-[110px]">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Meta</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
  {fmt(data.nrr?.target ?? 0)}
                </span>
              </div>
              {/* Atingido */}
              <div className="flex flex-col items-center gap-0.5 w-[110px]">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Atingido</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-foreground whitespace-nowrap">
  {fmt(data.nrr?.achieved ?? 0)}
                </span>
              </div>
              {/* % */}
              <div className="flex flex-col items-center gap-0.5 w-[80px]">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">%</span>
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap", pctColor(nrrPct))}>
  {fmtPct(nrrPct)}{nrrPct >= 100 && " 🎉"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RankingPage() {
  // ── Context de role ──────────────────────────────────────────────────────────
  const { roleLoading, dsUser } = useDirectSalesContext();
  const hideTeamSellers = dsUser?.userRole === "EMPLOYEE";

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);  // re-fetch silencioso (já tem dados)
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");      // formato "YYYY-MM"
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"time" | "vendedor">("vendedor");
  const [sellerPage, setSellerPage] = useState(1);
  const SELLER_PAGE_SIZE = 10;
  // displayMode é o que está realmente renderizado — fica atrás do viewMode
  // durante a transição de saída (180 ms) para permitir o fade-out suave.
  const [displayMode, setDisplayMode] = useState<"time" | "vendedor">("vendedor");
  const [exiting, setExiting] = useState(false);

  // Detecta ?animation=true na URL → modo TV (alterna views a cada 60s)
  const isAnimationMode = useMemo(() => {
    return new URLSearchParams(window.location.search).get("animation") === "true";
  }, []);

  // Ref para distinguir carga inicial (spinner grande) de re-fetch (spinner pequeno)
  const hasFetchedOnce = useRef(false);
  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(new Map());

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (roleLoading) return;
    let cancelled = false;

    async function load() {
      setFetchError(null);
      if (!hasFetchedOnce.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      if (cancelled) return;

      const allRows = await getDummySalesRows();
      setRows(allRows.map((r) => parseRow(r as unknown as RawCommissionRow)));

      hasFetchedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, roleLoading]);

  // ── Filtro de período ────────────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rows) keys.add(toMonthKey(r.date_from));
    // "YYYY-MM" ordena lexicograficamente de forma correta (ex: "2026-01" > "2025-12")
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Linhas filtradas pelo mês selecionado (ignora o dia — só MM/YYYY)
  const filteredRows = useMemo(() => {
    if (!selectedMonth) return rows;
    return rows.filter((r) => toMonthKey(r.date_from) === selectedMonth);
  }, [rows, selectedMonth]);

  // ── Cálculos ─────────────────────────────────────────────────────────────────

  // Métricas por time separadas por plan_type (exclui ramp-up — vão para time virtual)
  const mrrByManager = useMemo(() => aggregateByManager(filteredRows, "MRR"), [filteredRows]);
  const nrrByManager = useMemo(() => aggregateByManager(filteredRows, "NRR"), [filteredRows]);

  // Time virtual Ramp-up (separado do ranking principal)
  const mrrRampUp = useMemo(() => aggregateRampUpTeam(filteredRows, "MRR"), [filteredRows]);
  const nrrRampUp = useMemo(() => aggregateRampUpTeam(filteredRows, "NRR"), [filteredRows]);
  const hasRampUp = mrrRampUp !== null || nrrRampUp !== null;

  // bracket expandível pelo employee: o time do seu manager, ou "Ramp-up" se ele está lá
  const employeeExpandableBracket = useMemo(() => {
    if (dsUser?.userRole !== "EMPLOYEE") return null;
    const inRampUp =
      mrrRampUp?.people.some((p) => p.name === dsUser.userName) ||
      nrrRampUp?.people.some((p) => p.name === dsUser.userName);
    return inRampUp ? "Ramp-up" : (dsUser.managerName ?? null);
  }, [dsUser, mrrRampUp, nrrRampUp]);

  // Totais gerais da empresa:
  //   target  = apenas membros ativos (skip_record=FALSE)
  //   achieved = todos os membros (ativos + ramp-up + férias), clamped a 0
  const mrrTotals = useMemo(() => aggregateCompanyTotals(filteredRows, "MRR"), [filteredRows]);
  const nrrTotals = useMemo(() => aggregateCompanyTotals(filteredRows, "NRR"), [filteredRows]);

  // Lista de times combinada (MRR+NRR) com ranking aplicado
  const combinedManagersRaw = useMemo(
    () => buildCombinedRanking(filteredRows),
    [filteredRows]
  );

  // Aplica filtro de busca por nome (gerente ou vendedor)
  const combinedManagers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return combinedManagersRaw;

    return combinedManagersRaw
      .map((d) => {
        // Se o nome do gerente bate → mostra o card inteiro
        if (d.managerName.toLowerCase().includes(q)) return d;

        // Se não, filtra apenas os vendedores que batem
        const filterPeople = (people: PersonMetrics[]) =>
          people.filter((p) => p.name.toLowerCase().includes(q));

        const mrrPeople = d.mrr ? filterPeople(d.mrr.people) : [];
        const nrrPeople = d.nrr ? filterPeople(d.nrr.people) : [];

        // Nenhum vendedor bateu → oculta o time inteiro
        if (mrrPeople.length === 0 && nrrPeople.length === 0) return null;

        return {
          ...d,
          mrr: d.mrr ? { ...d.mrr, people: mrrPeople } : null,
          nrr: d.nrr ? { ...d.nrr, people: nrrPeople } : null,
        };
      })
      .filter((d): d is CombinedManagerData => d !== null);
  }, [combinedManagersRaw, searchQuery]);

  // Ranking global de vendedores (cross-team)
  const sellersRaw = useMemo(
    () => buildSellerRanking(filteredRows),
    [filteredRows]
  );

  // Aplica filtro de busca ao ranking de vendedores
  const filteredSellers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sellersRaw;
    return sellersRaw.filter((s) => s.sellerName.toLowerCase().includes(q));
  }, [sellersRaw, searchQuery]);

  // Reseta página ao mudar busca ou mês
  useEffect(() => { setSellerPage(1); }, [searchQuery, selectedMonth]);

  // Vendedores da página atual
  const pagedSellers = useMemo(() => {
    const start = (sellerPage - 1) * SELLER_PAGE_SIZE;
    return filteredSellers.slice(start, start + SELLER_PAGE_SIZE);
  }, [filteredSellers, sellerPage, SELLER_PAGE_SIZE]);

  const totalSellerPages = Math.ceil(filteredSellers.length / SELLER_PAGE_SIZE);

  // ── Toggle expand/collapse ────────────────────────────────────────────────────
  const toggleManager = useCallback((managerName: string) => {
    setExpandedManagers((prev) => {
      const next = new Set(prev);
      if (next.has(managerName)) next.delete(managerName);
      else next.add(managerName);
      return next;
    });
  }, []);

  // ── Transição suave ao mudar viewMode ────────────────────────────────────────
  useEffect(() => {
    if (viewMode === displayMode) return;
    setExiting(true);
    const t = setTimeout(() => {
      setDisplayMode(viewMode);
      setExiting(false);
    }, 180);
    return () => clearTimeout(t);
  }, [viewMode, displayMode]);

  // ── Modo TV (?animation=true) — alterna times/vendedores a cada 60 s ─────────
  // O switch de viewMode já aciona o re-fetch acima, mantendo os dados sempre frescos.
  useEffect(() => {
    if (!isAnimationMode) return;
    const id = setInterval(() => {
      setViewMode((v) => (v === "time" ? "vendedor" : "time"));
    }, 60_000);
    return () => clearInterval(id);
  }, [isAnimationMode]);

  // Wake Lock: impede a tela de apagar quando no modo TV
  useEffect(() => {
    if (!isAnimationMode) return;
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;

    async function acquire() {
      try {
        lock = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request("screen");
      } catch {
        // ignorado: permissão negada ou API indisponível
      }
    }

    acquire();
    // Reaquire se o documento voltar ao foco (Wake Lock é liberado ao minimizar)
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release();
    };
  }, [isAnimationMode]);

  // ── Render states ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-[hsl(var(--kpi-down))]" />
        <p className="text-sm font-semibold text-foreground">Erro ao carregar dados</p>
        <p className="text-xs text-muted-foreground max-w-sm">{fetchError}</p>
      </div>
    );
  }

  // ── UI principal ─────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-6">

        {/* Controles: sync, theme, view — acima do título */}
        <DirectSalesPageControls />

        {/* HEADER: título + controles de filtro e busca */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-5xl font-extrabold animate-gradient-text pb-1">Ranking Mensal</h2>
              {/* Badge modo TV */}
              {isAnimationMode && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/25 self-center mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" />
                  Modo TV
                </span>
              )}
            </div>
            <DummyDataBadge className="mb-1" />
            <p className="text-lg text-muted-foreground mt-3">
              Comparativo do desempenho de times e vendedores.
            </p>
            {refreshing && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/60">
                <span className="h-3 w-3 animate-spin rounded-full border border-muted-foreground/40 border-t-transparent inline-block" />
                atualizando...
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">

            {/* ── Grupo: Visualização + Busca ── */}
            <div className="flex items-end gap-2">

              {/* Toggle: Visualização Por — switch estilo checkbox */}
              <div>
                <div className="view-mode-switch h-8 flex items-center px-1">
                  <input
                    type="checkbox"
                    id="view-mode-toggle"
                    checked={viewMode === "vendedor"}
                    onChange={(e) => setViewMode(e.target.checked ? "vendedor" : "time")}
                  />
                  <label htmlFor="view-mode-toggle">
                    <span className="switch-prefix">Visualizando por</span>
                    <span className="switch-toggletext">
                      <span className="switch-unchecked">Times</span>
                      <span className="switch-checked">Vendedores</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Busca */}
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium block mb-1.5 pl-0.5">
                  Busca
                </span>
                <div className="glass-filter flex items-center gap-2 px-3 rounded-2xl h-8">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder={viewMode === "time" ? "Gerente ou vendedor..." : "Vendedor..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground w-[160px]"
                  />
                </div>
              </div>
            </div>

            {/* ── Separador vertical ── */}
            <div className="h-8 w-px bg-border/40 mx-1 self-end" />

            {/* ── Período ── */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium block mb-1.5 pl-0.5">
                Período
              </span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[185px] h-8 text-xs glass-button border-0 gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {formatMonthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            Nenhum dado encontrado para o período selecionado.
          </p>
        ) : (
          <>
            {/* LISTA — wrapper com fade-out/in ao trocar visualização */}
            <div
              className="transition-[opacity,transform] duration-[180ms] ease-in"
              style={{
                opacity: exiting ? 0 : 1,
                transform: exiting ? "translateY(-8px)" : "translateY(0)",
              }}
            >
              {displayMode === "time" ? (
                combinedManagers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sem resultados para a busca.
                  </p>
                ) : (
                  // key=displayMode força remount ao trocar view, reiniciando as animações CSS
                  <div key="time-view" className="space-y-8">
                    {(() => {
                      let cardIndex = 0;
                      const groups = (
                        [
                          { key: "1-5", label: "Direct Sales BR: 1–5" },
                          { key: "5+", label: "Direct Sales BR: 5–50" },
                        ] as const
                      ).map(({ key, label }) => {
                        const group = combinedManagers.filter((d) => d.teamType === key);
                        if (group.length === 0) return null;
                        const dot = resolveTeamPalette(key).dot;
                        return (
                          <div key={key} className="space-y-3">
                            <h1
                              className="list-item-reveal text-sm font-bold uppercase tracking-widest text-foreground px-1 border-b border-border/25 pb-3 flex items-center gap-2.5"
                              style={{ animationDelay: `${cardIndex++ * 40}ms` }}
                            >
                              <span className="w-[3px] h-4 rounded-full inline-block shrink-0" style={{ backgroundColor: dot }} />
                              {label}
                            </h1>
                            {group.map((d) => (
                              <div
                                key={d.managerName}
                                className="list-item-reveal"
                                style={{ animationDelay: `${cardIndex++ * 40}ms` }}
                              >
                                <CombinedManagerCard
                                  data={d}
                                  expanded={expandedManagers.has(d.managerName)}
                                  onToggle={() => toggleManager(d.managerName)}
                                  hideTeamSellers={hideTeamSellers && d.managerName !== employeeExpandableBracket}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      });

                      const others = combinedManagers.filter((d) => d.teamType !== "5+" && d.teamType !== "1-5");
                      const othersGroup = others.length > 0 ? (
                        <div key="outros" className="space-y-3">
                          <h1
                            className="list-item-reveal text-sm font-bold uppercase tracking-widest text-foreground px-1 border-b border-border/25 pb-3 flex items-center gap-2.5"
                            style={{ animationDelay: `${cardIndex++ * 40}ms` }}
                          >
                            <span className="w-[3px] h-4 rounded-full inline-block shrink-0" style={{ backgroundColor: resolveTeamPalette("outbound").dot }} />
                            Direct Sales BR: Outbound
                          </h1>
                          {others.map((d) => (
                            <div
                              key={d.managerName}
                              className="list-item-reveal"
                              style={{ animationDelay: `${cardIndex++ * 40}ms` }}
                            >
                              <CombinedManagerCard
                                data={d}
                                expanded={expandedManagers.has(d.managerName)}
                                onToggle={() => toggleManager(d.managerName)}
                                hideTeamSellers={hideTeamSellers && d.managerName !== employeeExpandableBracket}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null;

                      const rampUpGroup = hasRampUp ? (
                        <div key="ramp-up" className="space-y-3">
                          <h1
                            className="list-item-reveal text-sm font-bold uppercase tracking-widest text-foreground px-1 border-b border-border/25 pb-3 flex items-center gap-2.5"
                            style={{ animationDelay: `${cardIndex++ * 40}ms` }}
                          >
                            <span className="w-[3px] h-4 rounded-full bg-blue-500 inline-block shrink-0" />
                            Direct Sales BR: Ramp-Up
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-default">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p className="text-xs font-medium">Meta/Atingido não contabilizado!</p>
                              </TooltipContent>
                            </Tooltip>
                          </h1>
                          {(mrrRampUp || nrrRampUp) && (() => {
                            const rampUpData: CombinedManagerData = {
                              managerName: "Ramp-up",
                              teamType: null,
                              teamName: null,
                              mrr: mrrRampUp ?? null,
                              nrr: nrrRampUp ?? null,
                              rank: 0,
                            };
                            return (
                              <div className="list-item-reveal" style={{ animationDelay: `${cardIndex++ * 40}ms` }}>
                                <CombinedManagerCard
                                  data={rampUpData}
                                  expanded={expandedManagers.has("Ramp-up")}
                                  onToggle={() => toggleManager("Ramp-up")}
                                  isRampUpTeam
                                  hideTeamSellers={hideTeamSellers && "Ramp-up" !== employeeExpandableBracket}
                                />
                              </div>
                            );
                          })()}
                        </div>
                      ) : null;

                      return [...groups, othersGroup, rampUpGroup];
                    })()}
                  </div>
                )
              ) : (
                filteredSellers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sem resultados para a busca.
                  </p>
                ) : (
                  <div key="seller-view" className="space-y-3">
                    {/* ── Top 3: cards de destaque (só na página 1, só se o rank for ≤ 3) ── */}
                    {sellerPage === 1 && pagedSellers.some((s) => s.rank <= 3) && (
                      <div className="flex items-end justify-center gap-4 pb-2">
                        {([2, 1, 3] as const)
                          .map((targetRank, i) => {
                            const s = pagedSellers.find((x) => x.rank === targetRank);
                            if (!s) return null;
                            return (
                              <div
                                key={s.sellerName}
                                className={`list-item-reveal w-72 shrink-0 ${targetRank === 1 ? "mb-12" : ""}`}
                                style={{ animationDelay: `${i * 80}ms` }}
                              >
                                <SellerTopCard
                                  rank={s.rank as 1 | 2 | 3}
                                  name={s.sellerName}
                                  teamName={s.teamName}
                                  mrrAchieved={s.mrr?.achieved ?? 0}
                                  mrrTarget={s.mrr?.target ?? 0}
                                  mrrPct={s.mrr?.pct ?? 0}
                                  nrrAchieved={s.nrr?.achieved ?? 0}
                                  nrrTarget={s.nrr?.target ?? 0}
                                  nrrPct={s.nrr?.pct ?? 0}
                                  avatarUrl={avatarMap.get(s.sellerName)}
                                />
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* ── Demais vendedores como linhas ── */}
                    {pagedSellers
                      .filter((s) => !(sellerPage === 1 && s.rank <= 3))
                      .map((s, i) => (
                        <div
                          key={s.sellerName}
                          className="list-item-reveal"
                          style={{ animationDelay: `${(i + (sellerPage === 1 ? 3 : 0)) * 40}ms` }}
                        >
                          <SellerRow data={s} />
                        </div>
                      ))}

                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
