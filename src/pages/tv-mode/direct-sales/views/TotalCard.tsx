import { Target, TrendingUp, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { fmt, fmtPct, pctColor } from "@/lib/directSalesUtils";

export function TotalCard({
  label, target, achieved, pct, accentColor,
}: {
  label: string;
  target: number;
  achieved: number;
  pct: number;
  accentColor: string;
}) {
  return (
    <div className="flex-1 space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: accentColor }} />
        <h3 className="text-xl font-bold text-foreground">{label}</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
            <Target className="h-4 w-4 text-muted-foreground" /> Meta
          </h2>
          <p className="text-2xl font-bold tabular-nums text-foreground">{fmt(target)}</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> Atingido
          </h2>
          <p className="text-2xl font-bold tabular-nums text-foreground">{fmt(achieved)}</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
            <Percent className="h-4 w-4 text-muted-foreground" /> Atingido
          </h2>
          <p className={cn("text-2xl font-bold tabular-nums", pctColor(pct))}>
            {fmtPct(pct)}{pct >= 100 && " 🎉"}
          </p>
        </div>
      </div>

      <Progress
        value={Math.min(pct, 100)}
        className="h-2.5"
        style={{ "--progress-bg": accentColor } as React.CSSProperties}
      />
    </div>
  );
}
