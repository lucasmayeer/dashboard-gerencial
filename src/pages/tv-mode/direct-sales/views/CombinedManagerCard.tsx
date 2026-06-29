import { cn } from "@/lib/utils";
import { fmt, fmtPct, pctColor, resolveTeamPalette, MRR_BADGE_STYLE, NRR_BADGE_STYLE } from "@/lib/directSalesUtils";
import { RankIcon } from "@/components/direct-sales/RankIcon";
import type { CombinedManagerData } from "@/lib/previaUtils";

export function CombinedManagerCard({
  data, isRampUpTeam = false,
}: {
  data: CombinedManagerData;
  isRampUpTeam?: boolean;
}) {
  const mrrPct = data.mrr?.pct ?? 0;
  const nrrPct = data.nrr?.pct ?? 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden transition-all duration-300 hover:ring-1 hover:ring-white/10">
      <div className="w-full flex items-center gap-3 px-5 py-4">

        {!isRampUpTeam && (
          <span className="text-muted-foreground text-sm font-mono flex items-center justify-center shrink-0 w-[32px]">
            {data.rank <= 3 ? (
              <RankIcon rank={data.rank} size={18} />
            ) : (
              `#${data.rank}`
            )}
          </span>
        )}

        <span className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <span className="text-base font-semibold text-foreground truncate min-w-0">
            {data.teamName ?? data.managerName}
          </span>
          {!isRampUpTeam && data.teamType && (() => {
            const p = resolveTeamPalette(data.teamType);
            return (
              <span
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
                style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.text }}
              >
                {data.teamType.toUpperCase()}
              </span>
            );
          })()}
        </span>

        <div className="flex items-center gap-5 tabular-nums shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center rounded-full text-[11px] font-bold tracking-wider uppercase shrink-0 w-[44px] h-[22px]"
              style={MRR_BADGE_STYLE}
            >
              MRR
            </span>
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-center gap-0.5 w-[130px]">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-medium">Meta</span>
                <span className="text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">
                  {fmt(data.mrr?.target ?? 0)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 w-[130px]">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-medium">Atingido</span>
                <span className="text-[13px] text-foreground whitespace-nowrap tabular-nums">
                  {fmt(data.mrr?.achieved ?? 0)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 w-[95px]">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-medium">%</span>
                <span className={cn("text-[13px] font-bold whitespace-nowrap tabular-nums", pctColor(mrrPct))}>
                  {fmtPct(mrrPct)}{mrrPct >= 100 && " 🎉"}
                </span>
              </div>
            </div>
          </div>

          <span className="text-muted-foreground/20 text-xl self-center">|</span>

          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center rounded-full text-[11px] font-bold tracking-wider uppercase shrink-0 w-[44px] h-[22px]"
              style={NRR_BADGE_STYLE}
            >
              NRR
            </span>
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-center gap-0.5 w-[130px]">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-medium">Meta</span>
                <span className="text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">
                  {fmt(data.nrr?.target ?? 0)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 w-[130px]">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-medium">Atingido</span>
                <span className="text-[13px] text-foreground whitespace-nowrap tabular-nums">
                  {fmt(data.nrr?.achieved ?? 0)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 w-[95px]">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/45 font-medium">%</span>
                <span className={cn("text-[13px] font-bold whitespace-nowrap tabular-nums", pctColor(nrrPct))}>
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
