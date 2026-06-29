import type { BSAQuarterData } from "./BSAShared";
import { QUARTER_LABEL, fmtH } from "./BSAShared";

export function BSAQuarterMiniCard({ data }: { data: BSAQuarterData }) {
  const pct = Math.max(0, data.pct);
  const goalMet = pct >= 100;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-1.5">
        <div className="text-center">
          <span className="text-[13px] font-bold text-foreground/75 tracking-wide">
            {QUARTER_LABEL[data.quarter] ?? data.quarter}
          </span>
        </div>

        {data.hasData ? (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[1fr_1px_1fr] gap-0">
              <div className="flex flex-col items-center gap-0.5 pr-2.5">
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-px text-[7px] font-bold tracking-wider uppercase"
                  style={{ background: "rgba(91,137,158,0.15)", border: "1px solid rgba(91,137,158,0.30)", color: "#5B899E" }}
                >
                  Billable
                </span>
                <span className="text-[12px] tabular-nums text-foreground/65 font-medium leading-tight">{fmtH(data.billable)}</span>
              </div>

              <div className="bg-white/8 rounded-full" />

              <div className="flex flex-col items-center gap-0.5 pl-2.5">
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-px text-[7px] font-bold tracking-wider uppercase"
                  style={{ background: "rgba(113,75,103,0.15)", border: "1px solid rgba(113,75,103,0.30)", color: "#b87fa8" }}
                >
                  Meta
                </span>
                <span className="text-[12px] tabular-nums text-foreground/65 font-medium leading-tight">{fmtH(data.meta)}</span>
              </div>
            </div>

            <div className="text-center">
              <span className="text-[13px] font-bold tabular-nums" style={{ color: goalMet ? "#22c55e" : "#E4A900" }}>
                {Math.round(pct)}%
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/25 italic text-center py-0.5">Sem dados</p>
        )}
      </div>
    </div>
  );
}
