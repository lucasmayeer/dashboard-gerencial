import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPct, pctColor } from "@/lib/directSalesUtils";
import { TeamBadge } from "@/components/direct-sales/TeamBadge";
import { RankIcon } from "@/components/direct-sales/RankIcon";
import { BSAFilterBar } from "@/components/bsa/BSAFilterBar";
import { BSAAnalystTopCard } from "@/components/bsa/BSAAnalystTopCard";
import { useBSAContext } from "@/contexts/BSAContext";
import { useDirectSalesRole } from "@/hooks/useDirectSalesRole";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import { fmtH } from "@/lib/bsaUtils";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface BSAAnalystRow {
  rank: number;
  name: string;
  teamName: string | null;
  horasMeta: number;
  horasAtingido: number;
  horasPct: number;
}

interface BSAPersonRow {
  name: string;
  horasMeta: number;
  horasAtingido: number;
  horasPct: number;
}

interface BSATeamRow {
  rank: number;
  teamName: string;
  managerName: string | null;
  analistas: number;
  horasMeta: number;
  horasAtingido: number;
  horasPct: number;
  people: BSAPersonRow[];
}

const HORAS_BADGE = { bg: "rgba(91,137,158,0.18)", border: "rgba(91,137,158,0.40)", color: "#5B899E" };

// ── Métricas reutilizáveis ────────────────────────────────────────────────────
const HrsMetrics = memo(function HrsMetrics({ meta, atingido, pct }: { meta: number; atingido: number; pct: number }) {
  return (
    <div className="flex items-center gap-2.5 tabular-nums shrink-0">
      <span
        className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase shrink-0 self-center"
        style={{ background: HORAS_BADGE.bg, border: `1px solid ${HORAS_BADGE.border}`, color: HORAS_BADGE.color }}
      >
        HRS
      </span>
      <div className="flex items-end gap-3">
        <div className="flex flex-col items-center gap-0.5 w-[90px]">
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Meta</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtH(meta)}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 w-[90px]">
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Faturado</span>
          <span className="text-[10px] text-foreground whitespace-nowrap">{fmtH(atingido)}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 w-[70px]">
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">%</span>
          <span className={cn("text-[10px] font-bold whitespace-nowrap", pctColor(pct))}>
            {fmtPct(pct)}{pct >= 100 && " 🎉"}
          </span>
        </div>
      </div>
    </div>
  );
});

// ── Linha de analista ─────────────────────────────────────────────────────────
const AnalystRow = memo(function AnalystRow({ data }: { data: BSAAnalystRow }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden hover:ring-1 hover:ring-white/10 transition-all duration-200">
      <div className="w-full flex items-center gap-3 px-6 py-4">
        <span className="text-muted-foreground text-xs font-mono flex items-center justify-center shrink-0 w-[28px]">
          {data.rank <= 3 ? <RankIcon rank={data.rank as 1 | 2 | 3} size={14} /> : `#${data.rank}`}
        </span>
        <span className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{data.name}</span>
          <TeamBadge teamName={data.teamName} />
        </span>
        <HrsMetrics meta={data.horasMeta} atingido={data.horasAtingido} pct={data.horasPct} />
      </div>
    </div>
  );
});

// ── Linha de time expansível ──────────────────────────────────────────────────
const ExpandableTeamRow = memo(function ExpandableTeamRow({
  data, expanded, onToggle, canExpand,
}: { data: BSATeamRow; expanded: boolean; onToggle: () => void; canExpand: boolean }) {
  const headerContent = (
    <>
      <span className="text-muted-foreground shrink-0 w-4">
        {canExpand && (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
      </span>
      <span className="text-muted-foreground text-xs font-mono flex items-center justify-center shrink-0 w-[28px]">
        {data.rank <= 3 ? <RankIcon rank={data.rank as 1 | 2 | 3} size={14} /> : `#${data.rank}`}
      </span>
      <span className="flex items-center gap-2 flex-1 min-w-0 text-left">
        <span className="text-sm font-semibold text-foreground truncate">{data.teamName}</span>
        <span className="text-[10px] text-muted-foreground/45 font-medium tabular-nums shrink-0">
          {data.analistas} {data.analistas === 1 ? "analista" : "analistas"}
        </span>
      </span>
      <HrsMetrics meta={data.horasMeta} atingido={data.horasAtingido} pct={data.horasPct} />
    </>
  );

  return (
    <div className={cn(
      "glass-card rounded-xl overflow-hidden transition-all duration-300",
      canExpand && expanded
        ? "ring-1 ring-white/20 shadow-[0_0_24px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)]"
        : "hover:ring-1 hover:ring-white/10",
    )}>
      {canExpand ? (
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
        >
          {headerContent}
        </button>
      ) : (
        <div className="w-full flex items-center gap-3 px-4 py-4">
          {headerContent}
        </div>
      )}

      {/* Analistas expandidos — só visível quando canExpand */}
      {canExpand && expanded && (
        <div className="border-t border-white/8 bg-white/[0.02]">
          {data.people.map((p, idx) => (
            <div
              key={p.name}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-border/10 last:border-0"
            >
              {/* chevron spacer */}
              <span className="w-4 shrink-0" />
              {/* rank — mesmo w-[28px] do header */}
              <span className="text-[10px] text-muted-foreground font-mono flex items-center justify-center shrink-0 w-[28px]">
                {idx < 3 ? <RankIcon rank={(idx + 1) as 1 | 2 | 3} size={11} /> : `#${idx + 1}`}
              </span>
              {/* nome */}
              <span className="text-xs text-foreground flex-1 min-w-0 truncate text-left">{p.name}</span>
              {/* métricas — espelho exato de HrsMetrics */}
              <div className="flex items-center gap-2.5 tabular-nums shrink-0">
                {/* spacer invisível do badge HRS para alinhar com header */}
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase shrink-0 invisible"
                  style={{ background: HORAS_BADGE.bg, border: `1px solid ${HORAS_BADGE.border}`, color: HORAS_BADGE.color }}
                >
                  HRS
                </span>
                <div className="flex items-end gap-3">
                  <div className="flex flex-col items-center gap-0.5 w-[90px]">
                    <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{fmtH(p.horasMeta)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 w-[90px]">
                    <span className="text-[10px] text-foreground whitespace-nowrap">{fmtH(p.horasAtingido)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 w-[70px]">
                    <span className={cn("text-[10px] font-bold whitespace-nowrap", pctColor(p.horasPct))}>
                      {fmtPct(p.horasPct)}{p.horasPct >= 100 && " 🎉"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ── Página ────────────────────────────────────────────────────────────────────
export function RankingBSAPage() {
  const { selectedMonth, viewMode: bsaViewMode, analystTeamName } = useBSAContext();
  const { dsUser } = useDirectSalesRole();
  const [viewMode, setViewMode] = useState<"analista" | "time">("analista");

  // Analista só expande próprio time; TL/Manager expandem todos
  const canExpandAll = bsaViewMode !== "analyst";
  const myTeamName = dsUser ? (analystTeamName[dsUser.userName] ?? null) : null;
  const canExpandTeam = (teamName: string) => canExpandAll || teamName === myTeamName;
  const [searchQuery, setSearchQuery] = useState("");
  const [analysts, setAnalysts] = useState<BSAAnalystRow[]>([]);
  const [teams, setTeams] = useState<BSATeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(new Map());

  const toggleTeam = useCallback((name: string) =>
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    }), []);

  useEffect(() => {
    let cancelled = false;
    async function fetchRanking() {
      setLoading(true);
      const allRows = await getDummyImplantacaoRows();
      const rows = allRows.filter((r) => r.report_date.startsWith(selectedMonth));

      // ── Analistas ──
      const byUser: Record<string, { billable: number; meta: number; teamName: string | null }> = {};
      for (const r of rows) {
        if (!r.user_name) continue;
        if (!byUser[r.user_name]) byUser[r.user_name] = { billable: 0, meta: 0, teamName: r.team_name || null };
        byUser[r.user_name].billable += r.billable_hours;
        if (!r.skip_record && r.day_type === "BUSINESS DAY") {
          byUser[r.user_name].meta += Math.max(0, r.expected_billable_hours - r.discount_hours);
        }
      }

      const rankedAnalysts: BSAAnalystRow[] = Object.entries(byUser)
        .map(([name, { billable, meta, teamName }]) => ({
          name, teamName,
          horasAtingido: billable,
          horasMeta: meta,
          horasPct: meta > 0 ? (billable / meta) * 100 : 0,
        }))
        .sort((a, b) => b.horasPct - a.horasPct)
        .map((row, i) => ({ ...row, rank: i + 1 }))
        .slice(0, 10);

      // ── Times ──
      const byTeam: Record<string, {
        billable: number;
        meta: number;
        managerName: string | null;
        people: Record<string, { billable: number; meta: number }>;
      }> = {};

      for (const r of rows) {
        if (!r.user_name || !r.team_name) continue;
        if (!byTeam[r.team_name]) byTeam[r.team_name] = { billable: 0, meta: 0, managerName: r.manager_name || null, people: {} };
        byTeam[r.team_name].billable += r.billable_hours;
        if (!r.skip_record && r.day_type === "BUSINESS DAY") {
          byTeam[r.team_name].meta += Math.max(0, r.expected_billable_hours - r.discount_hours);
        }
        if (!byTeam[r.team_name].people[r.user_name]) {
          byTeam[r.team_name].people[r.user_name] = { billable: 0, meta: 0 };
        }
        byTeam[r.team_name].people[r.user_name].billable += r.billable_hours;
        if (!r.skip_record && r.day_type === "BUSINESS DAY") {
          byTeam[r.team_name].people[r.user_name].meta += Math.max(0, r.expected_billable_hours - r.discount_hours);
        }
      }

      const rankedTeams: BSATeamRow[] = Object.entries(byTeam)
        .map(([teamName, { billable, meta, managerName, people }]) => {
          const peopleRows: BSAPersonRow[] = Object.entries(people)
            .map(([name, { billable: b, meta: m }]) => ({
              name,
              horasAtingido: b,
              horasMeta: m,
              horasPct: m > 0 ? (b / m) * 100 : 0,
            }))
            .sort((a, b) => b.horasPct - a.horasPct);
          return {
            teamName,
            managerName,
            analistas: peopleRows.length,
            horasAtingido: billable,
            horasMeta: meta,
            horasPct: meta > 0 ? (billable / meta) * 100 : 0,
            people: peopleRows,
          };
        })
        .sort((a, b) => b.horasPct - a.horasPct)
        .map((row, i) => ({ ...row, rank: i + 1 }))
        .slice(0, 10);

      if (!cancelled) {
        setAnalysts(rankedAnalysts);
        setTeams(rankedTeams);
        setLoading(false);
      }
    }
    fetchRanking();
    return () => { cancelled = true; };
  }, [selectedMonth]);

  const filteredAnalysts = useMemo(
    () => searchQuery
      ? analysts.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : analysts,
    [analysts, searchQuery],
  );

  const filteredTeams = useMemo(
    () => searchQuery
      ? teams.filter((t) => t.teamName.toLowerCase().includes(searchQuery.toLowerCase()))
      : teams,
    [teams, searchQuery],
  );

  return (
    <div className="flex flex-col gap-6">

      {/* Título + controles */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-5xl font-extrabold animate-gradient-text pb-1">Ranking Mensal</h2>
          <p className="text-lg text-muted-foreground mt-3">
            Comparativo do desempenho de times e analistas.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <div className="view-mode-switch h-8 flex items-center px-1">
              <input
                type="checkbox"
                id="bsa-view-mode-toggle"
                checked={viewMode === "analista"}
                onChange={(e) => setViewMode(e.target.checked ? "analista" : "time")}
              />
              <label htmlFor="bsa-view-mode-toggle">
                <span className="switch-prefix">Visualizando por</span>
                <span className="switch-toggletext">
                  <span className="switch-unchecked">Times</span>
                  <span className="switch-checked">Analistas</span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium block mb-1.5 pl-0.5">
              Busca
            </span>
            <div className="glass-filter flex items-center gap-2 px-3 rounded-2xl h-8">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder={viewMode === "time" ? "Time..." : "Analista..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground w-[140px]"
              />
            </div>
          </div>

          <div className="h-8 w-px bg-border/40 mx-1 self-end" />
          <BSAFilterBar hidePictureMode />
        </div>
      </div>

      {/* ── View Analistas ── */}
      {viewMode === "analista" ? (
        <div className="space-y-3">
          {loading ? (
            <>
              <div className="flex items-end justify-center gap-4 pb-2">
                {([2, 1, 3] as const).map((r) => (
                  <div key={r} className={`glass-card rounded-2xl w-64 animate-pulse ${r === 1 ? "h-[260px] mb-10" : "h-[220px]"}`} />
                ))}
              </div>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="glass-card rounded-xl h-[58px] animate-pulse" />
              ))}
            </>
          ) : filteredAnalysts.length > 0 ? (
            <>
              {filteredAnalysts.filter((a) => a.rank <= 3).length > 0 && (
                <div className="flex items-end justify-center gap-4 pb-2">
                  {([2, 1, 3] as const).map((targetRank, i) => {
                    const s = filteredAnalysts.find((a) => a.rank === targetRank);
                    if (!s) return null;
                    return (
                      <div
                        key={s.name}
                        className={`list-item-reveal w-64 shrink-0 ${targetRank === 1 ? "mb-10" : ""}`}
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <BSAAnalystTopCard
                          rank={targetRank}
                          name={s.name}
                          teamName={s.teamName}
                          billable={s.horasAtingido}
                          meta={s.horasMeta}
                          pct={s.horasPct}
                          avatarUrl={avatarMap.get(s.name)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {filteredAnalysts.filter((a) => a.rank > 3).map((a, i) => (
                <div key={a.name} className="list-item-reveal" style={{ animationDelay: `${(i + 3) * 40}ms` }}>
                  <AnalystRow data={a} />
                </div>
              ))}
            </>
          ) : (
            Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="list-item-reveal" style={{ animationDelay: `${i * 40}ms` }}>
                <AnalystRow data={{ rank: i + 1, name: "—", teamName: null, horasMeta: 0, horasAtingido: 0, horasPct: 0 }} />
              </div>
            ))
          )}
        </div>
      ) : (
        /* ── View Times ── */
        <div className="space-y-3">
          {loading ? (
            <>
              <div className="flex items-end justify-center gap-4 pb-2">
                {([2, 1, 3] as const).map((r) => (
                  <div key={r} className={`glass-card rounded-2xl w-64 animate-pulse ${r === 1 ? "h-[260px] mb-10" : "h-[220px]"}`} />
                ))}
              </div>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="glass-card rounded-xl h-[58px] animate-pulse" />
              ))}
            </>
          ) : filteredTeams.length > 0 ? (
            <>
              {filteredTeams.filter((t) => t.rank <= 3).length > 0 && (
                <div className="flex items-end justify-center gap-4 pb-2">
                  {([2, 1, 3] as const).map((targetRank, i) => {
                    const t = filteredTeams.find((x) => x.rank === targetRank);
                    if (!t) return null;
                    return (
                      <div
                        key={t.teamName}
                        className={`list-item-reveal w-64 shrink-0 ${targetRank === 1 ? "mb-10" : ""}`}
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <BSAAnalystTopCard
                          rank={targetRank}
                          name={t.teamName}
                          teamName={`${t.analistas} ${t.analistas === 1 ? "analista" : "analistas"}`}
                          billable={t.horasAtingido}
                          meta={t.horasMeta}
                          pct={t.horasPct}
                          avatarUrl={t.managerName ? avatarMap.get(t.managerName) : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {filteredTeams.filter((t) => t.rank > 3).map((t, i) => (
                <div key={t.teamName} className="list-item-reveal" style={{ animationDelay: `${(i + 3) * 40}ms` }}>
                  <ExpandableTeamRow
                    data={t}
                    expanded={expandedTeams.has(t.teamName)}
                    onToggle={() => toggleTeam(t.teamName)}
                    canExpand={canExpandTeam(t.teamName)}
                  />
                </div>
              ))}
            </>
          ) : (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="list-item-reveal" style={{ animationDelay: `${i * 40}ms` }}>
                <ExpandableTeamRow
                  data={{ rank: i + 1, teamName: "—", managerName: null, analistas: 0, horasMeta: 0, horasAtingido: 0, horasPct: 0, people: [] }}
                  expanded={false}
                  onToggle={() => {}}
                  canExpand={false}
                />
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
